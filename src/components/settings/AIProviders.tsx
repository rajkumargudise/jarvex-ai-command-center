import { useAIState } from '../../context/AIProvidersContext';
import type { AIProviderConfig, AIModel } from '../../types/ai';
import {
  credentialStoreBackend,
  getCredentialStoreLabel,
} from '../../services/storage';
import { ProviderCard } from './ProviderCard';
import { ProviderStatus } from './ProviderStatus';

export function AIProviders() {
  const { ollama, providers: providersState } = useAIState();
  const {
    providers,
    settings,
    loading,
    testConnection,
    saveKey,
    removeKey,
    toggleProvider,
    setDefaultProvider,
    setDefaultModel,
    refreshStatus,
    geminiModels,
    nvidiaModels,
  } = providersState;

  const {
    status: ollamaStatus,
    models: ollamaModels,
  } = ollama;

  const enabledProviderIds = providers
    .filter((p: AIProviderConfig) => p.enabled)
    .map((p: AIProviderConfig) => p.id);

  const effectiveDefault =
    settings.defaultProvider === 'auto' ||
    !enabledProviderIds.includes(settings.defaultProvider)
      ? (enabledProviderIds.includes('ollama') ? 'ollama' : enabledProviderIds[0] ?? 'ollama')
      : settings.defaultProvider;

  const effectiveModel =
    ollamaModels.some((m: AIModel) => m.name === settings.defaultModel)
      ? settings.defaultModel
      : (ollamaModels.length > 0 ? ollamaModels[0].name : '');
const effectiveProvider = providers.find((p: AIProviderConfig) => p.id === effectiveDefault);

  return (
    <section className="settings-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CONFIGURATION</span>
          <h2>AI Providers</h2>
        </div>
        <button
          className="ghost-button"
          onClick={() => void refreshStatus()}
          type="button"
        >
          Refresh Status
        </button>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-header">
            <strong>Default AI Provider</strong>
            <span className="settings-helper">
              Used for new conversations. Auto picks the first available provider.
            </span>
          </div>
          <div className="settings-field">
            <label htmlFor="default-provider">Provider</label>
            <select
              id="default-provider"
              className="settings-select"
              value={settings.defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
            >
              <option value="auto">Auto</option>
              {providers
                .filter((p: AIProviderConfig) => p.enabled)
                .map((p: AIProviderConfig) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="settings-resolved">
            <span className="settings-helper">Resolved</span>
            {effectiveProvider ? (
              <ProviderStatus
                status={effectiveProvider.status}
                message={effectiveProvider.name}
              />
            ) : null}
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-header">
            <strong>Default Model</strong>
            <span className="settings-helper">
              Selected model used by the active provider.
            </span>
          </div>
          <div className="settings-field">
            <label htmlFor="default-model">Model</label>
            {ollamaModels.length > 0 ? (
              <select
                id="default-model"
                className="settings-select"
                value={effectiveModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              >
                {ollamaModels.map((m: AIModel) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="settings-empty">
                {loading
                  ? 'Checking for local models...'
                  : ollamaStatus.connected
                    ? 'No local models installed.'
                    : 'Ollama offline — models unavailable.'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="provider-list">
        {providers.map((provider: AIProviderConfig) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            onToggle={toggleProvider}
            onTest={testConnection}
            onSaveKey={saveKey}
            onRemoveKey={removeKey}
            modelCount={
              provider.id === 'gemini'
                ? geminiModels.length
                : provider.id === 'nvidia'
                  ? nvidiaModels.length
                  : undefined
            }
          />
        ))}
      </div>

      <div className="settings-security-note">
        <strong>SECURE STORAGE</strong>
        <span>
          {getCredentialStoreLabel()} · API keys are never displayed in full.
          {credentialStoreBackend === 'encrypted-local-storage'
            ? ' OS keychain: not available in this environment; keys are encrypted before saving.'
            : ' Keys are stored by the Windows OS credential store.'}
        </span>
      </div>
    </section>
  );
}