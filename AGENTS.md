# AGENTS.md — cdp-studio

## Quick Commands

```
npm run dev       # Start Electron dev server
npm run build     # Vite build to out/
npm run dist      # Build + create macOS .dmg
```

No test, lint, typecheck, or formatting scripts exist.

## Architecture

Electron + React app built with **electron-vite**. macOS-first.

```
src/main/index.js       → Electron main process (IPC handlers, CDP exec, electron-store)
src/preload/index.js    → contextBridge exposing window.cdpStudio (17 methods + 1 event)
src/renderer/src/       → React UI (Vite + @vitejs/plugin-react)
```

- **15 IPC channels** registered in main, bridged via preload. See `src/preload/index.js` for the complete registry.
- Persistent storage: **electron-store** (clips + settings, JSON-backed, no DB).
- No router. No global state library. All component-local `useState`.
- Cross-component communication uses **custom DOM events** (`window.dispatchEvent(new CustomEvent('cdpStudio', ...))`), not React context.

## Key Quirks

- **NodeGraph and WaveformViewer are always mounted** — toggled via CSS `display: none`, not conditional rendering. This preserves ReactFlow and WaveSurfer state.
- **`src/renderer/src/lib/cdpRunner.js` `runCDPProcess()` is unused.** The NodeGraph has its own inline chain-execution logic that duplicates this. Do not add new callers to `runCDPProcess()` without reconciling.
- **`@anthropic-ai/sdk` is in package.json but never imported.** The AI sidebar in `App.jsx` uses raw `fetch` to call the Anthropic API directly from the renderer.
- **100% inline styles.** No CSS modules, no CSS-in-JS lib, no Tailwind. Shared style objects are defined at the bottom of each component file.
- **`AISidebar` component is defined inline inside `App.jsx`**, not in a separate file.
- Audio files are read as **base64 data URLs** in the main process because Electron blocks `file://` URLs in the renderer.

## CDP Command System

Commands are defined declaratively in `src/renderer/src/lib/cdpCommands.js`. To add a new CDP process, add an entry to the `CDP_COMMANDS` array — see README.md for the schema.

Chain execution in the node graph traverses edges backwards from the output node, running each process sequentially via `child_process.execFile` with a **120-second timeout**.

## Platform

- **macOS-only** in practice: hidden title bar with traffic lights, `showInFinder`, Gatekeeper notes.
- Requires external CDP installation and SoX (`soxi`) for audio metadata.
- CDP binary auto-detected from 5 candidate paths; user can override in Settings.

## Distribution

`npm run dist` produces a `.dmg` in `dist/`. `electron-builder` config is in `package.json` `build` field. Only `out/**/*` is packaged.
