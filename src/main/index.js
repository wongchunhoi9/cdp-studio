import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { spawn, execFile } from 'child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync, symlinkSync, copyFileSync, rmSync } from 'fs'
import Store from 'electron-store'
import { randomUUID } from 'crypto'

// ── Persistent store ────────────────────────────────────────────────
const store = new Store()

// ── Active process tracking (for STOP button) ──────────────────────
let activeCDPProcess = null

// ── CDP binary path (user configures on first run) ──────────────────
// Common Mac install locations — cdpr8 is the current release
const CDP_CANDIDATE_PATHS = [
  `${process.env.HOME}/cdpr8/_cdp/_cdprogs`,
  `${process.env.HOME}/cdp8/_cdp/_cdprogs`,
  `${process.env.HOME}/cdpr7/_cdp/_cdprogs`,
  '/usr/local/bin',
  '/opt/homebrew/bin',
]

function getCDPBinPath() {
  const stored = store.get('cdpBinPath')
  if (stored) return stored
  // Auto-detect on first run
  for (const p of CDP_CANDIDATE_PATHS) {
    if (existsSync(p)) {
      store.set('cdpBinPath', p)
      return p
    }
  }
  return CDP_CANDIDATE_PATHS[0] // fallback — user will need to set manually
}

// ── Auto-detect CDP and return result to renderer ───────────────────
ipcMain.handle('cdp:detectPath', async () => {
  for (const p of CDP_CANDIDATE_PATHS) {
    const pvoc = join(p, 'pvoc')
    if (existsSync(pvoc)) {
      store.set('cdpBinPath', p)
      return { found: true, path: p }
    }
  }
  return { found: false, candidates: CDP_CANDIDATE_PATHS }
})

// ── Clip storage directory ──────────────────────────────────────────
function getClipDir() {
  const dir = join(app.getPath('userData'), 'clips')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getProjectDir() {
  const dir = join(app.getPath('userData'), 'projects')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// Bundled tutorial examples: dev = <repo>/resources/examples, packaged = <resources>/examples
function getExamplesDir() {
  const candidates = [
    join(app.getAppPath(), 'resources', 'examples'),
    join(process.cwd(), 'resources', 'examples'),
    join(__dirname, '..', '..', 'resources', 'examples'),
    join(process.resourcesPath || app.getAppPath(), 'examples'),
  ]
  return candidates.find(p => existsSync(p)) || candidates[0]
}

// Resolve bundled assets referenced by basename (source wavs, breakpoint/data files) against
// the session/example file's own directory. Absolute paths (containing '/') are left untouched,
// so normal user sessions are unaffected.
function resolveSessionPaths(data, baseDir) {
  const resolve = (v, exts) =>
    (typeof v === 'string' && exts.test(v) && !v.includes('/')) ? join(baseDir, v) : v
  for (const n of data.nodes || []) {
    if (n.type === 'source' && n.data?.filePath) {
      n.data.filePath = resolve(n.data.filePath, /\.(wav|aif|aiff)$/i)
    }
    if (n.data?.paramValues) {
      for (const k of Object.keys(n.data.paramValues)) {
        n.data.paramValues[k] = resolve(n.data.paramValues[k], /\.(brk|txt)$/i)
      }
    }
    if (n.data?.breakpointConnections) {
      for (const k of Object.keys(n.data.breakpointConnections)) {
        n.data.breakpointConnections[k] = resolve(n.data.breakpointConnections[k], /\.(brk|txt)$/i)
      }
    }
  }
  return data
}

// ── Window ──────────────────────────────────────────────────────────
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#090f1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ══════════════════════════════════════════════════════════════════
//  IPC HANDLERS
// ══════════════════════════════════════════════════════════════════

// ── Open file dialog ────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (_, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio Files', extensions: ['wav', 'WAV'] }],
    ...options
  })
  return result
})

// ── Open folder dialog ──────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result
})

// ── Save file dialog ────────────────────────────────────────────────
ipcMain.handle('dialog:saveFile', async (_, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
    ...options
  })
  return result
})

