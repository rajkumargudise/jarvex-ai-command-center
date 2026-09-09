/**
 * Unified model browser (Phase 9 fix).
 *
 * Consumes the single shared AI state — no independent hook copies, no
 * credential handling, no hardcoded model lists. Models come from provider
 * discovery and are grouped LOCAL (Ollama) / CLOUD (Gemini, NVIDIA NIM).
 */
import type { ReactNode } from 'react';
import type { AIModel } from '../../types/ai';
import { useAIState } from '../../context/AIProvidersContext';

function formatBytes(bytes?: number): string {
  if (!bytes) return 'Unknown size';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function OllamaModelRows({ models }: { models: AIModel[] }) {
  return (
    <div className="model-list">
      {models.map((model) => (
        <div className="model-row" key={model.name}>
          <div>
            <strong>{model.name}</strong>
            {(model.details?.parameterSize || model.details?.quantizationLevel) && (
              <span className="model-detail">
                {model.details?.parameterSize}
                {model.details?.quantizationLevel
                  ? ` · ${model.details.quantizationLevel}`
                  : ''}
              </span>
            )}
          </div>
          <span className="model-meta">{formatBytes(model.size)}</span>
        </div>
      ))}
    </div>
  );
}

function CloudModelRows({ models }: { models: AIModel[] }) {
  return (
    <div className="model-list">
      {models.map((model) => (
        <div className="model-row" key={model.name}>
          <div>
            <strong>{model.name}</strong>
            {model.displayName &&
              model.displayName !== model.name && (
                <span className="model-detail">
                  {model.displayName}
                </span>
              )}
            {model.description && (
              <span className="model-detail model-desc">
                {model.description}
              </span>
            )}
          </div>
          <span className="model-meta">CLOUD</span>
        </div>
      ))}
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  onRefresh,
  refreshing,
  children,
}: {
  eyebrow: string;
  title: string;
  onRefresh: () => void;
  refreshing: boolean;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <button
          className="ghost-button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          Refresh
        </button>
      </div>
      {children}
    </section>
  );
}

export function ModelsPage() {
  const { ollama, providers: providersState } = useAIState();

  const {
    status: ollamaStatus,
    models: ollamaModels,
    loading: ollamaLoading,
    refresh: refreshOllama,
  } = ollama;

  const {
    geminiModels,
    geminiModelsLoading,
    refreshGeminiModels,
    nvidiaModels,
    nvidiaModelsLoading,
    refreshNvidiaModels,
  } = providersState;

  return (
    <div className="model-arena">
      <SectionShell
        eyebrow="LOCAL AI"
        title="Models · Ollama"
        onRefresh={() => void refreshOllama()}
        refreshing={ollamaLoading}
      >
        {ollamaLoading ? (
          <div className="empty-state">Loading local models...</div>
        ) : !ollamaStatus.connected ? (
          <div className="empty-state">
            <strong>Connect Ollama to discover local models.</strong>
            {ollamaStatus.error && (
              <small className="error-state">{ollamaStatus.error}</small>
            )}
          </div>
        ) : ollamaModels.length === 0 ? (
          <div className="empty-state">No local models found.</div>
        ) : (
          <>
            <div className="model-summary">
              <span>Discovered models</span>
              <strong>{ollamaModels.length} models available</strong>
            </div>
            <OllamaModelRows models={ollamaModels} />
          </>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="CLOUD"
        title="Models · Google Gemini"
        onRefresh={() => void refreshGeminiModels()}
        refreshing={geminiModelsLoading}
      >
        {geminiModelsLoading ? (
          <div className="empty-state">Loading Gemini models...</div>
        ) : geminiModels.length === 0 ? (
          <div className="empty-state">
            <strong>No Gemini models found.</strong>
            <small>
              Add a Gemini API key in Settings → AI Providers, then refresh.
            </small>
          </div>
        ) : (
          <>
            <div className="model-summary">
              <span>Discovered models</span>
              <strong>{geminiModels.length} models available</strong>
            </div>
            <CloudModelRows models={geminiModels} />
          </>
        )}
      </SectionShell>

      <SectionShell
        eyebrow="CLOUD"
        title="Models · NVIDIA NIM"
        onRefresh={() => void refreshNvidiaModels()}
        refreshing={nvidiaModelsLoading}
      >
        {nvidiaModelsLoading ? (
          <div className="empty-state">Loading NVIDIA NIM models...</div>
        ) : nvidiaModels.length === 0 ? (
          <div className="empty-state">
            <strong>No NVIDIA NIM models found.</strong>
            <small>
              Add an NVIDIA API key in Settings → AI Providers, then refresh.
            </small>
          </div>
        ) : (
          <>
            <div className="model-summary">
              <span>Discovered models</span>
              <strong>{nvidiaModels.length} models available</strong>
            </div>
            <CloudModelRows models={nvidiaModels} />
          </>
        )}
      </SectionShell>
    </div>
  );
}
