import { contextBridge, ipcRenderer } from 'electron'

// Expose safe IPC bridges to the renderer (React app)
// Nothing from Node.js bleeds through — only these explicit methods
contextBridge.exposeInMainWorld('cdpStudio', {
  // ── File dialogs ──────────────────────────────────────────────────
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // ── CDP command runner ────────────────────────────────────────────
  runCDP: (params) => ipcRenderer.invoke('cdp:run', params),

  // ── Audio ─────────────────────────────────────────────────────────
  getAudioInfo: (filePath) => ipcRenderer.invoke('audio:getInfo', filePath),
  readAudioAsDataURL: (filePath) => ipcRenderer.invoke('audio:readAsDataURL', filePath),

  // ── Clip Bin ──────────────────────────────────────────────────────
  saveClip: (clip) => ipcRenderer.invoke('clips:save', clip),
  loadClips: () => ipcRenderer.invoke('clips:load'),
  updateClip: (id, updates) => ipcRenderer.invoke('clips:update', { id, updates }),
  deleteClip: (id) => ipcRenderer.invoke('clips:delete', id),

  // ── Sessions ──────────────────────────────────────────────────────
  saveSession: (name, data) => ipcRenderer.invoke('session:save', { name, data }),
  loadSession: () => ipcRenderer.invoke('session:load'),

  // ── Settings ──────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  detectCDPPath: () => ipcRenderer.invoke('cdp:detectPath'),

  // ── Shell helpers ─────────────────────────────────────────────────
  showInFinder: (path) => ipcRenderer.invoke('shell:showInFinder', path),
  getClipDir: () => ipcRenderer.invoke('app:getClipDir'),

  // ── Breakpoint files ──────────────────────────────────────────────
  writeBreakpointFile: (points, filename) =>
    ipcRenderer.invoke('breakpoint:write', { points, filename }),

  // ── Terminal log listener ─────────────────────────────────────────
  // Renderer subscribes to live CDP command output
  onTerminalEntry: (callback) => {
    ipcRenderer.on('terminal:append', (_, entry) => callback(entry))
    return () => ipcRenderer.removeAllListeners('terminal:append')
  }
})
