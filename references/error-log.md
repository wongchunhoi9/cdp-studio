# CDP Command Error Log

## filter bank — 2026-05-10

### Terminal Tests
- Mode 1: PASS — produced valid 16-bit mono WAV
- Mode 2: PASS — produced valid 16-bit mono WAV
- Mode 3: PASS — produced valid 16-bit mono WAV
- SSCAT flag (`-s0.5`): PASS

### Parameter constraints not enforced in UI
- Q range `0.1–10000` — binary accepts anything but practical range is ~0.1–50
- Gain `0.001–10000` dB — extremely wide range, very high gains may cause clipping
- Freq range `1–20000` Hz — exceeds audio sample rate (48kHz Nyquist = 24000Hz)
- No validation that `lofrq < hifrq` — user can swap them

### Common user mistakes
- Setting lofrq > hifrq (no filter effect or binary error)
- Using Q=0 (outside min range, would produce invalid filter)
- Not realizing modes 2/3 produce time-varying filter sweeps (output differs from mode 1)

### Edge cases found
- `-s` (SSCAT) flag only applies in certain modes per CDP docs — behavior in all modes was not tested
- `-d` (debug) flag was not tested — produces extra terminal output
- Stereo input: binary may downmix or fail — not tested

### Command generation verified
`buildArgs` with `modeNum: 'param:mode'` correctly maps user's mode selection to the second positional arg.

## EDIT batch — sfedit / envel / housekeep — 2026-06-24

Source in/out region → `sfedit cut` auto-trim, plus the new EDIT category.

### Terminal Tests (all PASS on Clarinet_M160_testSample.wav, mono 48kHz)
- `sfedit cut 1 in out 2.0 5.0` → 3.0s segment — PASS
- `sfedit cutend 1 in out 1.5` → keeps last 1.5s — PASS
- `sfedit excise 1 in out 1.0 2.0` → 3s→2s (gap closed) — PASS
- `sfedit insil 1 in out 1.0 1.0` → 3s→3.985s — PASS
- `sfedit join A B out` → 3.0 + 3.0 = 5.985s (one splice overlap) — PASS
- `envel dovetail 1 in out 0.5 0.5 1 1` → faded edges — PASS
- `envel curtail 1 in out 1.0 2.0 1` → tail faded to zero — PASS
- `housekeep copy 1 in out` — PASS
- `housekeep chans 5 mono out` → 2ch — PASS; `housekeep chans 4 stereo out` → 1ch — PASS

### Parameter constraints not enforced in UI
- `sfedit cut/excise`: binary does not reject end ≤ start cleanly; the `gtParam` constraint warns
  but does not block. Splice `-w` overlaps that exceed the segment can error.
- `envel dovetail`: in-fade + out-fade must not overlap (sum < file length) — not enforced.
- `housekeep chans` mode 3 `channo` must be ≤ channel count — not validated against the input.

### Behaviour notes / gotchas
- `sfedit join` has **no mode number**: `join infile1 infile2 outfile …` — modelled with
  `modeNum: null, twoInputs: true`. Output length = A + B minus one splice window.
- `housekeep chans` modes **1 and 2 auto-name** their outputs (`name_c1.wav`…) and take **no
  outfile** arg, so they are intentionally excluded — only modes 3/4/5 fit the single-output model.
- `housekeep gain` does **not exist** in r8; old `GAIN` ≈ `modify loudness` (already implemented).
- Old standalone names map as: SFLEN=`sndinfo len`, MAXSAMP=`sndinfo maxsamp`, COPYSFX=`housekeep copy`,
  DOVETAIL=`envel dovetail`, CUT=`sfedit cut`.

### Source in/out auto-trim
- The in/out region (WaveSurfer, seconds) is stored on the source node as `trimStart`/`trimEnd`
  and applied via an implicit `sfedit cut 1` pre-step in `renderChain`, seeded into `nodeOutputs`.
- Skipped when the region spans the whole file (±5ms tolerance) or is absent.
- The trimmed temp is transient (clip dir, timestamped) and not saved to the Clip Bin.

## STRETCH / MORPH (spectral) — 2026-06-24

### Terminal Tests (PASS, on horn.ana / capm.ana from `pvoc anal`)
- `stretch time 1 horn.ana out.ana 2.0` → output ~2× size; resynth = 10.8s (from 5.4s) — PASS
- `morph morph 1 horn.ana capm.ana out.ana 0.5 2.0 0.5 2.0 1 1` → valid .ana — PASS

### Notes
- Both are `.ana → .ana`: require a `pvoc anal` upstream and `pvoc synth` downstream. The node graph
  passes `.ana` between nodes but only saves `.wav` outputs to the Clip Bin (expected).
- `morph morph` takes **two `.ana` inputs** (`twoInputs: true`) and a sub-mode (1 linear/exp, 2 spline)
  via `modeNum: 'param:mode'`.
- Differing input lengths are fine for morph; output follows the morph windows / stagger.

## Tutorial batch — modify gain / blur chorus / distort pitch breakpoint — 2026-06-24

Added to realise the Topic I & II example sessions.

