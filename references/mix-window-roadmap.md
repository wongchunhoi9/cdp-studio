# Roadmap — MIX Window (multi-clip → one, via SUBMIX)

A new arrange/timeline view where the user places multiple Clip-Bin clips on tracks at chosen
start times with per-clip level & pan, then renders them to a single soundfile using the CDP
**SUBMIX** group. Think "mini-DAW arrange page" whose render engine is `submix mix`.

## Status (2026-06-25)

| Phase | State | Notes |
|---|---|---|
| **1 — MVP render** | ✅ **Done** | `Mix` tab, `MixWindow`, drag from ClipBin, start/level/pan, mixfile preview, `mix:render` IPC → `submix mix` → new Bin clip. Pre-flight blocks SR mismatch / >2ch. |
| **2 — Timeline UX** | 🟡 **Mostly done** | DAW timeline shipped: ruler with adaptive ticks, draggable clip blocks (updates `start`), zoom 15–200 px/s, per-clip waveform bars (synthetic, density-scaled), **rotary pan knob**. **Remaining:** real WaveSurfer thumbnails, mute/solo, snap-to-grid/clip. |
| **3 — Conform & clip-safety** | ⬜ Not started | `mix:getlevel` IPC exists (peak parse) but no UI yet. |
| **4 — Richer SUBMIX** | ⬜ Not started | crossfade / faders automation / addtomix. |
| **5 — Integration & polish** | ⬜ Not started | session persistence, NodeGraph round-trip, undo/redo. |

**Files:** `src/renderer/src/components/MixWindow/MixWindow.jsx` (UI), `mix:render` + `mix:getlevel`
in `src/main/index.js`, `mixRender`/`mixGetLevel` in `src/preload/index.js`, `application/cdp-clip`
drag payload added in `ClipBin.jsx`, `Mix` tab + always-mounted view in `App.jsx`.

**Key gotcha solved:** SUBMIX parses mixfiles on whitespace, so clip paths containing spaces
(macOS `~/Library/Application Support/…`) broke parsing. `mix:render`/`mix:getlevel` now work in a
spaceless `<temp>/cdp_mix_<ts>/` dir, symlinking any space-containing source paths, then copy the
output back to the clip dir. See `references/error-log.md`.

**Automation note:** `submix mix` only supports *fixed* level/pan per clip — no time-varying
automation in the mixfile. `submix faders` (level crossfade, normalised) and `submix pan` (position
by start-time) exist but aren't general automation. True per-clip level/pan curves must be baked into
the clip first (`envel impose`, `modify space`) before mixing. This pushes real automation to Phase 4
as a pre-bake step, not a mixfile feature.

## How SUBMIX works (ground truth, verified on r8)

**Core render:** `submix mix MIXFILE OUTSND [-sSTART] [-eEND] [-gATTEN] [-a]`

**Mixfile** = plain text, one line per placed clip (`;` comments, blank lines ignored):
```
sndname  starttime  chans  level                              ; simple
sndname  starttime  1      level  pan                         ; mono + pan
sndname  starttime  2      Llevel Lpan  Rlevel Rpan           ; stereo per-channel
```
- All files **same sample rate**; **mono or stereo only**. level: linear (1=unity) or dB. pan: −1 L … 0 C … 1 R.
- Output is mono if all-mono with no pan (or all hard-same-side); otherwise stereo.

