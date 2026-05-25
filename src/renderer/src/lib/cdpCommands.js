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
  { id: 'filter', label: 'FILTER', colour: '#d47500ff' },
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

  // ══ FILTER — Bank/Frequency filtering ══════════════════════════
  // Doc: https://www.composmentsdesktop.com/docs/html/cgrofilt.htm
  // Command: filter bank [1-3] infile outfile Q gain lofrq hifrq [-sscat] [-d]
  {
    id: 'filter_bank',
    program: 'filter',
    mode: 'bank',
    modeNum: 'param:mode', // Fetch mode number from the 'mode' parameter select box
    label: 'Filter Bank (Modes 1-3)',
    category: 'filter',
    description: 'Apply a frequency bandpass filter using bank modes 1, 2, or 3. Mode 1 = fixed, 2 = sweeping, 3 = variable.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrofilt.htm#BANK',
    params: [
      {
        id: 'mode', label: 'Mode', type: 'select', default: 1,
        options: [1, 2, 3],
        help: '1 = fixed band, 2 = sweeping band, 3 = variable band.'
      },
      {
        id: 'Q', label: 'Q', type: 'number', default: 1.0, min: 0.1, max: 10000,
        help: 'Bandwidth sharpness. Higher = narrower.'
      },
      {
        id: 'gain', label: 'Gain (dB)', type: 'number', default: 0.001, min: 0.001, max: 10000,
        help: 'Gain applied to the band.'
      },
      {
        id: 'lofrq', label: 'Low Freq (Hz)', type: 'number', default: 100, min: 1, max: 20000,
        help: 'Lower boundary of the filter band.'
      },
      {
        id: 'hifrq', label: 'High Freq (Hz)', type: 'number', default: 5000, min: 1, max: 20000,
        help: 'Upper boundary of the filter band.'
      }
    ],
    flags: [
      { id: 's', label: 'SSCAT', type: 'number', default: 0, min: 0, max: 1, step: 0.01, help: 'SSCAT value (0 to 1). Only used when sscat mode is active.' },
      { id: 'd', label: 'Debug', type: 'boolean', default: false, help: 'Enable debug output to terminal.' },
    ],
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

  // Correct syntax: distort average infile.wav outfile.wav cyclecnt [-mmaxwavelen] [-sskipcycles]
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
    flags: [
      { id: 'm', label: 'Max Wavelength (s)', type: 'number', default: 0.5, min: 0.01, max: 10, help: 'Maximum permissible wavelength in seconds. Default: 0.50' },
      { id: 's', label: 'Skip Cycles', type: 'number', default: 0, min: 0, max: 1000000, help: 'Number of wavecycles to skip at start.' },
    ],
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
  // Correct syntax: distort repeat infile.wav outfile.wav multiplier [-ccyclecnt] [-sskipcycles]
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
        id: 'multiplier', label: 'Multiplier', type: 'number',
        default: 4, min: 1, max: 100,
        help: 'Number of times each wavecycle (or group) is repeated.'
      }
    ],
    flags: [
      { id: 'c', label: 'Cycle Group Size', type: 'number', default: 1, min: 1, max: 1024, help: 'Size of wavecycle groups to be copied. Default: 1.' },
      { id: 's', label: 'Skip Cycles', type: 'number', default: 0, min: 0, max: 1000000, help: 'Number of wavecycles to skip at start.' },
    ],
  },

  // DISTORT MULTIPLY — waveset multiplication
  // Correct syntax: distort multiply infile.wav outfile.wav N [-s]
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
        default: 2, min: 2, max: 16,
        help: 'Number of times to multiply. 2 = square of input, 3 = cube, etc.'
      }
    ],
    flags: [
      { id: 's', label: 'Smooth', type: 'boolean', default: false, help: 'Enable smoothing.' },
    ],
  },

  // Correct syntax: distort harmonic infile.wav outfile.wav harmonics-file [-ppre_attenuation]
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
        id: 'harmonics', label: 'Harmonics Profile', type: 'number',
        default: 1, min: 1, max: 100,
        supportsBreakpoint: true,
        help: 'Harmonic profile (harmonic_number amplitude pairs). Breakpoint curve: X = harmonic number, Y = amplitude.'
      }
    ],
    flags: [
      { id: 'p', label: 'Pre-attenuation', type: 'number', default: 0, min: 0, max: 1, help: 'Scale input volume before processing (0-1).' },
    ],
  },

  // Correct syntax: distort interpolate infile.wav outfile.wav multiplier [-sskipcycles]
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
        id: 'multiplier', label: 'Multiplier', type: 'number',
        default: 2, min: 1, max: 100,
        help: 'Number of times each wavecycle repeats.'
      }
    ],
    flags: [
      { id: 's', label: 'Skip Cycles', type: 'number', default: 0, min: 0, max: 1000000, help: 'Number of wavecycles to skip at start.' },
    ],
  },

  // Correct syntax: distort pitch infile.wav outfile.wav octvary [-ccyclelen] [-sskipcycles]
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
        id: 'octvary', label: 'Octave Variation', type: 'number',
        default: 0.5, min: 0.01, max: 4,
        help: 'Maximum possible transposition up or down (fractions of octaves).'
      }
    ],
    flags: [
      { id: 'c', label: 'Cycle Interval', type: 'number', default: 1, min: 1, max: 1024, help: 'Max cycles between new transposition values.' },
      { id: 's', label: 'Skip Cycles', type: 'number', default: 0, min: 0, max: 1000000, help: 'Number of wavecycles to skip at start.' },
    ],
  },

  // Correct syntax: scramble scramble mode infile outfile dur seed [-ccnt] [-ttrns] [-aatten]
  {
    id: 'scramble_1',
    program: 'scramble',
    mode: 'scramble',
    modeNum: 1,
    label: 'Scramble (Mode 1)',
    category: 'distort',
    description: 'Scrambles audio based on duration and seed. MONO only. Mode 1: simple scramble.',
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
        default: 123, min: 0, max: 999999,
        help: 'Random seed for reproducible scrambling.'
      }
    ],
    flags: [
      { id: 'c', label: 'Group Size', type: 'number', default: 1, min: 1, max: 100, help: 'Number of wavesets in groups.' },
      { id: 't', label: 'Transposition (st)', type: 'number', default: 0, min: 0, max: 24, help: 'Random transposition range in semitones.' },
      { id: 'a', label: 'Attenuation (dB)', type: 'number', default: 0, min: 0, max: 96, help: 'Random attenuation range in dB.' },
    ],
  },

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
        id: 'A', label: 'Omit Count (A)', type: 'number',
        default: 1, min: 1, max: 1000,
        help: 'Number of wavecycles to omit.'
      },
      {
        id: 'B', label: 'Group Size (B)', type: 'number',
        default: 10, min: 1, max: 1000,
        help: 'Size of group of wavecycles out of which to omit A.'
      }
    ],
    flags: [],
  },

  // Correct syntax: distort delete mode infile.wav outfile.wav cyclecnt [-sskipcycles]
  {
    id: 'distort_delete',
    program: 'distort',
    mode: 'delete',
    modeNum: 'param:mode',
    label: 'Distort Delete',
    category: 'distort',
    description: 'Deletes waveset cycles using different selection modes. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#DELETE',
    params: [
      {
        id: 'mode', label: 'Mode', type: 'select', default: 1,
        options: [1, 2, 3],
        help: '1 = average cycles, 2 = strongest, 3 = weakest.'
      },
      {
        id: 'cyclecnt', label: 'Cycle Count', type: 'number',
        default: 10, min: 1, max: 1000,
        help: 'Number of cycles to evaluate in groups.'
      }
    ],
    flags: [
      { id: 's', label: 'Skip Cycles', type: 'number', default: 0, min: 0, max: 1000000, help: 'Number of wavecycles to skip at start.' },
    ],
  },

  // Correct syntax: distort shuffle infile.wav outfile.wav domain-image [-ccyclecnt] [-sskipcycles]
  {
    id: 'distort_shuffle',
    program: 'distort',
    mode: 'shuffle',
    modeNum: null,
    label: 'Distort Shuffle',
    category: 'distort',
    description: 'Scramble cycles based on a "domain image" map. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#SHUFFLE',
    params: [
      {
        id: 'domain', label: 'Shuffle Map', type: 'number',
        default: 0, min: 0, max: 1,
        supportsBreakpoint: true,
        help: 'Breakpoints defining the shuffle map (domain image).'
      }
    ],
    flags: [
      { id: 'c', label: 'Group Size', type: 'number', default: 1, min: 1, max: 100, help: 'Number of cycles in a group.' },
      { id: 's', label: 'Skip Cycles', type: 'number', default: 0, min: 0, max: 1000000, help: 'Number of wavecycles to skip at start.' },
    ],
  },

  // Correct syntax: distort reform mode infile.wav outfile.wav [exaggeration]
  {
    id: 'distort_reform',
    program: 'distort',
    mode: 'reform',
    modeNum: 'param:mode',
    label: 'Distort Reform',
    category: 'distort',
    description: 'Reshape wavecycles into basic waveforms. MONO only.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://www.composersdesktop.com/docs/html/cdistort.htm#REFORM',
    params: [
      {
        id: 'mode', label: 'Reform Mode', type: 'select', default: 1,
        options: [1, 2, 3, 4, 5, 6, 7, 8],
        help: '1:Fixed Square, 2:Square, 3:Fixed Triangle, 4:Triangle, 5:Inverted, 6:Click, 7:Sinusoid, 8:Exaggerate'
      },
      {
        id: 'exaggeration', label: 'Exaggeration (Mode 8)', type: 'number',
        default: 1.0, min: 0.1, max: 10,
        showIf: { paramId: 'mode', value: 8 },
        help: 'Only used for Mode 8 (Exaggerate Contour).'
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

    // ══ SORTER — Sort / Reorder Elements ═══════════════════════════
    // Doc: https://www.composersdesktop.com/docs/html/cgromody.htm#SORTER

    // Correct syntax: sorter sorter <mode> infile outfile esiz [-ssmooth] [-oopch] [-ppch] [-mmeta] [-f]
    {
     id: 'sorter',
     program: 'sorter',
     mode: 'sorter',
     modeNum: 'param:mode',
     label: 'Sorter (Reorder Elements)',
     category: 'modify',
     description: 'Segment audio and reorder by loudness, speed, or randomly. MONO only.',
     inputExt: ['.wav'],
     outputExt: '.wav',
     multichannel: false,
     docUrl: 'https://www.composersdesktop.com/docs/html/cgromody.htm#SORTER',
     params: [
        {
         id: 'mode', label: 'Sort Mode', type: 'select', default: 1,
         options: [1, 2, 3, 4, 5],
         help: '1=Crescendo (loudness ↑), 2=Decrescendo (loudness ↓), 3=Accelerando (speed ↑), 4=Ritardando (speed ↓), 5=Random'
        },
        {
         id: 'esiz', label: 'Element Size (s)', type: 'number',
         default: 0.1, min: 0, max: 60,
         showIf: { paramId: 'mode', valueNot: 5 },
         help: 'Segment length in seconds. 0 = use individual wavesets. Larger values create bigger chunks. Max = source duration.'
        },
        {
         id: 'seed', label: 'Random Seed', type: 'number',
         default: 0, min: 0, max: 256,
         showIf: { paramId: 'mode', value: 5 },
         help: 'Mode 5 only: 0 = different order each run, 1-256 = reproducible ordering.'
        }
      ],
     flags: [
        { id: 's', label: 'Smooth (splice ms)', type: 'number', default: 0, min: 0, max: 50, help: 'Fade splice between segments in ms. Ignored if element size is 0.' },
        { id: 'o', label: 'Pitch Spacing (MIDI)', type: 'number', default: 0, min: 0, max: 128, help: 'Space elements by this many semitones apart. 0=ignore, 128=use median pitch with -f flag.' },
        { id: 'p', label: 'Transpose To (MIDI)', type: 'number', default: 0, min: 0, max: 128, help: 'Re-pitch elements to this MIDI note. Requires -f flag. 0=ignore, 128=median pitch.' },
        { id: 'm', label: 'Meta Group Size (s)', type: 'number', default: 0, min: 0, max: 60, help: 'Group elements in larger chunks while preserving pitch correlation. Requires -f and -p flags.' },
        { id: 'f', label: 'Frequency Mode', type: 'boolean', default: false, help: 'Read element size as frequency (1/duration). Enables -p and -m flags.' }
      ]
    },

  // ══ DVDWIND — DVD Fast-Wind Shortening ════════════════════════════
  // Doc: https://composersdesktop.com/docs/html/cgroextd.htm#DVDWIND
  // Correct syntax: dvdwind dvdwind infile outfile contraction clipsize

  {
    id: 'extend_dvdwind',
    program: 'dvdwind',
    mode: 'dvdwind',
    modeNum: null,
    label: 'DVD Wind',
    category: 'extend',
    description: 'Shortens a sound by read-skip-read-skip, simulating DVD fast-forward. Each retained clip is clipsize ms long, separated by skipped sections.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://composersdesktop.com/docs/html/cgroextd.htm#DVDWIND',
    params: [
      {
        id: 'contraction', label: 'Contraction (>1)', type: 'number',
        default: 4, min: 1.01, max: 100,
        help: 'Time-compression ratio, must be greater than 1. 2 = half length, 4 = quarter length, 10 = 10× shorter.'
      },
      {
        id: 'clipsize', label: 'Clip Size (ms)', type: 'number',
        default: 50, min: 1, max: 2000,
        help: 'Duration of each retained audio clip in milliseconds. Smaller = more staccato fast-forward feel. Larger = more continuous.'
      },
    ],
    flags: [],
  },

  // ══ EXTEND SCRAMBLE — Scramble soundfile ════════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cgroextd.htm#SCRAMBLE
  // Correct syntax: extend scramble 1 infile outfile minseglen maxseglen outdur [-w splen] [-s seed] [-b] [-e]
  // Useful as a source generator for further processing — output can be fed into other EXTEND or MODIFY nodes.

  {
    id: 'extend_scramble_1',
    program: 'extend',
    mode: 'scramble',
    modeNum: 1,
    label: 'Scramble (Overlapping — Mode 1)',
    category: 'extend',
    description: 'Cut random overlapping chunks from source and splice them end-to-end. Sections may repeat or be entirely skipped. Useful as a source generator for further processing.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgroextd.htm#SCRAMBLE',
    params: [
      {
        id: 'minseglen', label: 'Min Chunk (s)', type: 'number',
        default: 0.1, min: 0.045, max: 60,
        dependsOn: {
          max: { type: 'inputDuration', fallback: 60 }
        },
        help: 'Minimum segment length in seconds (>= 0.045). Smaller = more fragmented, glitchy result. 0.1–0.5 = granular texture, 1.0+ = recognisable fragments.'
      },
      {
        id: 'maxseglen', label: 'Max Chunk (s)', type: 'number',
        default: 2.0, min: 0.045, max: 60,
        dependsOn: {
          max: { type: 'inputDuration', fallback: 60 }
        },
        constraints: [
          { type: 'gtParam', param: 'minseglen' }
        ],
        help: 'Maximum segment length in seconds. Must be > Min Chunk. 0.5–2.0 = speech rhythm, 3.0+ = large structural reordering.'
      },
      {
        id: 'outdur', label: 'Output Duration (s)', type: 'number',
        default: 10, min: 0.1, max: 100,
        help: 'Total output duration in seconds. Must exceed maxseglen. 10–30s = short textures, 30–100s = extended generative passages.'
      },
    ],
    flags: [
      { id: 'w', label: 'Splice Length (ms)', type: 'number', default: 25, min: 0, max: 1000, help: 'Crossfade between adjacent chunks in ms. 0 = hard cuts (glitchy), 25 = smooth joins (default).' },
      { id: 's', label: 'Seed', type: 'number', default: 0, min: 0, max: 999999, help: 'Non-zero for reproducible output. Same seed = identical scramble across runs. 0 = different each run.' },
      { id: 'b', label: 'Force Start from Beginning', type: 'boolean', default: false, help: 'Force the first chunk of output to start at the beginning of the input file.' },
      { id: 'e', label: 'Force End with Source End', type: 'boolean', default: false, help: 'Force the last chunk of output to end with the final samples of the input file.' },
    ],
  },

  // Correct syntax: extend scramble 2 infile outfile seglen scatter outdur [-w splen] [-s seed] [-b] [-e]
  {
    id: 'extend_scramble_2',
    program: 'extend',
    mode: 'scramble',
    modeNum: 2,
    label: 'Scramble (Complete Rearrange — Mode 2)',
    category: 'extend',
    description: 'Cut entire source into random-length non-overlapping chunks and rearrange. Each pass uses all material exactly once. Repeat passes fill the output duration.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: true,
    docUrl: 'https://www.composersdesktop.com/docs/html/cgroextd.htm#SCRAMBLE',
    params: [
      {
        id: 'seglen', label: 'Avg Chunk Size (s)', type: 'number',
        default: 0.5, min: 0.045, max: 60,
        dependsOn: {
          max: { type: 'inputDuration', fallback: 60 }
        },
        help: 'Average segment length in seconds. Determines base chunk size for cutting the entire file. 0.1–0.3 = rapid permutating grains, 0.5–2.0 = shuffled words/phrases.'
      },
      {
        id: 'scatter', label: 'Scatter Factor', type: 'number',
        default: 3, min: 0, max: 10,
        dependsOn: {
          max: {
            type: 'expression',
            fn: (ctx) => {
              const dur = ctx.inputDuration || 1
              const seglen = ctx.paramValues?.seglen || 0.1
              return Math.max(0, Math.floor(dur / seglen))
            },
            fallback: 10
          }
        },
        help: 'Randomisation of chunk lengths. 0 = uniform chunks, higher = wildly varying lengths. Useful range: 1–5 for subtle variation, 6+ for extreme contrast.'
      },
      {
        id: 'outdur', label: 'Output Duration (s)', type: 'number',
        default: 10, min: 0.1, max: 100,
        help: 'Total output duration. Process will repeat through source to fill this duration. 10–30s = focused, 30–100s = sprawling generative structure.'
      },
    ],
    flags: [
      { id: 'w', label: 'Splice Length (ms)', type: 'number', default: 25, min: 0, max: 1000, help: 'Crossfade between adjacent chunks in ms. 0 = hard cuts (glitchy), 25 = smooth joins (default).' },
      { id: 's', label: 'Seed', type: 'number', default: 0, min: 0, max: 999999, help: 'Non-zero for reproducible output. Same seed = identical shuffle across runs. 0 = different each run.' },
      { id: 'b', label: 'Force Start from Beginning', type: 'boolean', default: false, help: 'Force the first chunk of output to start at the beginning of the input file.' },
      { id: 'e', label: 'Force End with Source End', type: 'boolean', default: false, help: 'Force the last chunk of output to end with the final samples of the input file.' },
    ],
  },

  // ══ SFECHO ECHO — Decaying Echo Repeats ═══════════════════════════
  // Doc: https://www.composersdesktop.com/docs/html/cgroextd.htm#ECHOES
  // Correct syntax: sfecho echo infile outfile delay attenuation totaldur [-rrand] [-ccutoff]

  {
    id: 'extend_sfecho',
    program: 'sfecho',
    mode: 'echo',
    modeNum: null,
    label: 'Echo (SFECHO)',
    category: 'extend',
    description: 'Decaying echo: repeats the source at regular delay intervals, each repeat quieter than the last, until totaldur or cutoff level is reached.',
    inputExt: ['.wav'],
    outputExt: '.wav',
    multichannel: false,
    docUrl: 'https://composersdesktop.com/docs/html/cgroextd.htm#ECHOES',
    params: [
      {
        id: 'delay', label: 'Delay (s)', type: 'number',
        default: 0.3, min: 0.01, max: 10,
        supportsBreakpoint: true,
        help: 'Time between echo repeats in seconds. Must be ≥ source duration. 0.1–0.3 = tight slap-back, 0.5–1.0 = distinct echo, 2+ = cavernous.'
      },
      {
        id: 'attenuation', label: 'Attenuation (0–1)', type: 'number',
        default: 0.6, min: 0.01, max: 0.99,
        supportsBreakpoint: true,
        help: 'Relative level of each successive echo (0–1). 0.9 = gentle fade, 0.5 = each echo is half the previous, 0.1 = sharp cut.'
      },
      {
        id: 'totaldur', label: 'Total Duration (s)', type: 'number',
        default: 10, min: 0.1, max: 3600,
        help: 'Maximum output duration in seconds. Echo chain stops when this is reached or the cutoff dB level is hit.'
      },
    ],
    flags: [
      {
        id: 'r', label: 'Randomise Delay', type: 'number',
        default: 0, min: 0, max: 1,
        help: 'Randomisation of echo timing (0–1). 0 = perfectly regular echoes, >0 = irregular / natural feel. Can be time-varying.'
      },
      {
        id: 'c', label: 'Cutoff Level (dB)', type: 'number',
        default: -96, min: -120, max: -6,
        help: 'dB level at which decaying echoes are silenced. Default: -96 dB (near-silence). Raise e.g. to -40 to cut the tail short.'
      },
    ],
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
