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

---

## Agent Skills

### Skill: Implementing a New CDP Node

Use this checklist when adding a new CDP command to the node graph.

#### Step 1 — Research the CDP Command

1. Open the CDP8 documentation at https://www.composersdesktop.com/docs/html/
2. Find the correct docs page for the command's category:
   - PVOC: `cspecpvoc.htm`
   - BLUR: `cspecblur.htm`
   - FOCUS: `cspecfoc.htm`
   - MODIFY: `cgromody.htm`
   - DISTORT: `cdistort.htm`
   - EXTEND: `cextend.htm` / `cgroextd.htm`
   - MIX/SUBMIX: `cgromixr.htm`
3. Note the **exact CLI syntax** — argument order is critical
4. Identify: program name, mode, modeNum, required params, optional flags, input/output types

#### Step 2 — Add Entry to `CDP_COMMANDS`

File: `src/renderer/src/lib/cdpCommands.js`

Add an object to the `CDP_COMMANDS` array in the appropriate category section. Required fields:

```javascript
{
  id: 'category_action',         // snake_case, unique across ALL commands
  program: 'binary_name',        // CDP executable (no path, no extension)
  mode: 'mode_name',             // first CLI argument after binary
  modeNum: N,                    // integer sub-mode or null
  label: 'Display Name',         // shown in UI picker
  category: 'category_id',       // must match a key in CDP_CATEGORIES
  description: 'What it does.',  // shown in picker tooltip
  inputExt: ['.wav'],            // or ['.ana'] for spectral processes
  outputExt: '.wav',             // or '.ana'
  multichannel: false,           // true only if CDP docs confirm it handles >2ch
  twoInputs: false,              // true only for mix/combine commands
  docUrl: 'https://...',         // exact CDP8 docs URL with anchor
  params: [],                    // positional params after outfile
  flags: [],                     // optional flag params
}
```

#### Step 3 — Define Parameters Correctly

**Positional params** (`params` array):
- Listed in the **exact order** CDP expects them on the CLI
- `type: 'number'` — gets a slider + numeric input
- `type: 'select'` — gets a dropdown
- `default` — must be a valid value within `min`/`max`
- `help` — describe in **musical terms**, not just technical. Example: "0.5 = half speed (pitch drops), 2.0 = double speed (pitch rises)"
- `flagPrefix: '-X'` — if this param should be formatted as a flag (e.g., `-P1.5` for pitch)

**Flag params** (`flags` array):
- Only sent when user changes them from `default`
- Formatted as `-{id}{value}` (e.g., `-c1024`)
- Same field structure as positional params

#### Step 4 — Verify Chain Compatibility

- If `outputExt: '.ana'`, the output can only connect to nodes accepting `.ana` input (PVOC Synth, other BLUR/FOCUS nodes)
- If `inputExt: ['.ana']`, the node MUST come after a PVOC Analyse or another spectral process
- If `multichannel: false`, the node will reject multichannel input at runtime — document this
- If `twoInputs: true`, the node gets two input handles — verify the CLI syntax takes two input files

#### Step 5 — Test in the App

1. Run `npm run dev`
2. Add the new node via **+ Add Process**
3. Connect it in a valid chain (Source → ... → new node → Output)
4. Set parameters and click **▶ Run**
5. Verify:
   - The terminal log shows the correct CLI command
   - The CDP binary executes without errors
   - The output file is created in the Clip Bin
   - The waveform viewer can play the result

#### Step 6 — Common Pitfalls

- **Argument order is the #1 source of bugs.** CDP is extremely strict about CLI argument order: `program [mode] [modeNum] infile [infile2] outfile [params...] [-flags]`
- **`.ana` vs `.wav`** — spectral processes (PVOC/BLUR/FOCUS) work on `.ana` files. Time-domain processes (MODIFY/DISTORT/EXTEND) work on `.wav` directly
- **`modeNum` is an integer**, not a string. Use `null` if not applicable
- **Don't duplicate IDs** — every `id` must be unique across the entire `CDP_COMMANDS` array
- **`help` text should be practical** — tell the user what values sound like, not just what they do

---

### Skill: Reviewing a CDP Node Implementation

Use this checklist when reviewing an existing or proposed CDP node definition.

#### CLI Correctness

- [ ] `program` matches the CDP binary name exactly (no path, no `.exe`)
- [ ] `mode` is the correct first argument for this CDP process
- [ ] `modeNum` is correct (integer or `null`) — verify against CDP docs
- [ ] **Argument order in `params` matches CDP's expected positional order** — this is the most common bug
- [ ] Flag params in `flags` array use correct single-letter identifiers (e.g., `-c`, `-s`, `-r`)
- [ ] `flagPrefix` on positional params produces the correct flag format (e.g., `-P` for pitch)

#### Type Compatibility

- [ ] `inputExt` matches what CDP actually accepts (`.wav` for time-domain, `.ana` for spectral)
- [ ] `outputExt` matches what CDP actually produces
- [ ] The node can form valid chains: output type of predecessor matches input type of this node
- [ ] `twoInputs: true` only set for commands that genuinely take two input files

#### Multichannel Safety

- [ ] `multichannel: true` only if CDP documentation explicitly confirms it handles >2 channels
- [ ] If `multichannel: false`, the node will reject multichannel input at runtime — this is correct behavior
- [ ] `ambisonicNote` present if relevant for multichannel commands

#### UI/UX Quality

- [ ] `label` is clear and distinguishes from similar commands (e.g., "Distort Reverse (Wavesets)" vs "Reverse (Audio)")
- [ ] `description` explains what the command does in one sentence
- [ ] `help` text on every parameter includes **practical value guidance** (e.g., "11 = subtle shimmer, 51 = soft halo, 201 = heavy smear")
- [ ] `min`/`max` ranges are reasonable and match CDP's documented constraints
- [ ] `default` is a sensible starting point for musical use
- [ ] For `select` type params, `options` covers the useful range without overwhelming

#### Documentation

- [ ] `docUrl` points to the correct CDP8 docs page with the right anchor
- [ ] `category` matches the correct section in `CDP_CATEGORIES`
- [ ] `id` is unique and follows the `category_action` naming convention

#### Cross-Reference Checks

- [ ] No duplicate `id` values in the entire `CDP_COMMANDS` array
- [ ] If the command is a variant of an existing one (e.g., `pvoc_synth` vs `pvoc_pitch`), the distinction is clear in `label` and `description`
- [ ] The command doesn't overlap unnecessarily with an existing command that does the same thing

---

### Skill: Reviewing Node Graph Connectivity

Use this checklist when reviewing how nodes are connected in the graph.

#### Chain Validity

- [ ] Every chain starts at a Source node (`.wav` file)
- [ ] Spectral chains follow: Source → PVOC Analyse → [BLUR/FOCUS...] → PVOC Synth → Output
- [ ] Time-domain chains follow: Source → [MODIFY/DISTORT/EXTEND...] → Output
- [ ] Mix nodes have both inputs connected
- [ ] No circular connections

#### Parameter Sanity

- [ ] No parameter values outside their `min`/`max` ranges
- [ ] `extend_drunk`: `locus` + `ambitus` does not exceed source file duration
- [ ] `extend_drunk`: `clock` > `splicelen * 2`
- [ ] BLUR `N` values are odd numbers where required
- [ ] Pitch shift multiplier is within reasonable range (0.0625–16)
