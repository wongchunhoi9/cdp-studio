# CDP Studio

A node-based desktop application for the [Composers' Desktop Project (CDP)](https://www.composersdesktop.com/). Built with Electron + React. macOS-first.

CDP Studio lets you chain CDP sound transformation commands visually — connect nodes, tweak parameters, and render audio processing pipelines without touching the terminal.

---

## Vision

This project aims to make the powerful but intimidating [Composers' Desktop Project](https://www.composersdesktop.com/) accessible through a visual, node-based interface. Instead of memorizing arcane CLI syntax, you build processing chains by connecting nodes on a canvas.

### Inspiration

- **[SoundThread](https://github.com/j-p-higgins/SoundThread)** — the original node-based CDP GUI. SoundThread proves the concept: CDP's 200+ commands can be navigated visually. CDP Studio takes a different approach — a focused, modern Electron app with a clip bin, waveform viewer, terminal log, and AI assistant. Many CDP commands remain unimplemented in SoundThread; this project aims to fill those gaps and provide a more complete CDP workflow.
- **Pure Data / Max MSP** — the dataflow programming paradigm applied to offline sound transformation rather than real-time synthesis.
- **Blender Geometry Nodes** — visual node graphs as a first-class creative interface.

### Design Principles

1. **Visual over textual** — every CDP command is a node with labeled parameters
2. **Chains, not isolated effects** — the power is in chaining spectral, granular, and time-domain processes
3. **Non-destructive** — source files are never modified; every render produces a new clip
4. **Spectral-first architecture** — PVOC Analyse → spectral processing → PVOC Synth is a first-class workflow
5. **Multichannel-ready** — built from day one for ambisonic and multichannel workflows

---

## Prerequisites

```bash
# Check Node.js (need v18+)
node --version

# Check npm
npm --version
```

If you don't have Node.js, download it from https://nodejs.org (choose "LTS" version).

---

## Installation

### Step 1 — Install CDP

Download CDP for Mac from: https://www.unstablesound.net/cdp.html
Install it and note the path to the `bin` folder (usually `/Applications/CDP/bin`).

### Step 2 — Install SoX (for audio info)

```bash
# Install Homebrew if you don't have it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install SoX:
brew install sox
```

### Step 3 — Install app dependencies

```bash
cd path/to/cdp-studio
npm install
```

### Step 4 — Run in development mode

```bash
npm run dev
```

The app window will open. On first launch, go to Settings and set your CDP bin path.

---

## How to Use

### Loading a source file
1. Click **+ Add Process** in the node graph
2. Or drag from the Source node and click "Load WAV…"

### Adding a CDP process
1. Click **+ Add Process** in the top-left of the node graph
2. Pick a category (PVOC, MODIFY, GRAIN, etc.)
3. Click a process to add it as a node
4. Connect: drag from the right handle of Source → left handle of process node
5. Adjust parameters with the sliders
6. Click **▶ Run** to execute

### Viewing results
- Every render appears automatically in the **Clip Bin** (left panel)
- Click a clip → switches to **Waveform** tab showing full waveform + playback
- The **Terminal Log** at the bottom shows every CDP command that ran

### AI Assistant
- Click **🤖 AI** in the top right to open the assistant
- Click **? Ask AI** on any process node to get specific help about that command

---

## Project Structure

```
cdp-studio/
├── src/
│   ├── main/
│   │   └── index.js          ← Electron main process
│   │                           (file system, runs CDP commands, dialogs)
│   ├── preload/
│   │   └── index.js          ← Bridge between Electron and React
│   │                           (exposes safe IPC methods)
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.jsx             ← Main layout
│           ├── main.jsx            ← React entry
│           ├── components/
│           │   ├── NodeGraph/      ← CDP process node graph
│           │   ├── ClipBin/        ← Persistent render storage
│           │   ├── TerminalLog/    ← Live CDP command log
│           │   └── WaveformViewer/ ← WaveSurfer.js waveform display
│           └── lib/
│               ├── cdpCommands.js  ← CDP command catalog
│               └── cdpRunner.js    ← Builds + executes CDP commands
```

---

## Adding CDP Commands

Open `src/renderer/src/lib/cdpCommands.js` and add an entry to `CDP_COMMANDS`:

```javascript
{
  id: 'pvoc_morph',          // unique ID
  program: 'pvoc',           // CDP binary name
  mode: 'morph',             // first argument after program name
  modeNum: 1,                // integer sub-mode (or null)
  label: 'PVOC Morph',       // display name in UI
  category: 'pvoc',          // which category tab
  description: '...',
  inputExt: ['.ana'],        // expected input file type
  outputExt: '.wav',         // output file type
  multichannel: false,       // safe for > 2 channels?
  twoInputs: false,          // takes two input files?
  docUrl: 'https://...',     // CDP8 docs URL
  params: [                  // positional params after outfile
    {
      id: 'amount',
      label: 'Morph Amount',
      type: 'number',        // 'number' | 'select'
      default: 0.5,
      min: 0, max: 1,
      help: 'What this parameter does in musical terms.',
    }
  ],
  flags: [],                 // optional flag params (-{id}{value})
}
```

**CLI argument order:** `program [mode] [modeNum] infile [infile2] outfile [params...] [-flags]`

---

## Multichannel / Ambisonic Notes

The app is architected for multichannel from Phase 1:

- Every clip stores `channels`, `sampleRate`, and `channelFormat` metadata
- `channelFormat` values: `mono`, `stereo`, `4ch` (FOA), `9ch` (HOA2), `16ch` (HOA3)
- CDP commands are flagged `multichannel: true` in `cdpCommands.js` if they safely handle > 2 channels
- Phase 4 will add Ambisonic encoder/decoder nodes using CDP's multichannel PVOC commands

---

## Building for Distribution (Mac .dmg)

```bash
npm run dist
```

The `.dmg` appears in the `dist/` folder.

---

## Phase Roadmap

- **Phase 1 (now):** Node graph + Clip Bin + Waveform viewer + Terminal log + AI assistant
- **Phase 2:** Timeline — drag clips, rough arrangement, export stems
- **Phase 3:** Spectral editor — WebGL spectrogram + paint/erase frequency regions
- **Phase 4:** Ambisonic support — multichannel PVOC, B-format encoder/decoder nodes

---

## References

### CDP Documentation

- **[CDP8 Documentation Home](https://www.composersdesktop.com/docs/html/)** — the definitive reference for all CDP commands
- [PVOC — Spectral Analysis/Synthesis](https://www.composersdesktop.com/docs/html/cspecpvoc.htm)
- [BLUR — Spectral Blurring](https://www.composersdesktop.com/docs/html/cspecblur.htm)
- [FOCUS — Spectral Freeze](https://www.composersdesktop.com/docs/html/cspecfoc.htm)
- [MODIFY — Time-Domain Transformation](https://www.composersdesktop.com/docs/html/cgromody.htm)
- [DISTORT — Waveset Distortion](https://www.composersdesktop.com/docs/html/cdistort.htm)
- [EXTEND — Time-Stretch](https://www.composersdesktop.com/docs/html/cextend.htm) / [Extended Commands](https://www.composersdesktop.com/docs/html/cgroextd.htm)
- [MIX/SUBMIX](https://www.composersdesktop.com/docs/html/cgromixr.htm)

### Related Projects

- **[SoundThread](https://github.com/j-p-higgins/SoundThread)** — the original node-based CDP GUI. The primary inspiration for this project. SoundThread covers many CDP commands, but many remain unimplemented. CDP Studio aims to provide a more complete and modern implementation.
- **[Composers' Desktop Project](https://www.composersdesktop.com/)** — the official CDP website
- **[Unstable Sound](https://www.unstablesound.net/)** — CDP downloads and community

### Tech Stack

- [Electron](https://www.electronjs.org/) — desktop app framework
- [React](https://react.dev/) — UI framework
- [@xyflow/react](https://reactflow.dev/) — node graph (ReactFlow)
- [WaveSurfer.js](https://wavesurfer.xyz/) — waveform visualization
- [electron-vite](https://electron-vite.org/) — build tooling
- [electron-store](https://github.com/sindresorhus/electron-store) — persistent settings
