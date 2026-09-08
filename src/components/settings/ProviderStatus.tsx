import type { AIProviderStatus } from '../../types/ai';
import { getProviderStatusLabel } from '../../services/providers';

interface ProviderStatusProps {
  status: AIProviderStatus;
  message?: string;
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

export function ProviderStatus({ status, message }: ProviderStatusProps) {
  return (
    <div className={`provider-status status-${statusClass(status)}`}>
      <span className="page-status-dot" />
      <span className="status-badge">
        {getProviderStatusLabel(status).toUpperCase()}
      </span>
      {message && <span className="status-message">{message}</span>}
    </div>
  );
}