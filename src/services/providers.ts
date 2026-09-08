import type { AIProviderConfig, AIProviderStatus } from '../types/ai';

export interface ProviderDefinition {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  description: string;
  docsUrl: string;
  requiresApiKey: boolean;
  defaultBaseUrl?: string;
}

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'local',
    description: 'Run AI models locally on your machine',
    docsUrl: 'https://ollama.com',
    requiresApiKey: false,
    defaultBaseUrl: 'http://127.0.0.1:11434',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'cloud',
    description: 'Google\'s most capable AI models',
    docsUrl: 'https://ai.google.dev',
    requiresApiKey: true,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    type: 'cloud',
    description: 'NVIDIA NIM and API Catalog models (OpenAI-compatible)',
    docsUrl: 'https://docs.api.nvidia.com',
    requiresApiKey: true,
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  },
  {
    id: 'groq',
    name: 'Groq',
    type: 'cloud',
    description: 'Ultra-fast AI inference with LPU technology',
    docsUrl: 'https://groq.com',
    requiresApiKey: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    type: 'cloud',
    description: 'High-performance AI inference on CS-3 hardware',
    docsUrl: 'https://cerebras.ai',
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'cloud',
    description: 'Access multiple AI providers through one API',
    docsUrl: 'https://openrouter.ai',
    requiresApiKey: true,
  },
];

export function getProviders(): ProviderDefinition[] {
  return providerDefinitions;
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return providerDefinitions.find((p) => p.id === id);
}

export function getEnabledProviders(
  enabledIds: string[],
): ProviderDefinition[] {
  return providerDefinitions.filter((p) => enabledIds.includes(p.id));
}

export function getDefaultEnabledProviders(): string[] {
  return ['ollama'];
}

export function getProviderStatusLabel(status: AIProviderStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'unavailable':
      return 'Unavailable';
    case 'not_configured':
      return 'Not configured';
    case 'checking':
      return 'Checking...';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

export function getInitialProviderConfigs(): AIProviderConfig[] {
  return providerDefinitions.map((def) => ({
    id: def.id,
    name: def.name,
    type: def.type,
    enabled: def.id === 'ollama',
    status: def.requiresApiKey ? 'not_configured' : 'checking',
    apiKeyConfigured: false,
    baseUrl: def.defaultBaseUrl,
    description: def.description,
    docsUrl: def.docsUrl,
  }));
}
