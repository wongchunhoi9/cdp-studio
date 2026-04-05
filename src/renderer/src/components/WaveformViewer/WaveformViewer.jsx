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

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: compact ? '#334155' : '#1e4d8c',
      progressColor: compact ? '#3b82f6' : '#60a5fa',
      cursorColor: '#7dd3fc',
      cursorWidth: 1,
      height: compact ? 36 : 80,
      barWidth: compact ? 1 : 2,
      barGap: 1, barRadius: 1,
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
        background: '#0f172a', border: '1px solid #2d1a5f',
        borderRadius: 8, padding: compact ? '6px 10px' : '14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: compact ? '0.8em' : '1.4em' }}>〜</span>
        <div>
          <div style={{ fontSize: compact ? '0.68em' : '0.8em', color: '#8b5cf6', fontWeight: 600 }}>
            Spectral file (.ana)
          </div>
          {!compact && (
            <div style={{ fontSize: '0.72em', color: '#475569', marginTop: 2 }}>
              Cannot display waveform — this is a frequency-domain analysis file.
              Connect to PVOC Synth in the node graph to convert to audio.
            </div>
          )}
        </div>
      </div>
    )
    if (compact) return placeholder
    return (
      <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.85em', fontWeight: 700, color: '#f1f5f9' }}>{clip.name}</div>
          <span style={{ fontSize: '0.7em', color: '#8b5cf6', background: '#2d1a5f', padding: '2px 8px', borderRadius: 10, border: '1px solid #4c1d95' }}>.ana</span>
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
        background: '#0f172a', borderRadius: 6, padding: '4px 8px',
        border: '1px solid #1e293b',
      }}>
        <button onClick={togglePlay} disabled={!ready}
          style={{
            width: 24, height: 24, borderRadius: '50%',
            background: ready ? '#1e3a5f' : '#1e293b',
            border: `1px solid ${ready ? '#3b82f6' : '#334155'}`,
            color: '#f1f5f9', cursor: ready ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', flexShrink: 0,
          }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />
        <div style={{ fontSize: '0.68em', color: '#475569', flexShrink: 0 }}>
          {fmt(duration)}
        </div>
      </div>
    )
  }

  // ── Full mode ─────────────────────────────────────────────────────
  return (
    <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: 10, padding: 16 }}>
      {clip && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.85em', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clip.name}
            </div>
            <div style={{ fontSize: '0.7em', color: '#64748b', marginTop: 2 }}>
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
            <span style={{ fontSize: '0.7em', color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: 10 }}>
              {clip.sampleRate ? `${(clip.sampleRate / 1000).toFixed(1)}kHz` : ''}
            </span>
          </div>
        </div>
      )}

      <div ref={containerRef}
        style={{ width: '100%', background: '#060d1a', borderRadius: 6, border: '1px solid #0f2040', minHeight: 80, position: 'relative' }}
      />

      {error && <div style={{ fontSize: '0.75em', color: '#ef4444', marginTop: 6, textAlign: 'center' }}>{error}</div>}
      {!ready && !error && clip?.filePath && (
        <div style={{ fontSize: '0.72em', color: '#334155', marginTop: 4, textAlign: 'center' }}>Loading waveform…</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <button onClick={togglePlay} disabled={!ready}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: ready ? (playing ? '#1e3a5f' : '#1e4d8c') : '#1e293b',
            border: `1px solid ${ready ? '#3b82f6' : '#334155'}`,
            color: '#f1f5f9', cursor: ready ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', transition: 'all 0.15s', flexShrink: 0,
          }}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={{ fontSize: '0.78em', color: '#94a3b8', fontFamily: 'monospace' }}>
          {fmt(currentTime)} / {fmt(duration)}
        </div>
        <div style={{ flex: 1 }} />
        {clip?.filePath && (
          <button onClick={() => window.cdpStudio?.showInFinder(clip.filePath)}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.75em', padding: '4px 8px', borderRadius: 6 }}
            onMouseEnter={e => e.target.style.color = '#94a3b8'}
            onMouseLeave={e => e.target.style.color = '#475569'}>
            Show in Finder
          </button>
        )}
      </div>
    </div>
  )
}
