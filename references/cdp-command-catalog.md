# CDP Command Catalog & Implementation Checklist

> Development log. Source of truth = the CDP **Release 8** install at `~/cdpr8/_cdp/_cdprogs`
> (program banners print a stale `"Release 7.1 2016"` string — ignore it, the distribution is r8).
> HTML docs mirrored at `references/html/` (index: `ccdpndex.htm`).
>
> **Process for adding a row's mode-level detail:** run the binary with no args (and `PROGRAM MODE`)
> to capture the exact Usage line, then fill the file-type + params (CLAUDE.md Stage 1). Programs are
> enumerated at the group level from the CDP8 index; per-mode rows are filled in as each is implemented.

## Legend — file types

| Symbol | Meaning |
|---|---|
| `wav` | Soundfile (`.wav` / `.aif`) — time domain |
| `ana` | PVOC spectral analysis file (`.ana`) — made by `pvoc anal`, resynthesised by `pvoc synth` |
| `pvx` | PVOC-EX spectral file (`.pvx`) |
| `frq` | Binary pitch-data file (`.frq`) |
| `brk` | Breakpoint **text** file — `time value` pairs (also `.txt`). Editable. |
| `evl` | Binary envelope file (`.evl`) |
| `for` | Formant data file (`.for`) |
| `mix` | Mixfile — **text** list of soundfiles + times/levels (SUBMIX) |
| `txt` | Other text/data file (column data, file lists, tuning tables…) |
| `info` | Prints to stdout / writes a text report (no soundfile output) |

**App support today:** the node graph passes `wav` and `ana`/`pvx` between nodes and saves `wav`
outputs to the Clip Bin. Inline breakpoint curves are written to `brk` files automatically
(`breakpoint:write`). `evl` / `for` / `frq` / `mix` are **not yet** handled and gate several groups.

---

## Implementation status (2026-06-25)

**64 commands implemented** across 14 categories (40 → +13 → +2 → +11 batches).
Plus a **SNDINFO inspector** (props/len/maxsamp/loudchan) + **DIRSF** folder listing (read-only UI),
and a **MIX window** (DAW-style arrange page driving `submix mix` — see `mix-window-roadmap.md`).

| Category | Implemented | Notes |
|---|---|---|
| PVOC | 3 | anal, synth, pitch |
| BLUR | 5 | blur, avrg, scatter, chorus, **suppress** ⭐ |
| FOCUS | 3 | freeze, **exag**, **step** ⭐ |
| FILTER | 1 | bank (modes 1–3) |
| MODIFY | 11 | speed×4, loudness fade, gain, brassage×4, radical reverse |
| DISTORT | 12 | average, reverse, repeat, multiply, harmonic, interpolate, pitch, scramble, omit, delete, shuffle, reform |
| GRAIN | 4 | sorter, **reverse**, **duplicate**, **omit** ⭐ |
| MIX | 1 | submix balance (node) · **`submix mix` via MIX window** ⭐ |
| EXTEND | 8 | drunk×2, loop, bounce, dvdwind, scramble×2, sfecho |
| EDIT | 11 | sfedit cut/cutend/excise/insil/join, envel dovetail/curtail, housekeep copy/chans, **envel extract/impose (.evl)** ⭐ |
| STRETCH | 2 | time, **spectrum** ⭐ |
| MORPH | 1 | morph morph |
| **REVERB** ⭐ | **1** | reverb (multichannel reverberator) |
| **HILITE** ⭐ | **1** | trace (retain N loudest partials) |

⭐ = added in the recommended batch (GRAIN / REVERB / spectral / `.evl` / inspector).
The **`.evl` binary-envelope** file type is now plumbed through the chain (extract → impose).

⭐ = added in the in/out + editing batch (this round). Counts verified via
`grep -cE "^    program: '" src/renderer/src/lib/cdpCommands.js`.

---

# TIME DOMAIN (soundfiles)

### HOUSEKEEP — `housekeep` · `cgrohous.htm`
| Mode | in→out | text? | Done | id |
|---|---|---|---|---|
| copy (1 copy once) | wav→wav | — | ✓ | `housekeep_copy` |
| copy (2 copy many) | wav→wav× | — | ▢ | auto-names outputs |
| chans (3 zero / 4 mono / 5 stereo) | wav→wav | — | ✓ | `housekeep_chans` |
| chans (1 extract / 2 extract-all) | wav→wav× | — | ▢ | auto-names outputs |
| extract | wav→wav | — | ▢ | extract significant sound |
| respec | wav→wav | — | ▢ | change sr / format |
| gate | wav→wav | — | ▢ | chop at zeros |
| bakup / bundle / sort | wav/txt | txt | ▢ | file-list utilities |
| disk / batchexpand / endclicks / deglitch | mixed | — | ▢ | |

