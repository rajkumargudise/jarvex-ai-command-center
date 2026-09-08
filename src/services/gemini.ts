/**
 * Google Gemini API integration (Phase 2A).
 *
 * Official REST endpoint: https://generativelanguage.googleapis.com/v1beta
 *
 * - Health check   : GET  /models?pageSize=5  (lightweight, no generation)
 * - Model discovery: GET  /models             (filtered to generateContent)
 * - Chat streaming : POST /models/{model}:streamGenerateContent?alt=sse
 *
 * Authentication uses the `x-goog-api-key` header (NOT a URL query string) so
 * the key never appears in network query strings or server logs.
 */

import type { AIModel } from '../types/ai';
import { getApiKey } from './storage';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_HTTP_TIMEOUT_MS = 15000;

// Sensible in-memory model cache (5 minutes) to avoid repeated /models calls.
const GEMINI_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
let geminiModelCache: { timestamp: number; models: AIModel[] } | null = null;

export function invalidateGeminiModelCache(): void {
  geminiModelCache = null;
}

async function getStoredGeminiKey(): Promise<string | null> {
  return getApiKey('gemini');
}

export async function getGeminiApiKey(): Promise<string | null> {
  return getStoredGeminiKey();
}

/**
 * GET helper for lightweight Gemini endpoints (health check, model discovery).
 * Enforces a timeout and authenticates via the `x-goog-api-key` header so the
 * key never appears in URL query strings.
 */
async function geminiFetch(path: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_HTTP_TIMEOUT_MS);

  try {
    return await fetch(`${GEMINI_API_BASE}${path}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/* --------------------------------------------------------------------------
 * Health check
 * ------------------------------------------------------------------------ */

export type GeminiHealthStatus = 'available' | 'error' | 'unavailable';

export interface GeminiHealthResult {
  status: GeminiHealthStatus;
  message?: string;
}

/**
 * Read and sanitize an error response body. Returns a short user-safe message.
 * Google error messages do not echo the API key, but we still bound the length
 * and never surface raw headers.
 */
async function readGeminiError(response: Response): Promise<string> {
  const fallback = mapGeminiStatus(response.status);

  try {
    const text = await response.text();
    if (!text) return fallback;

    const data = JSON.parse(text) as {
      error?: { message?: string };
    };
    const message = data.error?.message;
    if (message && message.length > 0 && message.length < 300) {
      return message;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function checkGeminiHealth(): Promise<GeminiHealthResult> {
  const apiKey = await getStoredGeminiKey();

  if (!apiKey) {
    return { status: 'error', message: 'Gemini API key is not configured.' };
  }

  try {
    const response = await geminiFetch('/models?pageSize=5', apiKey);

    if (response.ok) {
      return { status: 'available' };
    }

    const rawMessage = await readGeminiError(response);
    const isAuthFailure =
      response.status === 401 ||
      response.status === 403 ||
      /api key|permission|denied/i.test(rawMessage);

    return {
      status: 'error',
      message: isAuthFailure
        ? 'Gemini API key is invalid or lacks permission. Update it in Settings.'
        : rawMessage,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'unavailable', message: 'Gemini request timed out.' };
    }
    return {
      status: 'unavailable',
      message:
        'Unable to reach the Gemini API. Check your network connection.',
    };
  }
}
/* --------------------------------------------------------------------------
 * Model discovery
 * ------------------------------------------------------------------------ */

interface GeminiModelEntry {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModelEntry[];
}

/** Normalize a Gemini model entry into the unified AIModel structure. */
function normalizeGeminiModel(entry: GeminiModelEntry): AIModel {
  const name = entry.name.replace(/^models\//, '');
  return {
    name,
    providerId: 'gemini',
    displayName: entry.displayName || name,
    description: entry.description,
    capabilities: {
      chat: true,
      streaming: true,
    },
  };
}

export async function getGeminiModels(): Promise<AIModel[]> {
  if (geminiModelCache) {
    const age = Date.now() - geminiModelCache.timestamp;
    if (age < GEMINI_MODEL_CACHE_TTL_MS) {
      return geminiModelCache.models;
    }
  }

  const apiKey = await getStoredGeminiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const response = await geminiFetch('/models', apiKey);

  if (!response.ok) {
    throw new Error(mapGeminiStatus(response.status));
  }

  const data = (await response.json()) as GeminiModelsResponse;
  const entries = data.models ?? [];

  const models: AIModel[] = entries
    .filter((entry) =>
      (entry.supportedGenerationMethods ?? []).includes('generateContent'),
    )
    .map(normalizeGeminiModel);

  geminiModelCache = { timestamp: Date.now(), models };
  return models;
}
/* --------------------------------------------------------------------------
 * Streaming chat
 * ------------------------------------------------------------------------ */

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiContent {
  role?: string;
  parts?: GeminiPart[];
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export interface GeminiChatOptions {
  signal?: AbortSignal;
}

/** Map JARVEX messages into Gemini's request structure. */
function buildGeminiPayload(
  messages: { role: string; content: string }[],
): {
  contents: { role: string; parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
} {
  const systemTexts = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content);

  const contents = messages
    .filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    )
    .map((message) => ({
      // Gemini uses "model" where OpenAI-style APIs use "assistant".
      role: message.role === 'assistant' ? 'model' : message.role,
      parts: [{ text: message.content }],
    }));

  return {
    contents,
    ...(systemTexts.length > 0
      ? { systemInstruction: { parts: systemTexts.map((text) => ({ text })) } }
      : {}),
  };
}

/** Extract assistant text from a Gemini SSE chunk (skips thinking parts). */
function extractGeminiText(chunk: GeminiStreamChunk): string {
  const candidates = chunk.candidates;
  if (!candidates || candidates.length === 0) {
    if (chunk.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini blocked the request (${chunk.promptFeedback.blockReason}).`,
      );
    }
    return '';
  }

  const parts = candidates[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought) // skip internal reasoning/thinking
    .map((part) => part.text ?? '')
    .join('');
}
/**
 * Stream a chat completion from Gemini, emitting text fragments incrementally.
 * Supports cancellation through `options.signal` (AbortController).
 */
