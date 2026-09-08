export interface AIModel {
  name: string;
  size?: number;
  modifiedAt?: string;
  digest?: string;
  details?: {
    family?: string;
    parameterSize?: string;
    quantizationLevel?: string;
  };
  /** Provider that owns this model (ollama, gemini, ...). */
  providerId?: string;
  /** Friendly display name (cloud providers). */
  displayName?: string;
  /** Short description (cloud providers). */
  description?: string;
  /** Capability flags used by the model registry. */
  capabilities?: {
    chat?: boolean;
    vision?: boolean;
    reasoning?: boolean;
    coding?: boolean;
    streaming?: boolean;
  };
}

export interface OllamaStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

export interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model?: string;
    modified_at?: string;
    size?: number;
    digest?: string;
    details?: {
      parent_model?: string;
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  options?: Record<string, unknown>;
}

export interface ChatResponse {
  message: ChatMessage;
  done: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  isAvailable(): Promise<boolean>;
}

// === Phase 1C: Multi-Provider Types ===

export type AIProviderType = 'local' | 'cloud';

export type AIProviderStatus =
  | 'available'
  | 'unavailable'
  | 'not_configured'
  | 'checking'
  | 'error';

export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  enabled: boolean;
  status: AIProviderStatus;
  apiKeyConfigured: boolean;
  baseUrl?: string;
  description?: string;
  docsUrl?: string;
}

export interface AIModelRegistry {
  id: string;
  name: string;
  providerId: string;
  type: AIProviderType;
  parameterSize?: string;
  size?: number;
  quantization?: string;
  capabilities?: {
    chat?: boolean;
    vision?: boolean;
    reasoning?: boolean;
    coding?: boolean;
    streaming?: boolean;
  };
}

export interface ProviderHealthResult {
  providerId: string;
  status: AIProviderStatus;
  message?: string;
  latency?: number;
}

export interface AISettings {
  defaultProvider: string;
  defaultModel: string;
  enabledProviders: string[];
}
