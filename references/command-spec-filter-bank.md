---
name: command-spec-filter-bank
description: Specification for the CDP 'filter bank' command
type: project
---
Command: `filter bank [mode] infile outfile Q gain lofrq hifrq [-sscat] [-d]`
Mode: 1, 2, or 3
Parameters:
- Q: Quality factor (float)
- gain: Gain (float)
- lofrq: Low frequency (float)
- hifrq: High frequency (float)
Flags:
- -sscat: (boolean)
- -d: (boolean)
