import type {
  AIModel,
  OllamaStatus,
  OllamaTagsResponse,
} from "../types/ai";

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${OLLAMA_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Ollama request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/version`);

    if (!response.ok) {
      return {
        connected: false,
        error: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { version?: string };

    return {
      connected: true,
      version: data.version,
    };
  } catch (error) {
    return {
      connected: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to Ollama",
    };
  }
}

export async function getOllamaModels(): Promise<AIModel[]> {
  const data = await request<OllamaTagsResponse>("/api/tags");

  return data.models.map((model) => ({
    name: model.name,
    size: model.size,
    modifiedAt: model.modified_at,
    digest: model.digest,
    details: {
      family: model.details?.family,
      parameterSize: model.details?.parameter_size,
      quantizationLevel: model.details?.quantization_level,
    },
  }));
}

export interface OllamaChatChunk {
  model?: string;
  created_at?: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  error?: string;
}

export async function streamOllamaChat(
  model: string,
  messages: { role: string; content: string }[],
  onToken: (content: string) => void,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Ollama chat failed: ${response.status} ${response.statusText}${
        errorText ? `: ${errorText}` : ''
      }`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let streamComplete = false;

  try {
    while (!streamComplete) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) continue;

        let chunk: OllamaChatChunk;
        try {
          chunk = JSON.parse(line) as OllamaChatChunk;
        } catch {
          continue;
        }

        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (chunk.done) {
          streamComplete = true;
          break;
        }

        if (chunk.message?.content) {
          onToken(chunk.message.content);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function checkOllama(): Promise<{
  status: OllamaStatus;
  models: AIModel[];
}> {
  const status = await getOllamaStatus();

  if (!status.connected) {
    return {
      status,
      models: [],
    };
  }

  try {
    const models = await getOllamaModels();

    return {
      status,
      models,
    };
  } catch (error) {
    return {
      status: {
        connected: false,
        version: status.version,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Ollama models",
      },
      models: [],
    };
  }
}