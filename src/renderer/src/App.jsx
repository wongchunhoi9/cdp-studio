import { useState, useRef } from 'react'
import NodeGraph from './components/NodeGraph/NodeGraph.jsx'
import ClipBin from './components/ClipBin/ClipBin.jsx'
import TerminalLog from './components/TerminalLog/TerminalLog.jsx'
import WaveformViewer from './components/WaveformViewer/WaveformViewer.jsx'
import SettingsPanel from './components/SettingsPanel/SettingsPanel.jsx'

// AI Sidebar — inline for Phase 1, uses Anthropic API
const CDP_SYSTEM = `You are an expert on the Composers' Desktop Project (CDP) — a suite of ~500 command-line sound transformation tools. The user is a clarinetist learning CDP. Answer questions about any CDP command, give exact terminal syntax, explain parameters in musical terms, and suggest creative uses for clarinet sounds. Format with **bold** for key terms and \`code\` for commands. Be concise and practical.`

function AISidebar({ focusedCommand, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  // Auto-ask about the focused command when it changes
  const lastFocusRef = useRef(null)
  if (focusedCommand && focusedCommand.id !== lastFocusRef.current) {
    lastFocusRef.current = focusedCommand.id
    setTimeout(() => send(`Explain the ${focusedCommand.label} command and suggest good starting parameters for clarinet sounds.`), 100)
  }

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const next = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: CDP_SYSTEM,
          messages: next,
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'No response.'
      setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ Connection error.' }])
    }
    setLoading(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const renderMd = (t) => {
    t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/`([^`\n]+)`/g, '<code style="background:#1e293b;color:#7dd3fc;padding:2px 5px;border-radius:3px;font-size:0.85em">$1</code>')
    t = t.replace(/\n/g, '<br/>')
    return t
  }

  return (
    <div style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#0a1220', borderLeft: '1px solid #1e293b',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.8em', fontWeight: 700, color: '#94a3b8' }}>AI Assistant</div>
          {focusedCommand && (
            <div style={{ fontSize: '0.68em', color: '#3b82f6' }}>{focusedCommand.label}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1em' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {messages.length === 0 && (
          <div style={{ fontSize: '0.75em', color: '#334155', lineHeight: 1.7 }}>
            Ask anything about CDP commands, parameters, or techniques.<br/><br/>
            Click <strong style={{ color: '#475569' }}>? Ask AI</strong> on any node to get instant help about that specific process.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: m.role === 'user' ? '#1e3a5f' : '#1a1f2e',
            border: `1px solid ${m.role === 'user' ? '#2d5a8e' : '#1e293b'}`,
            fontSize: '0.78em', color: '#e2e8f0', lineHeight: 1.6,
          }}
            dangerouslySetInnerHTML={{ __html: renderMd(m.content) }}
          />
        ))}
        {loading && (
          <div style={{ fontSize: '0.75em', color: '#475569', padding: '4px 0' }}>Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about CDP…"
            disabled={loading}
            style={{
              flex: 1, background: '#1e293b', border: '1px solid #334155',
              color: '#f1f5f9', borderRadius: 6, padding: '6px 8px',
              fontSize: '0.75em',
            }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{
            background: '#1e3a5f', border: '1px solid #3b82f6', color: '#7dd3fc',
            borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.8em',
          }}>➤</button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [selectedClip, setSelectedClip] = useState(null)
  const [showAI, setShowAI] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [focusedCommand, setFocusedCommand] = useState(null)
  const [activeTab, setActiveTab] = useState('graph') // 'graph' | 'viewer'

  const handleAIHelp = (command) => {
    setFocusedCommand(command)
    setShowAI(true)
  }

  // When leaving the viewer tab, pass a null key signal to WaveformViewer
  // by toggling selectedClip — WaveSurfer destroys on filePath change anyway
  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#090f1a', color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, sans-serif",
      overflow: 'hidden',
    }}>

      {/* ── Title bar ─────────────────────────────────────────────── */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center',
        padding: '0 80px 0 16px', // 80px left padding for macOS traffic lights
        borderBottom: '1px solid #1e293b',
        background: '#060d1a', flexShrink: 0,
        WebkitAppRegion: 'drag', // make it draggable like a native title bar
        userSelect: 'none',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 24,
        }}>
          {/* Main tabs */}
          {[
            { id: 'graph',  label: '⬡ Node Graph' },
            { id: 'viewer', label: '〜 Waveform' },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                background: 'none', border: 'none',
                color: activeTab === tab.id ? '#f1f5f9' : '#475569',
                fontSize: '0.78em', fontWeight: 600, cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                paddingBottom: 2,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: '#1e293b', border: '1px solid #334155',
              color: '#64748b', borderRadius: 6, padding: '3px 10px',
              fontSize: '0.72em', cursor: 'pointer',
            }}
          >
            ⚙ Settings
          </button>
          <button
            onClick={() => setShowAI(a => !a)}
            style={{
              background: showAI ? '#1e3a5f' : '#1e293b',
              border: `1px solid ${showAI ? '#3b82f6' : '#334155'}`,
              color: showAI ? '#7dd3fc' : '#64748b',
              borderRadius: 6, padding: '3px 10px', fontSize: '0.72em',
              cursor: 'pointer',
            }}
          >
            🤖 AI
          </button>
        </div>
      </div>

      {/* ── Main content area ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Left: Clip Bin */}
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid #1e293b',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <ClipBin
            onClipSelect={(clip) => {
              setSelectedClip(clip)
              setActiveTab('viewer')
            }}
            selectedClipId={selectedClip?.id}
          />
        </div>

        {/* Centre: Node Graph and Waveform Viewer — both always mounted, toggled with CSS */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Node Graph — always mounted so patch state is never lost */}
          <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'graph' ? 'flex' : 'none', flexDirection: 'column' }}>
            <NodeGraph onAIHelp={handleAIHelp} />
          </div>

          {/* Waveform Viewer */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24, display: activeTab === 'viewer' ? 'block' : 'none' }}>
            {selectedClip ? (
              <div>
                <div style={{ fontSize: '0.75em', color: '#475569', marginBottom: 16 }}>
                  Viewing clip from Clip Bin — click any clip on the left to load it here
                </div>
                <WaveformViewer clip={selectedClip} compact={false} />

                {/* Command that made this clip */}
                {selectedClip.command && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: '0.72em', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                      CDP Command
                    </div>
                    <div style={{
                      fontFamily: 'monospace', fontSize: '0.78em', color: '#7dd3fc',
                      background: '#0f172a', border: '1px solid #1e3a5f',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      $ {selectedClip.command}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                height: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#334155',
                flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontSize: '2em' }}>〜</div>
                <div style={{ fontSize: '0.85em' }}>Select a clip from the Clip Bin to view its waveform</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Sidebar (collapsible) */}
        {showAI && (
          <AISidebar
            focusedCommand={focusedCommand}
            onClose={() => { setShowAI(false); setFocusedCommand(null) }}
          />
        )}
      </div>

      {/* ── Terminal Log ──────────────────────────────────────────── */}
      <TerminalLog />

      {/* ── Settings Panel ────────────────────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
