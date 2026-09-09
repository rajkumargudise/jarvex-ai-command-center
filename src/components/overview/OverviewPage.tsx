/**
 * Overview page shell. Reads the single shared AI state — no private
 * useOllama()/useAIProviders() copies.
 */
import { useState } from 'react';
import { useAIState } from '../../context/AIProvidersContext';
import type { Section } from '../../App';

function StatusCard({
  title,
  value,
  detail,
  dotClassName,
}: {
  title: string;
  value: string;
  detail: string;
  dotClassName?: string;
}) {
  return (
    <div className="status-card">
      <div className="card-label">{title}</div>
      <div className="card-value">
        <span className={`status-dot ${dotClassName ?? ''}`} />
        {value}
      </div>
      <div className="card-detail">{detail}</div>
    </div>
  );
}

const agents = [
  { name: 'Lead Generation', status: 'READY', description: 'Lead discovery, enrichment and verification', icon: '◎' },
  { name: 'CRM', status: 'READY', description: 'Customer and contact management', icon: '▦' },
  { name: 'Automation', status: 'READY', description: 'Workflow execution and orchestration', icon: '↯' },
  { name: 'Marketing', status: 'CONFIGURE', description: 'Campaigns and customer engagement', icon: '◈' },
  { name: 'ERP', status: 'CONFIGURE', description: 'Business operations and billing', icon: '▤' },
  { name: 'Research', status: 'PLANNED', description: 'Research and intelligence', icon: '⌕' },
];

export function OverviewPage({
  onNavigate,
}: {
  onNavigate: (section: Section) => void;
}) {
  const { ollama } = useAIState();
  const [message, setMessage] = useState('');

  const {
    status: ollamaStatus,
    models: ollamaModels,
    loading: ollamaLoading,
    refresh: refreshOllama,
  } = ollama;

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">COMMAND CENTER</div>
          <h1>Good afternoon, Raj.</h1>
          <p>
            Your local AI infrastructure is ready. Ask Jarvex to
            inspect, analyze, automate or build.
          </p>
        </div>
        <div className="hero-orb">
          <span>J</span>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">INFRASTRUCTURE</span>
            <h2>Local AI Status</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="live-badge">
              <span className="status-dot" />
              LIVE
            </span>
            <button
              className="ghost-button"
              onClick={() => void refreshOllama()}
              disabled={ollamaLoading}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="status-grid">
          <StatusCard
            title="Ollama"
            value={ollamaStatus.connected ? 'CONNECTED' : 'OFFLINE'}
            detail={
              ollamaLoading
                ? 'Checking local AI...'
                : ollamaStatus.connected
                  ? `v${ollamaStatus.version ?? 'unknown'} · ${ollamaModels.length} model${ollamaModels.length === 1 ? '' : 's'}`
                  : (ollamaStatus.error || 'Unable to connect to local Ollama')}
          />
          <StatusCard title="llama.cpp" value="RUNNING" detail="127.0.0.1:8080" />
          <StatusCard title="Repository" value="CONNECTED" detail="E:\GitHub Repos" />
          <StatusCard title="Agent Engine" value="READY" detail="Local orchestration" />
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CAPABILITY NETWORK</span>
            <h2>Agents</h2>
          </div>
          <button className="text-button" onClick={() => onNavigate('Agents')}>
            View all →
          </button>
        </div>

        <div className="agent-grid">
          {agents.map((agent) => (
            <button
              className="agent-card"
              key={agent.name}
              onClick={() => onNavigate('Agents')}
            >
              <div className="agent-top">
                <div className="agent-icon">{agent.icon}</div>
                <span className={`agent-status ${agent.status.toLowerCase()}`}>
                  {agent.status}
                </span>
              </div>
              <h3>{agent.name}</h3>
              <p>{agent.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="ask-section">
        <div className="ask-header">
          <div>
            <span className="eyebrow">JARVEX AI</span>
            <h2>What would you like to do?</h2>
          </div>
          <span className="model-label">Qwen3-0.6B · Local</span>
        </div>

        <div className="chat-input">
          <span className="spark">✦</span>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask Jarvex anything..."
            onKeyDown={(event) => {
              if (event.key === 'Enter' && message.trim()) {
                onNavigate('AI Chat')
              }
            }}
          />
          <button
            className="send-button"
            onClick={() => {
              if (message.trim()) onNavigate('AI Chat')
            }}
            aria-label="Send"
          >
            →
          </button>
        </div>

        <div className="suggestions">
          <button onClick={() => setMessage('Scan my repositories')}>
            Scan my repositories
          </button>
          <button onClick={() => setMessage('Show available agents')}>
            Show available agents
          </button>
          <button onClick={() => setMessage('Check local AI status')}>
            Check local AI status
          </button>
        </div>
      </section>
    </>
  );
}
