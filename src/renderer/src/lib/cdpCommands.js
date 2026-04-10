// CDP Command Catalog — verified against CDP8 official documentation
// Doc root: https://www.composersdesktop.com/docs/html/
//
// Argument order: program [mode] [modeNum] infile [infile2] outfile [params...] [-flags]
//
// Fields:
//   program    — binary name
//   mode       — first arg after binary (e.g. 'anal', 'radical', 'brassage')
//   modeNum    — integer sub-mode, placed after mode  
//   params     — positional params after outfile, in exact order
//   flags      — optional flag params formatted as -{id}{value} (e.g. -c1024)
//   inputExt   — required input extension(s)
//   outputExt  — output extension
//   twoInputs  — true if command takes two input files
//   docUrl     — link to official CDP8 documentation page

export const CDP_CATEGORIES = [
  { id: 'pvoc', label: 'PVOC — Spectral', colour: '#8b5cf6' },
  { id: 'blur', label: 'BLUR — Spectral', colour: '#06b6d4' },
  { id: 'focus', label: 'FOCUS — Spectral', colour: '#a78bfa' },
  { id: 'modify', label: 'MODIFY — Time', colour: '#3b82f6' },
  { id: 'distort', label: 'DISTORT — Waveset', colour: '#f59e0b' },
  { id: 'grain', label: 'GRAIN — Granular', colour: '#ec4899' },
  { id: 'extend', label: 'EXTEND — Time-stretch', colour: '#f97316' },
  { id: 'mix', label: 'MIX — Combine', colour: '#22c55e' },
]