// ── Run a CDP command ───────────────────────────────────────────────
// Returns { success, stdout, stderr, command, outputPath }
ipcMain.handle('cdp:run', async (_, { program, args, outputPath, label }) => {
  const binPath = getCDPBinPath()
  const executable = join(binPath, program)

  return new Promise((resolve) => {
    const fullArgs = args.map(a => String(a))
    const commandString = `${program} ${fullArgs.join(' ')}`

    // Notify renderer of the command being run (for terminal log)
    mainWindow.webContents.send('terminal:append', {
      type: 'command',
      text: commandString,
      timestamp: new Date().toISOString()
    })

    const child = execFile(executable, fullArgs, { timeout: 120000 }, (error, stdout, stderr) => {
      // Clear tracking if this is still the active process
      if (activeCDPProcess === child) {
        activeCDPProcess = null
      }

      if (error) {
        mainWindow.webContents.send('terminal:append', {
          type: 'error',
          text: error.signal === 'SIGTERM' ? 'Process killed by user.' : (stderr || error.message),
          timestamp: new Date().toISOString()
        })
        resolve({
          success: false,
          error: error.message,
          stderr,
          command: commandString,
          wasKilled: error.signal === 'SIGTERM'
        })
      } else {
        mainWindow.webContents.send('terminal:append', {
          type: 'success',
          text: `✓ Done → ${outputPath}`,
          timestamp: new Date().toISOString()
        })
        resolve({ success: true, stdout, stderr, command: commandString, outputPath })
      }
    })

    // Store reference to allow killing it later
    activeCDPProcess = child
  })
})

// ── Stop the currently running CDP command ───────────────────────────
ipcMain.handle('cdp:stop', async () => {
  if (activeCDPProcess) {
    activeCDPProcess.kill('SIGTERM')
    activeCDPProcess = null
    return true
  }
  return false
})

// ── SNDINFO inspector: run info modes and return their text ──────────
function stripCdpBanner(text) {
  return (text || '').split('\n').filter(l => !/^CDP Release/i.test(l.trim())).join('\n').trim()
}
ipcMain.handle('sndinfo:report', async (_, filePath) => {
  const bin = getCDPBinPath()
  const run = (mode) => new Promise((res) => {
    execFile(join(bin, 'sndinfo'), [mode, filePath], { timeout: 20000 }, (err, stdout, stderr) => {
      res({ ok: !err, text: stripCdpBanner((stdout || '') + (stderr || '')) })
    })
  })
  const out = {}
  for (const mode of ['props', 'len', 'maxsamp', 'loudchan']) out[mode] = await run(mode)
  return out
})

// ── DIRSF: list the soundfiles in a chosen directory ─────────────────
ipcMain.handle('dirsf:list', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths[0]) return { ok: false }
  const dir = result.filePaths[0]
  const bin = getCDPBinPath()
  return new Promise((res) => {
    // dirsf lists the soundfiles in its working directory.
    execFile(join(bin, 'dirsf'), [], { cwd: dir, timeout: 20000 }, (err, stdout, stderr) => {
      const text = stripCdpBanner((stdout || '') + (stderr || ''))
      res({ ok: !!text, dir, text })
    })
  })
})

// ── Get audio file info (channels, samplerate, duration) ────────────
// Uses soxi -D for duration (returns seconds directly), separate call for other info
ipcMain.handle('audio:getInfo', async (_, filePath) => {
  // .ana files are spectral — return placeholder info, no audio decoding
  if (filePath.endsWith('.ana')) {
    return { channels: 0, sampleRate: 0, bitsPerSample: 0, duration: 0, isAna: true, source: 'ana' }
  }

  return new Promise((resolve) => {
    // soxi -D returns duration in seconds as a plain float — most reliable
    execFile('soxi', ['-D', filePath], (errD, durOut) => {
      execFile('soxi', [filePath], (error, stdout) => {
        // Parse full soxi output for metadata
        let channels = 1, sampleRate = 44100, bitsPerSample = 24, duration = 0

        if (!error && stdout) {
          const lines = stdout.trim().split('\n')
          const get = (label) => {
            const line = lines.find(l => l.includes(label))
            return line ? line.split(':').slice(1).join(':').trim() : null
          }
          channels = parseInt(get('Channels') || '1')
          sampleRate = parseInt(get('Sample Rate') || '44100')
          const precStr = get('Precision') || '24'
          bitsPerSample = parseInt(precStr)
        } else {
          // Fallback: read WAV header manually
          try {
            const buf = readFileSync(filePath)
            channels = buf.readUInt16LE(22)
            sampleRate = buf.readUInt32LE(24)
            bitsPerSample = buf.readUInt16LE(34)
            const dataSize = buf.readUInt32LE(40)
            duration = dataSize / (sampleRate * channels * (bitsPerSample / 8))
            resolve({ channels, sampleRate, bitsPerSample, duration, isAna: false, source: 'header' })
            return
          } catch (e) {
            resolve({ channels: 1, sampleRate: 44100, bitsPerSample: 24, duration: 0, isAna: false, source: 'fallback' })
            return
          }
        }

        // soxi -D gives clean decimal seconds
        if (!errD && durOut) {
          duration = parseFloat(durOut.trim()) || 0
        }

        resolve({ channels, sampleRate, bitsPerSample, duration, isAna: false, source: 'soxi' })
      })
    })
  })
})

