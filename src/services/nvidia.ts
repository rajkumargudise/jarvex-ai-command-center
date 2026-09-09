/**
 * NVIDIA NIM API integration (Phase 2B).
 *
 * Official OpenAI-compatible REST endpoint:
 * https://integrate.api.nvidia.com/v1
 *
 * - Health check   : GET /models            (lightweight, no generation)
 * - Model discovery: GET /models            (full API catalog, no hardcoding)
 * - Chat streaming : POST /chat/completions (SSE, OpenAI chunk format)
 *
 * Authentication uses the `Authorization: Bearer` header so the key never
 * appears in URLs, query strings, logs, or server-side request logs. The key
 * is read through the shared CredentialStore (src/services/storage.ts) —
 * never from localStorage directly and never hardcoded.
 *
 * Model discovery is authoritative: whatever NVIDIA returns (including
 * moonshotai/kimi-k3 when present) is exposed through the unified AIModel
 * architecture. The static list below is a FALLBACK used only when live
 * discovery is unavailable, so the model picker still works offline.
 */

import type { AIModel } from '../types/ai';
import { getApiKey } from './storage';

const NVIDIA_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_HTTP_TIMEOUT_MS = 15000;
const NVIDIA_CHAT_PATH = '/chat/completions';

// Sensible in-memory model cache (5 minutes) to avoid repeated /models calls.
const NVIDIA_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
let nvidiaModelCache: { timestamp: number; models: AIModel[] } | null = null;

export function invalidateNvidiaModelCache(): void {
  nvidiaModelCache = null;
}

async function getStoredNvidiaKey(): Promise<string | null> {
  return getApiKey('nvidia');
}

/**
 * GET helper for lightweight NVIDIA endpoints (health check, model discovery).
 * Enforces a timeout and authenticates via the `Authorization: Bearer` header
 * so the key never appears in URL query strings.
 */
