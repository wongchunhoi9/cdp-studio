# Phase 1 Command Priority List

**Rule:** Phase 1 = commands that work entirely on `.wav` files with no PVOC analysis step
and no external text/breakpoint files. Pure sample-domain processing.

Each command is rated:
- ⭐⭐⭐ = Most musically useful for clarinet, implement first
- ⭐⭐ = Good variety, implement second wave
- ⭐ = Interesting but niche, implement when above are done

---

## WAVE 1 — Already implemented (verify these are correct)

- [x] `modify radical 1` — Reverse ⭐⭐⭐
- [x] `modify speed 1` — Speed change ⭐⭐⭐
- [x] `modify loudness` — Fade/envelope ⭐⭐⭐
- [x] `modify brassage 6` — Granular brassage ⭐⭐⭐
- [x] `distort average` — Waveset average ⭐⭐⭐
- [x] `distort reverse` — Waveset reversal ⭐⭐
- [x] `distort repeat` — Waveset repeat/stretch ⭐⭐
- [x] `distort shuffle` — Waveset shuffle ⭐⭐

---

## WAVE 2 — Implement next (high value, simple syntax)

### EXTEND group
These make a single clarinet note into a longer/evolving event.

| Command | Syntax | ⭐ | Doc anchor | Status |
|---|---|---|---|---|
| `extend loop` | `extend loop 1 infile outfile start len step [-w splice]` | ⭐⭐⭐ | `cgroextd.htm#LOOP` | ✅ Implemented |
| `extend stutter` | `extend stutter infile outfile datafile...` | ⭐⭐⭐ | `cgroextd.htm#STUTTER` | ❌ Skipped (requires datafile) |
| `extend bounce` | `extend bounce infile outfile count startgap shorten` | ⭐⭐⭐ | `cgroextd.htm#BOUNCE` | ✅ Implemented |
| `extend pad` | `extend pad infile outfile time` | ⭐⭐ | `cgroextd.htm#PAD` | ✅ Implemented |

### MODIFY additional modes
These work directly on .wav with no extra files.

| Command | Syntax | ⭐ | Doc anchor | Status |
|---|---|---|---|---|
| `modify brassage 1` | `modify brassage 1 infile outfile pitchshift` | ⭐⭐⭐ | `cgromody.htm#BRASSAGE` | ✅ Implemented |
| `modify brassage 2` | `modify brassage 2 infile outfile velocity` | ⭐⭐⭐ | `cgromody.htm#BRASSAGE` | ✅ Implemented |
| `modify brassage 5` | `modify brassage 5 infile outfile density` | ⭐⭐ | `cgromody.htm#BRASSAGE` | ✅ Implemented |
| `modify radical 2` | `modify radical 2 infile outfile repeats chunklen` | ⭐⭐ | `cgromody.htm#RADICAL` | ✅ Implemented (Shred) |
| `modify radical 5` | `modify radical 5 infile outfile modulating-frq` | ⭐⭐ | `cgromody.htm#RADICAL` | ✅ Implemented (Ring Mod) |

---

## WAVE 3 — DISTORT completions

| Command | Syntax | ⭐ | Doc anchor |
|---|---|---|---|
| `distort harmonic` | `distort harmonic infile outfile N` | ⭐⭐⭐ | `cdistort.htm#HARMONIC` |
| `distort interpolate` | `distort interpolate infile outfile N` | ⭐⭐ | `cdistort.htm#INTERPOLATE` |
| `distort pitch` | `distort pitch infile outfile semitones` | ⭐⭐⭐ | `cdistort.htm#PITCH` |
| `distort multiply` | `distort multiply infile outfile N` | ⭐⭐ | `cdistort.htm#MULTIPLY` |
| `scramble 1` | `scramble 1 infile outfile dur seed` | ⭐⭐ | `cdistort.htm#SCRAMBLE` |
| `distort omit` | `distort omit infile outfile A B` | ⭐ | `cdistort.htm#OMIT` |
| `distort delete` | `distort delete infile outfile cyclecnt` | ⭐ | `cdistort.htm#DELETE` |

---

## WAVE 4 — FILTER group (no text files needed for basic modes)

| Command | Syntax | ⭐ | Doc anchor |
|---|---|---|---|
| `filter lp` | `filter lp infile outfile lofrq` | ⭐⭐⭐ | `cgrofilt.htm#LP` |
| `filter hp` | `filter hp infile outfile hifrq` | ⭐⭐⭐ | `cgrofilt.htm#HP` |
| `filter bp` | `filter bp infile outfile lofrq hifrq` | ⭐⭐ | `cgrofilt.htm#BP` |
| `filter notch` | `filter notch infile outfile lofrq hifrq` | ⭐⭐ | `cgrofilt.htm#NOTCH` |
| `phasor` | `phasor infile outfile freq depth` | ⭐⭐ | `cgrofilt.htm#PHASOR` |

---

## WAVE 5 — ENVEL and SFEDIT basics

| Command | Syntax | ⭐ | Doc anchor |
|---|---|---|---|
| `envel reshape` | `envel reshape infile outfile...` | ⭐⭐ | `cgroenvl.htm#RESHAPE` |
| `envel tremolo` | `envel tremolo infile outfile freq depth` | ⭐⭐ | `cgroenvl.htm#TREMOLO` |
| `sfedit reverse` | `sfedit reverse infile outfile` | ⭐⭐ | `cgroedit.htm#REVERSE` |
| `sfedit excise` | `sfedit excise 1 infile outfile start end` | ⭐⭐ | `cgroedit.htm#EXCISE` |

---

## Commands to skip in Phase 1 (require text files or PVOC)

These all need breakpoint files, pitch trace files, or .ana input — Phase 2+:

- Any PVOC processing → Phase 2
- `modify speed 2` → needs a breakpoint file for time-varying speed
- `modify brassage 7` → needs too many params with breakpoint options
- TEXTURE group → needs score text files
- PSOW group → needs pitch trace .frq files
- REVERB `rmverb` → works on .wav but needs careful tuning — defer

---

## Implementation order suggestion

```
Wave 2 EXTEND/MODIFY → ✅ COMPLETE
  ↓
Wave 3 DISTORT (harmonic, pitch, interpolate) → expands waveset palette
  ↓
Wave 4 FILTER (lp, hp, bp) → fundamental and missing entirely right now
  ↓
Wave 5 ENVEL/SFEDIT → for precise editing and envelope work
```
