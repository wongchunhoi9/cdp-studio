# CDP Studio — Soft Error Log

This file documents known soft errors, parameter constraints, and common user mistakes
for each implemented command. Updated during Stage 5 of each implementation.

---

## Template (copy for each command)

```
## PROGRAM MODE — [date implemented]

### Parameter constraints not yet enforced in UI
-

### Common user mistakes
-

### Error messages seen in Terminal Log and their meaning
-

### Parameter edge cases found during testing
-

### Notes for future UI improvement
-
```

---

## distort average — implemented

### Parameter constraints not yet enforced in UI
- `cyclecnt` must be > 1 (the docs say Range: > 1 but the UI min is 2 which is correct)
- Input must be MONO — UI does not block stereo input

### Common user mistakes
- Feeding stereo file: CDP exits with "Sound file has wrong number of channels"
- Setting cyclecnt > number of wavecycles in file: "sound source too short"

### Error messages seen in Terminal Log and their meaning
- `Sound file has wrong number of channels` → convert to mono first using housekeep or SoX
- `sound source is too short for cyclecnt value` → reduce cyclecnt or use longer file

### Parameter edge cases found during testing
- cyclecnt = 2 is audible but subtle; cyclecnt > 50 creates a static/sample-hold effect

---

## modify radical 1 (Reverse) — implemented

### Parameter constraints not yet enforced in UI
- None — this command is simple with no parameters

### Common user mistakes
- None known

### Error messages seen in Terminal Log and their meaning
- None known

---

## modify brassage 6 — implemented

### Parameter constraints not yet enforced in UI
- velocity = 0 anywhere in a breakpoint file requires outlength to be set
  (not applicable yet since we don't use breakpoint files in Phase 1)
- bsplice + esplice must be < grainsize/2

### Common user mistakes
- Setting space > 1 on a mono input source has no effect
- density < 0.01 can produce unpredictable behaviour

### Parameter edge cases found during testing  
- pitchshift = 0 causes silent output — minimum useful value is ±0.001 or just leave at 0
  (NOTE: needs investigation — may be specific to certain CDP versions)
- Very large grainsize (>500ms) with low density can produce very sparse output that sounds broken

### Notes for future UI improvement
- Add visual warning when bsplice + esplice >= grainsize
- Clamp velocity minimum to 0.01 to avoid infinite-stretch edge case without outlength