export const CDP_COMMANDS = [

  // ══ PVOC ══════════════════════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cspecpvoc.htm

  {
    id: 'pvoc_anal',
    program: 'pvoc',
    mode: 'anal',
    modeNum: 1,
    label: 'PVOC Analyse',
    category: 'pvoc',
    description: 'Analyse a .wav into a spectral .ana file. REQUIRED before any PVOC/BLUR/FOCUS spectral process.',
    inputExt: ['.wav'],
    outputExt: '.ana',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecpvoc.htm',
    params: [],
    flags: [
      {
        id: 'c', label: 'Analysis Points', type: 'select', default: 1024,
        options: [64, 128, 256, 512, 1024, 2048, 4096],
        help: 'FFT analysis points. More = better frequency resolution, worse time detail. 1024 is good for clarinet. Flag format: -c1024'
      },
    ]
  },

  // Correct syntax: pvoc synth infile.ana outfile.wav
  {
    id: 'pvoc_synth',
    program: 'pvoc',
    mode: 'synth',
    modeNum: null,
    label: 'PVOC Synth',
    category: 'pvoc',
    description: 'Convert a .ana spectral file back to .wav audio. Use after BLUR or FOCUS nodes.',
    inputExt: ['.ana'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecpvoc.htm',
    params: [],
    flags: [],
  },

  // PVOC SYNTH with -P flag for pitch shift
  // Correct syntax: pvoc synth infile.ana outfile.wav -P<multiplier>
  {
    id: 'pvoc_pitch',
    program: 'pvoc',
    mode: 'synth',
    modeNum: null,
    label: 'PVOC Pitch Shift',
    category: 'pvoc',
    description: 'Spectral pitch-shift without changing duration. Input: .ana from PVOC Analyse.',
    inputExt: ['.ana'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecpvoc.htm',
    params: [
      {
        id: 'multiplier', label: 'Pitch Multiplier', type: 'number',
        default: 1.0, min: 0.0625, max: 16, flagPrefix: '-P',
        help: '0.5 = octave down, 2.0 = octave up, 1.5 = perfect fifth up, 0.75 = perfect fourth down.'
      }
    ],
    flags: [],
  },

  // ══ BLUR — Spectral blurring (SEPARATE program) ═══════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cspecblur.htm
  // All BLUR processes: input .ana → output .ana → chain to PVOC Synth

  // Correct syntax: blur blur infile.ana outfile.ana N
  {
    id: 'blur_blur',
    program: 'blur',
    mode: 'blur',
    modeNum: null,
    label: 'Blur (Time Average)',
    category: 'blur',
    description: 'Time-average the spectrum across N windows. Spectral wash/halo. Input: .ana → Output: .ana → chain to PVOC Synth.',
    inputExt: ['.ana'],
    outputExt: '.ana',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecblur.htm',
    params: [
      {
        id: 'N', label: 'Blur Windows (odd)', type: 'number',
        default: 11, min: 1, max: 201,
        help: 'Must be ODD. 11 = subtle shimmer, 51 = soft halo, 201 = heavy smear.'
      }
    ],
    flags: [],
  },

  // Correct syntax: blur avrg infile.ana outfile.ana N
  {
    id: 'blur_avrg',
    program: 'blur',
    mode: 'avrg',
    modeNum: null,
    label: 'Blur Average (Channels)',
    category: 'blur',
    description: 'Average spectral energy across N adjacent frequency channels. Input: .ana → Output: .ana',
    inputExt: ['.ana'],
    outputExt: '.ana',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecblur.htm',
    params: [
      {
        id: 'N', label: 'Adjacent Channels (odd)', type: 'number',
        default: 5, min: 1, max: 99,
        help: 'Must be ODD. Cannot exceed half the analysis points used in PVOC Anal.'
      }
    ],
    flags: [],
  },

  // Correct syntax: blur scatter infile.ana outfile.ana range
  {
    id: 'blur_scatter',
    program: 'blur',
    mode: 'scatter',
    modeNum: null,
    label: 'Blur Scatter',
    category: 'blur',
    description: 'Randomly scramble spectral windows within a range. Input: .ana → Output: .ana',
    inputExt: ['.ana'],
    outputExt: '.ana',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecblur.htm',
    params: [
      {
        id: 'range', label: 'Scatter Range', type: 'number',
        default: 20, min: 1, max: 500,
        help: 'Small = slow wandering. Large = wild scrambling of the spectrum.'
      }
    ],
    flags: [],
  },

  // ══ FOCUS — Spectral freeze (SEPARATE program) ═══════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cspecfoc.htm

  // Correct syntax: focus freeze infile.ana outfile.ana time duration
  {
    id: 'focus_freeze',
    program: 'focus',
    mode: 'freeze',
    modeNum: null,
    label: 'Focus Freeze',
    category: 'focus',
    description: 'Freeze the spectrum at a moment — infinite sustaining pad. Input: .ana → Output: .ana → chain to PVOC Synth.',
    inputExt: ['.ana'],
    outputExt: '.ana',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cspecfoc.htm',
    params: [
      {
        id: 'time', label: 'Freeze Time (s)', type: 'number',
        default: 0.5, min: 0, max: 9999,
        help: 'Moment to freeze. 0.2 = bright attack, 0.8 = body of tone.'
      },
      {
        id: 'duration', label: 'Output Duration (s)', type: 'number',
        default: 8.0, min: 0.1, max: 600,
        help: 'Length of frozen output in seconds.'
      }
    ],
    flags: [],
  },

  // ══ MODIFY ════════════════════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cgromody.htm

  // MODIFY RADICAL 1 = audio reverse (NOT modify reverse — that doesn't exist)
  // Correct syntax: modify radical 1 infile.wav outfile.wav
  {
    id: 'modify_radical_reverse',
    program: 'modify',
    mode: 'radical',
    modeNum: 1,
    label: 'Reverse (Audio)',
    category: 'modify',
    description: 'Reverse the entire soundfile (time-domain, not waveset). Mode 1 of MODIFY RADICAL.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    ambisonicNote: 'Safe for multichannel — all channels reversed simultaneously.',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#RADICAL',
    params: [],
    flags: [],
  },

  // MODIFY SPEED — correct syntax: modify speed 1 infile.wav outfile.wav ratio
  // Mode 1 = change speed by constant ratio (pitch also changes)
  {
    id: 'modify_speed',
    program: 'modify',
    mode: 'speed',
    modeNum: 1,
    label: 'Speed Change',
    category: 'modify',
    description: 'Change speed AND pitch by a ratio. Mode 1. Works on .wav directly.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#SPEED',
    params: [
      {
        id: 'ratio', label: 'Speed Ratio', type: 'number',
        default: 0.5, min: 0.01, max: 32,
        help: '0.5 = half speed (pitch drops), 2.0 = double speed (pitch rises). 0.125 = massive drone.'
      }
    ],
    flags: [],
  },

  // MODIFY LOUDNESS — correct syntax: modify loudness infile.wav outfile.wav startlevel endlevel
  {
    id: 'modify_loudness',
    program: 'modify',
    mode: 'loudness',
    modeNum: null,
    label: 'Loudness / Fade',
    category: 'modify',
    description: 'Reshape the amplitude envelope linearly from startlevel to endlevel.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#LOUDNESS',
    params: [
      {
        id: 'startlevel', label: 'Start Level (0–1)', type: 'number',
        default: 0.0, min: 0, max: 1,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'inputDuration' },
        help: '0 = silence at start, 1 = full volume. Fade-in: 0 → 1. Supports breakpoint curve.'
      },
      {
        id: 'endlevel', label: 'End Level (0–1)', type: 'number',
        default: 1.0, min: 0, max: 1,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'inputDuration' },
        // Cross-parameter constraint: endlevel should typically be >= startlevel for fade-in
        // But this is just an example - users might want fade-out (1→0) or complex curves
        constraints: [
          // No hard constraint here since fade-out (1→0) is valid
          // But we could warn if levels are inverted with constraint: { type: 'custom', fn: ... }
        ],
        help: '0 = silence at end, 1 = full volume. Fade-out: 1 → 0. Supports breakpoint curve.'
      }
    ],
    flags: [],
  },

  // MODIFY BRASSAGE 6 = full granular brassage
  // Correct syntax: modify brassage 6 infile.wav outfile.wav velocity density grainsize pitchshift amp space bsplice esplice
  {
    id: 'modify_brassage',
    program: 'modify',
    mode: 'brassage',
    modeNum: 6,
    label: 'Brassage (Granular)',
    category: 'grain',
    description: 'Full granular reconstitution. Mode 6. velocity = speed of advance (inverse of timestretch), density = grain overlap.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#BRASSAGE',
    params: [
      { id: 'velocity', label: 'Velocity (inverse stretch)', type: 'number', default: 1.0, min: 0, max: 20, help: 'Speed through source. 0.5 = stretch to 2×, 2.0 = compress to half. 0 = infinite stretch.' },
      { id: 'density', label: 'Density (grain overlap)', type: 'number', default: 1.0, min: 0.01, max: 2, help: 'Grain overlap. <1 = gaps, 1 = normal, >1 = dense. 0.01 values get unpredictable.' },
      { id: 'grainsize', label: 'Grain Size (ms)', type: 'number', default: 50, min: 10, max: 1000, help: 'Grain length in ms. 20–80ms = shimmer, 200–500ms = audible fragments.' },
      { id: 'pitchshift', label: 'Pitch Shift (semitones)', type: 'number', default: 0.0, min: -24, max: 24, help: 'Transposition in semitones (±). 0 = no pitch change.' },
      { id: 'amp', label: 'Amplitude (0–1)', type: 'number', default: 1.0, min: 0, max: 1, help: 'Grain loudness. 1.0 = unchanged.' },
      { id: 'space', label: 'Stereo Position (0–1)', type: 'number', default: 0.5, min: 0, max: 1, help: '0 = hard left, 0.5 = centre, 1 = hard right.' },
      { id: 'bsplice', label: 'Start Splice (ms)', type: 'number', default: 5, min: 1, max: 100, help: 'Fade-in of each grain in ms. Prevents clicks.' },
      { id: 'esplice', label: 'End Splice (ms)', type: 'number', default: 5, min: 1, max: 100, help: 'Fade-out of each grain in ms. Prevents clicks.' },
    ],
    flags: [],
  },

  // ══ DISTORT — Waveset ════════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cdistort.htm
  // All DISTORT processes work on MONO .wav files only.

  // Correct syntax: distort average infile.wav outfile.wav cyclecnt
  {
    id: 'distort_average',
    program: 'distort',
    mode: 'average',
    modeNum: null,
    label: 'Distort Average',
    category: 'distort',
    description: 'Average waveshape over N pseudo-wavecycles. Aphex Twin-style glitch. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#AVERAGE',
    params: [
      {
        id: 'cyclecnt', label: 'Wavecycle Count', type: 'number',
        default: 8, min: 2, max: 100,
        help: 'Wavecycles to average. Range >1. Values <10 retain original character, ~100 creates sample-hold effect.'
      }
    ],
    flags: [],
  },

  // DISTORT REVERSE — waveset cycle-reversal (NOT a simple audio reverse)
  // Correct syntax: distort reverse infile.wav outfile.wav cyclecnt
  {
    id: 'distort_reverse',
    program: 'distort',
    mode: 'reverse',
    modeNum: null,
    label: 'Distort Reverse (Wavesets)',
    category: 'distort',
    description: 'Cycle-reversal: wavesets reversed in groups. Creates granular distortion. MONO only. Note: this is waveset reversal, not full audio reverse.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#REVERSE',
    params: [
      {
        id: 'cyclecnt', label: 'Wavecycles per Group', type: 'number',
        default: 4, min: 1, max: 200,
        help: 'Number of wavecycles per reversed group. Small = grainy, large = swathes of reversed sound.'
      }
    ],
    flags: [],
  },

  // DISTORT REPEAT — timestretch by repeating wavecycles
  // Correct syntax: distort repeat infile.wav outfile.wav cyclecnt
  {
    id: 'distort_repeat',
    program: 'distort',
    mode: 'repeat',
    modeNum: null,
    label: 'Distort Repeat',
    category: 'distort',
    description: 'Timestretch by repeating wavecycles — a glitchy, artefact-rich stretch. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#REPEAT',
    params: [
      {
        id: 'cyclecnt', label: 'Repeat Count', type: 'number',
        default: 4, min: 1, max: 100,
        help: 'How many times each wavecycle is repeated. Higher = longer and more distorted.'
      }
    ],
    flags: [],
  },

  // DISTORT MULTIPLY — waveset multiplication
  // Correct syntax: distort multiply infile.wav outfile.wav N
  {
    id: 'distort_multiply',
    program: 'distort',
    mode: 'multiply',
    modeNum: null,
    label: 'Distort Multiply',
    category: 'distort',
    description: 'Multiply waveform by itself N times. Creates heavy distortion. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#MULTIPLY',
    params: [
      {
        id: 'N', label: 'Multiplier (N)', type: 'number',
        default: 2, min: 1, max: 10,
        help: 'Number of times to multiply. 2 = square of input, 3 = cube, etc.'
      }
    ],
    flags: [],
  },

  // DISTORT HARMONIC — waveset harmonic distortion
  // Correct syntax: distort harmonic infile.wav outfile.wav N
  {
    id: 'distort_harmonic',
    program: 'distort',
    mode: 'harmonic',
    modeNum: null,
    label: 'Distort Harmonic',
    category: 'distort',
    description: 'Harmonic distortion by adding harmonics of the fundamental. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#HARMONIC',
    params: [
      {
        id: 'N', label: 'Harmonic Level (N)', type: 'number',
        default: 2, min: 1, max: 10,
        help: 'Amount of harmonic content added.'
      }
    ],
    flags: [],
  },

  // DISTORT INTERPOLATE — waveset interpolation
  // Correct syntax: distort interpolate infile.wav outfile.wav N
  {
    id: 'distort_interpolate',
    program: 'distort',
    mode: 'interpolate',
    modeNum: null,
    label: 'Distort Interpolate',
    category: 'distort',
    description: 'Interpolates between wave cycles. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#INTERPOLATE',
    params: [
      {
        id: 'N', label: 'Interpolation (N)', type: 'number',
        default: 2, min: 1, max: 10,
        help: 'Interpolation factor.'
      }
    ],
    flags: [],
  },

  // DISTORT PITCH — waveset pitch shift
  // Correct specification: distort pitch infile.wav outfile.wav semitones
  {
    id: 'distort_pitch',
    program: 'distort',
    mode: 'pitch',
    modeNum: null,
    label: 'Distort Pitch',
    category: 'distort',
    description: 'Pitch shift via waveset manipulation. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#PITCH',
    params: [
      {
        id: 'semitones', label: 'Semitones', type: 'number',
        default: 0, min: -12, max: 12,
        help: 'Shift pitch by semitones.'
      }
    ],
    flags: [],
  },

  // SCRAMBLE 1 — simple scrambler
  // Correct syntax: scramble 1 infile.wav outfile.wav dur seed
  {
    id: 'scramble_1',
    program: 'scramble',
    mode: '1',
    modeNum: null,
    label: 'Scramble (Mode 1)',
    category: 'distort',
    description: 'Scrambles audio based on duration and seed. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#SCRAMBLE',
    params: [
      {
        id: 'dur', label: 'Duration (s)', type: 'number',
        default: 1.0, min: 0.1, max: 60,
        help: 'Duration of the scramble effect.'
    },
      {
        id: 'seed', label: 'Seed', type: 'number',
        default: 0, min: 0, max: 999999,
        help: 'Random seed.'
      }
    ],
    flags: [],
  },

  // DISTORT OMIT — omit parts of the waveform
  // Correct syntax: distort omit infile.wav outfile.wav A B
  {
    id: 'distort_omit',
    program: 'distort',
    mode: 'omit',
    modeNum: null,
    label: 'Distort Omit',
    category: 'distort',
    description: 'Omits parts of the waveform between A and B. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#OMIT',
    params: [
      {
        id: 'A', label: 'Start Point (A)', type: 'number',
        default: 0.1, min: 0, max: 1,
        help: 'Start of omission range (fraction of cycle).'
      },
      {
        id: 'B', label: 'End Point (B)', type: 'number',
        default: 0.9, min: 0, max: 1,
        help: 'End of omission range (fraction of cycle).'
      }
    ],
    flags: [],
  },

  // DISTORT DELETE — delete cycles after N cycles
  // Correct syntax: distort delete infile.wav outfile.wav cyclecnt
  {
    id: 'distort_delete',
    program: 'distort',
    mode: 'delete',
    modeNum: null,
    label: 'Distort Delete',
    category: 'distort',
    description: 'Deletes waveset cycles after N cycles. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#DELETE',
    params: [
      {
        id: 'cyclecnt', label: 'Cycle Count', type: 'number',
        default: 10, min: 1, max: 1000,
        help: 'Number of cycles to keep before deleting.'
      }
    ],
    flags: [],
  },

  // ══ MIX — Combine ════════════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cgromixr.htm

  // SUBMIX BALANCE — mix two files with a balance control
  // Correct syntax: submix balance sndfile1 sndfile2 outfile [-kbalance]
  {
    id: 'submix_balance',
    program: 'submix',
    mode: 'balance',
    modeNum: null,
    label: 'Mix (2 files)',
    category: 'mix',
    description: 'Mix two soundfiles together. Balance controls relative level: 0 = all B, 1 = all A, 0.5 = equal.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    twoInputs: true,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromixr.htm',
    params: [],
    flags: [],
  },

  // ══ EXTEND — Time-stretch ═════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cextend.htm

  // EXTEND DRUNK (Mode 1 only) — Drunken walk through source file
  // Correct syntax: extend drunk 1 infile outfile outdur locus ambitus step clock [-ssplicelen] [-cclokrand] [-ooverlap] [-rseed]
  {
    id: 'extend_drunk',
    program: 'extend',
    mode: 'drunk',
    modeNum: 1,
    label: 'Extend Drunk (Mode 1)',
    category: 'extend',
    description: 'MODE 1 ONLY: Drunken walk through source. Splice segments end-to-end with random start times chosen by a drunken walk. outdur, locus, ambitus, step, clock may vary over time via breakpoint files.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    docUrl: 'https://composersdesktop.com/docs/html/cgroextd.htm',
    params: [
      {
        id: 'outdur', label: 'Output Duration', type: 'number',
        default: 10, min: 0.1, max: 3600,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'self' },  // Uses its own value as max time
        help: 'Total minimum duration of output (seconds). Breakpoint: LH col = outfile time, RH col = time in infile.'
      },
      {
        id: 'locus', label: 'Locus', type: 'number',
        default: 1, min: 0, max: 3600,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'outputDuration', param: 'outdur' },
        // Dynamic limits: max is input file duration
        dependsOn: {
          min: { type: 'constant', value: 0 },
          max: { type: 'inputDuration', fallback: 3600 }
        },
        help: 'Center time in source for drunken walk (seconds). Constant = fixed position in infile. Breakpoint: LH col = outfile time, RH col = infile time. Max = input duration.'
      },
      {
        id: 'ambitus', label: 'Ambitus', type: 'number',
        default: 0.5, min: 0.01, max: 3600,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'outputDuration', param: 'outdur' },
        // Dynamic limits: max is half of input duration
        dependsOn: {
          min: { type: 'constant', value: 0.01 },
          max: { type: 'inputDuration', scale: 0.5, fallback: 1800 }
        },
        help: 'Half-width of region to read segments from (seconds). Breakpoint: LH col = outfile time, RH col = half-width in seconds. Max = half input duration.'
      },
      {
        id: 'step', label: 'Step', type: 'number',
        default: 0.5, min: 0.002, max: 3600,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'outputDuration', param: 'outdur' },
        // Step must be > 0.002 and auto-adjusted if larger than ambitus
        dependsOn: {
          min: { type: 'constant', value: 0.002 },
          max: { type: 'inputDuration', fallback: 3600 }
        },
        help: 'Max random step between segment reads (seconds, > 0.002). Auto-adjusted if larger than ambitus. Breakpoint: LH col = outfile time, RH col = step in seconds.'
      },
      {
        id: 'clock', label: 'Clock', type: 'number',
        default: 0.1, min: 0.032, max: 3600,
        supportsBreakpoint: true,
        breakpointTimeDomain: { type: 'outputDuration', param: 'outdur' },
        // Clock must be > 0.03 (2x default splice length of 15ms)
        // Also must be > splicelen * 2 when s flag is used
        dependsOn: {
          min: { type: 'constant', value: 0.032 },
          max: { type: 'inputDuration', fallback: 3600 }
        },
        help: 'Time between segment reads = segment duration (seconds, > splicelen * 2). Breakpoint: LH col = outfile time, RH col = clock in seconds. Must be > 0.03s.'
      },
    ],
    flags: [
      { id: 's', label: 'Splice Length', type: 'number', default: 15, min: 0, max: 1000, help: 'Splice slope length (ms). Default: 15. Clock must be > splicelen * 2.' },
      { id: 'c', label: 'Clock Randomisation', type: 'number', default: 0, min: 0, max: 1, help: 'Randomisation of clock ticks (0-1). Default: 0.' },
      { id: 'o', label: 'Overlap', type: 'number', default: 0, min: 0, max: 0.99, help: 'Mutual overlap of segments in output (0-0.99). Default: 0.' },
      { id: 'r', label: 'Seed', type: 'number', default: 0, min: 0, max: 999999, help: 'Any non-zero value gives reproducible output. Default: 0 (random).' },
    ],
  },

  // EXTEND DRUNK (Mode 2) — Drunken walk with sober holds
  // Correct syntax: extend drunk 2 infile outfile outdur locus ambitus step clock mindrnk maxdrnk [-ssplicelen] [-cclokrand] [-ooverlap] [-rseed] [-llosober] [-hhisober]
  {
    id: 'extend_drunk_2',
    program: 'extend',
    mode: 'drunk',
    modeNum: 2,
    label: 'Extend Drunk (Mode 2)',
    category: 'extend',
    description: 'Mode 2: Drunken walk with sober holds. The file plays straight at random intervals between drunk segments, creating alternating textured and clear passages.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgroextd.htm',
    params: [
      {
        id: 'outdur', label: 'Output Duration', type: 'number',
        default: 10, min: 0.1, max: 3600,
        supportsBreakpoint: true,
        help: 'Total minimum duration of output (seconds).'
      },
      {
        id: 'locus', label: 'Locus', type: 'number',
        default: 1, min: 0, max: 3600,
        supportsBreakpoint: true,
        help: 'Center time in source for drunken walk (seconds). Breakpoint: LH col = outfile time, RH col = infile time.'
      },
      {
        id: 'ambitus', label: 'Ambitus', type: 'number',
        default: 0.5, min: 0.01, max: 3600,
        supportsBreakpoint: true,
        help: 'Half-width of region to read segments from (seconds). The full ambit = 2 × ambitus, centered on locus.'
      },
      {
        id: 'step', label: 'Step', type: 'number',
        default: 0.5, min: 0.002, max: 3600,
        supportsBreakpoint: true,
        help: 'Max random step between segment reads (seconds, > 0.002). Auto-adjusted if larger than ambitus.'
      },
      {
        id: 'clock', label: 'Clock', type: 'number',
        default: 0.1, min: 0.032, max: 3600,
        supportsBreakpoint: true,
        help: 'Time between segment reads = segment duration (seconds, > splicelen × 2). Must be > 0.03s.'
      },
      {
        id: 'mindrnk', label: 'Min Sober Ticks', type: 'number',
        default: 10, min: 1, max: 32767,
        help: 'Minimum number of clock ticks between sober plays (1–32767). Lower = more frequent sober sections.'
      },
      {
        id: 'maxdrnk', label: 'Max Sober Ticks', type: 'number',
        default: 30, min: 1, max: 32767,
        help: 'Maximum number of clock ticks between sober plays (1–32767). Higher = longer gaps between sober sections.'
      },
    ],
    flags: [
      { id: 's', label: 'Splice Length', type: 'number', default: 15, min: 0, max: 1000, help: 'Splice slope length (ms). Default: 15. Clock must be > splicelen × 2.' },
      { id: 'c', label: 'Clock Randomisation', type: 'number', default: 0, min: 0, max: 1, help: 'Randomisation of clock ticks (0–1). Default: 0.' },
      { id: 'o', label: 'Overlap', type: 'number', default: 0, min: 0, max: 0.99, help: 'Mutual overlap of segments in output (0–0.99). Default: 0.' },
      { id: 'r', label: 'Seed', type: 'number', default: 0, min: 0, max: 999999, help: 'Any non-zero value gives reproducible output. Default: 0 (random).' },
      { id: 'l', label: 'Min Sober Duration', type: 'number', default: 0, min: 0, max: 3600, help: 'Minimum duration of sober plays (seconds). 0 = use CDP default. If ≥ infile duration, all sober plays go to end.' },
      { id: 'h', label: 'Max Sober Duration', type: 'number', default: 0, min: 0, max: 3600, help: 'Maximum duration of sober plays (seconds). 0 = use CDP default.' },
    ],
  },

  // EXTEND LOOP (Mode 1) — Loop segments until file exhausted
  // Correct syntax: extend loop 1 infile outfile start len step [-w splen] [-s scat] [-b]
  {
    id: 'extend_loop',
    program: 'extend',
    mode: 'loop',
    modeNum: 1,
    label: 'Loop (Mode 1)',
    category: 'extend',
    description: 'Loop a segment, advancing through the source file until it is exhausted. Mode 1.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgroextd.htm#LOOP',
    params: [
      {
        id: 'start', label: 'Start Time (s)', type: 'number',
        default: 0.0, min: 0, max: 3600,
        supportsBreakpoint: true,
        help: 'Time in source where looping begins (seconds).'
      },
      {
        id: 'len', label: 'Loop Length (ms)', type: 'number',
        default: 500, min: 1, max: 10000,
        supportsBreakpoint: true,
        help: 'Length of each looped segment in milliseconds.'
      },
      {
        id: 'step', label: 'Step (ms)', type: 'number',
        default: 100, min: 0, max: 10000,
        supportsBreakpoint: true,
        help: 'Advance in source from start of one loop to the next (ms). 0 = repeat same segment.'
      },
    ],
    flags: [
      { id: 'w', label: 'Splice Length', type: 'number', default: 25, min: 0, max: 1000, help: 'Length of splice in ms. Default: 25.' },
      { id: 's', label: 'Scatter', type: 'number', default: 0, min: 0, max: 1, help: 'Make step advance irregularly, within the timeframe given. 0 = no scatter.' },
    ],
  },

  // BOUNCE — Accelerating repeats, decaying in level
  // Correct syntax: bounce bounce inf outf count startgap shorten endlevel ewarp [-smin] [-c | -e]
  {
    id: 'extend_bounce',
    program: 'bounce',
    mode: 'bounce',
    modeNum: null,
    label: 'Bounce',
    category: 'extend',
    description: 'Accelerating repeats with decaying level — like a bouncing ball. Each repeat gets closer together and quieter.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cr8new.htm#BOUNCE',
    params: [
      {
        id: 'count', label: 'Bounce Count', type: 'number',
        default: 8, min: 1, max: 100,
        help: 'Number of repetitions. More = longer bounce sequence.'
      },
      {
        id: 'startgap', label: 'Start Gap (s)', type: 'number',
        default: 1.0, min: 0.04, max: 10,
        help: 'Initial gap between source and first repeat (seconds). Smaller = faster bounce feel.'
      },
      {
        id: 'shorten', label: 'Shorten Multiplier', type: 'number',
        default: 0.8, min: 0.1, max: 1,
        help: 'Each gap is this fraction of the previous. 0.5 = halves each time (fast accel), 1.0 = no acceleration.'
      },
      {
        id: 'endlevel', label: 'End Level', type: 'number',
        default: 0.1, min: 0, max: 1,
        help: 'Final volume as fraction of source. 0 = silence at end, 1 = no decay.'
      },
      {
        id: 'ewarp', label: 'Decay Warp', type: 'number',
        default: 1.0, min: 0.1, max: 100,
        help: 'Shapes the decay curve. >1 = fast decay then tail off, <1 = slow decay then sudden drop.'
      },
    ],
    flags: [
      { id: 's', label: 'Min Element Length', type: 'number', default: 0, min: 0, max: 1, help: 'Minimum length of bounced elements (0-1). 0 = no shrinkage. Elements shrink with the acceleration.' },
      { id: 'c', label: 'Cut Overlap', type: 'number', default: 0, min: 0, max: 1, help: 'If repeats overlap, cut to avoid clipping. 1 = enable. WARNING: do not use with -e flag.' },
      { id: 'e', label: 'Shrink From Start', type: 'number', default: 0, min: 0, max: 1, help: 'Shrink elements by trimming start instead of end. 1 = enable. WARNING: do not use with -c flag.' },
    ],
  },

  // ══ MODIFY BRASSAGE Sub-modes ════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cgromody.htm#BRASSAGE

  // MODIFY BRASSAGE 1 — Pitchshift only
  // Correct syntax: modify brassage 1 infile outfile pitchshift
  {
    id: 'modify_brassage_1',
    program: 'modify',
    mode: 'brassage',
    modeNum: 1,
    label: 'Brassage Pitch (Mode 1)',
    category: 'modify',
    description: 'Granular pitch-shift while retaining (more or less) the same duration. Mode 1.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#BRASSAGE',
    params: [
      {
        id: 'pitchshift', label: 'Pitch Shift (semitones)', type: 'number',
        default: 0, min: -24, max: 24,
        supportsBreakpoint: true,
        help: 'Transposition in semitones. 0 = no change, 12 = octave up, -12 = octave down.'
      },
    ],
    flags: [],
  },

  // MODIFY BRASSAGE 2 — Timestretch only (velocity)
  // Correct syntax: modify brassage 2 infile outfile velocity
  {
    id: 'modify_brassage_2',
    program: 'modify',
    mode: 'brassage',
    modeNum: 2,
    label: 'Brassage Time (Mode 2)',
    category: 'modify',
    description: 'Granular timestretch/compression while retaining the same pitch. Mode 2.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#BRASSAGE',
    params: [
      {
        id: 'velocity', label: 'Velocity', type: 'number',
        default: 1.0, min: 0, max: 20,
        supportsBreakpoint: true,
        help: 'Speed of advance relative to output. 1 = no stretch, 0.5 = 2× longer, 2 = 2× shorter. 0 = infinite stretch.'
      },
    ],
    flags: [],
  },

  // MODIFY BRASSAGE 5 — Granulate/texture
  // Correct syntax: modify brassage 5 infile outfile density
  {
    id: 'modify_brassage_5',
    program: 'modify',
    mode: 'brassage',
    modeNum: 5,
    label: 'Brassage Granulate (Mode 5)',
    category: 'modify',
    description: 'Granulate the source — put a grainy surface on the sound. Mode 5.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#BRASSAGE',
    params: [
      {
        id: 'density', label: 'Density', type: 'number',
        default: 1.0, min: 0.01, max: 2,
        supportsBreakpoint: true,
        help: 'Grain overlap. 1.0 = normal, <1 = gaps (pointillist), >1 = dense/overlapping. Very small values are unpredictable.'
      },
    ],
    flags: [],
  },

  // ══ MODIFY RADICAL Sub-modes ══════════════════════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cgromody.htm#RADICAL

  // MODIFY RADICAL 2 — Shred
  // Correct syntax: modify radical 2 infile outfile repeats chunklen [-s scatter] [-n]
  {
    id: 'modify_radical_shred',
    program: 'modify',
    mode: 'radical',
    modeNum: 2,
    label: 'Shred (Mode 2)',
    category: 'modify',
    description: 'Shred the sound: randomly segment and reorder chunks within existing duration. Mode 2.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#RADICAL',
    params: [
      {
        id: 'repeats', label: 'Repeat Count', type: 'number',
        default: 3, min: 1, max: 100,
        supportsBreakpoint: true,
        help: 'Number of times to shred. More = more jumbled. 1 = single pass.'
      },
      {
        id: 'chunklen', label: 'Chunk Length (s)', type: 'number',
        default: 0.1, min: 0.001, max: 10,
        supportsBreakpoint: true,
        help: 'Average length of chunks to cut and permutate (seconds).'
      },
    ],
    flags: [
      { id: 's', label: 'Scatter', type: 'number', default: 1, min: 0, max: 100, help: 'Randomisation of cuts. 0 = reorder without shredding.' },
    ],
  },

  // MODIFY RADICAL 5 — Ring Modulation
  // Correct syntax: modify radical 5 infile outfile modulating-frq
  {
    id: 'modify_radical_ringmod',
    program: 'modify',
    mode: 'radical',
    modeNum: 5,
    label: 'Ring Mod (Mode 5)',
    category: 'modify',
    description: 'Ring modulate: multiply audio by a sine wave at given frequency. Creates hollow, metallic sound. Mode 5.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#RADICAL',
    params: [
      {
        id: 'modulatingFrq', label: 'Modulator Freq (Hz)', type: 'number',
        default: 440, min: 0.01, max: 20000,
        supportsBreakpoint: true,
        help: 'Frequency of the modulating sine wave in Hz. Try: 50-200 (drone), 440-1000 (metallic), 2000+ (chipmunk).'
      },
    ],
    flags: [],
  },

]

export function getCommandsByCategory(categoryId) {
  return CDP_COMMANDS.filter(c => c.category === categoryId)
}

export function getCommandById(id) {
  return CDP_COMMANDS.find(c => c.id === id)
}

export function getMultichannelCommands() {
  return CDP_COMMANDS.filter(c => c.multichannel === true)
}

export const CHANNEL_FORMATS = {
  'mono': { label: 'Mono', channels: 1, colour: '#64748b' },
  'stereo': { label: 'Stereo', channels: 2, colour: '#3b82f6' },
  '4ch': { label: '4ch (FOA)', channels: 4, colour: '#8b5cf6', ambisonic: true, order: 1 },
  '9ch': { label: '9ch (HOA2)', channels: 9, colour: '#ec4899', ambisonic: true, order: 2 },
  '16ch': { label: '16ch (HOA3)', channels: 16, colour: '#f59e0b', ambisonic: true, order: 3 },
}
