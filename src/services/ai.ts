import type {
  AIModel,
  ChatMessage,
  AIProvider,
  AIModelRegistry,
} from '../types/ai';
import {
  getOllamaStatus,
  streamOllamaChat,
} from './ollama';
import {
  getGeminiModels,
  streamGeminiChat,
} from './gemini';
import {
  checkNvidiaHealth,
  getNvidiaModels,
  streamNvidiaChat,
} from './nvidia';

export const ollamaProvider: AIProvider = {
  id: 'ollama',
  name: 'Ollama',
  type: 'local',
  async isAvailable(): Promise<boolean> {
    const status = await getOllamaStatus();
    return status.connected;
  },
};

export const geminiProvider: AIProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  type: 'cloud',
  async isAvailable(): Promise<boolean> {
    try {
      const models = await getGeminiModels();
      return models.length > 0;
    } catch {
      return false;
    }
  },
};

export const nvidiaProvider: AIProvider = {
  id: 'nvidia',
  name: 'NVIDIA NIM',
  type: 'cloud',
  async isAvailable(): Promise<boolean> {
    const health = await checkNvidiaHealth();
    return health.status === 'available';
  },
};

export const aiProviders: AIProvider[] = [
  ollamaProvider,
  geminiProvider,
  nvidiaProvider,
];

export interface StreamOptions {
  signal?: AbortSignal;
}

export async function sendChatMessage(
  provider: AIProvider,
  model: string,
  messages: ChatMessage[],
  onToken: (content: string) => void,
  options?: StreamOptions,
): Promise<void> {
  const payload = messages.map(({ role, content }) => ({ role, content }));

  if (provider.id === 'ollama') {
    await streamOllamaChat(model, payload, onToken, options);
    return;
  }

  if (provider.id === 'gemini') {
    await streamGeminiChat(model, payload, onToken, options);
    return;
  }

  if (provider.id === 'nvidia') {
    await streamNvidiaChat(model, payload, onToken, options);
    return;
  }

  throw new Error(`Provider ${provider.id} is not yet implemented`);
}

export async function getProviderModels(
  provider: AIProvider,
): Promise<{ provider: AIProvider; models: AIModel[] }> {
  if (provider.id === 'ollama') {
    return { provider, models: [] };
  }

  if (provider.id === 'gemini') {
    const models = await getGeminiModels();
    return { provider, models };
  }

  if (provider.id === 'nvidia') {
    const models = await getNvidiaModels();
    return { provider, models };
  }

  return { provider, models: [] };
}

// === Phase 1C: Provider resolution & model registry ===

/**
 * Resolve the effective provider for "Auto" mode.
 * Auto → first enabled + available provider → Ollama (default).
 */
export function resolveAIProvider(
  defaultProviderId: string,
  enabledProviderIds: string[],
  availability: Record<string, boolean>,
): string {
  if (defaultProviderId && defaultProviderId !== 'auto') {
    return defaultProviderId;
  }

  // Auto: first enabled + available provider.
  // Phase 2B preference order: Ollama → Gemini → NVIDIA → other enabled.
  const candidates = enabledProviderIds.filter(
    (id) => availability[id] !== false,
  );
  const AUTO_PREFERENCE_ORDER = ['ollama', 'gemini', 'nvidia'];
  for (const id of AUTO_PREFERENCE_ORDER) {
    if (candidates.includes(id)) {
      return id;
    }
  }
  return candidates[0] ?? 'ollama';
}

/**
 * Build a unified model registry entry from an Ollama model (local) or a
 * cloud-provider model. Cloud entries inherit their provider's type.
 */
export function toModelRegistry(
  model: AIModel,
  providerId = 'ollama',
  type: 'local' | 'cloud' = providerId === 'ollama' ? 'local' : 'cloud',
): AIModelRegistry {
  return {
    id: `${providerId}:${model.name}`,
    name: model.name,
    providerId,
    type,
    parameterSize: model.details?.parameterSize,
    size: model.size,
    quantization: model.details?.quantizationLevel,
    capabilities: model.capabilities ?? {
      chat: true,
      streaming: true,
    },
  };
}

export function buildModelRegistry(
  ollamaModels: AIModel[],
  cloudModels: AIModel[] = [],
): AIModelRegistry[] {
  const local = ollamaModels.map((model) => toModelRegistry(model, 'ollama'));
  const cloud = cloudModels.map((model) =>
    toModelRegistry(model, model.providerId ?? 'cloud', 'cloud'),
  );
  return [...local, ...cloud];
}
