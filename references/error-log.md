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
