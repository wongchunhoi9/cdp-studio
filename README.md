# CDP Studio — Phase 1

A node-based desktop app for the Composers' Desktop Project.
Built with Electron + React. macOS first.

---

## Prerequisites

You need these installed before starting. Open Terminal and run each check:

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
# Navigate to this folder:
cd path/to/cdp-studio

# Install all dependencies:
npm install
```

### Step 4 — Run in development mode

```bash
npm run dev
```

The app window will open. On first launch, go to Settings and set your CDP bin path.

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

## Adding More CDP Commands

Open `src/renderer/src/lib/cdpCommands.js` and add an entry to `CDP_COMMANDS`:

```javascript
{
  id: 'pvoc_morph',          // unique ID
  program: 'pvoc',           // CDP binary name
  mode: 'morph',             // first argument after program name
  label: 'PVOC Morph',       // display name in UI
  category: 'pvoc',          // which category tab
  description: '...',
  inputExt: ['.ana'],        // expected input file type
  outputExt: '.wav',         // output file type
  multichannel: false,       // safe for > 2 channels?
  params: [
    {
      id: 'amount',
      label: 'Morph Amount',
      type: 'number',        // 'number' | 'select' | 'boolean'
      default: 0.5,
      min: 0, max: 1,
      help: 'What this parameter does in musical terms.'
    }
  ]
}
```

---

## Phase Roadmap

- **Phase 1 (now):** Node graph + Clip Bin + Waveform viewer + Terminal log + AI assistant
- **Phase 2:** Timeline — drag clips, rough arrangement, export stems
- **Phase 3:** Spectral editor — WebGL spectrogram + paint/erase frequency regions
- **Phase 4:** Ambisonic support — multichannel PVOC, B-format encoder/decoder nodes
