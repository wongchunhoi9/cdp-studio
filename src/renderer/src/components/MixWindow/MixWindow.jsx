import { useState, useRef } from 'react'

// ── Constants ───────────────────────────────────────────────────────
const TRACK_H    = 62   // px per track row (taller to fit pan knob)
const RULER_H    = 26   // px ruler height
const SIDEBAR_W  = 220  // px left sidebar
const MIN_PPS    = 15   // min pixels per second
const MAX_PPS    = 200  // max pixels per second
const DEFAULT_PPS = 55
const KNOB_SIZE  = 26   // px for pan knob diameter

// ── Utilities ───────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function fmtDur(s) {
  if (!s || isNaN(s)) return '—'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return m > 0 ? `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${sec}s`
}

function fmtRuler(s) {
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `${s}s`
}

function preflight(items) {
  const errs = []
  if (!items.length) return errs
  const srs = [...new Set(items.map(i => i.sampleRate).filter(Boolean))]
  if (srs.length > 1) errs.push(`Sample rate mismatch: ${srs.join(' / ')} Hz — all clips must use the same rate`)
  const bad = items.filter(i => i.channels > 2)
  if (bad.length) errs.push(`${bad.length} clip(s) have >2 channels — SUBMIX supports mono/stereo only`)
  return errs
}

