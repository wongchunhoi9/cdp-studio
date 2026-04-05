import { useState, useEffect } from 'react'

export default function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.cdpStudio?.getSettings().then(s => setSettings(s))
  }, [])

  const autoDetect = async () => {
    setDetecting(true)
    setDetectResult(null)
    const result = await window.cdpStudio?.detectCDPPath()
    setDetectResult(result)
    if (result?.found) {
      setSettings(s => ({ ...s, cdpBinPath: result.path }))
    }
    setDetecting(false)
  }

  const save = async () => {
    await window.cdpStudio?.setSettings(settings)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose?.() }, 800)
  }

  const testPath = async () => {
    const result = await window.cdpStudio?.runCDP({
      program: 'pvoc',
      args: [],
      outputPath: '',
      label: 'test',
    })
    // pvoc with no args returns usage message — that means it's found
    setDetectResult({
      found: !result?.error?.includes('not found'),
      path: settings?.cdpBinPath,
      tested: true,
    })
  }

  if (!settings) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000aa',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#0f172a', border: '1px solid #334155',
        borderRadius: 14, padding: 28, width: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: '1em', fontWeight: 700, color: '#f8fafc' }}>Settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.1em' }}>✕</button>
        </div>

        {/* ── CDP Path ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.78em', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
            CDP Binary Folder
          </label>
          <div style={{ fontSize: '0.72em', color: '#475569', marginBottom: 8, lineHeight: 1.6 }}>
            The folder containing <code style={{ color: '#7dd3fc', background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>pvoc</code>, <code style={{ color: '#7dd3fc', background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>grain</code>, <code style={{ color: '#7dd3fc', background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>modify</code> etc.<br/>
            Usually: <code style={{ color: '#7dd3fc', background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>/Users/yourname/cdpr8/_cdp/_cdprogs</code>
          </div>

          <input
            value={settings.cdpBinPath || ''}
            onChange={e => setSettings(s => ({ ...s, cdpBinPath: e.target.value }))}
            placeholder="/Users/yourname/cdpr8/_cdp/_cdprogs"
            style={{
              width: '100%', background: '#1e293b', border: '1px solid #334155',
              color: '#f1f5f9', borderRadius: 7, padding: '8px 12px',
              fontSize: '0.78em', fontFamily: 'monospace', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={autoDetect}
              disabled={detecting}
              style={btnStyle('#3b82f6')}
            >
              {detecting ? '🔍 Searching…' : '🔍 Auto-detect'}
            </button>
            <button onClick={testPath} style={btnStyle('#475569')}>
              ✓ Test path
            </button>
          </div>

          {/* Detection result */}
          {detectResult && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 7,
              background: detectResult.found ? '#052e16' : '#2d1a00',
              border: `1px solid ${detectResult.found ? '#166534' : '#92400e'}`,
              fontSize: '0.75em',
              color: detectResult.found ? '#4ade80' : '#fbbf24',
            }}>
              {detectResult.found
                ? `✓ CDP found at: ${detectResult.path}`
                : detectResult.tested
                  ? `✗ pvoc not found at this path. Check the folder and try again.`
                  : `✗ CDP not found automatically. Please paste the path manually.`
              }
            </div>
          )}
        </div>

        {/* ── Gatekeeper warning ── */}
        <div style={{
          background: '#2d1a00', border: '1px solid #92400e',
          borderRadius: 8, padding: '12px 14px', marginBottom: 20,
        }}>
          <div style={{ fontSize: '0.78em', fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
            ⚠️  macOS Gatekeeper — Run this once in Terminal
          </div>
          <div style={{ fontSize: '0.72em', color: '#fde68a', lineHeight: 1.7, marginBottom: 8 }}>
            macOS blocks unsigned binaries silently. Run this command once to unlock all CDP tools:
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: '0.8em', color: '#7dd3fc',
            background: '#0f172a', padding: '8px 12px', borderRadius: 6,
            border: '1px solid #1e3a5f',
          }}>
            xattr -rc ~/cdpr8
          </div>
          <div style={{ fontSize: '0.7em', color: '#92400e', marginTop: 6 }}>
            Replace <code>~/cdpr8</code> with your actual CDP folder path if different.
          </div>
        </div>

        {/* ── Other settings ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.78em', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
            Default Sample Rate
          </label>
          <select
            value={settings.defaultSampleRate || 44100}
            onChange={e => setSettings(s => ({ ...s, defaultSampleRate: parseInt(e.target.value) }))}
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 6, padding: '6px 10px', fontSize: '0.78em' }}
          >
            <option value={44100}>44100 Hz</option>
            <option value={48000}>48000 Hz</option>
            <option value={96000}>96000 Hz</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.keepIntermediateFiles !== false}
              onChange={e => setSettings(s => ({ ...s, keepIntermediateFiles: e.target.checked }))}
              style={{ accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: '0.78em', color: '#94a3b8' }}>
              Keep all intermediate files (recommended — nothing ever deleted)
            </span>
          </label>
        </div>

        {/* Save */}
        <button onClick={save} style={{ ...btnStyle('#22c55e'), width: '100%', padding: '10px' }}>
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>

        {/* How to find your path */}
        <div style={{ marginTop: 16, fontSize: '0.7em', color: '#334155', lineHeight: 1.8 }}>
          To find your CDP path: open Terminal and run{' '}
          <code style={{ color: '#475569', background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>find ~/ -name "pvoc" 2&gt;/dev/null</code>
          {' '}— copy everything except the trailing <code style={{ color: '#475569' }}>/pvoc</code>
        </div>
      </div>
    </div>
  )
}

const btnStyle = (colour) => ({
  background: colour + '22', border: `1px solid ${colour}55`,
  color: colour, borderRadius: 7, padding: '6px 14px',
  fontSize: '0.78em', fontWeight: 600, cursor: 'pointer',
})