### SFEDIT — `sfedit` · `cgroedit.htm`
| Mode | in→out | text? | Done | id |
|---|---|---|---|---|
| cut | wav→wav | — | ✓ | `sfedit_cut` (also powers Source in/out auto-trim) |
| cutend | wav→wav | — | ✓ | `sfedit_cutend` |
| excise | wav→wav | — | ✓ | `sfedit_excise` |
| insil | wav→wav | — | ✓ | `sfedit_insil` |
| join | wav+wav→wav | — | ✓ | `sfedit_join` (two inputs) |
| zcut / zcuts | wav→wav | — | ▢ | cut at zero-crossings |
| excises / cutmany / masks | wav→wav | txt? | ▢ | multi-segment |
| insert / replace / subtract | wav+wav→wav | — | ▢ | two inputs |
| randcuts / randchunks / twixt / sphinx | wav→wav | — | ▢ | |
| noisecut / syllables / joinseq / joindyn | wav→wav | txt? | ▢ | |

### ENVEL — `envel` · `cgroenvl.htm`
| Mode | in→out | text? | Done | id |
|---|---|---|---|---|
| dovetail | wav→wav | — | ✓ | `envel_dovetail` |
| curtail | wav→wav | — | ✓ | `envel_curtail` |
| extract | wav→evl | — | ▢ | **needs `evl`** |
| impose / replace / scaled | wav+evl→wav | evl | ▢ | **needs `evl`** |
| warp / tremolo / swell / attack / pluck | wav→wav | — | ▢ | |
| create / cyclic | (params/brk)→evl/brk | brk | ▢ | **needs `evl`** |
| reshape | evl→evl | — | ▢ | **needs `evl`** |
| envtobrk / envtodb | evl→brk | brk | ▢ | converters |

### MODIFY — `modify` · `cgromody.htm`
| Mode | in→out | Done | id |
|---|---|---|---|
| speed (1 ratio / 2 semitone / 5 accel / 6 vibrato) | wav→wav | ✓ | `modify_speed*` |
| loudness | wav→wav | ✓ | `modify_loudness` |
| brassage (1/2/5/6) | wav→wav | ✓ | `modify_brassage*` |
| radical (reverse / shred / ringmod) | wav→wav | ✓ | `modify_radical_*` |
| radical (other modes), pitch, stuff, space, scaledpan | wav→wav | ▢ | space/pan need `txt` |

### DISTORT — `distort` · `cdistort.htm` (mono only)
| Mode | Done | id |
|---|---|---|
| average, reverse, repeat, multiply, harmonic, interpolate, pitch, omit, delete, shuffle, reform | ✓ | `distort_*` |
| scramble | ✓ | `scramble_1` |
| telescope, divide, fractal, overload, cyclecnt… | ▢ | |

### EXTEND — `extend` / `sfedit`-family · `cgroextd.htm`
| Mode | Done | id |
|---|---|---|
| drunk (1/2), loop, bounce, dvdwind, scramble (1/2), sfecho | ✓ | `extend_*` |
| zigzag, sequence(2), gets<br>iterate / iterfof | ▢ | sequence2 may take `txt` list |

### Other time-domain groups (not yet started)
| Group | program · page | typical I/O | text? | notes |
|---|---|---|---|---|
| ENVNU | `cgroenvnu.htm` | wav→wav | — | further envelope ops |
| FILTER | `cgrofilt.htm` | wav→wav | brk | **bank done**; userbank/varibank need `brk`/`txt` filterbank files |
| GRAIN | `cgrogrns.htm` | wav→wav | — | granulate; good next creative batch |
| RETIME | `cgroedit.htm` | wav→wav | txt? | rearrange/retime events |
| REVERB | `cxreverb.htm` | wav→wav | — | reverb / delay |
| PSOW | `cgropsow.htm` | wav→wav | frq/brk | FOF grains; **needs `frq`** |
| TEXTURE | `cgrotext.htm` | (params)→wav | txt | needs note/rhythm `txt` data |
| SYNTH | `cgrosynt.htm` | (params)→wav | — | sources: tone/noise/click |
| SUBMIX | `cgromixr.htm` | wav…→wav | mix | ✓ `mix` (MIX window) + `balance` (node); ▢ crossfade/faders/addtomix/getlevel-UI |
| SNDINFO | `cgroinfo.htm` | wav→info | — | **inspector candidate — see below** |
| MULTICHANNEL (+TOOLKIT) | `cgromc.htm` / `cmcrefmn.htm` | wav→wav | — | diffusion / channel tools |
| SYSUTILS | `csysutil.htm` | mixed | txt | dirsf, columns, conversions |

