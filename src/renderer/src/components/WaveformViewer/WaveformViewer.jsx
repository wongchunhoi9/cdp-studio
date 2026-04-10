import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

const FORMAT_COLOURS = {
  mono:   '#64748b',
  stereo: '#3b82f6',
  '4ch':  '#8b5cf6',
  '9ch':  '#ec4899',
  '16ch': '#f59e0b',
}

export default function WaveformViewer({ clip, compact = false }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(clip?.duration || 0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const isAna = clip?.filePath?.endsWith('.ana')

  // ── Build / rebuild WaveSurfer whenever clip.filePath changes ────
  useEffect(() => {
    // Always stop and destroy previous instance first
    if (wsRef.current) {
      try { wsRef.current.stop() } catch (_) {}
      wsRef.current.destroy()
      wsRef.current = null
    }
    setReady(false)
    setPlaying(false)
    setCurrentTime(0)
    setError(null)

    // .ana files are spectral data — cannot be decoded as audio
    if (!clip?.filePath || isAna) return
    if (!containerRef.current) return

    const style = getComputedStyle(document.documentElement)
    const getVar = (v) => style.getPropertyValue(v).trim()

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: compact ? getVar('--border-light') : getVar('--accent'),
      progressColor: compact ? getVar('--text-normal') : getVar('--accent-hover'),
      cursorColor: getVar('--accent-text'),
      cursorWidth: 1,
      height: compact ? 36 : 240,
      splitChannels: !compact,
      // Omitting all bar properties (barWidth, barGap) gives a full unbroken line for maximum resolution
      normalize: true,
      interact: !compact,
      hideScrollbar: true,
      backend: 'WebAudio',
    })
    wsRef.current = ws

    ws.on('ready', () => { setDuration(ws.getDuration()); setReady(true) })
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()))
    ws.on('finish', () => { setPlaying(false); setCurrentTime(0) })
    ws.on('error', () => setError('Could not decode audio file'))

    // Load via IPC — Electron blocks file:// in renderer
    const load = async () => {
      if (window.cdpStudio?.readAudioAsDataURL) {
        const dataURL = await window.cdpStudio.readAudioAsDataURL(clip.filePath)
        if (dataURL && wsRef.current) {
          wsRef.current.load(dataURL)
        } else {
          setError('Could not read audio file')
        }
      }
    }
    load()

    return () => {
      try { ws.stop() } catch (_) {}
      ws.destroy()
      wsRef.current = null
    }
  }, [clip?.filePath])  // ← re-runs (and stops old) whenever clip path changes

  const togglePlay = () => {
    if (!wsRef.current || !ready) return
    wsRef.current.playPause()
    setPlaying(p => !p)
  }

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  const channelColour = FORMAT_COLOURS[clip?.channelFormat] || '#64748b'

  // ── .ana placeholder ─────────────────────────────────────────────
  if (isAna) {
    const placeholder = (
      <div style={{
        background: 'var(--panel-bg)', border: '1px solid var(--accent-bg)',
        borderRadius: 8, padding: compact ? '6px 10px' : '14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: compact ? '0.8em' : '1.4em' }}>〜</span>
        <div>
          <div style={{ fontSize: compact ? '0.68em' : '0.8em', color: 'var(--accent)', fontWeight: 600 }}>
            Spectral file (.ana)
          </div>
          {!compact && (
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 2 }}>
              Cannot display waveform — this is a frequency-domain analysis file.
              Connect to PVOC Synth in the node graph to convert to audio.
            </div>
          )}
        </div>
      </div>
    )
    if (compact) return placeholder
    return (
      <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-dim)', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.85em', fontWeight: 700, color: 'var(--text-bright)' }}>{clip.name}</div>
          <span style={{ fontSize: '0.7em', color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--accent-hover)' }}>.ana</span>
        </div>
        {placeholder}
      </div>
    )
  }

  // ── Compact mode (inside Clip Bin) ────────────────────────────────
  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--panel-bg)', borderRadius: 6, padding: '4px 8px',
        border: '1px solid var(--border-dim)',
      }}>
        <button onClick={togglePlay} disabled={!ready}
          style={{
            width: 24, height: 24, borderRadius: '50%',
            background: ready ? 'var(--accent-bg)' : 'var(--border-dim)',
            border: `1px solid ${ready ? 'var(--accent)' : 'var(--border-light)'}`,
            color: 'var(--text-bright)', cursor: ready ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', flexShrink: 0,
          }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
        <div style={{ fontSize: '0.68em', color: 'var(--text-muted)', flexShrink: 0 }}>
          {fmt(duration)}
        </div>
      </div>
    )
  }

  // ── Full mode ─────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-dim)', borderRadius: 10, padding: 16 }}>
      {clip && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.85em', fontWeight: 700, color: 'var(--text-bright)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clip.name}
            </div>
            <div style={{ fontSize: '0.7em', color: 'var(--text-normal)', marginTop: 2 }}>
              {clip.filePath?.split('/').pop()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <span style={{
              fontSize: '0.7em', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              background: channelColour + '22', border: `1px solid ${channelColour}66`, color: channelColour,
            }}>
              {clip.channelFormat || 'mono'}
            </span>
            <span style={{ fontSize: '0.7em', color: 'var(--text-normal)', background: 'var(--border-dim)', padding: '2px 8px', borderRadius: 10 }}>
              {clip.sampleRate ? `${(clip.sampleRate / 1000).toFixed(1)}kHz` : ''}
            </span>
          </div>
        </div>
      )}

      <div ref={containerRef}
        style={{ width: '100%', background: 'var(--panel-bg)', borderRadius: 6, border: '1px solid var(--border-dim)', minHeight: compact ? 36 : 240, position: 'relative' }}
      />

      {error && <div style={{ fontSize: '0.75em', color: '#ef4444', marginTop: 6, textAlign: 'center' }}>{error}</div>}
      {!ready && !error && clip?.filePath && (
        <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>Loading waveform…</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button onClick={togglePlay} disabled={!ready}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: ready ? (playing ? 'var(--accent-bg)' : 'var(--accent)') : 'var(--border-dim)',
            border: `1px solid ${ready ? 'var(--accent)' : 'var(--border-light)'}`,
            color: 'var(--text-bright)', cursor: ready ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', transition: 'all 0.15s', flexShrink: 0,
          }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{ fontSize: '0.78em', color: 'var(--text-normal)', fontFamily: 'monospace' }}>
          {fmt(currentTime)} / {fmt(duration)}
        </div>
        <div style={{ flex: 1 }} />
        {clip?.filePath && (
          <button onClick={() => window.cdpStudio?.showInFinder(clip.filePath)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75em', padding: '4px 8px', borderRadius: 6 }}
            onMouseEnter={e => e.target.style.color = 'var(--text-bright)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}>
            Show in Finder
          </button>
        )}
      </div>
    </div>
  )
}
