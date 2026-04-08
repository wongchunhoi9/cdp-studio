# CDP Documentation Page Map

Local path root: `~/cdpr8/docs/html/`
Online root: `https://www.composersdesktop.com/docs/html/`

## Time-Domain Groups (.wav → .wav)

| Group | Local file | Online URL | Notes |
|---|---|---|---|
| BLUR (spectral) | `cspecblur.htm` | `.../cspecblur.htm` | Operates on .ana files |
| DISTORT | `cdistort.htm` | `.../cdistort.htm` | Most commands mono only |
| ENVEL | `cgroenvl.htm` | `.../cgroenvl.htm` | Amplitude envelope shaping |
| EXTEND | `cgroextd.htm` | `.../cgroextd.htm` | Looping, padding, bouncing, stuttering |
| FILTER | `cgrofilt.htm` | `.../cgrofilt.htm` | LP, HP, BP, notch, phasing |
| FOCUS (spectral) | `cspecfoc.htm` | `.../cspecfoc.htm` | Operates on .ana files |
| GRAIN | `cgrogrns.htm` | `.../cgrogrns.htm` | Granular (brassage, wrappage) |
| HOUSEKEEP | `cgrohous.htm` | `.../cgrohous.htm` | Channel split/merge, format conversion |
| MODIFY | `cgromody.htm` | `.../cgromody.htm` | Speed, radical, brassage, loudness |
| MULTICHANNEL | `cgromc.htm` | `.../cgromc.htm` | Spatial, multichannel diffusion |
| PSOW | `cgropsow.htm` | `.../cgropsow.htm` | FOF grain / vocal processing |
| REVERB | `cxreverb.htm` | `.../cxreverb.htm` | Reverb and convolution |
| SFEDIT | `cgroedit.htm` | `.../cgroedit.htm` | Cut, join, splice, excise |
| SNDINFO | `cgroinfo.htm` | `.../cgroinfo.htm` | File info utilities |
| SUBMIX | `cgromixr.htm` | `.../cgromixr.htm` | Mixing, crossfading |
| SYNTH | `cgrosynt.htm` | `.../cgrosynt.htm` | Sound synthesis |
| TEXTURE | `cgrotext.htm` | `.../cgrotext.htm` | Texture generation |

## Spectral Groups (.ana files)

| Group | Local file | Online URL | Notes |
|---|---|---|---|
| PVOC | `cspecpvoc.htm` | `.../cspecpvoc.htm` | Analysis, synth, pitch, stretch |
| BLUR | `cspecblur.htm` | `.../cspecblur.htm` | blur, avrg, scatter, suppress, noise |
| COMBINE | `cspeccmbn.htm` | `.../cspeccmbn.htm` | Spectral combination |
| FOCUS | `cspecfoc.htm` | `.../cspecfoc.htm` | freeze, accu, narrow |
| FORMANTS | `cspecform.htm` | `.../cspecform.htm` | Formant manipulation |
| HILITE | `cspechilt.htm` | `.../cspechilt.htm` | Highlight partials |
| MORPH | `cspecmrph.htm` | `.../cspecmrph.htm` | Spectral morphing |
| PITCH (spectral) | `cspecptch.htm` | `.../cspecptch.htm` | Repitch, transpose |
| SPECFNU | `cspecfnu.htm` | `.../cspecfnu.htm` | CDP8 new: formant-preserving transforms |
| STRETCH (spectral) | `cspecstch.htm` | `.../cspecstch.htm` | Time-stretch spectral |

## Useful anchor format

Most sections have anchors matching the sub-command name in UPPERCASE:
```
https://www.composersdesktop.com/docs/html/cdistort.htm#AVERAGE
https://www.composersdesktop.com/docs/html/cgromody.htm#BRASSAGE
https://www.composersdesktop.com/docs/html/cgromody.htm#RADICAL
```

## How to quickly find any command

1. Open `~/cdpr8/docs/html/alphindex.htm` in a browser
2. Ctrl+F for the command name
3. Click the link → takes you to the exact section with Usage line

OR run the binary with no args — faster and always correct.