### SNDINFO (`sndinfo`, internally `sndreport`) · `cgroinfo.htm` — **text output, not chain nodes**
Surface these in a **Source/Clip inspector panel** rather than as process nodes (they print info, they
don't make soundfiles). Verified modes available: `props len lens sumlen timediff smptime timesmp
maxsamp maxsamp2 loudchan findhole diff chandiff prntsnd units maxi zcross`.
| Old name | Mode | Purpose | Done |
|---|---|---|---|
| SFLEN | `sndinfo len` | duration | ▢ (soxi already gives this) |
| MAXSAMP | `sndinfo maxsamp` | peak sample / level | ▢ |
| — | `sndinfo props` | full properties | ▢ |
| — | `sndinfo loudchan` | loudest channel | ▢ |
| DIRSF | (directory listing) | list soundfiles in a folder | ▢ |

---

# SPECTRAL DOMAIN (`.ana` / `.pvx`) — all need `pvoc anal` upstream, `pvoc synth` downstream

| Group | program · page | Done | id / notes |
|---|---|---|---|
| PVOC | `cpvocman.htm` | ✓ | `pvoc_anal` (wav→ana), `pvoc_synth` (ana→wav), `pvoc_pitch` |
| BLUR | `cblur.htm` | ✓ | `blur_blur`, `blur_avrg`, `blur_scatter`; ▢ chorus/drunk/noise/shuffle/spread/suppress/sharpen |
| FOCUS | `cfocus.htm` | ✓ | `focus_freeze`; ▢ accu/exag/fold/hold/randomise/step |
| STRETCH | `cstretch.htm` | ✓ | `stretch_time` (ana→ana); ▢ `stretch spectrum` |
| MORPH | `cmorph.htm` | ✓ | `morph_morph` (ana+ana→ana); ▢ `glide`, `bridge` |
| HILITE | `chilite.htm` | ▢ | emphasise / spectral filter |
| COMBINE | `ccombine.htm` | ▢ | cross / interleave / diff; MAKE outputs `for` |
| FORMANTS | `cformant.htm` | ▢ | get/put — **needs `for`** |
| PITCH / PITCHINFO | `cpitch.htm` / `cptchinf.htm` | ▢ | partial tracking — **needs `frq`** |
| REPITCH | `crepitch.htm` | ▢ | get/put pitch — **needs `frq` + `brk`** |
| SPEC / SPECNU / SPECFNU / SPECINFO | `cspecedi.htm` … | ▢ | gain/clean/shape utilities |
| ONEFORM / STRANGE | `coneform.htm` / `cstrange.htm` | ▢ | single-formant / unusual effects |

---

## Implementation order

**Done (this batch):**
1. ✓ **SNDINFO inspector** (`props`/`len`/`maxsamp`/`loudchan`) + `DIRSF` folder listing — read-only UI (Source-node "ⓘ Info" + "📁 Soundfiles").
2. ✓ **GRAIN** — `reverse`, `duplicate`, `omit` (`wav→wav`, grain-detection flags).
3. ✓ **REVERB** — `reverb` multichannel reverberator (`wav→wav`, stereo out).
4. ✓ **More SPECTRAL** — `stretch spectrum`, `hilite trace`, `focus exag/step`, `blur suppress` (`ana→ana`).
5. ✓ **`.evl` envelope support** — `envel extract` (→`.evl`) + `envel impose` (sound + `.evl`). First binary intermediate plumbed through the chain.

6. ✓ **`mix` (SUBMIX) — MIX window Phase 1 + most of Phase 2.** DAW-style arrange page: drag clips,
   timeline with ruler/zoom, draggable blocks, pan knob, `submix mix` render → Bin. See
   `references/mix-window-roadmap.md`.

**Next:**
7. **MIX window Phase 2 finish + Phase 3** — real WaveSurfer thumbnails, mute/solo, snap; then
   conform (`housekeep respec`/`chans`) + clip-safety UI on `submix getlevel`/`attenuate`.
8. **`frq` (PITCH / PSOW / REPITCH)** — binary pitch-data; analysis → `.frq`, repitch/transpose, resynth.
9. **More ENVEL/GRAIN/FOCUS/BLUR modes** — incremental `ana→ana` / `wav→wav` fill-ins (no new machinery).
