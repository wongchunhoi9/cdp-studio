# Bundled tutorial examples

Open these from the node graph via **Open Example…**. Each `.cdpproject` recreates a session from
*A Learning Manual for CDP* (Archer Endrich). Sources and breakpoint files are bundled here and
resolved automatically on load. Multi-branch sessions have several output nodes — **Render** each
one to hear that variation.

## Topic I — How to start designing sounds

| Doc | Session | Example file | Processes used |
|---|---|---|---|
| 1-1 | Listening 1 — Manipulating Sound | `topic1-1-manipulating-sounds.cdpproject` | `modify speed 2` (transpose via breakpoint), `distort pitch` (pitchwarp, fixed + breakpoint) |
| 1-2 | SoundLoom Basic Guide | — | GUI walkthrough (PDF); no processing chain |
| 1-3 | Basic Soundfile Editing | `topic1-3-basic-editing.cdpproject` | `sfedit cut` → `modify loudness 1` (gain) → `envel dovetail` |
| 1-4 | About Sound Design | — | concept only |
| 1-5 | About Composing with Sounds | — | concept only |
| 1-6 | The CDP Software | — | concept only |
| 1-7 | Suggestions for Composition Projects | — | concept only |
| 1-8 | CDP Primary Reference Materials | — | reference list only |

## Topic II — How to make basic modifications

| Doc | Session | Example file | Processes used |
|---|---|---|---|
| 2-1 | Listening 2 — Surfaces | — | listening doc (its examples are realised in 2-3) |
| 2-2 | Basic Modifications and Transformations | `topic2-2-basic-modifications.cdpproject` | Reverse, Transpose, Vibrato, Loop, spectral Timestretch (`pvoc anal`→`stretch time`→`pvoc synth`) |
| 2-3 | Surface Texturing | `topic2-3-surface-texturing.cdpproject` | `distort pitch`/`distort multiply`, `extend scramble`, `blur chorus` (spectral) |
| 2-4 | Suppleness via Time-varying Parameters | `topic2-4-suppleness.cdpproject` | gain 3× → cut 1.49s → transpose −2 oct; time-varying `distort pitch` (breakpoint); `extend drunk` |
| 2-5 | Types of Sound | — | concept only |
| 2-6 | Sonic Objectives | — | concept only |
| 2-7 | CDP Tutorial Materials | — | tutorial index only |

## Bundled assets
- **Sounds:** `horn.wav`, `capm.wav`, `clashm.wav`, `bfrogcdt.wav`, `marimba.wav`, `count.wav`
- **Breakpoint files:** `capm-transpose-up/down/both.brk`, `capm-pitchwarp.brk`, `tv-octvary.brk`
  (plain `time value` text — referenced by basename in a node's params and resolved on load)

## Added to support these examples
- `modify_gain` — MODIFY LOUDNESS Mode 1 (the Manual's *GAIN*)
- `blur_chorus` — BLUR CHORUS Mode 5 (amplitude + frequency chorusing)
- `distort_pitch` — octvary now supports a time-varying breakpoint (range up to 8)

## Not yet implemented (referenced by some Manual sessions)
These sessions lean on commands the app doesn't have yet, so the examples use the closest available
processes instead:
- **TEXTURE set** (Topic 5) — multi-event textures / shimmer (`texture simple`)
- **REVERB / MODIFY REVECHO** — stadium echo, reverberation
- **PITCH / REPITCH trace**, **MODIFY PAN**, **ENVEL TREMOLO**

These are tracked in [`references/cdp-command-catalog.md`](../../references/cdp-command-catalog.md).