// ── Clip Bin: save a clip ───────────────────────────────────────────
ipcMain.handle('clips:save', async (_, clip) => {
  const clips = store.get('clips', [])
  const newClip = {
    id: clip.id || randomUUID(),
    name: clip.name,
    filePath: clip.filePath,
    command: clip.command,
    sourceClipId: clip.sourceClipId || null,
    channels: clip.channels || 1,
    sampleRate: clip.sampleRate || 44100,
    duration: clip.duration || 0,
    colour: clip.colour || '#3b82f6',
    starred: false,
    tags: [],
    createdAt: new Date().toISOString(),
    nodeGraphSnapshot: clip.nodeGraphSnapshot || null,
    // Multichannel metadata — preserved for future Ambisonic phases
    channelFormat: clip.channelFormat || (clip.channels === 1 ? 'mono' : clip.channels === 2 ? 'stereo' : `${clip.channels}ch`),
    ambisonicOrder: clip.ambisonicOrder || null, // null = not ambisonic
  }
  clips.unshift(newClip)
  store.set('clips', clips)
  return newClip
})

// ── Clip Bin: load all clips ────────────────────────────────────────
ipcMain.handle('clips:load', async () => {
  const clips = store.get('clips', [])
  // Filter out clips whose files no longer exist
  return clips.filter(c => existsSync(c.filePath))
})

// ── Clip Bin: update a clip ─────────────────────────────────────────
ipcMain.handle('clips:update', async (_, { id, updates }) => {
  const clips = store.get('clips', [])
  const idx = clips.findIndex(c => c.id === id)
  if (idx !== -1) {
    clips[idx] = { ...clips[idx], ...updates }
    store.set('clips', clips)
    return clips[idx]
  }
  return null
})

// ── Clip Bin: delete a clip ─────────────────────────────────────────
ipcMain.handle('clips:delete', async (_, id) => {
  const clips = store.get('clips', [])
  store.set('clips', clips.filter(c => c.id !== id))
  return true
})

// ── Breakpoint files: write a .brk file ─────────────────────────────
ipcMain.handle('breakpoint:write', async (_, { points, filename }) => {
  const clipDir = getClipDir()
  const filePath = join(clipDir, filename)
  const lines = points.map(p => `${p.time.toFixed(6)} ${p.value.toFixed(6)}`).join('\n')
  writeFileSync(filePath, lines + '\n')
  return filePath
})

// ── Session: save ───────────────────────────────────────────────────
ipcMain.handle('session:save', async (_, { name, data }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(getProjectDir(), `${name}.cdpproject`),
    filters: [{ name: 'CDP Studio Project', extensions: ['cdpproject'] }]
  })
  if (!result.canceled) {
    writeFileSync(result.filePath, JSON.stringify(data, null, 2))
    return { saved: true, path: result.filePath }
  }
  return { saved: false }
})

// ── Session: load ───────────────────────────────────────────────────
ipcMain.handle('session:load', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'CDP Studio Project', extensions: ['cdpproject'] }],
    properties: ['openFile']
  })
  if (!result.canceled && result.filePaths[0]) {
    const data = JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
    // Resolve any basename-only assets (e.g. an example opened via this dialog) against its folder.
    resolveSessionPaths(data, dirname(result.filePaths[0]))
    return { loaded: true, data, path: result.filePaths[0] }
  }
  return { loaded: false }
})

// ── Examples: list bundled tutorial sessions ─────────────────────────
ipcMain.handle('examples:list', async () => {
  const dir = getExamplesDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.cdpproject'))
    .map(f => ({ name: f.replace(/\.cdpproject$/, ''), path: join(dir, f) }))
})

// ── Examples: load a bundled session, resolving source paths to the examples dir ──
ipcMain.handle('examples:load', async (_, name) => {
  const dir = getExamplesDir()
  const filePath = join(dir, `${name}.cdpproject`)
  if (!existsSync(filePath)) return { loaded: false }
  const data = JSON.parse(readFileSync(filePath, 'utf-8'))
  resolveSessionPaths(data, dir)
  return { loaded: true, data, path: filePath }
})

// ── Settings ────────────────────────────────────────────────────────
ipcMain.handle('settings:get', async () => store.get('settings', {
  cdpBinPath: '/usr/local/cdp/bin',
  defaultSampleRate: 44100,
  defaultBitDepth: 24,
  keepIntermediateFiles: true,
  theme: 'dark'
}))

ipcMain.handle('settings:set', async (_, settings) => {
  store.set('settings', settings)
  return true
})

