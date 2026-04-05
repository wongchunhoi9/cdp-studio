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
import { v4 as uuidv4 } from 'uuid'

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
    data.onUpdate(id, { paramValues: { ...data.paramValues, [paramId]: value } })
  }

  const renderParam = (param) => (
    <div key={param.id} style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <label style={{ fontSize: '0.67em', color: '#94a3b8' }}>
          {param.label}
          {param.id in (command.flags?.reduce((a, f) => ({ ...a, [f.id]: true }), {}) || {})
            ? <span style={{ color: '#334155', marginLeft: 3 }}>(-{param.id})</span>
            : null}
        </label>
        {param.type === 'number' && (
          <input type="number"
            min={param.min} max={param.max}
            step={param.step || (param.max - param.min) / 200}
            value={data.paramValues?.[param.id] ?? param.default}
            onChange={e => updateParam(param.id, parseFloat(e.target.value))}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={{
              width: 64, background: '#1e293b', border: `1px solid ${colour}33`,
              borderRadius: 4, padding: '1px 4px', color: colour,
              fontFamily: 'monospace', fontSize: '0.67em', textAlign: 'right',
              outline: 'none',
            }}
          />
        )}
        {param.type !== 'number' && (
          <span style={{ fontSize: '0.67em', color: colour, fontFamily: 'monospace' }}>
            {data.paramValues?.[param.id] ?? param.default}
          </span>
        )}
      </div>
      {param.type === 'number' && (
        <input type="range"
          min={param.min} max={param.max}
          step={param.step || (param.max - param.min) / 200}
          value={data.paramValues?.[param.id] ?? param.default}
          onChange={e => updateParam(param.id, parseFloat(e.target.value))}
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{ '--accent-color': colour }}
        />
      )}
      {param.type === 'select' && (
        <select value={data.paramValues?.[param.id] ?? param.default}
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
  )

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
    </div>
  )
}

// ── Output Node — runs the whole chain ────────────────────────────
function OutputNode({ data, id }) {
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
          <div style={{ fontSize: '0.7em', color: '#94a3b8', wordBreak: 'break-all', marginBottom: 8 }}>
            ✓ {data.filePath.split('/').pop()}
          </div>
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

const nodeTypes = { source: SourceNode, process: ProcessNode, output: OutputNode }

// ── Main NodeGraph ─────────────────────────────────────────────────
export default function NodeGraph({ onAIHelp }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: 'source-1', type: 'source', position: { x: 40, y: 180 },
      data: { filePath: null, audioInfo: null, label: '', onUpdate: updateNodeData },
    },
    {
      id: 'output-1', type: 'output', position: { x: 700, y: 180 },
      data: { filePath: null, chainRunning: false, onRenderChain: null },
    },
  ])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
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
      if (command.twoInputs && !input2Path) {
        updateNodeData(processNode.id, { status: 'error' })
        updateNodeData(outputNodeId, { chainRunning: false })
        alert('Mix node needs two inputs. Connect a second source/process to handle B.')
        return
      }

      // Validate mono requirement
      if (command.multichannel === false) {
        const inputInfo = await window.cdpStudio.getAudioInfo(inputPath).catch(() => null)
        if (inputInfo && inputInfo.channels > 1) {
          updateNodeData(processNode.id, { status: 'error' })
          updateNodeData(outputNodeId, { chainRunning: false })
          alert(`${command.label} requires mono input. The input file has ${inputInfo.channels} channels. Use HOUSEKEEP CHANS to split channels first.`)
          return
        }
      }

      const paramValues = processNode.data.paramValues || {}

      // Validate extend_drunk 1 constraints
      if (command.id === 'extend_drunk') {
        const inputInfo = await window.cdpStudio.getAudioInfo(inputPath).catch(() => null)
        if (inputInfo) {
          const dur = inputInfo.duration
          const locus = paramValues.locus ?? 0
          const ambitus = paramValues.ambitus ?? 1
          const clock = paramValues.clock ?? 0.1

          if (locus > dur) {
            updateNodeData(processNode.id, { status: 'error' })
            updateNodeData(outputNodeId, { chainRunning: false })
            alert(`Extend Drunk: Locus (${locus}s) exceeds input file duration (${dur.toFixed(2)}s). Set locus to a time within the file.`)
            return
          }
          if (locus - ambitus < 0) {
            updateNodeData(processNode.id, { status: 'error' })
            updateNodeData(outputNodeId, { chainRunning: false })
            alert(`Extend Drunk: Ambitus (${ambitus}s) extends before the start of the file. Locus (${locus}s) − ambitus must be ≥ 0. Reduce ambitus to ≤ ${locus.toFixed(2)}s.`)
            return
          }
          if (locus + ambitus > dur) {
            updateNodeData(processNode.id, { status: 'error' })
            updateNodeData(outputNodeId, { chainRunning: false })
            alert(`Extend Drunk: Ambitus (${ambitus}s) extends past the end of the file. Locus (${locus}s) + ambitus must be ≤ file duration (${dur.toFixed(2)}s). Reduce ambitus to ≤ ${(dur - locus).toFixed(2)}s.`)
            return
          }
          if (clock <= 0.03) {
            updateNodeData(processNode.id, { status: 'error' })
            updateNodeData(outputNodeId, { chainRunning: false })
            alert(`Extend Drunk: Clock (${clock}s) must be > 0.03s (twice the default splice length of 15ms).`)
            return
          }
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
    updateNodeData(outputNodeId, { chainRunning: false, filePath: finalPath })
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
    setEdges(eds => addEdge({
      ...connection,
      style: { stroke: '#334155', strokeWidth: 2 },
      animated: false,
      deletable: true,
    }, eds))

    // Propagate input path from source to connected process node
    setNodes(nds => {
      const sourceNode = nds.find(n => n.id === connection.source)
      const inputPath = sourceNode?.data?.filePath || sourceNode?.data?.outputPath
      if (!inputPath) return nds
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
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
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
