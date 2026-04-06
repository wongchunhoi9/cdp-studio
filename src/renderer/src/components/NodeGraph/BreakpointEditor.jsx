import { useState, useRef, useCallback, useMemo } from 'react'

const PADDING = { top: 8, right: 12, bottom: 18, left: 38 }
const POINT_RADIUS = 6
const SNAP_THRESHOLD = 12

export default function BreakpointEditor({
  points,
  onChange,
  timeMax = 10,
  valueMin = 0,
  valueMax = 100,
  paramMin = 0,
  paramMax = 1,
  colour = '#3b82f6',
  width = 200,
  height = 80,
}) {
  const [dragging, setDragging] = useState(null)
  const [hovered, setHovered] = useState(null)
  const svgRef = useRef(null)

  const graphW = width - PADDING.left - PADDING.right
  const graphH = height - PADDING.top - PADDING.bottom

  const toX = (time) => PADDING.left + (time / timeMax) * graphW
  const toY = (value) => PADDING.top + graphH - ((value - valueMin) / (valueMax - valueMin)) * graphH
  const fromX = (px) => Math.max(0, Math.min(timeMax, ((px - PADDING.left) / graphW) * timeMax))
  const fromY = (py) => Math.max(valueMin, Math.min(valueMax, valueMin + ((PADDING.top + graphH - py) / graphH) * (valueMax - valueMin)))

  const pctToValue = useMemo(() => (pct) => {
    return paramMin + (pct / 100) * (paramMax - paramMin)
  }, [paramMin, paramMax])

  const valueToPct = useMemo(() => (val) => {
    return ((val - paramMin) / (paramMax - paramMin)) * 100
  }, [paramMin, paramMax])

  const formatValue = (val) => {
    if (paramMax <= 1) return val.toFixed(3)
    if (paramMax <= 10) return val.toFixed(2)
    if (paramMax <= 100) return val.toFixed(1)
    return val.toFixed(0)
  }

  const findNearestPoint = (mouseX, mouseY) => {
    let nearest = -1
    let nearestDist = SNAP_THRESHOLD
    points.forEach((p, i) => {
      const pct = p.value
      const dx = toX(p.time) - mouseX
      const dy = toY(pct) - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = i
      }
    })
    return nearest
  }

  const handlePointDown = useCallback((e, index) => {
    e.stopPropagation()
    e.preventDefault()
    if (svgRef.current) {
      svgRef.current.setPointerCapture(e.pointerId)
    }
    setDragging(index)
  }, [])

  const handlePointerMove = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const time = Math.round(fromX(x) * 100) / 100
    const pctValue = Math.max(0, Math.min(100, fromY(y)))
    const actualValue = pctToValue(pctValue)

    if (dragging !== null) {
      const newPoints = points.map((p, i) =>
        i === dragging ? { time, value: pctValue } : p
      )
      newPoints.sort((a, b) => a.time - b.time)
      onChange(newPoints, actualValue)
    } else {
      const nearest = findNearestPoint(x, y)
      setHovered(nearest >= 0 ? { index: nearest, pct: pctValue, actual: actualValue, x, y } : null)
    }
  }, [dragging, points, onChange, timeMax, valueMin, valueMax, pctToValue])

  const handlePointerUp = useCallback((e) => {
    if (dragging !== null && svgRef.current) {
      svgRef.current.releasePointerCapture(e.pointerId)
    }
    setDragging(null)
    setHovered(null)
  }, [dragging])

  const handleClick = useCallback((e) => {
    if (dragging !== null) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const nearest = findNearestPoint(x, y)
    if (nearest >= 0) return

    const time = Math.round(fromX(x) * 100) / 100
    const pctValue = Math.max(0, Math.min(100, fromY(y)))

    const newPoints = [...points, { time, value: pctValue }].sort((a, b) => a.time - b.time)
    const actualValue = pctToValue(pctValue)
    onChange(newPoints, actualValue)
  }, [points, onChange, dragging, timeMax, valueMin, valueMax, pctToValue])

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation()
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const nearest = findNearestPoint(x, y)
    if (nearest >= 0 && points.length > 2) {
      const newPoints = points.filter((_, i) => i !== nearest)
      onChange(newPoints, null)
    }
  }, [points, onChange])

  const pathD = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.time).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(' ')
    : ''

  const gridLines = []

  // Y-axis grid lines and labels (inside graph area)
  const ySteps = 4
  for (let i = 0; i <= ySteps; i++) {
    const pct = valueMin + ((valueMax - valueMin) / ySteps) * i
    const actual = pctToValue(pct)
    const y = toY(pct)
    gridLines.push(
      <line key={`y-${i}`} x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y}
        stroke="#1e293b" strokeWidth={1} />
    )
    gridLines.push(
      <text key={`yl-${i}`} x={PADDING.left + 2} y={y + 4}
        textAnchor="start" fill="#64748b" fontSize={7} fontFamily="monospace">
        {pct.toFixed(0)}%
      </text>
    )
  }

  // X-axis grid lines and labels
  const xSteps = 4
  for (let i = 0; i <= xSteps; i++) {
    const t = (timeMax / xSteps) * i
    const x = toX(t)
    gridLines.push(
      <line key={`x-${i}`} x1={x} y1={PADDING.top} x2={x} y2={height - PADDING.bottom}
        stroke="#1e293b" strokeWidth={1} />
    )
    gridLines.push(
      <text key={`xl-${i}`} x={x} y={height - 2}
        textAnchor="middle" fill="#64748b" fontSize={8} fontFamily="monospace">
        {t.toFixed(0)}s
      </text>
    )
  }

  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="nodrag"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          background: '#0a0f1a',
          borderRadius: 6,
          border: `1px solid ${colour}33`,
          cursor: dragging !== null ? 'grabbing' : 'crosshair',
          display: 'block',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {gridLines}

        {points.length > 1 && (
          <path
            d={`${pathD} L ${toX(points[points.length - 1].time).toFixed(1)} ${toY(valueMin).toFixed(1)} L ${toX(points[0].time).toFixed(1)} ${toY(valueMin).toFixed(1)} Z`}
            fill={colour} fillOpacity={0.08}
          />
        )}

        {pathD && (
          <path d={pathD} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.time)}
            cy={toY(p.value)}
            r={POINT_RADIUS}
            fill={dragging === i ? colour : '#0d1520'}
            stroke={colour}
            strokeWidth={2}
            style={{ cursor: dragging === i ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => handlePointDown(e, i)}
          />
        ))}

        {points.length <= 2 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#334155" fontSize={8}>
            click to add points
          </text>
        )}

        {hovered && (
          <g>
            <rect
              x={toX(points[hovered.index]?.time ?? 0) - 30}
              y={Math.max(PADDING.top, toY(hovered.pct) - 18)}
              width={60}
              height={14}
              fill="#1e293b"
              stroke={colour}
              strokeWidth={1}
              rx={2}
            />
            <text
              x={toX(points[hovered.index]?.time ?? 0)}
              y={Math.max(PADDING.top + 8, toY(hovered.pct) - 8)}
              textAnchor="middle"
              fill="#f1f5f9"
              fontSize={8}
              fontFamily="monospace"
            >
              {`${hovered.pct.toFixed(0)}% → ${formatValue(hovered.actual)}`}
            </text>
          </g>
        )}
      </svg>
      <div style={{
        position: 'absolute', top: 2, right: 6,
        fontSize: '0.58em', color: '#334155', fontFamily: 'monospace'
      }}>
        {points.length} pt{points.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
