import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { spawn, execFile } from 'child_process'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs'
import Store from 'electron-store'
import { randomUUID } from 'crypto'

// ── Persistent store ────────────────────────────────────────────────
const store = new Store()

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

    execFile(executable, fullArgs, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        mainWindow.webContents.send('terminal:append', {
          type: 'error',
          text: stderr || error.message,
          timestamp: new Date().toISOString()
        })
        resolve({ success: false, error: error.message, stderr, command: commandString })
      } else {
        mainWindow.webContents.send('terminal:append', {
          type: 'success',
          text: `✓ Done → ${outputPath}`,
          timestamp: new Date().toISOString()
        })
        resolve({ success: true, stdout, stderr, command: commandString, outputPath })
      }
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
    return { loaded: true, data, path: result.filePaths[0] }
  }
  return { loaded: false }
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

// ── Open file in Finder ─────────────────────────────────────────────
ipcMain.handle('shell:showInFinder', async (_, filePath) => {
  shell.showItemInFolder(filePath)
})

// ── Get user data path (for constructing output paths) ─────────────
ipcMain.handle('app:getClipDir', async () => getClipDir())
