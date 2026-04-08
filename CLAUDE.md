# cdp-studio — Claude Code Context

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

- **15 IPC channels** registered in main, bridged via preload
- Persistent storage: **electron-store** (clips + settings, JSON-backed, no DB)
- No router. No global state library. All component-local `useState`
- Cross-component communication uses **custom DOM events** (`window.dispatchEvent(new CustomEvent('cdpStudio', ...))`)

## Key Quirks

- **NodeGraph and WaveformViewer are always mounted** — toggled via CSS `display: none`, not conditional rendering. This preserves ReactFlow and WaveSurfer state.
- **`src/renderer/src/lib/cdpRunner.js` `runCDPProcess()` is unused.** The NodeGraph has its own inline chain-execution logic that duplicates this. Do not add new callers to `runCDPProcess()` without reconciling.
- **`@anthropic-ai/sdk` is in package.json but never imported.** The AI sidebar in `App.jsx` uses raw `fetch` to call the Anthropic API directly from the renderer.
- **100% inline styles.** No CSS modules, no CSS-in-JS lib, no Tailwind. Shared style objects are defined at the bottom of each component file.
- **`AISidebar` component is defined inline inside `App.jsx`**, not in a separate file.
- Audio files are read as **base64 data URLs** in the main process because Electron blocks `file://` URLs in the renderer.

## CDP Command System

Commands are defined declaratively in `src/renderer/src/lib/cdpCommands.js`. To add a new CDP process, add an entry to the `CDP_COMMANDS` array.

Chain execution in the node graph traverses edges backwards from the output node, running each process sequentially via `child_process.execFile` with a **120-second timeout**.

## Platform

- **macOS-only** in practice: hidden title bar with traffic lights, `showInFinder`, Gatekeeper notes.
- Requires external CDP installation and SoX (`soxi`) for audio metadata.
- CDP binary auto-detected from 5 candidate paths; user can override in Settings.

## Distribution

`npm run dist` produces a `.dmg` in `dist/`. `electron-builder` config is in `package.json` `build` field. Only `out/**/*` is packaged.

---

## Skills

### Skill: CDP Command Implementation

**Triggers:** "implement X command", "add Y to the node graph", "fix the Z node", "the distort command is wrong", or CDP usage error in terminal log.

**Workflow:** Always follow all 6 stages in order. Do not skip lookup or error-document stages.

#### STAGE 1 — LOOKUP (never skip)

Run the binary with no args to get ground truth:
```bash
~/cdpr8/_cdp/_cdprogs/PROGRAMNAME MODE
```

Record from output:
1. Exact program name
2. Mode name and modeNum (integer)
3. Input/output file types (`.wav` or `.ana`)
4. Positional params in exact order
5. Flags in format `-xVALUE`
6. Mono-only requirement
7. Multichannel support

**Red flags (lookup incomplete):**
- Found in docs but binary not run
- Usage line in docs doesn't match binary output
- Any parameter range unknown

#### STAGE 2 — SPEC

Fill `references/command-spec-template.md` before coding. Key fields:
- `modeNum` — many commands have required integer sub-mode
- `outputExt` — BLUR/FOCUS output `.ana` not `.wav`
- `monoOnly` — DISTORT commands are mono only
- Flag format — `-c1024` not `--c 1024`

#### STAGE 3 — IMPLEMENT

Add entry to `src/renderer/src/lib/cdpCommands.js`:

- [ ] `program` matches binary filename exactly
- [ ] `mode` and `modeNum` match Usage line
- [ ] `inputExt` / `outputExt` correct
- [ ] `params` in exact positional order from Usage line
- [ ] Each param has `min`, `max`, `default` from docs
- [ ] `help` text includes range + musical use case
- [ ] `flags` use single-char id matching flag letter
- [ ] `multichannel: false` if mono-only
- [ ] `docUrl` points to correct anchor

#### STAGE 4 — TERMINAL TEST

```bash
~/cdpr8/_cdp/_cdprogs/PROGRAM MODE MODENUM input.wav output.wav PARAM1 PARAM2 -FLAG1
```

Verify: exits without error, output.wav exists, plays correctly.

**Common failures:**
- "No such file" → wrong program name
- "Invalid data" → wrong file format
- "Wrong number of channels" → stereo to mono-only command
- "Usage:" printed → wrong argument count

#### STAGE 5 — UI TEST + ERROR DOCUMENTATION

1. Load source WAV → add process node → connect → Render Chain
2. Check Terminal Log for exact command
3. Check Clip Bin for result
4. Listen to output

Document in `references/error-log.md`:
```
## PROGRAMNAME MODE — [date]

### Parameter constraints not enforced in UI
### Common user mistakes
### Error messages and meanings
### Edge cases found
```

#### STAGE 6 — USER SIGN-OFF

Present: command string from Terminal Log, parameter description, error-log entries, UI constraints not enforced.

Only complete after explicit user confirmation.

---

## Quick Reference

### Argument order
```
PROGRAM [MODE] [MODENUM] INFILE [INFILE2] OUTFILE [PARAMS...] [-FLAGS...]
```

### Phase 1 priority
See `references/phase1-command-list.md` — commands that work on `.wav` without PVOC or text files.

### Doc pages
See `references/doc-page-map.md` for CDP8 documentation file mappings.