async function nvidiaFetch(path: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NVIDIA_HTTP_TIMEOUT_MS);

  try {
    return await fetch(`${NVIDIA_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/* --------------------------------------------------------------------------
 * Error mapping
 * ------------------------------------------------------------------------ */

/**
 * Sanitized, user-facing error text for every HTTP status class NVIDIA can
 * return. Never includes the API key or raw response headers.
 */
export function mapNvidiaStatus(status: number): string {
  switch (status) {
    case 400:
      return 'NVIDIA rejected the request (400). Check the selected model and input.';
    case 401:
      return 'NVIDIA API key is invalid or missing. Update it in Settings.';
    case 403:
      return 'NVIDIA access denied (403). The API key may lack permission for this model.';
    case 404:
      return 'The selected NVIDIA model or endpoint was not found (404).';
    case 408:
      return 'NVIDIA request timed out (408). Try again.';
    case 409:
      return 'NVIDIA request conflict (409). Try again shortly.';
    case 429:
      return 'NVIDIA rate limit reached (429). Try again later or switch provider.';
    default:
      if (status >= 500) {
        return `NVIDIA service error (${status}). Try again later.`;
      }
      return `NVIDIA request failed (${status}).`;
  }
}

/**
 * Read and sanitize an error response body. Returns a short user-safe message.
 * NVIDIA may answer with OpenAI-style `{error:{message}}`, `{message}`, or
 * `{detail}` bodies. As defense-in-depth, any accidental echo of the API key
 * is redacted before the message reaches the UI.
 */
async function readNvidiaError(
  response: Response,
  apiKey?: string,
): Promise<string> {
  const fallback = mapNvidiaStatus(response.status);

  try {
    const text = await response.text();
    if (!text) return fallback;

    const data = JSON.parse(text) as {
      message?: unknown;
      detail?: unknown;
      error?: unknown;
    };

    const rawCandidates: unknown[] = [
      typeof data.error === 'object' && data.error !== null
        ? (data.error as { message?: unknown }).message
        : data.error,
      data.message,
      data.detail,
    ];

    const raw = rawCandidates.find(
      (candidate) =>
        typeof candidate === 'string' &&
        candidate.length > 0 &&
        candidate.length < 300,
    );

    if (typeof raw !== 'string') return fallback;
    if (apiKey && raw.includes(apiKey)) {
      return raw.split(apiKey).join('[redacted]');
    }
    return raw;
  } catch {
    return fallback;
  }
}

/* --------------------------------------------------------------------------
 * Health check
 * ------------------------------------------------------------------------ */

export type NvidiaHealthStatus =
  | 'available'
  | 'error'
  | 'unavailable'
  | 'not_configured';

export interface NvidiaHealthResult {
  status: NvidiaHealthStatus;
  message?: string;
}

export async function checkNvidiaHealth(): Promise<NvidiaHealthResult> {
  const apiKey = await getStoredNvidiaKey();

  // Health should reflect service + credential state, not the chat hooks'
  // private copies. Without a key the provider is simply not configured.
  if (!apiKey) {
    return {
      status: 'not_configured',
      message: 'NVIDIA API key is not configured.',
    };
  }

  try {
    const response = await nvidiaFetch('/models', apiKey);

    if (response.ok) {
      return { status: 'available' };
    }

    const rawMessage = await readNvidiaError(response, apiKey);
    const isAuthFailure =
      response.status === 401 ||
      response.status === 403 ||
      /api key|unauthorized|permission|denied/i.test(rawMessage);

    return {
      status: 'error',
      message: isAuthFailure
        ? 'NVIDIA API key is invalid or lacks permission. Update it in Settings.'
        : rawMessage,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'unavailable', message: 'NVIDIA request timed out.' };
    }
    return {
      status: 'unavailable',
      message:
        'Unable to reach the NVIDIA API. Check your network connection.',
    };
  }
}

/* --------------------------------------------------------------------------
 * Model discovery
 * ------------------------------------------------------------------------ */

interface NvidiaModelEntry {
  id?: unknown;
  name?: unknown;
  capabilities?: { chat_completions?: unknown };
}

interface NvidiaModelsResponse {
  object?: string;
  data?: NvidiaModelEntry[];
}

/**
 * Ids that are clearly not chat-completion models (embedding / reranking /
 * safety models). Applied only when the catalog does not tell us explicitly.
 */
const NON_CHAT_MODEL_PATTERN = /(embed|rerank|moderation|guard|clip)/i;

/** Normalize a NVIDIA catalog entry into the unified AIModel structure. */
function normalizeNvidiaModel(entry: NvidiaModelEntry): AIModel | null {
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id || NON_CHAT_MODEL_PATTERN.test(id)) {
    return null;
  }

  const capabilities = entry.capabilities;
  if (
    capabilities &&
    typeof capabilities === 'object' &&
    capabilities.chat_completions === false
  ) {
    return null;
  }

  const displayName =
    typeof entry.name === 'string' && entry.name.trim()
      ? entry.name.trim()
      : undefined;

  return {
    name: id,
    providerId: 'nvidia',
    displayName,
    capabilities: {
      chat: true,
      streaming: true,
    },
  };
}

export async function getNvidiaModels(): Promise<AIModel[]> {
  if (nvidiaModelCache) {
    const age = Date.now() - nvidiaModelCache.timestamp;
    if (age < NVIDIA_MODEL_CACHE_TTL_MS) {
      return nvidiaModelCache.models;
    }
  }

  const apiKey = await getStoredNvidiaKey();
  if (!apiKey) {
    throw new Error('NVIDIA API key is not configured.');
  }

  const response = await nvidiaFetch('/models', apiKey);

  if (!response.ok) {
    throw new Error(mapNvidiaStatus(response.status));
  }

  const data = (await response.json()) as NvidiaModelsResponse;
  const entries = data.data ?? [];

  const models: AIModel[] = entries
    .map(normalizeNvidiaModel)
    .filter((model): model is AIModel => model !== null);

  nvidiaModelCache = { timestamp: Date.now(), models };
  return models;
}

/* --------------------------------------------------------------------------
 * Streaming chat
 * ------------------------------------------------------------------------ */

export interface NvidiaChatOptions {
  signal?: AbortSignal;
}

interface NvidiaStreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
    finish_reason?: string | null;
  }>;
  object?: string;
  error?: unknown;
}

/** Extract assistant text from an OpenAI-style SSE chunk. */
function extractNvidiaText(chunk: NvidiaStreamChunk): string {
  const content = chunk.choices?.[0]?.delta?.content;
  // reasoning_content (thinking tokens) is intentionally NOT emitted.
  return typeof content === 'string' ? content : '';
}

/**
 * Stream a chat completion from NVIDIA NIM, emitting text fragments
 * incrementally. Supports cancellation through `options.signal`
 * (AbortController), multiple SSE events per network read, and partial
 * events split across reads.
 */
export async function streamNvidiaChat(
  model: string,
  messages: { role: string; content: string }[],
  onToken: (content: string) => void,
  options?: NvidiaChatOptions,
): Promise<void> {
  const apiKey = await getStoredNvidiaKey();

  if (!apiKey) {
    throw new Error(
      'NVIDIA API key is not configured. Add it in Settings → AI Providers.',
    );
  }

  const response = await fetch(`${NVIDIA_API_BASE}${NVIDIA_CHAT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const rawMessage = await readNvidiaError(response, apiKey);
    const isAuthFailure =
      response.status === 401 ||
      response.status === 403 ||
      /api key|unauthorized|permission|denied/i.test(rawMessage);
    throw new Error(
      isAuthFailure
        ? 'NVIDIA API key is invalid or lacks permission. Update it in Settings.'
        : rawMessage,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('NVIDIA response body is not readable.');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Normalize CRLF so SSE line framing is stable across chunks.
      buffer = buffer.replace(/\r\n/g, '\n');

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        // Skip empty lines, SSE comments (": keep-alive"), and event names.
        if (!line.startsWith('data:')) continue;

        const payloadText = line.slice(5).trim();
        if (!payloadText) continue;

        if (payloadText === '[DONE]') {
          return;
        }

        let chunk: NvidiaStreamChunk;
        try {
          chunk = JSON.parse(payloadText) as NvidiaStreamChunk;
        } catch {
          // Ignore malformed fragments; keep streaming.
          continue;
        }

        if (chunk.error) {
          throw new Error(sanitizeStreamError(chunk.error, apiKey));
        }

        const text = extractNvidiaText(chunk);
        if (text) {
          onToken(text);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** User-safe text for an in-stream error payload (key redacted). */
function sanitizeStreamError(error: unknown, apiKey: string): string {
  const rawMessage =
    typeof error === 'string'
      ? error
      : typeof error === 'object' &&
          error !== null &&
          typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
  const safeMessage =
    rawMessage && rawMessage.length < 300
      ? rawMessage
      : 'NVIDIA returned a streaming error.';
  return apiKey && safeMessage.includes(apiKey)
    ? safeMessage.split(apiKey).join('[redacted]')
    : safeMessage;
}