// ── Root component ──────────────────────────────────────────────────
export default function MixWindow() {
  const [items, setItems]       = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [outName, setOutName]   = useState('mix_output')
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(null)
  const [renderOk, setRenderOk] = useState(null)
  const [showMixfile, setShowMixfile] = useState(false)
  const [pps, setPps] = useState(DEFAULT_PPS)

  const addClip = (clip) => {
    setItems(prev => [...prev, {
      mixId: uid(),
      name: clip.name,
      filePath: clip.filePath,
      channels: clip.channels || 1,
      sampleRate: clip.sampleRate || 44100,
      duration: clip.duration || 0,
      channelFormat: clip.channelFormat || (clip.channels === 1 ? 'mono' : 'stereo'),
      colour: clip.colour || '#3b82f6',
      start: 0, level: 1.0, pan: 0,
    }])
    setRenderOk(null)
    setRenderError(null)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const clipJson = e.dataTransfer.getData('application/cdp-clip')
    if (clipJson) { try { addClip(JSON.parse(clipJson)); return } catch {} }
    const filePath = e.dataTransfer.getData('text/plain')
    if (filePath && /\.(wav|aif|aiff)$/i.test(filePath)) {
      const info = await window.cdpStudio.getAudioInfo(filePath)
      const name = filePath.split('/').pop().replace(/\.[^.]+$/, '')
      addClip({ name, filePath, channels: info.channels, sampleRate: info.sampleRate, duration: info.duration, channelFormat: info.channels === 1 ? 'mono' : 'stereo', colour: '#3b82f6' })
    }
  }

  const updateItem = (mixId, updates) => {
    setItems(prev => prev.map(it => it.mixId === mixId ? { ...it, ...updates } : it))
    setRenderOk(null)
  }

  const removeItem = (mixId) => {
    setItems(prev => prev.filter(it => it.mixId !== mixId))
    setRenderOk(null); setRenderError(null)
  }

  const handleRender = async () => {
    const errors = preflight(items)
    if (errors.length) { setRenderError(errors.join('\n')); return }
    setRenderError(null); setRenderOk(null); setRendering(true)
    try {
      const result = await window.cdpStudio.mixRender(items, outName)
      if (result.success) {
        const info = await window.cdpStudio.getAudioInfo(result.outputPath)
        await window.cdpStudio.saveClip({ name: outName, filePath: result.outputPath, command: result.command, channels: info.channels, sampleRate: info.sampleRate, duration: info.duration, colour: '#22c55e' })
        window.dispatchEvent(new CustomEvent('cdpStudio', { detail: { type: 'clipSaved' } }))
        setRenderOk(`Saved to Clip Bin as "${outName}"`)
      } else {
        setRenderError(result.stderr || result.error || 'Render failed')
      }
    } catch (err) {
      setRenderError(err.message)
    }
    setRendering(false)
  }

  // Mixfile preview (basenames only, for readability)
  const mixfileLines = items.map(item => {
    const name = item.filePath.split('/').pop()
    const start = Number(item.start).toFixed(3)
    const level = Number(item.level).toFixed(4)
    if (Number(item.channels) <= 1) return `${name}  ${start}  1  ${level}  ${Number(item.pan).toFixed(4)}`
    return `${name}  ${start}  2  ${level}`
  })

  const errors = preflight(items)
  const canRender = items.length > 0 && errors.length === 0 && !rendering

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--app-bg)', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, padding: '8px 14px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--border-dim)' }}>
        <span style={{ fontSize: '0.75em', fontWeight: 800, color: 'var(--text-normal)', letterSpacing: '0.1em', marginRight: 4 }}>MIX</span>
        <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>Output</span>
        <input value={outName} onChange={e => setOutName(e.target.value)}
          style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: 'var(--text-bright)', borderRadius: 6, padding: '4px 8px', fontSize: '0.78em', width: 155 }} />

        <button onClick={() => setShowMixfile(m => !m)} style={{
          background: showMixfile ? 'var(--accent-bg)' : 'var(--border-dim)',
          border: `1px solid ${showMixfile ? 'var(--accent)' : 'var(--border-light)'}`,
          color: showMixfile ? 'var(--accent-text)' : 'var(--text-normal)',
          borderRadius: 6, padding: '4px 9px', fontSize: '0.7em', cursor: 'pointer',
        }}>¶ Mixfile</button>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6, borderLeft: '1px solid var(--border-dim)', paddingLeft: 10 }}>
          <span style={{ fontSize: '0.67em', color: 'var(--text-muted)' }}>Zoom</span>
          <button onClick={() => setPps(p => Math.max(MIN_PPS, Math.round(p / 1.5)))} style={S.zoomBtn}>−</button>
          <input type="range" min={MIN_PPS} max={MAX_PPS} step={1} value={pps}
            onChange={e => setPps(Number(e.target.value))}
            style={{ width: 72, cursor: 'pointer', accentColor: 'var(--accent)' }} />
          <button onClick={() => setPps(p => Math.min(MAX_PPS, Math.round(p * 1.5)))} style={S.zoomBtn}>+</button>
          <span style={{ fontSize: '0.65em', color: 'var(--text-muted)', width: 36 }}>{pps}px/s</span>
        </div>

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.68em', color: 'var(--text-muted)' }}>{items.length} clip{items.length !== 1 ? 's' : ''}</span>
        <button onClick={handleRender} disabled={!canRender} style={{
          background: canRender ? 'var(--accent-bg)' : 'var(--border-dim)',
          border: `1px solid ${canRender ? 'var(--accent)' : 'var(--border-light)'}`,
          color: canRender ? 'var(--accent-text)' : 'var(--text-muted)',
          borderRadius: 6, padding: '5px 13px', fontSize: '0.78em', fontWeight: 700,
          cursor: canRender ? 'pointer' : 'not-allowed',
        }}>
          {rendering ? '⟳ Rendering…' : '▶ Render Mix'}
        </button>
      </div>

      {/* ── Mixfile preview ───────────────────────────────────── */}
      {showMixfile && (
        <div style={{ background: '#050505', borderBottom: '1px solid var(--border-dim)', padding: '7px 18px', flexShrink: 0 }}>
          <pre style={{ fontFamily: 'monospace', fontSize: '0.7em', color: '#7dd3fc', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 110, overflowY: 'auto' }}>
            {mixfileLines.length > 0 ? mixfileLines.join('\n') : '; (empty — drop clips below)'}
          </pre>
        </div>
      )}

      {/* ── Banners ───────────────────────────────────────────── */}
      {(errors.length > 0 || renderError) && (
        <div style={{ background: '#ef444415', borderBottom: '1px solid #ef444430', padding: '6px 18px', flexShrink: 0, fontSize: '0.74em', color: '#ef4444', position: 'relative' }}>
          {(renderError || errors.join('\n')).split('\n').map((l, i) => <div key={i}>{l}</div>)}
          {renderError && <button onClick={() => setRenderError(null)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9em' }}>✕</button>}
        </div>
      )}
      {renderOk && (
        <div style={{ background: '#22c55415', borderBottom: '1px solid #22c55430', padding: '6px 18px', flexShrink: 0, fontSize: '0.74em', color: '#4ade80', position: 'relative' }}>
          ✓ {renderOk}
          <button onClick={() => setRenderOk(null)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4ade80', fontSize: '0.9em' }}>✕</button>
        </div>
      )}

      {/* ── DAW area ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <DAWLayout
          items={items}
          pps={pps}
          onUpdateStart={(mixId, start) => updateItem(mixId, { start })}
          onUpdateItem={updateItem}
          onRemove={removeItem}
          dragOver={dragOver}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        />
      </div>
    </div>
  )
}

// ── DAW layout: sidebar + scrollable timeline ───────────────────────
function DAWLayout({ items, pps, onUpdateStart, onUpdateItem, onRemove, dragOver, onDragOver, onDragLeave, onDrop }) {
  const isEmpty = items.length === 0

  const totalDuration = items.length > 0
    ? Math.max(...items.map(i => (i.start || 0) + (i.duration || 0)))
    : 0
  const timelineWidth = Math.max(totalDuration * pps + 360, 1000)

  // Ruler ticks
  const rulerStep = pps >= 80 ? 0.5 : pps >= 35 ? 1 : pps >= 18 ? 2 : 5
  const totalS    = Math.ceil(totalDuration) + Math.ceil(8 / rulerStep) * rulerStep
  const rulerTicks = []
  for (let s = 0; s <= totalS; s = Math.round((s + rulerStep) * 100) / 100) {
    rulerTicks.push({ time: s, major: Math.round(s * 100) % Math.round(Math.max(rulerStep * 2, 1) * 100) === 0 })
  }

  // Drag-to-reposition blocks
  const handleBlockMouseDown = (e, item) => {
    e.preventDefault()
    const startX    = e.clientX
    const startVal  = item.start || 0
    const onMove = (ev) => {
      const dx       = ev.clientX - startX
      const newStart = Math.max(0, startVal + dx / pps)
      onUpdateStart(item.mixId, Math.round(newStart * 10) / 10)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Sidebar + Timeline rows ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar ─────────────────────────────────── */}
        <div style={{ width: SIDEBAR_W, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-dim)', background: 'var(--panel-bg)' }}>

          {/* Ruler spacer (keeps height aligned with ruler) */}
          <div style={{ height: RULER_H, flexShrink: 0, borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
            <span style={{ fontSize: '0.6em', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tracks</span>
          </div>

          {/* Per-track controls */}
          {items.map((item, idx) => (
            <TrackSidebar
              key={item.mixId}
              item={item}
              index={idx}
              onUpdate={u => onUpdateItem(item.mixId, u)}
              onRemove={() => onRemove(item.mixId)}
            />
          ))}

          {/* Empty filler */}
          {isEmpty && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.72em', padding: 16, textAlign: 'center' }}>
              Drop clips to add tracks
            </div>
          )}
        </div>

        {/* ── Scrollable timeline ──────────────────────────── */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ minWidth: timelineWidth, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

            {/* Ruler */}
            <div style={{ height: RULER_H, position: 'relative', flexShrink: 0, background: 'var(--panel-bg)', borderBottom: '1px solid var(--border-dim)', overflow: 'hidden' }}>
              {rulerTicks.map((t, i) => (
                <div key={i} style={{ position: 'absolute', left: t.time * pps, top: 0, height: '100%', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: 1, height: t.major ? 14 : 7, background: t.major ? 'var(--text-muted)' : 'var(--border-light)' }} />
                  {t.major && (
                    <span style={{ position: 'absolute', top: 4, left: 4, fontSize: '0.6em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmtRuler(t.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Track lanes */}
            {items.map((item, idx) => (
              <div key={item.mixId} style={{
                height: TRACK_H, flexShrink: 0, position: 'relative',
                borderBottom: '1px solid var(--border-dim)',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)',
                overflow: 'hidden',
              }}>
                {/* Second gridlines */}
                <Gridlines pps={pps} width={timelineWidth} />

                {/* Clip block */}
                <ClipBlock item={item} pps={pps} onMouseDown={handleBlockMouseDown} />
              </div>
            ))}

            {/* Empty lane placeholder */}
            {isEmpty && (
              <div style={{ height: 72, display: 'flex', alignItems: 'center', paddingLeft: 20, color: 'var(--text-muted)', fontSize: '0.74em', borderBottom: '1px solid var(--border-dim)' }}>
                ← timeline will appear here
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Drop zone ────────────────────────────────────────── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          flexShrink: 0,
          minHeight: 56,
          margin: '8px 14px 14px',
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-light)'}`,
          borderRadius: 10,
          background: dragOver ? 'var(--accent-bg)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 5,
          color: dragOver ? 'var(--accent-text)' : 'var(--text-muted)',
          fontSize: '0.76em',
          transition: 'border-color 0.12s, background 0.12s',
          cursor: 'default',
        }}
      >
        <span style={{ fontSize: '1.3em', lineHeight: 1 }}>⊕</span>
        <span>{isEmpty ? 'Drop clips from the Clip Bin to start your mix' : 'Drop more clips here'}</span>
      </div>
    </div>
  )
}

// ── Track sidebar row ───────────────────────────────────────────────
function TrackSidebar({ item, index, onUpdate, onRemove }) {
  const isStereo = item.channels > 1
  return (
    <div style={{
      height: TRACK_H, flexShrink: 0, padding: '5px 10px',
      borderBottom: '1px solid var(--border-dim)',
      background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.colour, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: '0.74em', fontWeight: 600, color: 'var(--text-bright)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </span>
        <span style={{ fontSize: '0.58em', color: 'var(--text-muted)', flexShrink: 0 }}>{item.channelFormat}</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7em', padding: '1px 3px', flexShrink: 0, lineHeight: 1 }}>✕</button>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={S.ctrlLabel}>start</span>
        <input type="number" value={item.start} min={0} step={0.1}
          onChange={e => onUpdate({ start: Math.max(0, parseFloat(e.target.value) || 0) })}
          style={{ ...S.ctrlInput, width: 42 }} />
        <span style={S.ctrlLabel}>vol</span>
        <input type="number" value={item.level} min={0} max={4} step={0.05}
          onChange={e => onUpdate({ level: Math.max(0, Math.min(4, parseFloat(e.target.value) || 1)) })}
          style={{ ...S.ctrlInput, width: 36 }} />
        {!isStereo && (
          <Knob
            value={item.pan}
            onChange={pan => onUpdate({ pan })}
            colour={item.colour}
          />
        )}
        {isStereo && (
          <span style={{ fontSize: '0.58em', color: 'var(--text-muted)', fontStyle: 'italic' }}>stereo</span>
        )}
      </div>
    </div>
  )
}

// ── Pan knob ────────────────────────────────────────────────────────
// Rotary knob for pan (-1 L … 0 C … +1 R).
// Drag up/down to change; double-click to reset to center.
function Knob({ value, onChange, colour = '#3b82f6' }) {
  const sz  = KNOB_SIZE
  const cx  = sz / 2
  const cy  = sz / 2
  const arc = sz / 2 - 4   // radius of the arc track

  // Map value (-1…+1) to degrees from top (−135 … +135)
  const deg = (value + 1) / 2 * 270 - 135

  // Point on circle at given degrees-from-top
  const pt = (d, r = arc) => ({
    x: +(cx + r * Math.cos((d - 90) * Math.PI / 180)).toFixed(2),
    y: +(cy + r * Math.sin((d - 90) * Math.PI / 180)).toFixed(2),
  })

  const tStart  = pt(-135)   // track arc start
  const tEnd    = pt(135)    // track arc end
  const vCenter = pt(0)      // zero-center point on arc
  const vEnd    = pt(deg)    // current value point on arc
  const ind     = pt(deg, arc - 2)  // indicator tip (slightly inset)

  const panLabel = value === 0 ? 'C'
    : value < 0 ? `L${(-value).toFixed(2).replace('0.', '.')}`
    : `R${value.toFixed(2).replace('0.', '.')}`

  const handleMouseDown = (e) => {
    e.preventDefault()
    const startY = e.clientY, startVal = value
    const onMove = ev => {
      const delta = (startY - ev.clientY) / 90  // 90px = full range
      const next  = Math.max(-1, Math.min(1, startVal + delta))
      onChange(Math.round(next * 100) / 100)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Value arc: from center (0°) to current position.
  // Since deg ∈ [−135, +135], arc is always ≤135° → large-arc = 0.
  // Sweep clockwise (1) when panning right, counterclockwise (0) when left.
  const valueArcPath = value !== 0
    ? `M ${vCenter.x} ${vCenter.y} A ${arc} ${arc} 0 0 ${deg > 0 ? 1 : 0} ${vEnd.x} ${vEnd.y}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
      <svg
        width={sz} height={sz}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(0)}
        style={{ cursor: 'ns-resize', display: 'block', userSelect: 'none' }}
        title={`Pan: ${panLabel} — drag up/down, double-click to center`}
      >
        {/* Background track arc: −135° → +135° clockwise, 270° so large-arc=1 */}
        <path
          d={`M ${tStart.x} ${tStart.y} A ${arc} ${arc} 0 1 1 ${tEnd.x} ${tEnd.y}`}
          fill="none" stroke="var(--border-light)" strokeWidth={2} strokeLinecap="round"
        />
        {/* Value arc */}
        {valueArcPath && (
          <path d={valueArcPath}
            fill="none" stroke={colour} strokeWidth={2} strokeLinecap="round" opacity="0.9"
          />
        )}
        {/* Knob body */}
        <circle cx={cx} cy={cy} r={arc - 2}
          fill="var(--border-dim)" stroke="var(--border-light)" strokeWidth={0.5}
        />
        {/* Center reference dot at 12 o'clock */}
        <circle cx={pt(0, arc + 1).x} cy={pt(0, arc + 1).y} r={1}
          fill="var(--text-muted)" opacity="0.5"
        />
        {/* Indicator line */}
        <line x1={cx} y1={cy} x2={ind.x} y2={ind.y}
          stroke={value === 0 ? 'var(--text-muted)' : colour}
          strokeWidth={1.5} strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: '0.54em', color: value === 0 ? 'var(--text-muted)' : colour, lineHeight: 1, letterSpacing: '0.02em' }}>
        {panLabel}
      </span>
    </div>
  )
}

// ── Clip block (draggable) ──────────────────────────────────────────
function ClipBlock({ item, pps, onMouseDown }) {
  const left  = (item.start || 0) * pps
  const width = Math.max((item.duration || 1) * pps, 28)

  return (
    <div
      onMouseDown={e => onMouseDown(e, item)}
      title={`${item.name}  |  start: ${item.start}s  |  duration: ${fmtDur(item.duration)}\nDrag to reposition`}
      style={{
        position: 'absolute',
        left,
        width,
        top: 5,
        height: TRACK_H - 10,
        background: item.colour + 'cc',
        borderLeft: `3px solid ${item.colour}`,
        borderRadius: 4,
        cursor: 'grab',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        padding: '0 7px',
        gap: 5,
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Waveform decoration — density scales with block width */}
      <WaveformBars name={item.name} blockWidth={width} />

      {/* Label (over bars) */}
      <span style={{
        position: 'absolute',
        left: 8, top: 0, bottom: 0,
        display: 'flex', alignItems: 'center',
        fontSize: '0.7em', fontWeight: 700,
        color: '#fff',
        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        maxWidth: width - 52,
        pointerEvents: 'none',
      }}>
        {item.name}
      </span>

      {/* Duration badge (right edge) */}
      {width > 60 && (
        <span style={{
          position: 'absolute', right: 5, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center',
          fontSize: '0.6em', color: 'rgba(255,255,255,0.65)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {fmtDur(item.duration)}
        </span>
      )}
    </div>
  )
}

// ── Decorative waveform bars — density scales with block width ───────
// Bars are a fixed 2px wide with 1px gap so zooming in reveals more of them.
// Heights are deterministic per clip name so each clip looks distinct.

function seededBars(seed, count) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return Array.from({ length: count }, () => {
    h = (Math.imul(1664525, h) + 1013904223) | 0
    const r = (h >>> 0) / 0xFFFFFFFF
    // Power curve makes quiet valleys and loud peaks look more natural
    return Math.pow(r, 0.55) * 0.82 + 0.18
  })
}

function WaveformBars({ name, blockWidth }) {
  const BAR_W = 2, GAP = 1
  const count = Math.max(6, Math.floor((blockWidth - 8) / (BAR_W + GAP)))
  const bars  = seededBars(name || '', count)

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center',
      padding: '3px 4px', gap: GAP,
      opacity: 0.28, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: BAR_W, flexShrink: 0,
          height: `${Math.round(h * 100)}%`,
          background: '#fff',
          borderRadius: 1,
        }} />
      ))}
    </div>
  )
}

// ── Second gridlines behind the timeline ───────────────────────────
function Gridlines({ pps, width }) {
  if (pps < 20) return null
  const count = Math.ceil(width / pps) + 1
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: i * pps,
          top: 0, bottom: 0,
          width: 1,
          background: 'var(--border-dim)',
          opacity: 0.5,
        }} />
      ))}
    </div>
  )
}

// ── Shared style objects ────────────────────────────────────────────
const S = {
  zoomBtn: {
    background: 'var(--border-dim)', border: '1px solid var(--border-light)',
    color: 'var(--text-normal)', borderRadius: 4, padding: '2px 7px',
    fontSize: '0.82em', cursor: 'pointer', lineHeight: 1.2,
  },
  ctrlLabel: {
    fontSize: '0.62em', color: 'var(--text-muted)',
  },
  ctrlInput: {
    background: 'var(--border-dim)', border: '1px solid var(--border-light)',
    color: 'var(--text-bright)', borderRadius: 4, padding: '2px 4px',
    fontSize: '0.65em', textAlign: 'right', boxSizing: 'border-box',
  },
}
