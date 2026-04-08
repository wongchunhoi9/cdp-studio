# CDP Command Implementation Skill

**name:** cdp-command-implementation  
**description:** Use this skill whenever implementing, fixing, or verifying a CDP (Composers Desktop Project) command in the CDP Studio app. Triggers when the user says things like "implement X command", "add Y to the node graph", "fix the Z node", "the distort command is wrong", or shows a CDP usage error in the terminal log. This skill defines the complete repeatable workflow: lookup → spec → implement → test → error-document → sign-off. Always follow all 6 stages in order. Do not skip the lookup or error-document stages.

## Purpose

This skill governs the repeatable process for adding or fixing any CDP command in the CDP Studio Electron app (`cdpCommands.js`). Every command must pass through all 6 stages. No command is considered complete until the user signs off at Stage 6.

## Project Context

- App: CDP Studio — Electron + React, macOS
- Command catalog: `src/renderer/src/lib/cdpCommands.js`
- Command runner: `src/renderer/src/lib/cdpRunner.js`
- CDP binary location: `~/cdpr8/_cdp/_cdprogs/` (set in Settings)
- CDP docs root: `~/cdpr8/docs/html/` (local) and `https://www.composersdesktop.com/docs/html/`
- Argument order: `program [mode] [modeNum] infile [infile2] outfile [params...] [-flags]`

## The 6-Stage Workflow

### STAGE 1 — LOOKUP (never skip)

Before writing any code, verify the exact syntax from CDP docs.

**Primary source — run in terminal:**
```bash
~/cdpr8/_cdp/_cdprogs/PROGRAMNAME MODE
# With no arguments CDP prints the full usage message including all modes,
# parameter names, ranges, defaults, and flag formats.
# This is the ground truth. Always prefer this over docs or memory.
```

**Secondary source — local HTML docs:**
```
~/cdpr8/docs/html/  ← always present, version-matched to the installed binary
```

See references/doc-page-map.md for the filename for each function group.

**Record from the usage output:**
1. Exact program name (binary filename)
2. Mode name (first arg after program, if any)
3. Mode number (integer after mode, if any — e.g. `modify brassage **6**`)
4. Input file type(s) — `.wav` or `.ana` or both
5. Output file type — `.wav` or `.ana`
6. Every positional parameter in exact order with name, range, default
7. Every flag in exact format `-xVALUE` with name, range, default
8. Whether file must be MONO (many DISTORT and some MODIFY commands)
9. Whether file can be multichannel (note for future Ambisonic support)

**Red flags that mean the lookup is incomplete:**
- You find the command in the docs but have not run the binary
- The Usage line in the docs does not match the binary output
- Any parameter range is unknown
- The output extension is assumed, not confirmed

---

### STAGE 2 — SPEC (fill before coding)

Read `references/command-spec-template.md` and fill one spec per command.
The completed spec is the source of truth for the implementation.

**Key spec fields that often have errors:**
- `modeNum` — many commands have a required integer sub-mode that is easy to miss
- `outputExt` — BLUR and FOCUS output `.ana` not `.wav`; forgetting this breaks chaining
- `monoOnly` — DISTORT commands are mono only; must warn user in UI
- Flag format — flags are `-c1024` not `--c 1024` not `-c 1024`

---

### STAGE 3 — IMPLEMENT

Add or update the entry in `cdpCommands.js` using the spec.

**Checklist before committing:**
- [ ] `program` matches binary filename exactly (check with `ls ~/cdpr8/_cdp/_cdprogs/`)
- [ ] `mode` and `modeNum` match Usage line exactly
- [ ] `inputExt` is correct (`.wav` or `.ana`)
- [ ] `outputExt` is correct (`.wav` or `.ana`)
- [ ] `params` array is in the exact positional order from Usage line
- [ ] Each param has `min`, `max`, `default` sourced from docs — not guessed
- [ ] Each param `help` text mentions the range and a musical use case
- [ ] `flags` entries use single character id matching the flag letter
- [ ] `multichannel: false` set if command is mono-only
- [ ] `docUrl` points to the correct anchor on the function group page
- [ ] `category` matches one of the defined CDP_CATEGORIES

**buildArgs produces:** `[mode?, modeNum?, infile, infile2?, outfile, ...params, ...-flags]`
Verify this matches the Usage line argument order.

---

### STAGE 4 — TERMINAL TEST

Before testing the UI, verify the raw command works in Terminal.

```bash
cd ~/Music/test-samples   # or wherever you have a short .wav file

# Run the command manually with the exact same args buildArgs would produce:
~/cdpr8/_cdp/_cdprogs/PROGRAM MODE MODENUM input.wav output.wav PARAM1 PARAM2 -FLAG1

# Check:
# 1. Did it exit without error?
# 2. Does output.wav exist?
# 3. soxi output.wav  — is duration/channels what you expect?
# 4. Play output.wav — does it sound like the process did what it should?
```

If the raw command fails here, fix it before touching the UI.

**Common raw failures and causes:**
- "No such file" → wrong program name or PATH not set
- "Invalid data" → wrong file format (e.g. feeding .wav to a .ana command)
- "Wrong number of channels" → stereo file to a mono-only command
- "Usage:" printed → wrong number of arguments (mode/modeNum missing or extra arg)
- Silence in output → parameter value out of useful range (not an error, just useless)

---

### STAGE 5 — UI TEST + ERROR DOCUMENTATION

Test the command through the node graph in CDP Studio. For each test:

1. Load a source WAV file in the Source node
2. Add the new process node
3. Connect Source → Process → Output
4. Click Render Chain
5. Check the Terminal Log panel for the exact command that ran
6. Check the Clip Bin for the result
7. Click the result clip → Waveform tab → listen

**Document soft errors** — fill `references/error-log.md` with:

```
## PROGRAMNAME MODE — [date]

### Known parameter constraints not caught by the UI
- N must be ODD (blur blur, blur avrg) — UI does not enforce this yet
- cyclecnt must not exceed number of wavecycles in file — no warning shown

### Common user mistakes
- Feeding a stereo file to a mono-only command → CDP exits silently with no output
- Chaining blur blur directly to Output without PVOC Synth → .ana file not playable

### Error messages seen in Terminal Log and their meaning
- "INVALID DATA: Cannot open output file" → output folder doesn't exist or no write permission
- "Sound file has wrong number of channels" → input must be mono
- "sound source is too short for cyclecnt value" → reduce cyclecnt or use a longer input

### Parameter edge cases found during testing
- pitch value of exactly 0.0 in modify brassage causes silent output — use 0.001 minimum
```

---

### STAGE 6 — USER SIGN-OFF

Present the user with:
1. The exact command string from the Terminal Log of a successful run
2. A description of what parameters were used and what the output sounded like
3. The error-log entries filled for this command
4. Any constraints not yet enforced in the UI (future improvement notes)

Ask: "Does this match what you expected? Anything to adjust before we mark it complete?"

Only mark the command complete after explicit user confirmation.

---

## Quick Reference

### Argument order rule
```
PROGRAM [MODE] [MODENUM] INFILE [INFILE2] OUTFILE [PARAM1 PARAM2 ...] [-FLAG1 -FLAG2 ...]
```

### Phase 1 command priority (no PVOC, no text files)
See `references/phase1-command-list.md` for the prioritised list of commands
to implement in Phase 1, with their doc page references.

### When something is unclear
Run the binary with no args. Read the output carefully.
The Usage line is always the authority. Docs can be outdated; the binary never lies.