export async function streamGeminiChat(
  model: string,
  messages: { role: string; content: string }[],
  onToken: (content: string) => void,
  options?: GeminiChatOptions,
): Promise<void> {
  const apiKey = await getStoredGeminiKey();

  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Add it in Settings → AI Providers.',
    );
  }

  const payload = buildGeminiPayload(messages);
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  if (!response.ok) {
    // Google signals invalid keys with HTTP 400 + "API key not valid" in the
    // body, so parse the body and detect auth failures the same way the
    // health check does rather than trusting the status code alone.
    const rawMessage = await readGeminiError(response);
    const isAuthFailure =
      response.status === 401 ||
      response.status === 403 ||
      /api key|permission|denied/i.test(rawMessage);
    throw new Error(
      isAuthFailure
        ? 'Gemini API key is invalid or lacks permission. Update it in Settings.'
        : rawMessage,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Gemini response body is not readable.');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let receivedTokens = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Normalize CRLF so SSE event framing matching is stable across chunks.
      buffer = buffer.replace(/\r\n/g, '\n');

      let eventEnd: number;
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const eventBlock = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);

        for (const line of eventBlock.split('\n')) {
          if (!line.startsWith('data: ')) continue;

          const payloadText = line.slice(6).trim();
          if (!payloadText) continue;

          let chunk: GeminiStreamChunk;
          try {
            chunk = JSON.parse(payloadText) as GeminiStreamChunk;
          } catch {
            // Ignore malformed fragments; keep streaming.
            continue;
          }

          const text = extractGeminiText(chunk);
          if (text) {
            receivedTokens = true;
            onToken(text);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // A valid but empty stream is an empty completion, not an error.
  void receivedTokens;
}

/* --------------------------------------------------------------------------
 * Error mapping
 * ------------------------------------------------------------------------ */

export function mapGeminiStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Gemini rejected the request (400). Check the selected model.';
    case 401:
      return 'Gemini API key is invalid. Update it in Settings.';
    case 403:
      return 'Gemini access denied (403). The API key may lack permission.';
    case 404:
      return 'The selected Gemini model is unavailable.';
    case 429:
      return 'Gemini rate limit reached. Try again later or switch provider.';
    default:
      if (status >= 500) {
        return `Gemini service error (${status}). Try again later.`;
      }
      return `Gemini request failed (${status}).`;
  }
}