import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIModel, ChatMessage } from '../types/ai';
import type { UseOllamaResult } from './useOllama';
import type { UseAIProvidersResult } from './useAIProviders';
import {
  aiProviders,
  resolveAIProvider,
  sendChatMessage,
} from '../services/ai';

const SETTINGS_KEY = 'jarvex-ai-settings';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface UseChatState {
  ollama: UseOllamaResult;
  providersState: UseAIProvidersResult;
}

/**
 * Chat state. Takes the shared AI state ({ ollama, providersState }) as an
 * argument so Chat always reads the same live provider state as Settings and
 * the Models page — never a private hook copy.
 */
export function useChat({ ollama, providersState }: UseChatState) {
  const {
    status: ollamaStatus,
    models: ollamaModels,
    loading: ollamaLoading,
    refresh: refreshOllama,
  } = ollama;

  const {
    providers,
    settings,
    geminiModels,
    geminiModelsLoading,
    refreshGeminiModels,
    nvidiaModels,
    nvidiaModelsLoading,
    refreshNvidiaModels,
  } = providersState;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(
    () =>
      localStorage.getItem('jarvex-selected-provider') ??
      ((): string => {
        try {
          const stored = localStorage.getItem(SETTINGS_KEY);
          if (stored) {
            return JSON.parse(stored).defaultProvider ?? 'auto';
          }
        } catch {
          // fall through
        }
        return 'auto';
      })(),
  );
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Provider resolution (Ollama-first Auto, Gemini fallback)
  // ------------------------------------------------------------------

  const geminiConfig = providers.find((p) => p.id === 'gemini');
  const geminiAvailable =
    geminiConfig?.enabled === true && geminiConfig?.status === 'available';

  const nvidiaConfig = providers.find((p) => p.id === 'nvidia');
  const nvidiaAvailable =
    nvidiaConfig?.enabled === true && nvidiaConfig?.status === 'available';

  const enabledProviderIds = settings.enabledProviders;

  const availability = useMemo(
    () => ({
      ollama: ollamaStatus.connected,
      gemini: geminiAvailable,
      nvidia: nvidiaAvailable,
    }),
    [ollamaStatus.connected, geminiAvailable, nvidiaAvailable],
  );

  const providerId = useMemo(
    () =>
      selectedProvider !== 'auto'
        ? selectedProvider
        : resolveAIProvider('auto', enabledProviderIds, availability),
    [selectedProvider, enabledProviderIds, availability],
  );

  const providerModels: AIModel[] =
    providerId === 'gemini'
      ? geminiModels
      : providerId === 'nvidia'
        ? nvidiaModels
        : ollamaModels;
  const providerModelsLoading: boolean =
    providerId === 'gemini'
      ? geminiModelsLoading
      : providerId === 'nvidia'
        ? nvidiaModelsLoading
        : ollamaLoading;

  const activeProvider =
    aiProviders.find((provider) => provider.id === providerId) ??
    aiProviders[0];

  const providerOptions = useMemo(() => {
    const options: { id: string; name: string }[] = [
      { id: 'auto', name: 'Auto' },
    ];
    if (enabledProviderIds.includes('ollama')) {
      options.push({ id: 'ollama', name: 'Ollama' });
    }
    if (geminiConfig?.enabled && geminiConfig.apiKeyConfigured) {
      options.push({ id: 'gemini', name: 'Gemini' });
    }
    if (nvidiaConfig?.enabled && nvidiaConfig.apiKeyConfigured) {
      options.push({ id: 'nvidia', name: 'NVIDIA NIM' });
    }
    return options;
  }, [enabledProviderIds, geminiConfig, nvidiaConfig]);

  // If a previously-selected provider is no longer usable (e.g. its key was
  // removed), fall back to Auto to avoid a stuck/invalid selection.
  useEffect(() => {
    if (
      selectedProvider !== 'auto' &&
      !providerOptions.some((option) => option.id === selectedProvider)
    ) {
      setSelectedProvider('auto');
      localStorage.setItem('jarvex-selected-provider', 'auto');
    }
  }, [selectedProvider, providerOptions]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const updateSelectedProvider = useCallback((choice: string) => {
    setSelectedProvider(choice);
    localStorage.setItem('jarvex-selected-provider', choice);
  }, []);

  // ------------------------------------------------------------------
  // Per-provider model selection with persistence
  // ------------------------------------------------------------------

  const modelStorageKey = `jarvex-selected-model:${providerId}`;

  useEffect(() => {
    if (providerModels.length === 0) return;

    const currentExists = providerModels.some(
      (model) => model.name === selectedModel,
    );

    if (currentExists) {
      localStorage.setItem(modelStorageKey, selectedModel as string);
      return;
    }

    const stored = localStorage.getItem(modelStorageKey);
    if (stored && providerModels.some((model) => model.name === stored)) {
      setSelectedModel(stored);
    } else if (selectedModel !== providerModels[0].name) {
      setSelectedModel(providerModels[0].name);
      localStorage.setItem(modelStorageKey, providerModels[0].name);
    }
  }, [providerModels, selectedModel, providerId, modelStorageKey]);

  const updateSelectedModel = useCallback(
    (model: string) => {
      setSelectedModel(model);
      localStorage.setItem(modelStorageKey, model);
    },
    [modelStorageKey],
  );

  // Derived per-provider UI states
  const providerOffline = useMemo(() => {
    if (providerId === 'ollama') {
      return !ollamaStatus.connected && !ollamaLoading;
    }
    if (providerId === 'gemini') {
      // Mirror the NVIDIA behaviour: surface key/API errors as send-time
      // errors rather than locking the chat input.
      if (geminiConfig?.status === 'error') {
        return false;
      }
      return (
        !geminiModelsLoading &&
        (geminiConfig?.status === 'unavailable' ||
          !geminiConfig?.apiKeyConfigured)
      );
    }
    if (providerId === 'nvidia') {
      // A service-level error (bad key, API denial) is shown by the send
      // path and must not lock the input. Offline applies to timeouts,
      // network failures, and any definitely-missing credential.
      if (nvidiaConfig?.status === 'error') {
        return false;
      }
      return (
        !nvidiaModelsLoading &&
        (nvidiaConfig?.status === 'unavailable' ||
          !nvidiaConfig?.apiKeyConfigured)
      );
    }
    return true;
  }, [providerId, ollamaStatus, ollamaLoading, geminiModelsLoading, geminiConfig, nvidiaModelsLoading, nvidiaConfig]);

  const providerHasNoModels = useMemo(() => {
    if (providerId === 'ollama') {
      return (
        ollamaStatus.connected && !ollamaLoading && ollamaModels.length === 0
      );
    }
    if (providerId === 'gemini') {
      return (
        geminiConfig?.status === 'available' &&
        !geminiModelsLoading &&
        geminiModels.length === 0
      );
    }
    if (providerId === 'nvidia') {
      return (
        nvidiaConfig?.status === 'available' &&
        !nvidiaModelsLoading &&
        nvidiaModels.length === 0
      );
    }
    return true;
  }, [
    providerId,
    ollamaStatus,
    ollamaLoading,
    ollamaModels,
    geminiConfig,
    geminiModelsLoading,
    geminiModels,
    nvidiaConfig,
    nvidiaModelsLoading,
    nvidiaModels,
  ]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!selectedModel) {
        setError('No model selected for the active provider.');
        return;
      }

      if (providerId === 'gemini') {
        if (!geminiConfig?.apiKeyConfigured) {
          setError(
            'Gemini is not configured. Add an API key in Settings → AI Providers.',
          );
          return;
        }
        if (geminiModels.length === 0) {
          setError(
            'No Gemini models are available. Check the API key or your network connection.',
          );
          return;
        }
      } else if (providerId === 'nvidia') {
        if (!nvidiaConfig?.apiKeyConfigured) {
          setError(
            'NVIDIA NIM is not configured. Add an API key in Settings → AI Providers.',
          );
          return;
        }
        if (nvidiaModels.length === 0) {
          setError(
            'No NVIDIA NIM models are available. Check the API key or your network connection.',
          );
          return;
        }
      } else if (!ollamaStatus.connected) {
        setError('Ollama is not connected. Start Ollama and try again.');
        return;
      }

      setError(null);

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await sendChatMessage(
          activeProvider,
          selectedModel,
          [...messagesRef.current, userMessage],
          (token: string) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: msg.content + token }
                  : msg,
              ),
            );
          },
          { signal: controller.signal },
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Generation was stopped by the user
        } else {
          setError(
            err instanceof Error ? err.message : 'Failed to send message',
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsGenerating(false);
      }
    },
    [
      selectedModel,
      providerId,
      activeProvider,
      ollamaStatus.connected,
      geminiConfig,
      geminiModels.length,
      nvidiaConfig,
      nvidiaModels.length,
      messagesRef,
    ],
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const refreshProviderModels = useCallback(() => {
    if (providerId === 'gemini') {
      void refreshGeminiModels();
      return Promise.resolve();
    }
    if (providerId === 'nvidia') {
      void refreshNvidiaModels();
      return Promise.resolve();
    }
    return refreshOllama();
  }, [providerId, refreshGeminiModels, refreshNvidiaModels, refreshOllama]);

  return {
    messages,
    isGenerating,
    error,
    selectedModel,
    setSelectedModel: updateSelectedModel,
    selectedProvider,
    setSelectedProvider: updateSelectedProvider,
    providerId,
    providerOptions,
    providerModels,
    providerModelsLoading,
    providerOffline,
    providerHasNoModels,
    sendMessage,
    stopGeneration,
    clearChat,
    refreshProviderModels,
    ollamaStatus,
    ollamaModels,
  };
}
