import type { AIProviderConfig, AIProviderStatus } from '../../types/ai';
import { getProviderStatusLabel } from '../../services/providers';
import { APIKeyInput } from './APIKeyInput';

interface ProviderCardProps {
  provider: AIProviderConfig;
  onToggle: (providerId: string) => void;
  onTest: (providerId: string) => void;
  onSaveKey: (providerId: string, key: string) => Promise<void>;
  onRemoveKey: (providerId: string) => void;
  modelCount?: number;
}

function statusClass(status: AIProviderStatus): string {
  switch (status) {
    case 'available':
      return 'available';
    case 'unavailable':
      return 'unavailable';
    case 'not_configured':
      return 'not-configured';
    case 'checking':
      return 'checking';
    case 'error':
      return 'error';
    default:
      return '';
  }
}

export function ProviderCard({
  provider,
  onToggle,
  onTest,
  onSaveKey,
  onRemoveKey,
  modelCount,
}: ProviderCardProps) {
  const isCloud = provider.type === 'cloud';
  const isTesting = provider.status === 'checking';

  return (
    <div className={`provider-card ${provider.enabled ? 'enabled' : 'disabled'}`}>
      <div className="provider-card-header">
        <div>
          <div className="provider-name-row">
            <strong>{provider.name}</strong>
            <span className={`provider-type-badge ${isCloud ? 'cloud' : 'local'}`}>
              {isCloud ? 'CLOUD' : 'LOCAL'}
            </span>
          </div>
          {provider.description && (
            <p className="provider-description">{provider.description}</p>
          )}
        </div>
        <div className="provider-toggle">
          <button
            className={`toggle-switch ${provider.enabled ? 'on' : 'off'}`}
            onClick={() => onToggle(provider.id)}
            type="button"
            aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.name}`}
            title={provider.enabled ? 'Enabled' : 'Disabled'}
          >
            <span className="toggle-knob" />
          </button>
          <span className="toggle-label">
            {provider.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className={`provider-status status-${statusClass(provider.status)}`}>
        {isTesting ? (
          <span className="status-badge">CHECKING</span>
        ) : (
          <span className="status-badge">
            {getProviderStatusLabel(provider.status).toUpperCase()}
          </span>
        )}
        {provider.status === 'available' && typeof modelCount === 'number' && (
          <span className="provider-model-count">
            {modelCount} model{modelCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isCloud && (
        <div className="provider-key-section">
          <div className="provider-key-label">
            API Key
            {provider.apiKeyConfigured ? (
              <span className="key-configured-label">Configured</span>
            ) : (
              <span className="key-not-configured-label">Not configured</span>
            )}
          </div>
          <APIKeyInput
            providerId={provider.id}
            hasKey={provider.apiKeyConfigured}
            onSave={onSaveKey}
            onRemove={onRemoveKey}
            disabled={isTesting}
          />
        </div>
      )}

      <div className="provider-actions">
        <button
          className="ghost-button"
          onClick={() => onTest(provider.id)}
          disabled={isTesting}
          type="button"
        >
          {isTesting ? 'Testing...' : 'Test Connection'}
        </button>
        {isCloud && provider.apiKeyConfigured && (
          <button
            className="text-button danger"
            onClick={() => onRemoveKey(provider.id)}
            type="button"
          >
            Reset Provider
          </button>
        )}
      </div>
    </div>
  );
}