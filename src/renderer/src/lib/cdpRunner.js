// cdpRunner.js — Builds and executes CDP commands via Electron IPC
// All calls go through window.cdpStudio (exposed by preload.js)

import { getCommandById } from './cdpCommands.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Build the argument array for a CDP command.
 *
 * CDP argument order:
 *   [mode] [modeNum] infile [infile2] outfile [params...] [-flags]
 *
 * Examples:
 *   pvoc anal 1 input.wav output.ana -c1024
 *   modify speed 1 input.wav output.wav 0.5
 *   blur blur input.ana output.ana 11
 *   brassage 1 input.wav output.wav 2.0 60 1.0 0.8 1.0 1.0 1.0 0.5 5 5
 */
export function buildArgs({ command, inputPath, input2Path, outputPath, paramValues }) {
  const args = []

  // 1. Mode name (if present)
  if (command.mode) {
    args.push(command.mode)
  }

  // 2. Mode number (if present) — e.g. pvoc anal **1**, modify speed **1**, brassage **1**
  if (command.modeNum !== null && command.modeNum !== undefined) {
    args.push(String(command.modeNum))
  }

  // 3. Input file(s)
  args.push(inputPath)
  if (input2Path) args.push(input2Path)

  // 4. Output file
  args.push(outputPath)

  // 5. Positional parameters in declared order (or flag-style if flagPrefix is set)
  command.params.forEach(p => {
    const val = paramValues[p.id] !== undefined ? paramValues[p.id] : p.default
    if (p.flagPrefix) {
      args.push(`${p.flagPrefix}${val}`)
    } else {
      args.push(String(val))
    }
  })

  // 6. Flag-style parameters — formatted as -{id}{value} (e.g. -c1024)
  // Only include flags when the user has changed them from their default value.
  if (command.flags) {
    command.flags.forEach(f => {
      const val = paramValues[f.id]
      if (val === undefined || val === f.default) return
      args.push(`-${f.id}${val}`)
    })
  }

  return args
}

/**
 * Run a single CDP process.
 * Returns { success, outputPath, command, clip } where clip is ready to save to the Bin.
 */
export async function runCDPProcess({
  commandId,
  inputPath,
  input2Path = null,
  outputPath,
  paramValues = {},
  clipName,
  sourceClipId = null,
  audioInfo = null,
}) {
  const command = getCommandById(commandId)
  if (!command) throw new Error(`Unknown command: ${commandId}`)

  const args = buildArgs({ command, inputPath, input2Path, outputPath, paramValues })

  const result = await window.cdpStudio.runCDP({
    program: command.program,
    args,
    outputPath,
    label: command.label,
  })

  if (!result.success) {
    return { success: false, error: result.error, command: result.command }
  }

  // Get info about the output file
  let outInfo = { channels: 1, sampleRate: 44100, duration: 0 }
  try {
    outInfo = await window.cdpStudio.getAudioInfo(outputPath)
  } catch (e) {
    // non-fatal — use defaults
  }

  // Build a Clip Bin entry
  const clip = {
    id: uuidv4(),
    name: clipName || generateClipName(command, paramValues),
    filePath: outputPath,
    command: result.command,
    sourceClipId,
    channels: outInfo.channels || (audioInfo?.channels ?? 1),
    sampleRate: outInfo.sampleRate || 44100,
    duration: outInfo.duration || 0,
    channelFormat: formatChannels(outInfo.channels || 1),
  }

  return { success: true, outputPath, command: result.command, clip }
}

/**
 * Auto-generate a readable clip name from the command + key parameter.
 */
function generateClipName(command, paramValues) {
  const firstParam = command.params[0] || command.flags?.[0]
  if (firstParam) {
    const val = paramValues[firstParam.id] ?? firstParam.default
    return `${command.label} · ${firstParam.label} ${val}`
  }
  return command.label
}

function formatChannels(n) {
  if (n === 1) return 'mono'
  if (n === 2) return 'stereo'
  return `${n}ch`
}

/**
 * Build an output path for a new render inside the CDP clips folder.
 * Uses the command's declared outputExt (.wav or .ana).
 */
export async function buildOutputPath(inputPath, commandId) {
  const clipDir = await window.cdpStudio.getClipDir()
  const command = getCommandById(commandId)
  const baseName = inputPath.split('/').pop().replace(/\.[^.]+$/, '')
  const mode = command?.mode || command?.program || commandId
  const ext = command?.outputExt || '.wav'
  const ts = Date.now()
  return `${clipDir}/${baseName}_${mode}_${ts}${ext}`
}
