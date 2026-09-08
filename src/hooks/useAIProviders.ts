import { useCallback, useEffect, useState } from 'react';
import type {
  AIProviderConfig,
  AIProviderStatus,
  AISettings,
  AIModel,
} from '../types/ai';
import {
  getInitialProviderConfigs,
  getProvider,
} from '../services/providers';
import {
  deleteApiKey,
  hasApiKey,
  migrateLegacyCredentials,
  saveApiKey,
} from '../services/storage';
import { getOllamaStatus } from '../services/ollama';
import {
  checkGeminiHealth,
  getGeminiModels,
  invalidateGeminiModelCache,
} from '../services/gemini';
import {
  checkNvidiaHealth,
  getNvidiaModels,
  invalidateNvidiaModelCache,
} from '../services/nvidia';

const SETTINGS_KEY = 'jarvex-ai-settings';

interface UseAIProvidersResult {
  providers: AIProviderConfig[];
  settings: AISettings;
  loading: boolean;
  testConnection: (providerId: string) => Promise<void>;
  saveKey: (providerId: string, apiKey: string) => Promise<void>;
  removeKey: (providerId: string) => void;
  toggleProvider: (providerId: string) => void;
  setDefaultProvider: (providerId: string) => void;
  setDefaultModel: (model: string) => void;
  refreshOllamaStatus: () => Promise<void>;
  refreshProviderStatus: (providerId: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  geminiModels: AIModel[];
  geminiModelsLoading: boolean;
  refreshGeminiModels: () => Promise<void>;
  nvidiaModels: AIModel[];
  nvidiaModelsLoading: boolean;
  refreshNvidiaModels: () => Promise<void>;
}

const defaultSettings: AISettings = {
  defaultProvider: 'ollama',
  defaultModel: '',
  enabledProviders: ['ollama'],
};
export function useAIProviders(): UseAIProvidersResult {
  const [providers, setProviders] = useState<AIProviderConfig[]>(
    getInitialProviderConfigs,
  );
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch {
      // Use defaults
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);
  const [geminiModels, setGeminiModels] = useState<AIModel[]>([]);
  const [geminiModelsLoading, setGeminiModelsLoading] = useState(false);
  const [nvidiaModels, setNvidiaModels] = useState<AIModel[]>([]);
  const [nvidiaModelsLoading, setNvidiaModelsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const checkKeys = async () => {
      setLoading(true);

      // Phase 2A.1: move any legacy fallback credentials into the OS
      // keychain before checking configuration (no-op in a plain browser).
      try {
        await migrateLegacyCredentials();
      } catch {
        // Migration is best-effort; legacy entries remain for a later retry.
      }

      const updated = await Promise.all(
        providers.map(async (provider) => {
          const def = getProvider(provider.id);
          if (!def?.requiresApiKey) {
            return provider;
          }
          const keyConfigured = await hasApiKey(provider.id);
          return {
            ...provider,
            apiKeyConfigured: keyConfigured,
            status: keyConfigured
              ? ('checking' as AIProviderStatus)
              : ('not_configured' as AIProviderStatus),
          };
        }),
      );
      setProviders(updated);
      setLoading(false);
    };

    void checkKeys();
  }, []);

  const updateProviderStatus = useCallback(
    (providerId: string, status: AIProviderStatus) => {
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, status } : p)),
      );
    },
    [],
  );

  const refreshOllamaStatus = useCallback(async () => {
    updateProviderStatus('ollama', 'checking');

    try {
      const status = await getOllamaStatus();
      updateProviderStatus(
        'ollama',
        status.connected ? 'available' : 'unavailable',
      );
    } catch {
      updateProviderStatus('ollama', 'error');
    }
  }, [updateProviderStatus]);

  const refreshGeminiModels = useCallback(async () => {
    if (!(await hasApiKey('gemini'))) {
      setGeminiModels([]);
      return;
    }

    setGeminiModelsLoading(true);
    try {
      const models = await getGeminiModels();
      setGeminiModels(models);
    } catch (err) {
      console.error('[ai] Gemini model discovery failed:', err);
      setGeminiModels([]);
    } finally {
      setGeminiModelsLoading(false);
    }
  }, []);

  const refreshNvidiaModels = useCallback(async () => {
    if (!(await hasApiKey('nvidia'))) {
      setNvidiaModels([]);
      return;
    }

    setNvidiaModelsLoading(true);
    try {
      const models = await getNvidiaModels();
      setNvidiaModels(models);
    } catch (err) {
      console.error('[ai] NVIDIA model discovery failed:', err);
      setNvidiaModels([]);
    } finally {
      setNvidiaModelsLoading(false);
    }
  }, []);

  const refreshProviderStatus = useCallback(
    async (providerId: string) => {
      const def = getProvider(providerId);
      if (!def) return;

      if (providerId === 'ollama') {
        await refreshOllamaStatus();
        return;
      }

      if (providerId === 'gemini') {
        if (!(await hasApiKey('gemini'))) {
          updateProviderStatus('gemini', 'not_configured');
          setGeminiModels([]);
          return;
        }

        updateProviderStatus('gemini', 'checking');
        const result = await checkGeminiHealth();

        if (result.status === 'available') {
          updateProviderStatus('gemini', 'available');
          void refreshGeminiModels();
        } else if (result.status === 'error') {
          updateProviderStatus('gemini', 'error');
        } else {
          updateProviderStatus('gemini', 'unavailable');
        }
        return;
      }

      if (providerId === 'nvidia') {
        if (!(await hasApiKey('nvidia'))) {
          updateProviderStatus('nvidia', 'not_configured');
          setNvidiaModels([]);
          return;
        }

        updateProviderStatus('nvidia', 'checking');
        const result = await checkNvidiaHealth();

        if (result.status === 'available') {
          updateProviderStatus('nvidia', 'available');
          void refreshNvidiaModels();
        } else if (result.status === 'error') {
          updateProviderStatus('nvidia', 'error');
        } else {
          updateProviderStatus('nvidia', 'unavailable');
        }
        return;
      }

      // Future cloud providers: mirror configuration state without network calls.
      const keyConfigured = await hasApiKey(providerId);
      updateProviderStatus(
        providerId,
        keyConfigured ? 'checking' : 'not_configured',
      );
    },
    [refreshOllamaStatus, updateProviderStatus, refreshGeminiModels, refreshNvidiaModels],
  );

  const refreshStatus = useCallback(async () => {
    await Promise.all(
      providers.map((provider) => refreshProviderStatus(provider.id)),
    );
  }, [providers, refreshProviderStatus]);

  const testConnection = useCallback(
    (providerId: string) => refreshProviderStatus(providerId),
    [refreshProviderStatus],
  );

  useEffect(() => {
    void refreshOllamaStatus();
  }, [refreshOllamaStatus]);

  useEffect(() => {
    void (async () => {
      if (await hasApiKey('gemini')) {
        void refreshProviderStatus('gemini');
        void refreshGeminiModels();
      }
    })();
    // Run once on mount; deps change once the key state resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      if (await hasApiKey('nvidia')) {
        void refreshProviderStatus('nvidia');
        void refreshNvidiaModels();
      }
    })();
    // Run once on mount; deps change once the key state resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
