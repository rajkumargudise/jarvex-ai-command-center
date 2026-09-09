import { useState } from 'react'
import { AIProvidersProvider } from './context/AIProvidersContext'
import { ChatWindow } from './components/chat/ChatWindow'
import { AIProviders } from './components/settings/AIProviders'
import { ModelsPage } from './components/models/ModelsPage'
import { OverviewPage } from './components/overview/OverviewPage'
import './App.css'

export type Section =
  | 'Overview'
  | 'AI Chat'
  | 'Agents'
  | 'Repositories'
  | 'Models'
  | 'MCP / A2A'
  | 'Tasks'
  | 'Tools'
  | 'Settings'

export function AppInner() {
  const [active, setActive] = useState<Section>('Overview')

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
            <OverviewPage onNavigate={setActive} />
          ) : active === 'AI Chat' ? (
            <ChatWindow />
          ) : active === 'Models' ? (
            <ModelsPage />
          ) : active === 'Settings' ? (
            <AIProviders />
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

function App() {
  return (
    <AIProvidersProvider>
      <AppInner />
    </AIProvidersProvider>
  )
}

export default App
