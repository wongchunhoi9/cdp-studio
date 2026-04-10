import { useState, useRef, useEffect } from 'react'

/**
 * Simple code editor for CDP breakpoint files
 * CDP format: "time value" pairs, one per line, space-separated
 */
export default function TextEditor({
  value = '',
  onChange,
  lineNumbers = true,
  readOnly = false,
  error = null,
  height = 120,
  placeholder = '0.0 0.5\n1.0 0.8\n2.0 0.3'
}) {
  const textareaRef = useRef(null)
  const lines = value.split('\n')
  const lineCount = lines.length || 1

  // Parse and validate CDP format
  const validateLine = (line, lineNum) => {
    if (!line.trim()) return null // Empty line is OK

    const parts = line.trim().split(/\s+/)
    if (parts.length !== 2) {
      return `Line ${lineNum}: Expected 2 values (time value), got ${parts.length}`
    }

    const [time, val] = parts
    if (isNaN(parseFloat(time))) {
      return `Line ${lineNum}: "${time}" is not a valid number`
    }
    if (isNaN(parseFloat(val))) {
      return `Line ${lineNum}: "${val}" is not a valid number`
    }

    return null
  }

  // Find first error
  const firstError = lines
    .map((line, i) => validateLine(line, i + 1))
    .find(err => err !== null)

  const handleChange = (e) => {
    onChange?.(e.target.value)
  }

  // Handle tab to insert spaces
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange?.(newValue)
      // Restore cursor position after state update
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          background: 'var(--app-bg)',
          border: `1px solid ${error || firstError ? '#ef4444' : 'var(--border-light)'}`,
          borderRadius: 6,
          overflow: 'hidden',
          height,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
          fontSize: '0.75em',
          lineHeight: '1.5',
        }}
      >
        {/* Line numbers */}
        {lineNumbers && (
          <div
            style={{
              background: 'var(--panel-bg)',
              padding: '6px 8px',
              color: 'var(--text-muted)',
              textAlign: 'right',
              userSelect: 'none',
              borderRight: '1px solid var(--border-dim)',
              minWidth: '2em',
            }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} style={{ height: '1.5em' }}>
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '6px 8px',
            color: 'var(--text-bright)',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />
      </div>

      {/* Error message */}
      {(error || firstError) && (
        <div
          style={{
            fontSize: '0.65em',
            color: '#ef4444',
            marginTop: 4,
            fontFamily: 'monospace',
          }}
        >
          ⚠ {error || firstError}
        </div>
      )}

      {/* Format hint */}
      <div
        style={{
          fontSize: '0.6em',
          color: 'var(--text-muted)',
          marginTop: 4,
          fontFamily: 'monospace',
        }}
      >
        CDP format: time value (space-separated)
      </div>
    </div>
  )
}

/**
 * Parse CDP breakpoint text into points array
 * Returns { points: [{time, value}], error: string | null }
 */
export function parseBreakpointText(text) {
  const lines = text.split('\n').filter(l => l.trim())
  const points = []

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/)
    if (parts.length !== 2) {
      return {
        points: [],
        error: `Line ${i + 1}: Expected "time value", got "${lines[i]}"`
      }
    }

    const time = parseFloat(parts[0])
    const value = parseFloat(parts[1])

    if (isNaN(time) || isNaN(value)) {
      return {
        points: [],
        error: `Line ${i + 1}: Invalid number(s) in "${lines[i]}"`
      }
    }

    points.push({ time, value })
  }

  // Sort by time
  points.sort((a, b) => a.time - b.time)

  return { points, error: null }
}

/**
 * Convert points array to CDP breakpoint text
 */
export function pointsToBreakpointText(points, decimals = 4) {
  if (!points || points.length === 0) return ''

  return points
    .map(p => `${p.time.toFixed(decimals)} ${p.value.toFixed(decimals)}`)
    .join('\n')
}

/**
 * Convert points to percentage values for visual editor
 * Returns array of {time, value} where value is 0-100 percentage
 */
export function pointsToPercentage(points, paramMin, paramMax) {
  if (!points || points.length === 0) return []

  return points.map(p => {
    const pct = paramMax !== paramMin
      ? ((p.value - paramMin) / (paramMax - paramMin)) * 100
      : 50
    return {
      time: p.time,
      value: Math.max(0, Math.min(100, pct))
    }
  })
}

/**
 * Convert percentage values back to actual values
 */
export function percentageToPoints(pctPoints, paramMin, paramMax) {
  if (!pctPoints || pctPoints.length === 0) return []

  return pctPoints.map(p => ({
    time: p.time,
    value: paramMin + (p.value / 100) * (paramMax - paramMin)
  }))
}
