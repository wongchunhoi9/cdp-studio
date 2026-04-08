# CDP Command Spec — [PROGRAM MODE]

> Fill this before writing any code. Source all values from the binary usage output.
> Run: `~/cdpr8/_cdp/_cdprogs/PROGRAM MODE` with no args to get the usage message.

---

## 1. Identity

| Field | Value |
|---|---|
| Program (binary name) | e.g. `distort` |
| Mode (first arg) | e.g. `average` |
| Mode Number (integer after mode) | e.g. `null` or `1` |
| Display label for UI | e.g. `Distort Average` |
| Category | `pvoc` / `blur` / `focus` / `modify` / `distort` / `grain` / `mix` |
| Doc page URL | e.g. `https://www.composersdesktop.com/docs/html/cdistort.htm#AVERAGE` |

---

## 2. File Types

| Field | Value |
|---|---|
| Input 1 extension | `.wav` or `.ana` |
| Input 2 extension (if two inputs) | `.wav` or `.ana` or `none` |
| Output extension | `.wav` or `.ana` |
| Mono only? | `yes` / `no` |
| Multichannel safe? | `yes` / `no` |

---

## 3. Full Usage Line (copy verbatim from binary output)

```
paste the exact Usage line here
```

---

## 4. Positional Parameters (in exact order after outfile)

| Position | Name in docs | UI label | Type | Min | Max | Default | Musical meaning |
|---|---|---|---|---|---|---|---|
| 1 | `cyclecnt` | Wavecycle Count | number | 2 | 100 | 8 | Wavecycles to average. Lower = subtle, higher = destroyed |
| 2 | | | | | | | |

---

## 5. Flags (optional, formatted as -xVALUE)

| Flag letter | UI label | Type | Options / Range | Default | Notes |
|---|---|---|---|---|---|
| `c` | Analysis Points | select | 64/128/256/512/1024/2048/4096 | 1024 | Written as -c1024 |

---

## 6. Constraints and Warnings

List anything the docs or binary output mention about constraints:

- [ ] Parameter N must be ODD
- [ ] Input must be mono
- [ ] cyclecnt must not exceed number of wavecycles in file
- [ ] velocity=0 requires outlength to be set
- [ ] Other: ___

---

## 7. Raw Terminal Test Command

```bash
# Fill in a real test command using default values:
~/cdpr8/_cdp/_cdprogs/PROGRAM MODE MODENUM ~/path/to/test.wav /tmp/test-output.wav PARAM1 PARAM2
```

Expected output file extension: `.wav` / `.ana`  
Expected duration change: same / longer / shorter / variable  
Expected mono/stereo: ___

---

## 8. Soft Errors to Document

After running, note any errors found for `error-log.md`:

- Common mistakes: ___
- Error messages seen: ___
- Edge cases found: ___

---

## 9. cdpCommands.js Entry (generated after filling fields above)

```javascript
{
  id: 'PROGRAM_MODE',
  program: 'PROGRAM',
  mode: 'MODE',
  modeNum: null,          // or integer
  label: 'Display Label',
  category: 'CATEGORY',
  description: 'One sentence. Mention input/output format and what it does musically.',
  inputExt: ['.wav'],
  outputExt: '.wav',
  multichannel: false,
  docUrl: 'URL#ANCHOR',
  params: [
    {
      id: 'PARAMNAME',
      label: 'UI Label',
      type: 'number',       // or 'select'
      default: 8,
      min: 2,
      max: 100,
      help: 'Musical description. Include range and a concrete example.'
    }
  ],
  flags: [
    {
      id: 'c',              // single letter matching the flag
      label: 'Analysis Points',
      type: 'select',
      default: 1024,
      options: [64, 128, 256, 512, 1024, 2048, 4096],
      help: 'Written as -c1024 in the command.'
    }
  ],
}
```
