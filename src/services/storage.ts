/**
 * SECURE STORAGE: WINDOWS CREDENTIAL MANAGER (PRIMARY) · ENCRYPTED LOCAL STORAGE (FALLBACK)
 *
 * Phase 2A.1 — the credential store now has two backends behind one small
 * `CredentialStore` surface, so callers never know which one is active:
 *
 * 1. os-keychain (PRIMARY): Windows Credential Manager via the maintained
 *    `keyring` crate, exposed through three minimal Tauri commands
 *    (credential_get / credential_set / credential_delete, see
 *    src-tauri/src/lib.rs). The OS protects the secret; nothing reversible is
 *    kept in WebView storage.
 *
 * 2. encrypted-local-storage (FALLBACK): the previous AES-GCM/PBKDF2
 *    localStorage scheme. Used only when the Tauri bridge is absent (e.g.
 *    opening the app in a plain browser during development).
 *
 * SECURITY AUDIT (fallback, unchanged): the fallback's encryption key is
 * derived from bundle constants, so it protects against casual inspection
 * (DevTools, stray backups, plaintext greps) but is NOT equivalent to OS-level
 * credential storage. It is never used when the OS keychain is available.
 *
 * MIGRATION: legacy fallback credentials are transparently migrated to the OS
 * keychain on startup (see migrateLegacyCredentials) and then removed from
 * localStorage. Secrets are never logged, never displayed, and never placed in
 * URLs.
 */

export type CredentialStoreBackend = 'os-keychain' | 'encrypted-local-storage';

export interface CredentialStore {
  backend: CredentialStoreBackend;
  /** Persist a secret for a provider. */
  set(providerId: string, secret: string): Promise<void>;
  /** Retrieve the stored secret, or null when not present. */
  get(providerId: string): Promise<string | null>;
  /** Remove a stored secret. */
  delete(providerId: string): Promise<void>;
  /** True when a secret exists for the provider. */
  has(providerId: string): Promise<boolean>;
  /** Remove every stored secret (dangerous - use sparingly). */
  clearAll(): Promise<void>;
}

/**
 * The active credential backend, detected once at module load:
 * the Tauri bridge (window.__TAURI__, enabled via `withGlobalTauri`) means the
 * app runs as the installed desktop application and can use the OS keychain.
 */
export const credentialStoreBackend: CredentialStoreBackend = getTauriInvoke()
  ? 'os-keychain'
  : 'encrypted-local-storage';

export function getCredentialStoreLabel(): string {
  return credentialStoreBackend === 'os-keychain'
    ? 'Windows Credential Manager (OS keychain)'
    : 'Encrypted local storage (fallback)';
}

type TauriInvoke = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface TauriGlobal {
  core?: { invoke?: TauriInvoke };
}

declare global {
  interface Window {
    __TAURI__?: TauriGlobal;
  }
}

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') return null;
  const invoke = window.__TAURI__?.core?.invoke;
  return typeof invoke === 'function' ? invoke : null;
}

const tauriInvoke = getTauriInvoke();

/** Must match SERVICE in src-tauri/src/lib.rs. */
const SERVICE_ACCOUNT_VALIDATION = /^[a-z][a-z0-9-]{0,63}$/;
/** Must match MAX_SECRET_LEN in src-tauri/src/lib.rs. */
const MAX_SECRET_LEN = 4096;

const STORAGE_PREFIX = 'jarvex-key-';
const SALT = 'jarvex-ai-command-center-salt-v1';
const APP_ID = 'in.jarvex.ai';

function isProviderIdValid(providerId: string): boolean {
  return SERVICE_ACCOUNT_VALIDATION.test(providerId);
}

/* ------------------------------------------------------------------ */
/* OS keychain backend (Windows Credential Manager via Tauri commands) */
/* ------------------------------------------------------------------ */

async function osSetSecret(providerId: string, secret: string): Promise<void> {
  await tauriInvoke!('credential_set', { account: providerId, secret });
}

async function osGetSecret(providerId: string): Promise<string | null> {
  const result = await tauriInvoke!('credential_get', { account: providerId });
  return typeof result === 'string' ? result : null;
}

async function osDeleteSecret(providerId: string): Promise<void> {
  await tauriInvoke!('credential_delete', { account: providerId });
}

/* ------------------------------------------------------------------ */
/* Fallback backend: AES-GCM encrypted localStorage (internal only) */
/* ------------------------------------------------------------------ */

function getStorageKey(providerId: string): string {
  return `${STORAGE_PREFIX}${providerId}`;
}

async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_ID),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Payload shape persisted by the fallback backend (iv + ciphertext). */
interface EncryptedPayload {
  iv: string;
  data: string;
}

