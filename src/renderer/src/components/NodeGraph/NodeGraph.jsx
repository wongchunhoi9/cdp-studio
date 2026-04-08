import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, Panel, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import WaveSurfer from 'wavesurfer.js'
import { CDP_COMMANDS, CDP_CATEGORIES, getCommandById } from '../../lib/cdpCommands.js'
import { buildArgs, buildOutputPath } from '../../lib/cdpRunner.js'
import { resolveParamLimits, resolveBreakpointTimeDomain, validateParamValue } from '../../lib/paramResolver.js'
import { v4 as uuidv4 } from 'uuid'
import BreakpointEditor from './BreakpointEditor'
import TextEditor, { parseBreakpointText, pointsToBreakpointText, pointsToPercentage, percentageToPoints } from './TextEditor'

// ── Format badge ───────────────────────────────────────────────────
function FormatBadge({ ext, side = 'in' }) {
  const isAna = ext === '.ana'
  const colour = isAna ? '#a78bfa' : '#22c55e'
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
function MiniWaveform({ filePath }) {
  const ref = useRef(null)
  const wsRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)

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
    ws.on('ready', () => setReady(true))
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

  const togglePlay = () => {
    wsRef.current?.playPause()
  }

  return (
    <div style={{
      borderRadius: 4, overflow: 'hidden',
      background: '#020a06', border: '1px solid #1a3a22',
      marginTop: 6, position: 'relative', minHeight: 32,
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
function SourceNode({ data, id }) {
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
      style={nodeStyle('#22c55e')}
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
            <div style={{ fontSize: '0.7em', color: '#94a3b8', wordBreak: 'break-all', marginBottom: 3 }}>
              {data.label}
            </div>
            {data.audioInfo && (
              <div style={{ fontSize: '0.65em', color: '#4ade80', marginBottom: 2 }}>
                {data.audioInfo.channels}ch · {(data.audioInfo.sampleRate / 1000).toFixed(1)}kHz · {fmt(data.audioInfo.duration)}
              </div>
            )}
            <MiniWaveform filePath={data.filePath} />
          </>
        ) : (
          <div style={{ fontSize: '0.72em', color: '#475569', textAlign: 'center', padding: '6px 0' }}>
            No file loaded — drop a clip here
          </div>
        )}
        <button onClick={handleBrowse} style={{ ...smallBtnStyle('#22c55e'), marginTop: 8 }}>
          {data.filePath ? 'Change File' : 'Load WAV…'}
        </button>
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
          <label style={{ fontSize: '0.67em', color: '#94a3b8' }}>
            {param.label}
            {param.id in (command.flags?.reduce((a, f) => ({ ...a, [f.id]: true }), {}) || {})
              ? <span style={{ color: '#334155', marginLeft: 3 }}>(-{param.id})</span>
              : null}
          </label>
          {isBreakpointParam && (
            <button
              onClick={toggleBreakpoint}
              className="nodrag"
              title={isBreakpoint ? 'Disable breakpoint curve' : 'Enable breakpoint curve'}
              style={{
                fontSize: '0.58em',
                background: isBreakpoint ? colour + '44' : '#1e293b',
                border: `1px solid ${isBreakpoint ? colour : '#334155'}`,
                color: isBreakpoint ? colour : '#475569',
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
              width: 64, background: '#1e293b', border: `1px solid ${colour}33`,
              borderRadius: 4, padding: '1px 4px', color: colour,
              fontFamily: 'monospace', fontSize: '0.67em', textAlign: 'right',
              outline: 'none',
            }}
          />
        )}
        {param.type !== 'number' && !isBreakpoint && (
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
          style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 4, padding: '2px 4px', fontSize: '0.7em' }}>
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
            <span style={{ fontSize: '0.55em', color: '#475569' }}>→</span>
            <FormatBadge ext={command.outputExt || '.wav'} side="out" />
          </div>
        </div>
        <div style={{ fontSize: '0.78em', fontWeight: 700, color: '#f1f5f9' }}>{command.label}</div>
      </div>

      <div style={{ padding: '8px 10px' }}>
        {command.params.map(renderParam)}
        {command.flags?.map(renderParam)}

        {/* Input file indicator */}
        {data.inputPath && (
          <div style={{ fontSize: '0.62em', color: '#475569', marginBottom: 4, wordBreak: 'break-all' }}>
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
          <div style={{ fontSize: '0.58em', color: '#475569', marginBottom: 4 }}>
            ⚠ Mono input only
          </div>
        )}

        {/* Doc link + AI help */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {command.docUrl && (
            <a href={command.docUrl} target="_blank" rel="noreferrer"
              style={{ ...smallBtnStyle('#334155'), flex: 1, textAlign: 'center', textDecoration: 'none', display: 'block' }}>
              📖 Docs
            </a>
          )}
          <button onClick={() => data.onAIHelp?.(command)}
            style={{ ...smallBtnStyle('#334155'), flex: 1 }}>
            ? AI
          </button>
        </div>
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
              background: hasConnection ? '#ec4899' : '#1e293b',
              border: hasConnection ? '2px solid #ec4899' : '2px solid #475569',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Output Node — runs the whole chain ────────────────────────────
function OutputNode({ data, id }) {
  const fmt = (s) => {
    if (!s || s === 0) return '—'
    const m = Math.floor(s / 60), sec = (s % 60).toFixed(1).padStart(4, '0')
    return `${m}:${sec}`
  }

  return (
    <div style={nodeStyle('#f59e0b')}>
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
            <div style={{ fontSize: '0.7em', color: '#94a3b8', wordBreak: 'break-all', marginBottom: 3 }}>
              ✓ {data.filePath.split('/').pop()}
            </div>
            {data.audioInfo && (
              <div style={{ fontSize: '0.65em', color: '#fbbf24', marginBottom: 6 }}>
                {data.audioInfo.channels}ch · {(data.audioInfo.sampleRate / 1000).toFixed(1)}kHz · {fmt(data.audioInfo.duration)}
              </div>
            )}
            {/* Quick preview waveform */}
            <MiniWaveform filePath={data.filePath} />
          </>
        ) : (
          <div style={{ fontSize: '0.7em', color: '#475569', marginBottom: 8 }}>
            Connect process nodes, then click Render Chain ↓
          </div>
        )}

        {/* THE key button — runs the entire chain */}
        <button
          onClick={() => data.onRenderChain?.(id)}
          disabled={data.chainRunning}
          style={{
            ...smallBtnStyle('#f59e0b'),
            width: '100%', padding: '6px 0',
            fontSize: '0.78em', fontWeight: 700,
            opacity: data.chainRunning ? 0.6 : 1,
          }}>
          {data.chainRunning ? '⟳ Running chain…' : '▶ Render Chain'}
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
    <div style={{ ...nodeStyle(colour), outline: selected ? `2px solid ${colour}` : 'none', width: 260 }}>
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
              background: viewMode === 'visual' ? colour + '44' : '#1e293b',
              border: `1px solid ${viewMode === 'visual' ? colour : '#334155'}`,
              color: viewMode === 'visual' ? colour : '#64748b',
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
              background: viewMode === 'text' ? colour + '44' : '#1e293b',
              border: `1px solid ${viewMode === 'text' ? colour : '#334155'}`,
              color: viewMode === 'text' ? colour : '#64748b',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            {'</>'} Text
          </button>
        </div>

        {/* Label input */}
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: '0.65em', color: '#94a3b8' }}>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="nodrag"
            style={{
              width: '100%', background: '#1e293b', border: '1px solid #334155',
              borderRadius: 4, padding: '2px 6px', color: '#f1f5f9',
              fontSize: '0.7em', marginTop: 2
            }}
          />
        </div>

        {/* Time Domain + Sync button */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.65em', color: '#94a3b8' }}>Time Domain</label>
            {connectedSourceDuration > 0 && (
              <button
                onClick={syncDurationFromSource}
                className="nodrag"
                style={{
                  fontSize: '0.58em',
                  padding: '1px 6px',
                  background: '#1e293b',
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
              width: '100%', background: '#1e293b', border: '1px solid #334155',
              borderRadius: 4, padding: '2px 6px', color: '#f1f5f9',
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
            <label style={{ fontSize: '0.65em', color: '#94a3b8' }}>Time Max (s)</label>
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
                width: '100%', background: '#1e293b', border: '1px solid #334155',
                borderRadius: 4, padding: '2px 6px', color: '#f1f5f9',
                fontSize: '0.7em', marginTop: 2
              }}
            />
          </div>
        )}

        {/* Value Range */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.65em', color: '#94a3b8' }}>Value Min</label>
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
                width: '100%', background: '#1e293b', border: '1px solid #334155',
                borderRadius: 4, padding: '2px 6px', color: '#f1f5f9',
                fontSize: '0.7em', marginTop: 2
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.65em', color: '#94a3b8' }}>Value Max</label>
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
                width: '100%', background: '#1e293b', border: '1px solid #334155',
                borderRadius: 4, padding: '2px 6px', color: '#f1f5f9',
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
            width={238}
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
          <div style={{ fontSize: '0.6em', color: '#64748b', marginTop: 4, wordBreak: 'break-all' }}>
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
        : { stroke: '#334155', strokeWidth: 2 },
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#090f1a' }}>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          background: #1e293b;
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
          border: 2px solid #0d1520;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--accent-color, #3b82f6);
          cursor: pointer;
          border: 2px solid #0d1520;
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
        style={{ background: '#090f1a' }}
        defaultEdgeOptions={{
          style: { stroke: '#334155', strokeWidth: 2 },
          deletable: true,
          selectable: true,
        }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls style={{ background: '#1e293b', border: '1px solid #334155' }} />
        <MiniMap
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
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
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Add Process
            </button>
            <button onClick={addSourceNode}
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#22c55e', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Add Source
            </button>
            <button onClick={addOutputNode}
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#f59e0b', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Add Output
            </button>
            <button onClick={addBreakpointFileNode}
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#ec4899', borderRadius: 8, padding: '7px 14px', fontSize: '0.8em', cursor: 'pointer', fontWeight: 600 }}>
              + Breakpoint
            </button>
          </div>
        </Panel>
        <Panel position="bottom-center">
          <div style={{ fontSize: '0.65em', color: '#334155', background: '#090f1a', padding: '3px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
            Click a wire or node to select · Backspace / Delete to remove
          </div>
        </Panel>
      </ReactFlow>

      {/* Command picker */}
      {showPicker && (
        <div style={{
          position: 'absolute', top: 50, left: 10, zIndex: 100,
          background: '#0f172a', border: '1px solid #334155',
          borderRadius: 12, padding: 12, width: 300,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <div style={{ fontSize: '0.78em', fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
            Add a CDP Process Node
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {CDP_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: '0.67em',
                  background: selectedCat === cat.id ? cat.colour + '33' : '#1e293b',
                  border: `1px solid ${selectedCat === cat.id ? cat.colour : '#334155'}`,
                  color: selectedCat === cat.id ? cat.colour : '#64748b', cursor: 'pointer',
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
                  background: '#1e293b', cursor: 'pointer', border: '1px solid transparent',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.8em', fontWeight: 600, color: '#f1f5f9' }}>{cmd.label}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <FormatBadge ext={cmd.inputExt?.[0] || '.wav'} side="in" />
                    <FormatBadge ext={cmd.outputExt || '.wav'} side="out" />
                  </div>
                </div>
                <div style={{ fontSize: '0.67em', color: '#475569' }}>{cmd.description.slice(0, 90)}…</div>
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
  background: '#0d1520', border: `1px solid ${colour}55`,
  borderRadius: 10, minWidth: 190, maxWidth: 230,
  boxShadow: `0 0 12px ${colour}11`,
})
const nodeTitleStyle = (colour) => ({
  background: colour + '22', borderBottom: `1px solid ${colour}33`,
  padding: '6px 10px', borderRadius: '10px 10px 0 0',
})
const handleStyle = (colour) => ({
  width: 10, height: 10, background: colour, border: '2px solid #0d1520',
})
const smallBtnStyle = (colour) => ({
  width: '100%', padding: '4px 0', marginTop: 4,
  background: colour + '22', border: `1px solid ${colour}55`,
  color: colour, borderRadius: 6, fontSize: '0.72em',
  cursor: 'pointer', fontWeight: 600,
})
