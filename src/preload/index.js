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
  stopCDP: () => ipcRenderer.invoke('cdp:stop'),

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
  listExamples: () => ipcRenderer.invoke('examples:list'),
  loadExample: (name) => ipcRenderer.invoke('examples:load', name),

  // ── Settings ──────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  detectCDPPath: () => ipcRenderer.invoke('cdp:detectPath'),

  // ── Sound info inspector (SNDINFO / DIRSF) ────────────────────────
  sndinfoReport: (filePath) => ipcRenderer.invoke('sndinfo:report', filePath),
  dirsfList: () => ipcRenderer.invoke('dirsf:list'),

  // ── MIX window (SUBMIX) ───────────────────────────────────────────
  mixRender: (items, outName, opts) => ipcRenderer.invoke('mix:render', { items, outName, opts }),
  mixGetLevel: (items) => ipcRenderer.invoke('mix:getlevel', items),

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