function fallbackSet(providerId: string, secret: string): Promise<void> {
  return (async () => {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(secret),
    );
    const payload: EncryptedPayload = {
      iv: arrayBufferToBase64(iv.buffer),
      data: arrayBufferToBase64(ciphertext),
    };
    localStorage.setItem(getStorageKey(providerId), JSON.stringify(payload));
  })();
}

async function fallbackGet(providerId: string): Promise<string | null> {
  const raw = localStorage.getItem(getStorageKey(providerId));
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as EncryptedPayload;
    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(payload.iv)) },
      key,
      base64ToArrayBuffer(payload.data),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Corrupt or undecryptable entry — treat as absent, never surface errors.
    return null;
  }
}

function fallbackHas(providerId: string): boolean {
  return localStorage.getItem(getStorageKey(providerId)) !== null;
}

function fallbackDelete(providerId: string): void {
  localStorage.removeItem(getStorageKey(providerId));
}

function fallbackClearAll(): void {
  for (const providerId of collectLegacyProviderIds()) {
    fallbackDelete(providerId);
  }
}

export async function saveApiKey(
  providerId: string,
  apiKey: string,
): Promise<void> {
  if (!apiKey) {
    throw new Error('API key cannot be empty');
  }
  if (!isProviderIdValid(providerId)) {
    throw new Error('Invalid provider identifier');
  }
  if (apiKey.length > MAX_SECRET_LEN) {
    throw new Error('API key exceeds the maximum supported length');
  }

  if (tauriInvoke) {
    await osSetSecret(providerId, apiKey);
    return;
  }

  await fallbackSet(providerId, apiKey);
}

export async function getApiKey(providerId: string): Promise<string | null> {
  if (!isProviderIdValid(providerId)) {
    return null;
  }

  if (tauriInvoke) {
    try {
      const secret = await osGetSecret(providerId);
      if (secret !== null) {
        return secret;
      }
    } catch {
      // OS store unavailable — fall through to the legacy encrypted storage.
    }
  }

  return fallbackGet(providerId);
}

export async function deleteApiKey(providerId: string): Promise<void> {
  if (!isProviderIdValid(providerId)) {
    return;
  }

  if (tauriInvoke) {
    try {
      await osDeleteSecret(providerId);
    } catch {
      // Best effort — the legacy copy below is still removed.
    }
  }
  fallbackDelete(providerId);
}

export async function hasApiKey(providerId: string): Promise<boolean> {
  if (!isProviderIdValid(providerId)) {
    return false;
  }

  if (tauriInvoke) {
    try {
      if ((await osGetSecret(providerId)) !== null) {
        return true;
      }
    } catch {
      // Fall through to the legacy encrypted storage.
    }
  }

  return fallbackHas(providerId);
}

function collectLegacyProviderIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      ids.push(key.slice(STORAGE_PREFIX.length));
    }
  }
  return ids;
}

export async function clearAllApiKeys(): Promise<void> {
  if (tauriInvoke) {
    for (const providerId of collectLegacyProviderIds()) {
      try {
        await osDeleteSecret(providerId);
      } catch {
        // Best effort.
      }
    }
  }
  fallbackClearAll();
}

/**
 * One-time migration: move credentials stored in the legacy encrypted
 * localStorage fallback into the OS keychain, then delete the legacy copies.
 * Secrets are never logged or exposed; on failure the legacy entry is kept.
 *
 * Returns the number of credentials migrated.
 */
export async function migrateLegacyCredentials(): Promise<number> {
  if (!tauriInvoke) {
    return 0;
  }

  let migrated = 0;
  for (const providerId of collectLegacyProviderIds()) {
    if (!isProviderIdValid(providerId)) {
      continue;
    }
    try {
      if ((await osGetSecret(providerId)) !== null) {
        // Already present in the OS store — just clean up the legacy copy.
        fallbackDelete(providerId);
        continue;
      }

      const secret = await fallbackGet(providerId);
      if (!secret) {
        fallbackDelete(providerId);
        continue;
      }

      await osSetSecret(providerId, secret);
      fallbackDelete(providerId);
      migrated += 1;
    } catch {
      // Leave the legacy entry untouched so a later attempt can retry.
    }
  }
  return migrated;
}

/**
 * The active credential store implementation.
 *
 * Delegates to the dual-backend functions above: the Windows OS credential
 * store (Windows Credential Manager) when the Tauri bridge is present, the
 * AES-GCM encrypted localStorage fallback otherwise.
 */
export const credentialStore: CredentialStore = {
  backend: credentialStoreBackend,
  set: saveApiKey,
  get: getApiKey,
  delete: deleteApiKey,
  has: hasApiKey,
  clearAll: clearAllApiKeys,
};
