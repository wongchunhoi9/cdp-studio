import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, Panel, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { CDP_COMMANDS, CDP_CATEGORIES, getCommandById } from '../../lib/cdpCommands.js'
import { buildArgs, buildOutputPath } from '../../lib/cdpRunner.js'
import { resolveParamLimits, resolveBreakpointTimeDomain, validateParamValue } from '../../lib/paramResolver.js'
import { v4 as uuidv4 } from 'uuid'
import BreakpointEditor from './BreakpointEditor'
import TextEditor, { parseBreakpointText, pointsToBreakpointText, pointsToPercentage, percentageToPoints } from './TextEditor'

// ── Format badge ───────────────────────────────────────────────────
function FormatBadge({ ext, side = 'in' }) {
  const colour = ext === '.ana' ? '#a78bfa' : ext === '.evl' ? '#f59e0b' : '#22c55e'
  return (
    <span style={{
      fontSize: '0.58em', fontWeight: 700,
      padding: '1px 5px', borderRadius: 4,
      background: colour + '22',
      border: `1px solid ${colour}55`,
      color: colour, fontFamily: 'monospace',
    }}>
      {side === 'in' ? '→ ' : ''}{ext}{side === 'out' ? ' →' : ''}
    </span>
  )
}

// ── Mini waveform for Source node ─────────────────────────────────
function MiniWaveform({ filePath, nodeSelected, onRegionChange, trimStart, trimEnd }) {
  const ref = useRef(null)
  const wsRef = useRef(null)
  const regionsRef = useRef(null)
  const onRegionChangeRef = useRef(onRegionChange)
  const trimRef = useRef({ trimStart, trimEnd })
  const restoringRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Keep latest callback + trim values without re-running the load effect.
  onRegionChangeRef.current = onRegionChange
  trimRef.current = { trimStart, trimEnd }

  useEffect(() => {
    if (!ref.current || !filePath) return
    wsRef.current?.destroy()
    setReady(false)
    setPlaying(false)

    const ws = WaveSurfer.create({
      container: ref.current,
      waveColor: '#1a5c2a',
      progressColor: '#22c55e',
      cursorWidth: 0,
      height: 32,
      barWidth: 1, barGap: 1, barRadius: 1,
      normalize: true, interact: true, hideScrollbar: true,
    })
    wsRef.current = ws

    const wsRegions = ws.registerPlugin(RegionsPlugin.create())
    regionsRef.current = wsRegions

    wsRegions.enableDragSelection({
      color: 'rgba(255, 255, 255, 0.45)', // Much more visible against the green
    })

    // Report the current in/out region (seconds) up to the node, or null when cleared.
    const emitRegion = () => {
      if (restoringRef.current) return
      const r = wsRegions.getRegions()[0]
      onRegionChangeRef.current?.(r ? { start: r.start, end: r.end } : null)
    }

    wsRegions.on('region-created', (region) => {
      // Allow only one region; remove the rest
      wsRegions.getRegions().forEach(r => {
        if (r.id !== region.id) r.remove()
      })
      emitRegion()
    })

    wsRegions.on('region-updated', emitRegion)   // dragging the region or its edges
    wsRegions.on('region-removed', emitRegion)   // dblclick-clear or programmatic clear

    wsRegions.on('region-out', (region) => {
      // Loop the region when cursor exits it
      region.play()
    })

    ws.on('dblclick', () => {
      wsRegions.clearRegions()
    })

    ws.on('ready', () => {
      setReady(true)
      // Restore a saved in/out region (e.g. after loading a session) without re-emitting it.
      const { trimStart, trimEnd } = trimRef.current
      if (trimStart != null && trimEnd != null && trimEnd > trimStart) {
        restoringRef.current = true
        wsRegions.addRegion({ start: trimStart, end: trimEnd, color: 'rgba(255, 255, 255, 0.45)' })
        restoringRef.current = false
      }
    })
    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))

    if (window.cdpStudio?.readAudioAsDataURL) {
      window.cdpStudio.readAudioAsDataURL(filePath).then(dataURL => {
        if (dataURL) ws.load(dataURL)
      })
    }
    return () => { ws.destroy(); wsRef.current = null }
  }, [filePath])

  // Spacebar playback
  useEffect(() => {
    if (!nodeSelected) return
    const handleKeyDown = (e) => {
      // Ignore if composing or inside an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return
      if (e.key === ' ') {
        e.preventDefault() // prevent page scroll
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodeSelected])

  // Clear the on-screen region when the node's in/out is cleared externally (e.g. the Clear button).
  useEffect(() => {
    if (!ready) return
    if (trimStart == null && trimEnd == null && (regionsRef.current?.getRegions().length || 0) > 0) {
      restoringRef.current = true
      regionsRef.current.clearRegions()
      restoringRef.current = false
    }
  }, [trimStart, trimEnd, ready])

  const togglePlay = () => {
    const isActuallyPlaying = wsRef.current?.isPlaying()
    const regions = regionsRef.current?.getRegions() || []
    if (regions.length > 0 && !isActuallyPlaying) {
      regions[0].play()
    } else {
      wsRef.current?.playPause()
    }
  }

  return (
    <div className="nodrag" style={{
      borderRadius: 4, overflow: 'hidden',
      background: '#020a06', border: '1px solid #1a3a22',
      marginTop: 6, position: 'relative', minHeight: 32,
      cursor: 'text', // Gives a text-selection-like cursor to indicate drag-able regions
    }}>
      <div ref={ref} style={{ width: '100%' }} />
      {ready && (
        <button
          onClick={togglePlay}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            background: playing ? '#22c55e' : '#1a5c2a', border: 'none',
            color: '#fff', borderRadius: '50%', width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '0.6em', padding: 0, lineHeight: 1,
            boxShadow: '0 0 6px rgba(0,0,0,0.5)', zIndex: 10,
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>
      )}
      {!ready && filePath && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6em', color: '#1a5c2a',
        }}>loading…</div>
      )}
    </div>
  )
}