**Supporting modes:** `submix getlevel MIXFILE` (peak level → clip check), `submix attenuate`
(scale a mixfile's levels), `submix merge s1 s2 out [-sstagger…]` (quick 2-file, no mixfile),
plus `crossfade`, `interleave`, `addtomix`, `faders`, `balance` (already wired as `submix_balance`).

## Constraints the window must enforce
1. **Same sample rate** across all clips → offer auto-conform via `housekeep respec`.
2. **Mono/stereo only** (no >2ch) → offer `housekeep chans 4` (mix to mono) for offenders.
3. **Clip safety** → run `submix getlevel` after building the mixfile; if peak > 1.0, suggest/apply
   `submix attenuate` (or auto-set the global `-g`).

## App integration (fits existing architecture)
- Add a third **always-mounted** view toggled by `activeTab` in `App.jsx` (alongside `graph`/`viewer`,
  see `App.jsx:264-273`): `activeTab === 'mix'`. Add a "Mix" tab button. State preserved like NodeGraph.
- Reuse: **ClipBin** (drag source), **electron-store** clips, `window.cdpStudio.getAudioInfo`
  (channels/sr/duration), the `cdp:run` IPC, and the `breakpoint:write` pattern for writing the mixfile.
- New component `src/renderer/src/components/MixWindow/MixWindow.jsx`.

## Data model (persisted in the session `.cdpproject` + electron-store)
```js
mix = {
  tracks: [{ id, name, muted, solo, clips: [
    { id, clipId, filePath, name, channels,
      start,                 // seconds in the mix timeline
      level,  pan,           // mono / simple
      Llevel, Lpan, Rlevel, Rpan,  // stereo per-channel (optional)
      gainDb }               // UI may edit in dB, converted on export
  ]}],
  masterAtten,               // global -g
}
```

## New IPC (main)
- `mix:render(lines, outName, opts)` → write `<clipDir>/<name>.txt` mixfile, run `submix mix`,
  return the output clip (same shape `cdp:run` produces). Mirror the existing breakpoint/run flow.
- `mix:getlevel(lines)` → write temp mixfile, run `submix getlevel`, parse peak → `{ maxlevel }`.
- (Later) `mix:attenuate`, `submix merge` passthrough.

---

## Phased milestones

### Phase 1 — MVP render ✅ DONE
- ✅ "Mix" tab + `MixWindow` shell; **drag clips from ClipBin** (`application/cdp-clip` payload).
- ✅ Per-clip fields: **start (s)**, **level**, **pan**. Inline mixfile preview (monospace, toggle).
- ✅ **Render Mix** → `mix:render` → new clip in the Bin (`submix mix mixfile out`).
- ✅ Pre-flight: blocks render if sample rates differ or any clip is >2ch.

### Phase 2 — Timeline UX 🟡 MOSTLY DONE
- ✅ Horizontal **timeline** with adaptive time ruler; tracks as rows; clips as blocks positioned by
  `start`, width = `duration`. **Drag blocks** to reposition (updates `start`, 0.1s snap).
- ✅ **Zoom** 15–200 px/s (slider + ±). Gridlines behind lanes.
- ✅ Per-clip **pan knob** (rotary SVG, drag up/down, dbl-click center) + start/level inputs in sidebar.
- ✅ Per-clip waveform bars — **synthetic** (seeded, density-scales with zoom). *Not real audio yet.*
- ⬜ **Real WaveSurfer thumbnails** inside each block (reuse `MiniWaveform` from NodeGraph).
- ⬜ **Mute / solo** per track.
- ⬜ **Snap-to-grid / snap-to-clip-edge** while dragging.

### Phase 3 — Conform & clip-safety (next major stage)
- Detect mismatched sample rates / >2ch on drop; one-click **auto-conform** (`housekeep respec`,
  `housekeep chans 4`) producing conformed intermediates.
- After build, run **`submix getlevel`**; show peak meter; "Normalize/Attenuate" applies `-g` or
  `submix attenuate`. Stereo per-channel level+pan editing.

### Phase 4 — Richer SUBMIX (3–4 days)
- **Crossfade** between two adjacent clips (`submix crossfade`); **merge** quick-mix path.
- **faders** = level/pan **automation** drawn as breakpoints per clip (reuse the BreakpointEditor).
- **addtomix** for incremental building of large mixes; **interleave** toward multichannel output.

### Phase 5 — Integration & polish (2 days)
- Round-trip: send a mix output back to the **Node Graph** as a source; send a graph output to a mix track.
- Persist the mix in the **session** (extend `serializeGraph`/`loadGraph` or a parallel `mix` block in
  `.cdpproject`); bundle a tutorial mix example (maps to Manual Topic III "How to mix sounds").
- Undo/redo, track reordering, export naming.

## Risks / open questions
- **>2ch sources:** SUBMIX mix is mono/stereo only — multichannel mixing needs the MULTICHANNEL
  toolkit (`njoin`/`submix interleave`), a separate track later.
- **Absolute paths in mixfiles:** write clip absolute paths (clips already store absolute `filePath`);
  for portability, regenerate the mixfile at render time rather than persisting it.
- **dB vs linear levels:** pick one in the UI (dB is friendlier); convert on mixfile export.
- **Pan law / clipping:** summed channels can overload — lean on `getlevel` before committing.

## First concrete step
Phase 1 only: add the `mix` tab + a minimal `MixWindow` that lists dropped clips with start/level/pan
fields, plus the `mix:render` IPC. That proves the SUBMIX render path end-to-end before investing in
the timeline UI.