### Terminal Tests (PASS)
- `modify loudness 1 in out 2.0` (GAIN) — PASS
- `blur chorus 5 in.ana out.ana 100 1.4` — PASS
- `distort pitch in out <octvary.brk>` (time-varying) — PASS; fixed `0.33` — PASS
- `modify speed 2 in out <transpose.brk>` (semitone breakpoint) — PASS

### Example sessions — full chain replay (25/25 branches PASS)
Verified by replaying every example `.cdpproject` through the app's own `buildArgs` + the r8
binaries (`/tmp/verify-examples.mjs`). Sessions: topic1-1, topic1-3, topic2-2, topic2-3, topic2-4.

### Gotchas
- `extend loop` **mode 1 requires step > 0** ("NB: Can be ZERO in modes 2 and 3, but NOT in mode 1").
  Example fixed to start 0.5 / len 300ms / step 200ms.
- Breakpoint/data files are referenced in example node params by **basename**; `examples:load`
  resolves any `*.brk` / `*.txt` param value (and breakpointConnection) to the bundled file.
- Old `GAIN` = `modify loudness 1` (constant factor); the existing `modify_loudness` is the
  start/end envelope-fade form and is kept separate.

## Recommended batch — GRAIN / REVERB / spectral / .evl / inspector — 2026-06-24

### Terminal Tests — all 11 new commands PASS via the app's buildArgs (verify-batch.mjs)
- grain reverse / duplicate (N) / omit (keep out-of) on count.wav — PASS (grainy sources only)
- reverb infile outfile rgain mix rvbtime absorb lpfreq trailertime — PASS (stereo out, +trailer)
- stretch spectrum 1 / hilite trace 1 / focus exag / focus step / blur suppress (.ana→.ana) — PASS
- envel extract 1 (wav→.evl) + envel impose 2 (sndfile + .evl → wav) — PASS

### Gotchas / notes
- **GRAIN ops need a grainy source** (silences between events — speech/percussion). On a sustained
  tone they may detect a single grain. Detection via `-l`gate / `-h`minhole; set multichannel:false.
- **reverb has NO mode number** and outputs stereo; its `-c/-H/-L` flags must precede the infile, so
  the UI exposes only positional params (no flags) to keep buildArgs' flag-at-end ordering valid.
- **focus exag** may print "Zero-amp spectral window(s)" warning — harmless.
- **.evl plumbing:** envel_extract outputs `.evl`; the chain passes it via nodeOutputs but does NOT
  save it to the Clip Bin (only `.wav`). envel_impose is a two-input node: sndfile (A) + .evl (B).
- **CDP never overwrites existing output files** (exit 255). The app always writes timestamped names,
  so this only bites manual/terminal reruns.
- **SNDINFO loudchan** errors on mono ("does not work with MONO"); the inspector simply hides modes
  whose run failed. DIRSF works when the binary is run with cwd = the chosen folder.

---

## MIX window (SUBMIX `mix`) — 2026-06-25

### What was built
- New `MixWindow` (DAW-style arrange page): `Mix` tab, drag clips from ClipBin, timeline with
  adaptive ruler, draggable clip blocks (set `start`), zoom 15–200 px/s, rotary pan knob, synthetic
  density-scaled waveform bars. Renders via new `mix:render` IPC → `submix mix mixfile out` → Bin clip.
- `mix:getlevel` IPC also added (peak parse from `submix getlevel 1`) — wired, no UI yet (Phase 3).

### Verified
- `submix mix mixfile out` with a two-clip mixfile (horn@0s + capm@2s) → 10.18s output. PASS.
- `submix getlevel 1 mixfile` → "MAX SAMPLE ENCOUNTERED : 0.975042 at 3.100941 secs". Regex updated
  to match this exact wording.

### Gotchas / notes
- **SPACES IN PATHS BREAK SUBMIX.** Mixfiles are whitespace-delimited (`sndname start chans level
  [pan]`), so a clip path containing a space — every macOS clip lives under
  `~/Library/Application Support/cdp-studio/clips/` — is parsed as multiple fields and the render
  fails. **Fix:** `mix:render`/`mix:getlevel` operate in a spaceless `<temp>/cdp_mix_<ts>/` dir,
  `symlinkSync` any space-containing source into it as `clipN.ext`, write the mixfile + output there,
  then `copyFileSync` the result to the clip dir. Temp dir is always `rmSync`-cleaned in `finally`.
- **No automation in the mixfile.** `submix mix` level/pan are FIXED per clip. `submix faders` is a
  normalised level crossfade (levels sum to 1.0, can't set overall level); `submix pan` positions by
  a clip's start-time, not a continuous sweep. Real per-clip level/pan curves must be pre-baked into
  the clip (`envel impose` for volume, `modify space` for movement) before mixing → Phase 4.
- **Mixfile format quirks:** mono files in a stereo mix pan centrally if given a single level; comment
  lines start with `;`; blank lines ignored; list need not be in start-time order; leading silence is
  ignored (splice on afterwards if needed).
- **Stereo clips:** UI uses the simple single-level format (`sndname start 2 level`); per-channel
  level+pan editing is deferred (Phase 3).
- IPC passes structured `items` (not pre-built lines) so the main process owns path handling; the
  renderer's mixfile preview shows basenames for readability only.
