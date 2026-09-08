import { useState } from 'react'
import './App.css'

type Section =
  | 'Overview'
  | 'AI Chat'
  | 'Agents'
  | 'Repositories'
  | 'Models'
  | 'MCP / A2A'
  | 'Tasks'
  | 'Tools'
  | 'Settings'

const navigation: { label: Section; icon: string; group?: string }[] = [
  { label: 'Overview', icon: '⌂' },
  { label: 'AI Chat', icon: '✦' },
  { label: 'Agents', icon: '◎' },
  { label: 'Repositories', icon: '▱' },
  { label: 'Models', icon: '◇' },
  { label: 'MCP / A2A', icon: '⇄' },
  { label: 'Tasks', icon: '☷' },
  { label: 'Tools', icon: '⌘' },
  { label: 'Settings', icon: '⚙' },
]

const agents = [
  { name: 'Lead Generation', status: 'READY', description: 'Lead discovery, enrichment and verification', icon: '◎' },
  { name: 'CRM', status: 'READY', description: 'Customer and contact management', icon: '▦' },
  { name: 'Automation', status: 'READY', description: 'Workflow execution and orchestration', icon: '↯' },
  { name: 'Marketing', status: 'CONFIGURE', description: 'Campaigns and customer engagement', icon: '◈' },
  { name: 'ERP', status: 'CONFIGURE', description: 'Business operations and billing', icon: '▤' },
  { name: 'Research', status: 'PLANNED', description: 'Research and intelligence', icon: '⌕' },
]

function App() {
  const [active, setActive] = useState<Section>('Overview')
  const [message, setMessage] = useState('')

  const isOverview = active === 'Overview'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">J</div>
          <div>
            <div className="brand-name">JARVEX</div>
            <div className="brand-product">AI COMMAND CENTER</div>
          </div>
        </div>

        <nav className="nav">
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${active === item.label ? 'active' : ''}`}
              onClick={() => setActive(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="connection">
            <span className="status-dot" />
            <div>
              <strong>LOCAL MODE</strong>
              <small>All systems on device</small>
            </div>
          </div>
          <div className="version">JARVEX AI v0.1.0</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>JARVEX AI</span>
            <span className="slash">/</span>
            <strong>{active}</strong>
          </div>

          <div className="topbar-status">
            <span className="status-dot" />
            <span>LOCAL</span>
            <div className="avatar">R</div>
          </div>
        </header>

        <div className="content">
          {isOverview ? (
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
                  <span className="live-badge">
                    <span className="status-dot" />
                    LIVE
                  </span>
                </div>

                <div className="status-grid">
                  <StatusCard title="Qwen3-0.6B" value="READY" detail="Local model" />
                  <StatusCard title="llama.cpp" value="RUNNING" detail="127.0.0.1:8080" />
                  <StatusCard title="Repository" value="CONNECTED" detail="D:\\GitHub Repos" />
                  <StatusCard title="Agent Engine" value="READY" detail="Local orchestration" />
                </div>
              </section>

              <section className="section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">CAPABILITY NETWORK</span>
                    <h2>Agents</h2>
                  </div>
                  <button className="text-button" onClick={() => setActive('Agents')}>
                    View all →
                  </button>
                </div>

                <div className="agent-grid">
                  {agents.map((agent) => (
                    <button
                      className="agent-card"
                      key={agent.name}
                      onClick={() => setActive('Agents')}
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
                        setActive('AI Chat')
                      }
                    }}
                  />
                  <button
                    className="send-button"
                    onClick={() => {
                      if (message.trim()) setActive('AI Chat')
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
          ) : (
            <section className="placeholder-page">
              <div className="placeholder-icon">
                {navigation.find((item) => item.label === active)?.icon}
              </div>
              <span className="eyebrow">JARVEX AI</span>
              <h1>{active}</h1>
              <p>
                This workspace is ready for the next integration step.
              </p>
              <div className="coming-card">
                <span className="status-dot" />
                <div>
                  <strong>Module initialized</strong>
                  <small>
                    Backend and agent capabilities will connect here next.
                  </small>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function StatusCard({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <div className="status-card">
      <div className="card-label">{title}</div>
      <div className="card-value">
        <span className="status-dot" />
        {value}
      </div>
      <div className="card-detail">{detail}</div>
    </div>
  )
}

export default App
