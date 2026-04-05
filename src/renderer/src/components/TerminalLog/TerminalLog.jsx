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
    command: '#7dd3fc',
    success: '#4ade80',
    error:   '#f87171',
    info:    '#94a3b8',
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
      background: '#060d1a',
      borderTop: '1px solid #1e293b',
      height: collapsed ? 32 : 160,
      transition: 'height 0.2s',
      flexShrink: 0,
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 32,
        borderBottom: collapsed ? 'none' : '1px solid #1e293b',
        cursor: 'pointer', flexShrink: 0,
      }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span style={{ fontSize: '0.7em', color: '#475569' }}>
          {collapsed ? '▶' : '▼'}
        </span>
        <span style={{
          fontSize: '0.72em', fontWeight: 600, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Terminal Log
        </span>
        <div style={{ flex: 1 }} />
        {!collapsed && (
          <button
            onClick={e => { e.stopPropagation(); copyAll() }}
            style={{
              background: 'none', border: 'none', color: '#475569',
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
              borderBottom: '1px solid #0d1520',
            }}>
              <span style={{ fontSize: '0.65em', color: '#334155', flexShrink: 0, marginTop: 1 }}>
                {formatTime(entry.timestamp)}
              </span>
              <span style={{
                fontSize: '0.72em',
                color: typeColour[entry.type] || '#94a3b8',
                wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                {typePrefix[entry.type] || ''}{entry.text}
              </span>
              {entry.type === 'command' && (
                <button
                  onClick={() => navigator.clipboard.writeText(entry.text)}
                  style={{
                    background: 'none', border: 'none', color: '#334155',
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