// ── Read audio file as base64 data URL (for WaveSurfer in Electron) ─
// Electron blocks file:// URLs in renderer. We read via main process instead.
ipcMain.handle('audio:readAsDataURL', async (_, filePath) => {
  try {
    const data = readFileSync(filePath)
    const ext = filePath.split('.').pop().toLowerCase()
    const mime = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch (e) {
    return null
  }
})

// ── MIX helpers ─────────────────────────────────────────────────────
// SUBMIX uses whitespace-delimited mixfiles — paths with spaces (e.g. macOS
// "Application Support") break parsing. We work in a /tmp sub-dir with no
// spaces, creating symlinks for any clip paths that contain spaces.

function buildMixLine(filePath, item) {
  const start = Number(item.start).toFixed(3)
  const level = Number(item.level).toFixed(4)
  if (Number(item.channels) <= 1) {
    return `${filePath}  ${start}  1  ${level}  ${Number(item.pan).toFixed(4)}`
  }
  return `${filePath}  ${start}  2  ${level}`
}

function makeSafeLinks(items, tmpBase) {
  return items.map((item, i) => {
    let filePath = item.filePath
    if (filePath.includes(' ')) {
      const ext = filePath.split('.').pop().toLowerCase()
      const linkPath = join(tmpBase, `clip${i}.${ext}`)
      symlinkSync(filePath, linkPath)
      filePath = linkPath
    }
    return buildMixLine(filePath, item)
  })
}

// ── MIX: write a mixfile and run submix mix ─────────────────────────
ipcMain.handle('mix:render', async (_, { items, outName, opts = {} }) => {
  const ts = Date.now()
  const tmpBase = join(app.getPath('temp'), `cdp_mix_${ts}`)
  mkdirSync(tmpBase, { recursive: true })

  try {
    const lines = makeSafeLinks(items, tmpBase)
    const mixfilePath = join(tmpBase, 'mixfile.txt')
    const tmpOutPath = join(tmpBase, 'output.wav')
    writeFileSync(mixfilePath, lines.join('\n') + '\n')

    const bin = getCDPBinPath()
    const args = ['mix', mixfilePath, tmpOutPath]
    if (opts.start != null) args.push(`-s${opts.start}`)
    if (opts.end != null) args.push(`-e${opts.end}`)
    if (opts.atten != null) args.push(`-g${opts.atten}`)
    if (opts.append) args.push('-a')

    return await new Promise((resolve) => {
      const commandString = `submix mix <mixfile> <output>`
      mainWindow.webContents.send('terminal:append', {
        type: 'command', text: `submix ${args.slice(0, 1).concat(['mixfile.txt', 'output.wav', ...args.slice(3)]).join(' ')}`,
        timestamp: new Date().toISOString()
      })
      execFile(join(bin, 'submix'), args, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          mainWindow.webContents.send('terminal:append', {
            type: 'error', text: stderr || error.message, timestamp: new Date().toISOString()
          })
          resolve({ success: false, error: error.message, stderr })
          return
        }
        // Copy output from temp (no-spaces) to clip bin
        const clipDir = getClipDir()
        const safeName = (outName || 'mix_output').replace(/[^a-zA-Z0-9_-]/g, '_')
        const outPath = join(clipDir, `${safeName}_${ts}.wav`)
        copyFileSync(tmpOutPath, outPath)
        mainWindow.webContents.send('terminal:append', {
          type: 'success', text: `✓ Mix → ${outPath}`, timestamp: new Date().toISOString()
        })
        resolve({ success: true, outputPath: outPath, command: commandString })
      })
    })
  } finally {
    try { rmSync(tmpBase, { recursive: true, force: true }) } catch {}
  }
})

// ── MIX: check peak level of a mixfile ─────────────────────────────
ipcMain.handle('mix:getlevel', async (_, items) => {
  const ts = Date.now()
  const tmpBase = join(app.getPath('temp'), `cdp_lvl_${ts}`)
  mkdirSync(tmpBase, { recursive: true })
  try {
    const lines = makeSafeLinks(items, tmpBase)
    const mixfilePath = join(tmpBase, 'mixfile.txt')
    writeFileSync(mixfilePath, lines.join('\n') + '\n')
    const bin = getCDPBinPath()
    return await new Promise((resolve) => {
      execFile(join(bin, 'submix'), ['getlevel', '1', mixfilePath], { timeout: 30000 }, (error, stdout, stderr) => {
        const text = ((stdout || '') + (stderr || '')).trim()
        // "MAX SAMPLE ENCOUNTERED : 0.975042 at ..."
        const match = text.match(/MAX SAMPLE ENCOUNTERED\s*:\s*([0-9.]+)/i)
        resolve({ ok: !error, maxlevel: match ? parseFloat(match[1]) : null, text })
      })
    })
  } finally {
    try { rmSync(tmpBase, { recursive: true, force: true }) } catch {}
  }
})

// ── Open file in Finder ─────────────────────────────────────────────
ipcMain.handle('shell:showInFinder', async (_, filePath) => {
  shell.showItemInFolder(filePath)
})

// ── Get user data path (for constructing output paths) ─────────────
ipcMain.handle('app:getClipDir', async () => getClipDir())
