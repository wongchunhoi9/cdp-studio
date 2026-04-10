import { useState, useEffect, useRef } from 'react'

export default function TerminalLog() {
  const [entries, setEntries] = useState([
    {
      type: 'info',
      text: 'CDP Studio ready. Run a process to see commands here.',
      timestamp: new Date().toISOString(),
    }
  ])
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!window.cdpStudio) return
    const unsubscribe = window.cdpStudio.onTerminalEntry((entry) => {
      setEntries(prev => [...prev.slice(-499), entry]) // keep last 500
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, collapsed])

  const typeColour = {
    command: 'var(--accent-text)',
    success: '#4ade80',
    error:   '#f87171',
    info:    'var(--text-normal)',
    warn:    '#fbbf24',
  }

  const typePrefix = {
    command: '$ ',
    success: '✓ ',
    error:   '✗ ',
    info:    '  ',
    warn:    '⚠ ',
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toTimeString().slice(0, 8)
  }

  const copyAll = () => {
    const text = entries.map(e => `[${formatTime(e.timestamp)}] ${typePrefix[e.type] || ''}${e.text}`).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--terminal-bg)',
      borderTop: '1px solid var(--border-dim)',
      height: collapsed ? 32 : 160,
      transition: 'height 0.2s',
      flexShrink: 0,
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 32,
        borderBottom: collapsed ? 'none' : '1px solid var(--border-dim)',
        cursor: 'pointer', flexShrink: 0,
      }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>
          {collapsed ? '▶' : '▼'}
        </span>
        <span style={{
          fontSize: '0.72em', fontWeight: 600, color: 'var(--text-normal)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Terminal Log
        </span>
        <div style={{ flex: 1 }} />
        {!collapsed && (
          <button
            onClick={e => { e.stopPropagation(); copyAll() }}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.7em', padding: '2px 6px',
            }}
          >
            Copy All
          </button>
        )}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: entries[entries.length - 1]?.type === 'error' ? '#ef4444' : '#22c55e',
        }} />
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div style={{
          flex: 1, overflowY: 'auto', padding: '4px 12px',
          fontFamily: 'monospace',
        }}>
          {entries.map((entry, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '2px 0',
              borderBottom: '1px solid var(--border-dim)',
            }}>
              <span style={{ fontSize: '0.65em', color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }}>
                {formatTime(entry.timestamp)}
              </span>
              <span style={{
                fontSize: '0.72em',
                color: typeColour[entry.type] || 'var(--text-normal)',
                wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                {typePrefix[entry.type] || ''}{entry.text}
              </span>
              {entry.type === 'command' && (
                <button
                  onClick={() => navigator.clipboard.writeText(entry.text)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '0.65em', padding: '0 4px',
                    flexShrink: 0, marginLeft: 'auto',
                  }}
                  title="Copy command"
                >
                  copy
                </button>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