const saveKey = useCallback(
    async (providerId: string, apiKey: string) => {
      await saveApiKey(providerId, apiKey);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, apiKeyConfigured: true, status: 'checking' }
            : p,
        ),
      );
      setSettings((prev) => ({
        ...prev,
        enabledProviders: prev.enabledProviders.includes(providerId)
          ? prev.enabledProviders
          : [...prev.enabledProviders, providerId],
      }));
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, enabled: true } : p,
        ),
      );

      if (providerId === 'gemini') {
        invalidateGeminiModelCache();
        void refreshProviderStatus('gemini');
        void refreshGeminiModels();
      }

      if (providerId === 'nvidia') {
        invalidateNvidiaModelCache();
        void refreshProviderStatus('nvidia');
        void refreshNvidiaModels();
      }
    },
    [refreshProviderStatus, refreshGeminiModels, refreshNvidiaModels],
  );

  const removeKey = useCallback(
    (providerId: string) => {
      void deleteApiKey(providerId);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                apiKeyConfigured: false,
                status: 'not_configured',
                enabled: false,
              }
            : p,
        ),
      );
      setSettings((prev) => ({
        ...prev,
        enabledProviders: prev.enabledProviders.filter((id) => id !== providerId),
      }));

      if (providerId === 'gemini') {
        invalidateGeminiModelCache();
        setGeminiModels([]);
      }

      if (providerId === 'nvidia') {
        invalidateNvidiaModelCache();
        setNvidiaModels([]);
      }
    },
    [],
  );

  const toggleProvider = useCallback(
    (providerId: string) => {
      const current = providers.find((p) => p.id === providerId);
      const def = getProvider(providerId);
      if (def?.requiresApiKey && current && !current.apiKeyConfigured) {
        return; // Cannot enable a cloud provider without credentials.
      }
      const newEnabled = current ? !current.enabled : false;

      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, enabled: newEnabled } : p,
        ),
      );
      setSettings((prev) => ({
        ...prev,
        enabledProviders: newEnabled
          ? prev.enabledProviders.includes(providerId)
            ? prev.enabledProviders
            : [...prev.enabledProviders, providerId]
          : prev.enabledProviders.filter((id) => id !== providerId),
      }));

      if (providerId === 'gemini' && newEnabled) {
        void refreshProviderStatus('gemini');
        void refreshGeminiModels();
      }

      if (providerId === 'nvidia' && newEnabled) {
        void refreshProviderStatus('nvidia');
        void refreshNvidiaModels();
      }
    },
    [providers, refreshProviderStatus, refreshGeminiModels, refreshNvidiaModels],
  );

  const setDefaultProvider = useCallback((providerId: string) => {
    setSettings((prev) => ({ ...prev, defaultProvider: providerId }));
  }, []);

  const setDefaultModel = useCallback((model: string) => {
    setSettings((prev) => ({ ...prev, defaultModel: model }));
  }, []);

  return {
    providers,
    settings,
    loading,
    testConnection,
    saveKey,
    removeKey,
    toggleProvider,
    setDefaultProvider,
    setDefaultModel,
    refreshOllamaStatus,
    refreshProviderStatus,
    refreshStatus,
    geminiModels,
    geminiModelsLoading,
    refreshGeminiModels,
    nvidiaModels,
    nvidiaModelsLoading,
    refreshNvidiaModels,
  };
}