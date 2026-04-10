import { useState, useEffect } from 'react'
import WaveformViewer from '../WaveformViewer/WaveformViewer.jsx'

const CLIP_COLOURS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#22c55e', '#06b6d4', '#f97316', '#84cc16',
]

const FORMAT_COLOURS = {
  mono:   '#64748b',
  stereo: '#3b82f6',
  '4ch':  '#8b5cf6',
  '9ch':  '#ec4899',
  '16ch': '#f59e0b',
}

export default function ClipBin({ onClipSelect, selectedClipId }) {
  const [clips, setClips] = useState([])
  const [filter, setFilter] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  // Load clips from store on mount
  useEffect(() => {
    loadClips()
  }, [])

  // Listen for new clips saved by the node graph
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.type === 'clipSaved') loadClips()
    }
    window.addEventListener('cdpStudio', handler)
    return () => window.removeEventListener('cdpStudio', handler)
  }, [])

  const loadClips = async () => {
    if (!window.cdpStudio) return
    const loaded = await window.cdpStudio.loadClips()
    setClips(loaded)
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Remove this clip from the Bin? (File will not be deleted.)')) return
    await window.cdpStudio.deleteClip(id)
    setClips(c => c.filter(cl => cl.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const handleStar = async (e, clip) => {
    e.stopPropagation()
    const updated = await window.cdpStudio.updateClip(clip.id, { starred: !clip.starred })
    setClips(cs => cs.map(c => c.id === clip.id ? { ...c, starred: !c.starred } : c))
  }

  const handleColour = async (e, clip, colour) => {
    e.stopPropagation()
    await window.cdpStudio.updateClip(clip.id, { colour })
    setClips(cs => cs.map(c => c.id === clip.id ? { ...c, colour } : c))
  }

  const handleRename = async (clip) => {
    if (!editName.trim()) return
    await window.cdpStudio.updateClip(clip.id, { name: editName.trim() })
    setClips(cs => cs.map(c => c.id === clip.id ? { ...c, name: editName.trim() } : c))
    setEditingId(null)
  }

  const filtered = clips.filter(c =>
    filter === ''
    || c.name.toLowerCase().includes(filter.toLowerCase())
    || c.command?.toLowerCase().includes(filter.toLowerCase())
  )

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '—'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--panel-bg)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 8px',
        borderBottom: '1px solid var(--border-dim)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--text-normal)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clip Bin
          </div>
          <div style={{
            fontSize: '0.7em', color: 'var(--text-muted)',
            background: 'var(--border-dim)', padding: '2px 8px', borderRadius: 10,
          }}>
            {clips.length} clips
          </div>
        </div>

        {/* Search */}
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search clips…"
          style={{
            width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)',
            borderRadius: 6, padding: '5px 10px', color: 'var(--text-bright)',
            fontSize: '0.78em', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Clip list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8em',
            marginTop: 40, lineHeight: 1.8,
          }}>
            <div style={{ fontSize: '1.6em', marginBottom: 8 }}>🎵</div>
            {clips.length === 0
              ? 'No clips yet.\nRun a CDP process\nto see results here.'
              : 'No clips match your search.'}
          </div>
        )}

        {filtered.map(clip => (
          <div key={clip.id}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('text/plain', clip.filePath)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            style={{
              borderRadius: 8, marginBottom: 6, overflow: 'hidden',
              border: `1px solid ${selectedClipId === clip.id ? clip.colour + '88' : 'var(--border-dim)'}`,
              background: selectedClipId === clip.id ? clip.colour + '11' : (expandedId === clip.id ? 'var(--border-dim)' : 'transparent'),
              cursor: 'pointer', transition: 'all 0.12s',
            }}
            onClick={() => {
              setExpandedId(expandedId === clip.id ? null : clip.id)
              onClipSelect?.(clip)
            }}
          >
            {/* Clip header row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px',
            }}>
              {/* Colour dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: clip.colour, flexShrink: 0,
              }} />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === clip.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(clip)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => handleRename(clip)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '100%', background: 'var(--border-dim)', border: '1px solid var(--accent)',
                      borderRadius: 4, padding: '2px 6px', color: 'var(--text-bright)',
                      fontSize: '0.78em',
                    }}
                  />
                ) : (
                  <div style={{
                    fontSize: '0.78em', fontWeight: 600, color: 'var(--text-bright)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {clip.starred && <span style={{ marginRight: 4 }}>⭐</span>}
                    {clip.name}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div style={{ fontSize: '0.68em', color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatTime(clip.duration)}
              </div>

              {/* Channel badge */}
              <span style={{
                fontSize: '0.62em', fontWeight: 700,
                padding: '1px 5px', borderRadius: 8,
                background: (FORMAT_COLOURS[clip.channelFormat] || '#64748b') + '22',
                color: FORMAT_COLOURS[clip.channelFormat] || '#64748b',
                border: `1px solid ${(FORMAT_COLOURS[clip.channelFormat] || '#64748b')}44`,
                flexShrink: 0,
              }}>
                {clip.channelFormat || 'mono'}
              </span>

              {/* Star button */}
              <button
                onClick={e => handleStar(e, clip)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '11px', color: clip.starred ? '#fbbf24' : 'var(--text-muted)',
                  padding: '2px', flexShrink: 0,
                }}
              >
                ★
              </button>
            </div>

            {/* Expanded detail */}
            {expandedId === clip.id && (
              <div style={{
                padding: '0 10px 10px',
                borderTop: '1px solid var(--border-light)',
              }}>

                {/* Waveform preview */}
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  <WaveformViewer clip={clip} compact={true} />
                </div>

                {/* Command that made it */}
                {clip.command && (
                  <div style={{
                    fontSize: '0.68em', color: 'var(--accent-text)', fontFamily: 'monospace',
                    background: 'var(--app-bg)', padding: '6px 8px', borderRadius: 5,
                    border: '1px solid var(--border-dim)', wordBreak: 'break-all',
                    marginBottom: 8,
                  }}>
                    $ {clip.command}
                  </div>
                )}

                {/* Date + sample rate */}
                <div style={{
                  display: 'flex', gap: 8, flexWrap: 'wrap',
                  fontSize: '0.68em', color: 'var(--text-muted)',
                  marginBottom: 8,
                }}>
                  <span>{formatDate(clip.createdAt)}</span>
                  <span>·</span>
                  <span>{(clip.sampleRate / 1000).toFixed(1)}kHz</span>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingId(clip.id); setEditName(clip.name) }}
                    style={actionBtnStyle}
                  >
                    Rename
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); window.cdpStudio?.showInFinder(clip.filePath) }}
                    style={actionBtnStyle}
                  >
                    Show in Finder
                  </button>
                  <button
                    onClick={e => handleDelete(e, clip.id)}
                    style={{ ...actionBtnStyle, color: '#ef4444', borderColor: '#ef444433' }}
                  >
                    Remove
                  </button>
                </div>

                {/* Colour picker */}
                <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                  {CLIP_COLOURS.map(c => (
                    <div key={c}
                      onClick={e => handleColour(e, clip, c)}
                      style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: c, cursor: 'pointer',
                        border: clip.colour === c ? '2px solid white' : '2px solid transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const actionBtnStyle = {
  background: 'var(--border-dim)', border: '1px solid var(--border-light)',
  color: 'var(--text-normal)', borderRadius: 6, padding: '3px 10px',
  fontSize: '0.72em', cursor: 'pointer',
}