// ── Source Node ────────────────────────────────────────────────────
function SourceNode({ data, id, selected }) {
  const [info, setInfo] = useState(null)
  const [busyInfo, setBusyInfo] = useState(false)

  // Drop any cached SNDINFO report when the loaded file changes.
  useEffect(() => { setInfo(null) }, [data.filePath])

  const fetchInfo = async () => {
    if (!data.filePath || !window.cdpStudio?.sndinfoReport) return
    setBusyInfo(true)
    try { setInfo(await window.cdpStudio.sndinfoReport(data.filePath)) }
    finally { setBusyInfo(false) }
  }

  const handleBrowse = async () => {
    if (!window.cdpStudio) return
    const result = await window.cdpStudio.openFile()
    if (!result.canceled && result.filePaths[0]) {
      const filePath = result.filePaths[0]
      const info = await window.cdpStudio.getAudioInfo(filePath)
      data.onUpdate(id, { filePath, audioInfo: info, label: filePath.split('/').pop() })
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    const filePath = e.dataTransfer.getData('text/plain')
    if (!filePath) return
    const info = await window.cdpStudio.getAudioInfo(filePath)
    data.onUpdate(id, { filePath, audioInfo: info, label: filePath.split('/').pop() })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const fmt = (s) => {
    if (!s || s === 0) return '—'
    const m = Math.floor(s / 60), sec = (s % 60).toFixed(1).padStart(4, '0')
    return `${m}:${sec}`
  }

  return (
    <div
      style={{ ...nodeStyle('#22c55e'), outline: selected ? '2px solid #22c55e' : 'none' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div style={nodeTitleStyle('#22c55e')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62em', opacity: 0.8, fontWeight: 700 }}>▶ SOURCE</span>
          <FormatBadge ext=".wav" side="out" />
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        {data.filePath ? (
          <>
            <div style={{ fontSize: '0.7em', color: 'var(--text-normal)', wordBreak: 'break-all', marginBottom: 3 }}>
              {data.label}
            </div>
            {data.audioInfo && (
              <div style={{ fontSize: '0.65em', color: '#4ade80', marginBottom: 2 }}>
                {data.audioInfo.channels}ch · {(data.audioInfo.sampleRate / 1000).toFixed(1)}kHz · {fmt(data.audioInfo.duration)}
              </div>
            )}
            {data.trimStart != null && data.trimEnd != null && (
              <div style={{ fontSize: '0.62em', color: '#2dd4bf', marginBottom: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✂ {data.trimStart.toFixed(2)}s → {data.trimEnd.toFixed(2)}s · {(data.trimEnd - data.trimStart).toFixed(2)}s</span>
                <button
                  className="nodrag"
                  onClick={() => data.onUpdate(id, { trimStart: null, trimEnd: null })}
                  title="Clear in/out region — the whole file will be processed"
                  style={{ background: 'none', border: '1px solid #14b8a655', color: '#2dd4bf', borderRadius: 3, fontSize: '0.85em', padding: '0 4px', cursor: 'pointer' }}
                >clear</button>
              </div>
            )}
            <MiniWaveform
              filePath={data.filePath}
              nodeSelected={selected}
              trimStart={data.trimStart}
              trimEnd={data.trimEnd}
              onRegionChange={(r) => data.onUpdate(id, { trimStart: r?.start ?? null, trimEnd: r?.end ?? null })}
            />
            <div style={{ fontSize: '0.58em', color: 'var(--text-muted)', marginTop: 3, opacity: 0.8 }}>
              Drag to set in/out · double-click to clear
            </div>
          </>
        ) : (
          <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
            No file loaded — drop a clip here
          </div>
        )}
        {data.filePath ? (
          <div className="nodrag" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={handleBrowse} style={{ ...smallBtnStyle('#22c55e'), flex: 1 }}>
              Change File
            </button>
            <button onClick={() => info ? setInfo(null) : fetchInfo()} title="Sound info — SNDINFO props / len / maxsamp / loudchan"
              style={{ ...smallBtnStyle('#334155') }}>
              {busyInfo ? '…' : info ? 'ⓘ Hide' : 'ⓘ Info'}
            </button>
          </div>
        ) : (
          <button onClick={handleBrowse} style={{ ...smallBtnStyle('#22c55e'), marginTop: 8 }}>
            Load WAV…
          </button>
        )}
        {info && (
          <div className="nodrag" style={{
            marginTop: 6, background: '#020a06', border: '1px solid #1a3a22', borderRadius: 4,
            padding: '6px 8px', fontSize: '0.62em', fontFamily: 'monospace', color: '#9ca3af',
            whiteSpace: 'pre-wrap', maxHeight: 170, overflowY: 'auto',
          }}>
            {['props', 'len', 'maxsamp', 'loudchan'].map(m => (info[m]?.ok && info[m].text) ? (
              <div key={m} style={{ marginBottom: 5 }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>{m.toUpperCase()}</span>{'\n'}{info[m].text}
              </div>
            ) : null)}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle('#22c55e')} />
    </div>
  )
}

// ── Process Node ───────────────────────────────────────────────────
function ProcessNode({ data, id, selected }) {
  const command = getCommandById(data.commandId)
  if (!command) return null

  const cat = CDP_CATEGORIES.find(c => c.id === command.category)
  const colour = cat?.colour || '#3b82f6'

  const updateParam = (paramId, value) => {
    const updates = { paramValues: { ...data.paramValues, [paramId]: value } }
    
    if (paramId === 'outdur' && data.breakpointCurves) {
      const oldOutdur = data.paramValues?.outdur ?? 10
      const newOutdur = value
      if (oldOutdur > 0 && newOutdur > 0) {
        const scale = newOutdur / oldOutdur
        const newCurves = {}
        for (const [key, curve] of Object.entries(data.breakpointCurves)) {
          if (Array.isArray(curve)) {
            newCurves[key] = curve.map(pt => ({ ...pt, time: pt.time * scale }))
          }
        }
        updates.breakpointCurves = newCurves
      }
    }

    data.onUpdate(id, updates)
  }

  // ── Soft validation: compute per-param error messages ─────────────
  const [validationErrors, setValidationErrors] = useState({})
  const [inputDuration, setInputDuration] = useState(0)

  useEffect(() => {
    if (!data.inputPath || !command) {
      setValidationErrors({})
      return
    }

    const validate = async () => {
      const errors = {}
      const inputInfo = await window.cdpStudio.getAudioInfo(data.inputPath).catch(() => null)
      const dur = inputInfo?.duration || 0
      setInputDuration(dur)
      const paramValues = data.paramValues || {}
      const outdur = paramValues.outdur ?? 10

      // Build resolution context
      const context = {
        inputDuration: dur,
        outputDuration: outdur,
        paramValues
      }

      // Clock must be > 0.03 (CDP constraint for extend_drunk)
      const clock = paramValues.clock ?? 0.1
      if (clock <= 0.03) {
        errors.clock = `must be > 0.03s`
      }

      // Check breakpoint curve values against resolved limits
      const bpCurves = data.breakpointCurves || {}
      const allParams = [...(command.params || []), ...(command.flags || [])]
      for (const param of allParams) {
        const limits = resolveParamLimits(param, context)
        const curve = bpCurves[param.id]
        if (curve && Array.isArray(curve)) {
          for (const pt of curve) {
            const actualVal = limits.min + (pt.value / 100) * (limits.max - limits.min)
            if (actualVal < limits.min) {
              errors[param.id] = `curve has value ${actualVal.toFixed(2)} < min ${limits.min}`
              break
            }
            if (actualVal > limits.max) {
              errors[param.id] = `curve has value ${actualVal.toFixed(2)} > max ${limits.max}`
              break
            }
          }
        }
        // Also validate static params
        const validation = validateParamValue(param, paramValues[param.id], context)
        if (!validation.valid) {
          errors[param.id] = validation.error
        }
      }

      setValidationErrors(errors)
    }

    validate()
  }, [data.inputPath, data.paramValues, data.breakpointCurves, command])


  const renderParam = (param) => {
    const isBreakpoint = data.breakpointCurves?.[param.id] != null
    const isBreakpointParam = param.supportsBreakpoint && param.type === 'number'
    const currentValue = data.paramValues?.[param.id] ?? param.default

    // Build resolution context for this param
    const context = {
      inputDuration,
      outputDuration: data.paramValues?.outdur ?? 10,
      paramValues: data.paramValues || {}
    }
    const limits = resolveParamLimits(param, context)

    const toggleBreakpoint = () => {
      const current = data.breakpointCurves?.[param.id]
      if (current) {
        const curves = { ...data.breakpointCurves }
        delete curves[param.id]
        const paramValues = { ...data.paramValues }
        delete paramValues[param.id]
        data.onUpdate(id, { breakpointCurves: curves, paramValues })
      } else {
        const outdur = data.paramValues?.outdur ?? 10
        const defaultVal = data.paramValues?.[param.id] ?? param.default
        const pctValue = limits.max !== limits.min ? ((defaultVal - limits.min) / (limits.max - limits.min)) * 100 : 0
        const clampedPct = Math.max(0, Math.min(100, pctValue))
        const curves = { ...(data.breakpointCurves || {}), [param.id]: [
          { time: 0, value: clampedPct },
          { time: outdur, value: clampedPct },
        ]}
        data.onUpdate(id, { breakpointCurves: curves })
      }
    }

    const updateBreakpoints = (newPoints, currentActualValue) => {
      const curves = { ...(data.breakpointCurves || {}), [param.id]: newPoints }
      data.onUpdate(id, { breakpointCurves: curves })
    }

    return (
    <div key={param.id} style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ fontSize: '0.67em', color: 'var(--text-normal)' }}>
            {param.label}
            {param.id in (command.flags?.reduce((a, f) => ({ ...a, [f.id]: true }), {}) || {})
              ? <span style={{ color: 'var(--text-muted)', marginLeft: 3 }}>(-{param.id})</span>
              : null}
          </label>
          {isBreakpointParam && (
            <button
              onClick={toggleBreakpoint}
              className="nodrag"
              title={isBreakpoint ? 'Disable breakpoint curve' : 'Enable breakpoint curve'}
              style={{
                fontSize: '0.58em',
                background: isBreakpoint ? colour + '44' : 'var(--border-dim)',
                border: `1px solid ${isBreakpoint ? colour : 'var(--border-light)'}`,
                color: isBreakpoint ? colour : 'var(--text-muted)',
                borderRadius: 4,
                padding: '1px 5px',
                cursor: 'pointer',
                fontWeight: 600,
              }}>
              BP
            </button>
          )}
          {validationErrors[param.id] && (
            <span title={validationErrors[param.id]} style={{
              fontSize: '0.58em', color: '#f59e0b', marginLeft: 4, cursor: 'help',
            }}>
              ⚠ {validationErrors[param.id]}
            </span>
          )}
          {/* Show indicator when breakpoint file is connected */}
          {data.breakpointConnections?.[param.id] && (
            <span title="Connected to breakpoint file" style={{
              fontSize: '0.58em', color: '#ec4899', marginLeft: 4,
            }}>
              📎
            </span>
          )}
        </div>
        {param.type === 'number' && !isBreakpoint && (
          <input type="number"
            className="nodrag"
            min={limits.min} max={limits.max}
            step={param.step || (limits.max - limits.min) / 200}
            value={currentValue}
            onChange={e => updateParam(param.id, parseFloat(e.target.value))}
            style={{
              width: 64, background: 'var(--border-dim)', border: `1px solid ${colour}33`,
              borderRadius: 4, padding: '1px 4px', color: colour,
              fontFamily: 'monospace', fontSize: '0.67em', textAlign: 'right',
              outline: 'none',
            }}
          />
        )}
        {param.type === 'boolean' && !isBreakpoint && (
          <input type="checkbox"
            className="nodrag"
            checked={currentValue}
            onChange={e => updateParam(param.id, e.target.checked)}
            style={{ accentColor: colour, cursor: 'pointer' }}
          />
        )}
        {param.type !== 'number' && param.type !== 'boolean' && param.type !== 'select' && !isBreakpoint && (
          <span style={{ fontSize: '0.67em', color: colour, fontFamily: 'monospace' }}>
            {currentValue}
          </span>
        )}
        {isBreakpoint && (
          <span style={{ fontSize: '0.58em', color: colour, background: colour + '22', borderRadius: 4, padding: '1px 5px' }}>
            〰 curve
          </span>
        )}
      </div>
      {param.type === 'number' && !isBreakpoint && (
        <input type="range"
          className="nodrag"
          min={limits.min} max={limits.max}
          step={param.step || (limits.max - limits.min) / 200}
          value={currentValue}
          onChange={e => updateParam(param.id, parseFloat(e.target.value))}
          style={{ '--accent-color': colour }}
        />
      )}
      {isBreakpoint && (
        <BreakpointEditor
          points={data.breakpointCurves[param.id]}
          onChange={updateBreakpoints}
          timeMax={resolveBreakpointTimeDomain(param, context).max}
          valueMin={0}
          valueMax={100}
          paramMin={limits.min}
          paramMax={limits.max}
          colour={colour}
          width={200}
          height={72}
        />
      )}
      {param.type === 'select' && !isBreakpoint && (
        <select className="nodrag" value={currentValue}
          onChange={e => {
            const val = param.options[0] && typeof param.options[0] === 'number'
              ? parseInt(e.target.value)
              : e.target.value
            updateParam(param.id, val)
          }}
          style={{ width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: 'var(--text-bright)', borderRadius: 4, padding: '2px 4px', fontSize: '0.7em' }}>
          {param.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>

  )}

  const statusColour = data.status === 'done' ? '#22c55e' : data.status === 'error' ? '#ef4444' : data.status === 'running' ? colour : '#334155'

  return (
    <div style={{ ...nodeStyle(colour), outline: selected ? `2px solid ${colour}` : 'none' }}>
      {command.twoInputs ? (
        <>
          <Handle id="input-a" type="target" position={Position.Left} style={{ ...handleStyle(colour), top: '30%' }} />
          <Handle id="input-b" type="target" position={Position.Left} style={{ ...handleStyle(colour), top: '70%' }} />
        </>
      ) : (
        <Handle type="target" position={Position.Left} style={handleStyle(colour)} />
      )}

      <div style={nodeTitleStyle(colour)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: '0.58em', opacity: 0.7 }}>{cat?.label}</span>
          {/* Format flow: in → out */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <FormatBadge ext={command.inputExt?.[0] || '.wav'} side="in" />
            <span style={{ fontSize: '0.55em', color: 'var(--text-muted)' }}>→</span>
            <FormatBadge ext={command.outputExt || '.wav'} side="out" />
          </div>
        </div>
        <div style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--text-bright)' }}>{command.label}</div>
      </div>

      <div style={{ padding: '8px 10px' }}>
        {command.params
          .filter(p => !p.showIf || (
            (p.showIf.valueNot === undefined || (data.paramValues?.[p.showIf.paramId] ?? getCommandById(data.commandId).params.find(cp => cp.id === p.showIf.paramId)?.default) !== p.showIf.valueNot) &&
            (p.showIf.value === undefined || (data.paramValues?.[p.showIf.paramId] ?? getCommandById(data.commandId).params.find(cp => cp.id === p.showIf.paramId)?.default) === p.showIf.value)
          ))
          .map(renderParam)}
        {command.flags
          ?.filter(f => !f.showIf || (
            (f.showIf.valueNot === undefined || (data.paramValues?.[f.showIf.paramId] ?? getCommandById(data.commandId).params.find(cp => cp.id === f.showIf.paramId)?.default) !== f.showIf.valueNot) &&
            (f.showIf.value === undefined || (data.paramValues?.[f.showIf.paramId] ?? getCommandById(data.commandId).params.find(cp => cp.id === f.showIf.paramId)?.default) === f.showIf.value)
          ))
          .map(renderParam)}


        {/* Input file indicator */}
        {data.inputPath && (
          <div style={{ fontSize: '0.62em', color: 'var(--text-muted)', marginBottom: 4, wordBreak: 'break-all' }}>
            ↳ {data.inputPath.split('/').pop()}
          </div>
        )}

        {/* Status indicator */}
        {data.status && (
          <div style={{
            fontSize: '0.65em', color: statusColour,
            marginBottom: 4, fontWeight: 600,
          }}>
            {data.status === 'running' && '⟳ Processing…'}
            {data.status === 'done' && '✓ Done'}
            {data.status === 'error' && '✗ Error — check terminal'}
            {data.status === 'waiting' && '· Waiting in chain'}
          </div>
        )}

        {/* Multichannel note */}
        {!command.multichannel && (
          <div style={{ fontSize: '0.58em', color: 'var(--text-muted)', marginBottom: 4 }}>
            ⚠ Mono input only
          </div>
        )}

        {/* Doc link */}
        {command.docUrl && (
          <div style={{ display: 'flex', marginTop: 4 }}>
            <a href={command.docUrl} target="_blank" rel="noreferrer"
              style={{ ...smallBtnStyle('#334155'), flex: 1, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
              📖 Docs
            </a>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={handleStyle(colour)} />

      {/* Breakpoint file input handles for breakpoint-enabled params */}
      {command.params?.filter(p => p.supportsBreakpoint).map((param, idx) => {
        const hasConnection = data.breakpointConnections?.[param.id]
        const totalBpParams = command.params.filter(p => p.supportsBreakpoint).length
        const topOffset = 45 + (idx * 20)
        return (
          <Handle
            key={param.id}
            id={param.id}
            type="target"
            position={Position.Right}
            style={{
              ...handleStyle('#ec4899'),
              top: `${topOffset}px`,
              right: -10,
              width: 8,
              height: 8,
              background: hasConnection ? '#ec4899' : 'var(--border-dim)',
              border: hasConnection ? '2px solid #ec4899' : '2px solid var(--border-light)',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Output Node — runs the whole chain ────────────────────────────
function OutputNode({ data, id, selected }) {
  const fmt = (s) => {
    if (!s || s === 0) return '—'
    const m = Math.floor(s / 60), sec = (s % 60).toFixed(1).padStart(4, '0')
    return `${m}:${sec}`
  }

  return (
    <div style={{ ...nodeStyle('#f59e0b'), outline: selected ? '2px solid #f59e0b' : 'none' }}>
      <Handle type="target" position={Position.Left} style={handleStyle('#f59e0b')} />
      <div style={nodeTitleStyle('#f59e0b')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62em', opacity: 0.8, fontWeight: 700 }}>⬛ OUTPUT</span>
          <FormatBadge ext=".wav" side="in" />
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        {data.filePath ? (
          <>
              <div style={{ fontSize: '0.7em', color: 'var(--text-normal)', wordBreak: 'break-all', marginBottom: 3 }}>
              ✓ {data.filePath.split('/').pop()}
            </div>
            {data.audioInfo && (
              <div style={{ fontSize: '0.65em', color: '#fbbf24', marginBottom: 6 }}>
                {data.audioInfo.channels}ch · {(data.audioInfo.sampleRate / 1000).toFixed(1)}kHz · {fmt(data.audioInfo.duration)}
              </div>
            )}
            {/* Quick preview waveform */}
            <MiniWaveform filePath={data.filePath} nodeSelected={selected} />
          </>
        ) : (
          <div style={{ fontSize: '0.7em', color: 'var(--text-muted)', marginBottom: 8 }}>
            Connect process nodes, then click Render Chain ↓
          </div>
        )}

        {/* THE key button — runs the entire chain or stops it */}
        <button
          onClick={() => {
            if (data.chainRunning) {
              window.cdpStudio.stopCDP()
            } else {
              data.onRenderChain?.(id)
            }
          }}
          style={{
            ...smallBtnStyle(data.chainRunning ? '#ef4444' : '#f59e0b'),
            width: '100%', padding: '6px 0',
            fontSize: '0.78em', fontWeight: 700,
            opacity: 1, // Full opacity so it looks clickable for stop
          }}>
          {data.chainRunning ? '⏹ STOP rendering' : '▶ Render Chain'}
        </button>

        {data.filePath && (
          <button
            onClick={() => window.cdpStudio?.showInFinder(data.filePath)}
            style={{ ...smallBtnStyle('#475569'), width: '100%', marginTop: 4 }}>
            Show in Finder
          </button>
        )}
      </div>
    </div>
  )
}

// ── Breakpoint File Node ────────────────────────────────────────────
// Generates CDP .brk files that can connect to process node parameters
function BreakpointFileNode({ data, id, selected }) {
  const [viewMode, setViewMode] = useState(data.viewMode || 'visual')
  const [timeDomain, setTimeDomain] = useState(data.timeDomain || 'output')
  const [timeMax, setTimeMax] = useState(data.timeMax || 10)
  const [paramMin, setParamMin] = useState(data.paramMin || 0)
  const [paramMax, setParamMax] = useState(data.paramMax || 1)
  const [points, setPoints] = useState(data.points || [
    { time: 0, value: 50 },
    { time: 10, value: 50 }
  ])
  const [textContent, setTextContent] = useState(data.textContent || '')
  const [textError, setTextError] = useState(null)
  const [label, setLabel] = useState(data.label || 'breakpoint')

  const colour = '#ec4899' // Pink for breakpoint files

  // Connected source info
  const connectedSourceId = data.connectedSourceId
  const connectedSourceDuration = data.connectedSourceDuration || 0

  // Sync points to text when switching to text view
  useEffect(() => {
    if (viewMode === 'text' && !textContent) {
      // Convert points (percentage) to actual values then to text
      const actualPoints = percentageToPoints(points, paramMin, paramMax)
      setTextContent(pointsToBreakpointText(actualPoints))
    }
  }, [viewMode])

  // Update parent when values change
  useEffect(() => {
    data.onUpdate?.(id, {
      viewMode,
      points,
      textContent,
      timeDomain,
      timeMax,
      paramMin,
      paramMax,
      label,
      filePath: data.filePath,
      status: data.status,
      connectedSourceId,
      connectedSourceDuration
    })
  }, [points, textContent, viewMode, timeDomain, timeMax, paramMin, paramMax, label, connectedSourceId, connectedSourceDuration])

  const handleTextChange = (newText) => {
    setTextContent(newText)
    const { points: parsedPoints, error } = parseBreakpointText(newText)
    setTextError(error)

    if (!error && parsedPoints.length >= 2) {
      // Convert actual values to percentage for visual editor
      const pctPoints = pointsToPercentage(parsedPoints, paramMin, paramMax)
      setPoints(pctPoints)
      // Update timeMax based on last point
      if (parsedPoints.length > 0) {
        const maxTime = parsedPoints[parsedPoints.length - 1].time
        if (maxTime > timeMax) {
          setTimeMax(maxTime)
        }
      }
    }
  }

  const handlePointsChange = (newPoints) => {
    setPoints(newPoints)
    // Update text content when points change (for bidirectional sync)
    const actualPoints = percentageToPoints(newPoints, paramMin, paramMax)
    setTextContent(pointsToBreakpointText(actualPoints))
  }

  const syncDurationFromSource = () => {
    if (connectedSourceDuration > 0) {
      setTimeMax(connectedSourceDuration)
      // Scale points to new duration
      const currentMax = Math.max(...points.map(p => p.time), timeMax)
      if (currentMax > 0) {
        const scaled = points.map(p => ({
          ...p,
          time: (p.time / currentMax) * connectedSourceDuration
        }))
        setPoints(scaled)
        // Also update text
        const actualPoints = percentageToPoints(scaled, paramMin, paramMax)
        setTextContent(pointsToBreakpointText(actualPoints))
      }
    }
  }

  const exportToFile = async () => {
    if (!window.cdpStudio) return

    // Use text content if valid, otherwise convert points
    let actualPoints
    if (textContent && !textError) {
      const { points: parsed } = parseBreakpointText(textContent)
      actualPoints = parsed
    } else {
      actualPoints = percentageToPoints(points, paramMin, paramMax)
    }

    const filename = `${label}_${Date.now()}.brk`
    try {
      const filePath = await window.cdpStudio.writeBreakpointFile(actualPoints, filename)
      data.onUpdate?.(id, { filePath, status: 'exported' })
    } catch (e) {
      console.error('Failed to export breakpoint file:', e)
    }
  }

  return (
    <div style={{ ...nodeStyle(colour), outline: selected ? `2px solid ${colour}` : 'none' }}>
      <Handle type="target" position={Position.Left} style={handleStyle(colour)} id="duration-source" />

      <div style={nodeTitleStyle(colour)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.62em', opacity: 0.8, fontWeight: 700 }}>〰 BREAKPOINT FILE</span>
          <span style={{ fontSize: '0.55em', color: colour, fontFamily: 'monospace' }}>.brk</span>
        </div>
      </div>

      <div style={{ padding: '8px 10px' }}>
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button
            onClick={() => setViewMode('visual')}
            className="nodrag"
            style={{
              flex: 1,
              padding: '3px 8px',
              fontSize: '0.7em',
              background: viewMode === 'visual' ? colour + '44' : 'var(--border-dim)',
              border: `1px solid ${viewMode === 'visual' ? colour : 'var(--border-light)'}`,
              color: viewMode === 'visual' ? colour : 'var(--text-normal)',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            〰 Visual
          </button>
          <button
            onClick={() => setViewMode('text')}
            className="nodrag"
            style={{
              flex: 1,
              padding: '3px 8px',
              fontSize: '0.7em',
              background: viewMode === 'text' ? colour + '44' : 'var(--border-dim)',
              border: `1px solid ${viewMode === 'text' ? colour : 'var(--border-light)'}`,
              color: viewMode === 'text' ? colour : 'var(--text-normal)',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {'</>'} Text
          </button>
        </div>

        {/* Label input */}
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: '0.65em', color: 'var(--text-normal)' }}>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="nodrag"
            style={{
              width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)',
              borderRadius: 4, padding: '2px 6px', color: 'var(--text-bright)',
              fontSize: '0.7em', marginTop: 2
            }}
          />
        </div>

        {/* Time Domain + Sync button */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.65em', color: 'var(--text-normal)' }}>Time Domain</label>
            {connectedSourceDuration > 0 && (
              <button
                onClick={syncDurationFromSource}
                className="nodrag"
                style={{
                  fontSize: '0.58em',
                  padding: '1px 6px',
                  background: 'var(--border-dim)',
                  border: '1px solid #22c55e',
                  color: '#22c55e',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Sync: {connectedSourceDuration.toFixed(1)}s
              </button>
            )}
          </div>
          <select
            value={timeDomain}
            onChange={(e) => setTimeDomain(e.target.value)}
            className="nodrag"
            style={{
              width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)',
              borderRadius: 4, padding: '2px 6px', color: 'var(--text-bright)',
              fontSize: '0.7em', marginTop: 2
            }}
          >
            <option value="input">Input Duration</option>
            <option value="output">Output Duration</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Time Max for custom */}
        {timeDomain === 'custom' && (
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: '0.65em', color: 'var(--text-normal)' }}>Time Max (s)</label>
            <input
              type="number"
              value={timeMax}
              onChange={(e) => {
                const newMax = parseFloat(e.target.value) || 1
                setTimeMax(newMax)
              }}
              min={0.1}
              max={3600}
              step={0.1}
              className="nodrag"
              style={{
                width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)',
                borderRadius: 4, padding: '2px 6px', color: 'var(--text-bright)',
                fontSize: '0.7em', marginTop: 2
              }}
            />
          </div>
        )}

        {/* Value Range */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.65em', color: 'var(--text-normal)' }}>Value Min</label>
            <input
              type="number"
              value={paramMin}
              onChange={(e) => {
                const newMin = parseFloat(e.target.value) || 0
                setParamMin(newMin)
                // Update text to reflect new range
                if (textContent) {
                  const actualPoints = percentageToPoints(points, newMin, paramMax)
                  setTextContent(pointsToBreakpointText(actualPoints))
                }
              }}
              className="nodrag"
              style={{
                width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)',
                borderRadius: 4, padding: '2px 6px', color: 'var(--text-bright)',
                fontSize: '0.7em', marginTop: 2
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.65em', color: 'var(--text-normal)' }}>Value Max</label>
            <input
              type="number"
              value={paramMax}
              onChange={(e) => {
                const newMax = parseFloat(e.target.value) || 1
                setParamMax(newMax)
                // Update text to reflect new range
                if (textContent) {
                  const actualPoints = percentageToPoints(points, paramMin, newMax)
                  setTextContent(pointsToBreakpointText(actualPoints))
                }
              }}
              className="nodrag"
              style={{
                width: '100%', background: 'var(--border-dim)', border: '1px solid var(--border-light)',
                borderRadius: 4, padding: '2px 6px', color: 'var(--text-bright)',
                fontSize: '0.7em', marginTop: 2
              }}
            />
          </div>
        </div>

        {/* Visual or Text Editor */}
        {viewMode === 'visual' ? (
          <BreakpointEditor
            points={points}
            onChange={handlePointsChange}
            timeMax={timeMax}
            valueMin={0}
            valueMax={100}
            paramMin={paramMin}
            paramMax={paramMax}
            colour={colour}
            width={200}
            height={70}
          />
        ) : (
          <TextEditor
            value={textContent}
            onChange={handleTextChange}
            height={100}
            error={textError}
          />
        )}

        {/* Export button */}
        <button
          onClick={exportToFile}
          disabled={textError !== null}
          style={{
            ...smallBtnStyle(colour),
            width: '100%',
            marginTop: 8,
            opacity: textError ? 0.5 : 1
          }}
        >
          {data.filePath ? '✓ Re-export .brk' : 'Export .brk File'}
        </button>

        {/* Status */}
        {data.filePath && (
          <div style={{ fontSize: '0.6em', color: 'var(--text-normal)', marginTop: 4, wordBreak: 'break-all' }}>
            {data.filePath.split('/').pop()}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={handleStyle(colour)}
        id="breakpoint"
      />
    </div>
  )
}

const nodeTypes = { source: SourceNode, process: ProcessNode, output: OutputNode, breakpointFile: BreakpointFileNode }

// ── Main NodeGraph ─────────────────────────────────────────────────
export default function NodeGraph({ onAIHelp }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: 'source-1', type: 'source', position: { x: 40, y: 180 },
      data: { filePath: '/Users/chunhoiwong/Desktop/cdp-studio/Clarinet_M160_testSample.wav', audioInfo: null, label: 'Clarinet_M160_testSample.wav', onUpdate: updateNodeData },
    },
    {
      id: 'process-1', type: 'process', position: { x: 350, y: 180 },
      data: { commandId: 'extend_drunk', paramValues: { outdur: 10, locus: 1, ambitus: 0.5, step: 0.5, clock: 0.1 }, breakpointCurves: null, inputPath: '/Users/chunhoiwong/Desktop/cdp-studio/Clarinet_M160_testSample.wav', onUpdate: updateNodeData },
    },
    {
      id: 'output-1', type: 'output', position: { x: 700, y: 180 }, deletable: false,
      data: { filePath: null, chainRunning: false, onRenderChain: null },
    },
  ])
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    { id: 'e1', source: 'source-1', target: 'process-1', animated: false, style: { stroke: '#6366f1' } },
    { id: 'e2', source: 'process-1', target: 'output-1', animated: false, style: { stroke: '#6366f1' } },
  ])
  const [showPicker, setShowPicker] = useState(false)
  const [examplePicker, setExamplePicker] = useState(null)  // null = closed, array = list of examples
  const [dirsfResult, setDirsfResult] = useState(null)      // null = closed, { dir, text } = DIRSF listing
  const [selectedCat, setSelectedCat] = useState('pvoc')
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  // Keep refs in sync for use inside callbacks
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])

  function updateNodeData(nodeId, updates) {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ))
  }

  // Auto-load audio file on startup for default patch
  useEffect(() => {
    const sourceNode = nodes.find(n => n.id === 'source-1')
    if (sourceNode?.data?.filePath && !sourceNode.data.audioInfo) {
      window.cdpStudio.getAudioInfo(sourceNode.data.filePath)
        .then(info => {
          setNodes(nds => nds.map(n =>
            n.id === 'source-1' ? { ...n, data: { ...n.data, audioInfo: info } } : n
          ))
        })
        .catch(() => {})
    }
  }, [])

  // ── Chain execution ──────────────────────────────────────────────
  // Traverses edges backwards from output to find all nodes in the graph,
  // then runs each process node in topological order.
  // Uses a nodeOutputs map so two-input nodes (e.g. Mix) can resolve both inputs.
  const renderChain = useCallback(async (outputNodeId) => {
    const allNodes = nodesRef.current
    const allEdges = edgesRef.current

    // Map of nodeId -> resolved output path
    const nodeOutputs = {}

    // Seed source file paths into the map
    for (const n of allNodes) {
      if (n.type === 'source' && n.data.filePath) {
        nodeOutputs[n.id] = n.data.filePath
      }
    }

    // Topological sort: traverse backwards from output, then reverse for forward order
    const orderedChain = []
    const visited = new Set()
    const traverse = (nodeId) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      const incomingEdges = allEdges.filter(e => e.target === nodeId)
      for (const edge of incomingEdges) {
        traverse(edge.source)
      }
      orderedChain.push(nodeId)
    }
    traverse(outputNodeId)

    // Filter to only process nodes in forward execution order
    const processChain = orderedChain
      .map(id => allNodes.find(n => n.id === id))
      .filter(n => n && n.type === 'process')

    if (processChain.length === 0) {
      alert('No process nodes connected to output. Add and connect some process nodes first.')
      return
    }

    // Mark chain as running
    updateNodeData(outputNodeId, { chainRunning: true, filePath: null })
    processChain.forEach(n => updateNodeData(n.id, { status: 'waiting' }))

    // ── Source in/out trim (implicit `sfedit cut` pre-step) ──────────
    // For each feeding source with a valid in/out region that doesn't span
    // the whole file, cut it first and feed the trimmed segment into the chain.
    for (const n of allNodes) {
      if (n.type !== 'source' || !n.data.filePath || !visited.has(n.id)) continue
      const { filePath, trimStart, trimEnd, audioInfo } = n.data
      const hasTrim = trimStart != null && trimEnd != null && trimEnd > trimStart + 0.001
      const dur = audioInfo?.duration ?? 0
      const spansWhole = dur > 0 && trimStart <= 0.005 && trimEnd >= dur - 0.005
      if (!hasTrim || spansWhole) continue

      const cutCmd = getCommandById('sfedit_cut')
      const cutOutPath = await buildOutputPath(filePath, 'sfedit_cut')
      const cutArgs = buildArgs({
        command: cutCmd, inputPath: filePath, input2Path: null,
        outputPath: cutOutPath, paramValues: { start: trimStart, end: trimEnd },
      })
      const cutRes = await window.cdpStudio.runCDP({
        program: cutCmd.program, args: cutArgs, outputPath: cutOutPath, label: 'Cut (in/out)',
      })
      if (!cutRes.success) {
        updateNodeData(outputNodeId, { chainRunning: false })
        alert(`Failed to trim source "${n.data.label || filePath.split('/').pop()}" to its in/out region.`)
        return
      }
      nodeOutputs[n.id] = cutOutPath
    }

    let lastClipId = null

    for (const processNode of processChain) {
      const command = getCommandById(processNode.data.commandId)
      if (!command) continue

      // Resolve input path(s) from nodeOutputs map
      const incomingEdges = allEdges.filter(e => e.target === processNode.id)
      const inputPath = nodeOutputs[incomingEdges[0]?.source]
      const input2Path = command.twoInputs ? nodeOutputs[incomingEdges[1]?.source] : null

      if (!inputPath) {
        updateNodeData(processNode.id, { status: 'error' })
        updateNodeData(outputNodeId, { chainRunning: false })
        alert('Missing input for ' + command.label + '. Connect a source or process node.')
        return
      }
      const inputInfo = await window.cdpStudio.getAudioInfo(inputPath).catch(() => null)
      const inputDuration = inputInfo?.duration || 0

      if (command.twoInputs && !input2Path) {
        updateNodeData(processNode.id, { status: 'error' })
        updateNodeData(outputNodeId, { chainRunning: false })
        alert('Mix node needs two inputs. Connect a second source/process to handle B.')
        return
      }

      // Validate mono requirement
      if (command.multichannel === false) {
        if (inputInfo && inputInfo.channels > 1) {
          updateNodeData(processNode.id, { status: 'error' })
          updateNodeData(outputNodeId, { chainRunning: false })
          alert(`${command.label} requires mono input. The input file has ${inputInfo.channels} channels. Use HOUSEKEEP CHANS to split channels first.`)
          return
        }
      }

      const paramValues = { ...(processNode.data.paramValues || {}) }

      // Write breakpoint files (inline curves or connected breakpoint file nodes)
      const breakpointCurves = processNode.data.breakpointCurves || {}
      const breakpointConnections = processNode.data.breakpointConnections || {}
      const resolutionContext = {
        inputDuration,
        outputDuration: paramValues.outdur ?? 10,
        paramValues
      }

      // First check for connected breakpoint file nodes
      for (const [paramId, bpFilePath] of Object.entries(breakpointConnections)) {
        if (bpFilePath) {
          paramValues[paramId] = bpFilePath
        }
      }

      // Then handle inline breakpoint curves (override if both exist)
      for (const [paramId, points] of Object.entries(breakpointCurves)) {
        if (points && Array.isArray(points) && points.length >= 2) {
          const param = command.params?.find(p => p.id === paramId)
          const limits = resolveParamLimits(param, resolutionContext)
          const actualPoints = points.map(p => ({
            time: p.time,
            value: limits.min + (p.value / 100) * (limits.max - limits.min),
          }))
          const filename = `${processNode.id}_${paramId}_${Date.now()}.brk`
          try {
            const filePath = await window.cdpStudio.writeBreakpointFile(actualPoints, filename)
            paramValues[paramId] = filePath
          } catch (e) {
            console.error('Failed to write breakpoint file for', paramId, e)
          }
        }
      }

      // Validate extend_drunk constraints (both modes)
      if (command.id === 'extend_drunk' || command.id === 'extend_drunk_2') {
        const clock = paramValues.clock ?? 0.1
        if (clock <= 0.03) {
          updateNodeData(processNode.id, { status: 'error' })
          updateNodeData(outputNodeId, { chainRunning: false })
          alert(`Extend Drunk: Clock (${clock}s) must be > 0.03s (twice the default splice length of 15ms).`)
          return
        }
      }

      updateNodeData(processNode.id, { status: 'running', inputPath, input2Path })

      const outputPath = await buildOutputPath(inputPath, processNode.data.commandId)
      const args = buildArgs({ command, inputPath, input2Path, outputPath, paramValues })

      const result = await window.cdpStudio.runCDP({
        program: command.program,
        args,
        outputPath,
        label: command.label,
      })

      if (!result.success) {
        updateNodeData(processNode.id, { status: 'error' })
        updateNodeData(outputNodeId, { chainRunning: false })
        return
      }

      updateNodeData(processNode.id, { status: 'done' })
      nodeOutputs[processNode.id] = outputPath

      // Save to clip bin (only .wav outputs)
      if (command.outputExt === '.wav') {
        const audioInfo = await window.cdpStudio.getAudioInfo(outputPath).catch(() => null)
        const clip = await window.cdpStudio.saveClip({
          id: uuidv4(),
          name: `${command.label}`,
          filePath: outputPath,
          command: result.command,
          sourceClipId: lastClipId,
          channels: audioInfo?.channels || 1,
          sampleRate: audioInfo?.sampleRate || 44100,
          duration: audioInfo?.duration || 0,
          channelFormat: audioInfo?.channels === 1 ? 'mono' : audioInfo?.channels === 2 ? 'stereo' : `${audioInfo?.channels}ch`,
        })
        lastClipId = clip?.id
        window.dispatchEvent(new CustomEvent('cdpStudio', { detail: { type: 'clipSaved', clip } }))
      }
    }

    // Update output node with final result
    const lastProcess = processChain[processChain.length - 1]
    const finalPath = nodeOutputs[lastProcess?.id]
    const audioInfo = await window.cdpStudio.getAudioInfo(finalPath).catch(() => null)
    updateNodeData(outputNodeId, { chainRunning: false, filePath: finalPath, audioInfo })
  }, [])

  // Wire renderChain into output node data after it's defined
  useEffect(() => {
    setNodes(nds => nds.map(n =>
      n.type === 'output'
        ? { ...n, data: { ...n.data, onRenderChain: renderChain } }
        : n
    ))
  }, [renderChain])

  // Wire callbacks into all nodes
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      if (n.type === 'source') return { ...n, data: { ...n.data, onUpdate: updateNodeData } }
      if (n.type === 'process') return { ...n, data: { ...n.data, onUpdate: updateNodeData, onAIHelp } }
      return n
    }))
  }, [onAIHelp])

  const onConnect = useCallback((connection) => {
    const sourceNode = nodesRef.current.find(n => n.id === connection.source)
    const isBreakpointConnection = sourceNode?.type === 'breakpointFile'

    setEdges(eds => addEdge({
      ...connection,
      style: isBreakpointConnection
        ? { stroke: '#ec4899', strokeWidth: 2, strokeDasharray: '5,5' }
        : { stroke: 'var(--border-light)', strokeWidth: 2 },
      animated: isBreakpointConnection,
      deletable: true,
    }, eds))

    // Propagate input path from source/breakpoint file to connected process node
    setNodes(nds => {
      const srcNode = nds.find(n => n.id === connection.source)
      const tgtNode = nds.find(n => n.id === connection.target)
      const inputPath = srcNode?.data?.filePath || srcNode?.data?.outputPath
      const isBreakpointFile = srcNode?.type === 'breakpointFile'
      const isTargetBreakpointFile = tgtNode?.type === 'breakpointFile'

      // Source connecting to breakpoint file inlet (for duration sync)
      if (isTargetBreakpointFile && connection.targetHandle === 'duration-source') {
        const sourceDuration = srcNode?.data?.audioInfo?.duration || 0
        return nds.map(n => {
          if (n.id !== connection.target) return n
          return {
            ...n,
            data: {
              ...n.data,
              connectedSourceId: connection.source,
              connectedSourceDuration: sourceDuration
            }
          }
        })
      }

      if (isBreakpointFile) {
        // Breakpoint file connection - store the breakpoint file path for the specific parameter
        const paramId = connection.targetHandle
        return nds.map(n => {
          if (n.id !== connection.target) return n
          const breakpointConnections = { ...(n.data.breakpointConnections || {}) }
          breakpointConnections[paramId] = srcNode.data.filePath
          return { ...n, data: { ...n.data, breakpointConnections } }
        })
      }

      if (!inputPath) return nds

      // Regular audio connection
      const targetHandle = connection.targetHandle
      return nds.map(n => {
        if (n.id !== connection.target) return n
        const updates = {}
        if (targetHandle === 'input-b') {
          updates.input2Path = inputPath
        } else {
          updates.inputPath = inputPath
        }
        return { ...n, data: { ...n.data, ...updates } }
      })
    })
  }, [])

  const addProcessNode = (commandId) => {
    const command = getCommandById(commandId)
    const id = `process-${uuidv4()}`
    const defaultParams = {}
    command.params.forEach(p => { defaultParams[p.id] = p.default })
    command.flags?.forEach(f => { defaultParams[f.id] = f.default })

    setNodes(nds => [...nds, {
      id, type: 'process',
      position: { x: 200 + Math.random() * 200, y: 60 + Math.random() * 200 },
      data: {
        commandId, paramValues: defaultParams,
        inputPath: null, status: null,
        onUpdate: updateNodeData, onAIHelp,
      },
    }])
    setShowPicker(false)
  }

  const addSourceNode = () => {
    const id = `source-${uuidv4()}`
    setNodes(nds => [...nds, {
      id, type: 'source',
      position: { x: 40, y: 180 + nds.filter(n => n.type === 'source').length * 200 },
      data: { filePath: null, audioInfo: null, label: '', onUpdate: updateNodeData },
    }])
  }

  const addOutputNode = () => {
    const id = `output-${uuidv4()}`
    setNodes(nds => [...nds, {
      id, type: 'output', deletable: false,
      position: { x: 700, y: 180 + nds.filter(n => n.type === 'output').length * 200 },
      data: { filePath: null, audioInfo: null, chainRunning: false, onRenderChain: renderChain },
    }])
  }

  const addBreakpointFileNode = () => {
    const id = `bpfile-${uuidv4()}`
    setNodes(nds => [...nds, {
      id, type: 'breakpointFile',
      position: { x: 200 + Math.random() * 200, y: 400 + Math.random() * 200 },
      data: {
        points: [{ time: 0, value: 50 }, { time: 10, value: 50 }],
        timeDomain: 'output',
        timeMax: 10,
        paramMin: 0,
        paramMax: 1,
        label: 'bp',
        filePath: null,
        status: null,
        onUpdate: updateNodeData,
      },
    }])
    setShowPicker(false)
  }

  // ── Session save / load ──────────────────────────────────────────
  // Serialize the graph, stripping function callbacks + transient run state.
  const serializeGraph = () => {
    const TRANSIENT = new Set(['onUpdate', 'onRenderChain', 'onAIHelp', 'status', 'chainRunning'])
    const nodes = nodesRef.current.map(n => {
      const data = {}
      for (const [k, v] of Object.entries(n.data || {})) {
        if (TRANSIENT.has(k) || typeof v === 'function') continue
        data[k] = v
      }
      return { id: n.id, type: n.type, position: n.position, deletable: n.deletable, data }
    })
    return { version: 1, app: 'cdp-studio', nodes, edges: edgesRef.current }
  }

  // Restore a serialized graph, re-attaching the callbacks the wiring effects
  // would otherwise only attach on mount.
  const loadGraph = (data) => {
    if (!data || !Array.isArray(data.nodes)) return
    const nodes = data.nodes.map(n => {
      const d = { ...n.data, status: null }
      if (n.type === 'source') d.onUpdate = updateNodeData
      if (n.type === 'process') { d.onUpdate = updateNodeData; d.onAIHelp = onAIHelp }
      if (n.type === 'breakpointFile') d.onUpdate = updateNodeData
      if (n.type === 'output') { d.onRenderChain = renderChain; d.filePath = null; d.chainRunning = false }
      return { ...n, data: d }
    })
    setNodes(nodes)
    setEdges(data.edges || [])
  }

  const handleSaveSession = async () => {
    // The native save dialog lets the user name the file; 'session' is just the default.
    await window.cdpStudio.saveSession('session', serializeGraph())
  }

  const handleOpenSession = async () => {
    const res = await window.cdpStudio.loadSession()
    if (res?.loaded) loadGraph(res.data)
  }

  // NB: Electron has no window.prompt(), so the example chooser is an in-app popover.
  const handleOpenExample = async () => {
    const list = (await window.cdpStudio.listExamples?.()) || []
    if (!list.length) { alert('No example sessions are bundled yet.'); return }
    setExamplePicker(list)
  }

  const loadExampleByName = async (name) => {
    setExamplePicker(null)
    const res = await window.cdpStudio.loadExample(name)
    if (res?.loaded) loadGraph(res.data)
  }

  const handleDirsf = async () => {
    const res = await window.cdpStudio.dirsfList?.()
    if (res?.ok) setDirsfResult(res)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--nodegraph-bg)' }}>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          background: var(--border-dim);
          border-radius: 3px;
          outline: none;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent-color, #3b82f6);
          cursor: pointer;
          border: 2px solid var(--panel-bg);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent-color, #3b82f6);
          cursor: pointer;
          border: 2px solid var(--panel-bg);
        }
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: #ef4444 !important;
          stroke-width: 2 !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={(changes) => {
          const safe = changes.filter(c => {
            if (c.type === 'remove') {
              const node = nodes.find(n => n.id === c.id)
              if (node?.type === 'output') return false
            }
            return true
          })
          onNodesChange(safe)
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={(event, edge) => console.log('Edge selected:', edge.id, 'source:', edge.source, 'target:', edge.target)}
        nodeTypes={nodeTypes}
        fitView
        selectable={true}
        deleteKeyCode={['Backspace', 'Delete']}
        style={{ background: 'var(--nodegraph-bg)' }}
        defaultEdgeOptions={{
          style: { stroke: 'var(--border-light)', strokeWidth: 2 },
          deletable: true,
          selectable: true,
        }}
      >
        <Background color="var(--panel-bg)" gap={20} size={1} />
        <Controls style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)' }} />
        <MiniMap
          style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-dim)' }}
          nodeColor={n => {
            if (n.type === 'source') return '#22c55e'
            if (n.type === 'output') return '#f59e0b'
            const cmd = getCommandById(n.data?.commandId)
            return CDP_CATEGORIES.find(c => c.id === cmd?.category)?.colour || '#3b82f6'
          }}
        />
        <Panel position="top-left">
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowPicker(p => !p)}
              style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: 'var(--text-bright)', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Add Process
            </button>
            <button onClick={addSourceNode}
              style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: '#22c55e', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Add Source
            </button>
            <button onClick={addOutputNode}
              style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: '#f59e0b', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Add Output
            </button>
            <button onClick={addBreakpointFileNode}
              style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: '#ec4899', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Breakpoint
            </button>
            <button onClick={handleDirsf} title="List the soundfiles in a folder (DIRSF)"
              style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: 'var(--text-bright)', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              📁 Soundfiles
            </button>
          </div>
        </Panel>
        {dirsfResult && (
          <Panel position="top-left">
            <div style={{ marginTop: 48, background: 'var(--panel-bg)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 8, maxWidth: 560, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.66em', color: 'var(--text-muted)' }}>DIRSF · {dirsfResult.dir}</span>
                <button onClick={() => setDirsfResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1em' }}>✕</button>
              </div>
              <pre style={{ margin: 0, fontSize: '0.62em', color: '#9ca3af', maxHeight: 260, overflow: 'auto', whiteSpace: 'pre' }}>{dirsfResult.text}</pre>
            </div>
          </Panel>
        )}
        <Panel position="top-right">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSaveSession} title="Save the current node graph as a .cdpproject file"
                style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: 'var(--text-bright)', borderRadius: 8, padding: '7px 12px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
                Save Session
              </button>
              <button onClick={handleOpenSession} title="Open a saved .cdpproject session"
                style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: 'var(--text-bright)', borderRadius: 8, padding: '7px 12px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
                Open Session
              </button>
              <button onClick={handleOpenExample} title="Open a bundled tutorial example"
                style={{ background: 'var(--border-dim)', border: '1px solid var(--border-light)', color: '#14b8a6', borderRadius: 8, padding: '7px 12px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
                Open Example…
              </button>
            </div>
            {examplePicker && (
              <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 6, minWidth: 240, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}>
                <div style={{ fontSize: '0.66em', color: 'var(--text-muted)', padding: '2px 6px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose a tutorial example</div>
                {examplePicker.map(ex => (
                  <button key={ex.name} onClick={() => loadExampleByName(ex.name)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-bright)', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.78em' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border-dim)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {ex.name}
                  </button>
                ))}
                <button onClick={() => setExamplePicker(null)}
                  style={{ ...smallBtnStyle('#475569'), marginTop: 4, width: '100%' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </Panel>
        <Panel position="bottom-center">
          <div style={{ fontSize: '0.65em', color: 'var(--text-muted)', background: 'var(--app-bg)', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border-dim)' }}>
            Click a wire or node to select · Backspace / Delete to remove
          </div>
        </Panel>
      </ReactFlow>

      {/* Command picker */}
      {showPicker && (
        <div style={{
          position: 'absolute', top: 50, left: 10, zIndex: 100,
          background: 'var(--panel-bg)', border: '1px solid var(--border-dim)',
          borderRadius: 12, padding: 12, width: 300,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: '0.78em', fontWeight: 700, color: 'var(--text-normal)', marginBottom: 10 }}>
            Add a CDP Process Node
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {CDP_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: '0.67em',
                  background: selectedCat === cat.id ? cat.colour + '33' : 'var(--border-dim)',
                  border: `1px solid ${selectedCat === cat.id ? cat.colour : 'var(--border-light)'}`,
                  color: selectedCat === cat.id ? cat.colour : 'var(--text-normal)', cursor: 'pointer',
                }}>
                {cat.label.split(' — ')[0]}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {CDP_COMMANDS.filter(c => c.category === selectedCat).map(cmd => (
              <div key={cmd.id} onClick={() => addProcessNode(cmd.id)}
                style={{
                  padding: '8px 10px', borderRadius: 7, marginBottom: 4,
                  background: 'var(--border-dim)', cursor: 'pointer', border: '1px solid transparent',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.8em', fontWeight: 600, color: 'var(--text-bright)' }}>{cmd.label}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <FormatBadge ext={cmd.inputExt?.[0] || '.wav'} side="in" />
                    <FormatBadge ext={cmd.outputExt || '.wav'} side="out" />
                  </div>
                </div>
                <div style={{ fontSize: '0.67em', color: 'var(--text-muted)' }}>{cmd.description.slice(0, 90)}…</div>
                {!cmd.multichannel && <div style={{ fontSize: '0.6em', color: '#f59e0b', marginTop: 2 }}>⚠ Mono input only</div>}
              </div>
            ))}
          </div>
          <button onClick={() => setShowPicker(false)} style={{ ...smallBtnStyle('#475569'), marginTop: 8, width: '100%' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────
const nodeStyle = (colour) => ({
  background: 'var(--panel-bg)', border: `1px solid ${colour}55`,
  borderRadius: 10, minWidth: 190, maxWidth: 230,
  boxShadow: `0 0 12px ${colour}11`,
})
const nodeTitleStyle = (colour) => ({
  background: colour + '22', borderBottom: `1px solid ${colour}33`,
  padding: '6px 10px', borderRadius: '10px 10px 0 0',
})
const handleStyle = (colour) => ({
  width: 10, height: 10, background: colour, border: '2px solid var(--panel-bg)',
})
const smallBtnStyle = (colour) => {
  const isNeutral = colour === '#334155' || colour === '#475569'
  return {
    width: '100%', padding: '4px 0', marginTop: 4,
    background: isNeutral ? 'var(--border-dim)' : colour + '22',
    border: `1px solid ${isNeutral ? 'var(--border-light)' : colour + '55'}`,
    color: isNeutral ? 'var(--text-muted)' : colour,
    borderRadius: 6, fontSize: '0.72em',
    cursor: 'pointer', fontWeight: 600,
  }
}
