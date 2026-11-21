import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { win32 } from 'node:path'
import { promisify } from 'node:util'

const execPowerShell = promisify(execFile)
let encodedScript

const attentionCodes = new Set([
  'flash-requested', 'ready', 'foreground', 'no-window', 'ambiguous-window',
  'wrong-desktop', 'no-foreground', 'enumeration-failed', 'invalid-parent',
  'parent-exited', 'parent-inaccessible', 'interop-unavailable', 'window-check-failed',
])
const toastCodes = new Set([
  'submitted', 'ready', 'skipped', 'app-not-registered', 'failed',
  'disabled:DisabledForApplication', 'disabled:DisabledForUser',
  'disabled:DisabledByGroupPolicy', 'disabled:DisabledByManifest',
])

export function parseAttentionResult(stdout, probe = false) {
  if (typeof stdout !== 'string') return null
  let result
  try {
    result = JSON.parse(stdout)
  } catch {
    return null
  }
  if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).length !== 2
    || !Object.hasOwn(result, 'attention') || !Object.hasOwn(result, 'toast')) return null

  const { attention, toast } = result
  if (!attentionCodes.has(attention) || !toastCodes.has(toast)) return null
  if (probe ? attention === 'flash-requested' || toast === 'submitted' : attention === 'ready' || toast === 'ready') return null
  const canToast = attention === 'no-window' || (probe
    ? attention === 'ready' || attention === 'foreground'
    : attention === 'flash-requested')
  if (!canToast && toast !== 'skipped') return null
  return { attention, toast }
}

function skipped(attention) {
  return { attention, toast: 'skipped' }
}

function classifyExecError(error) {
  if (error?.code === 'ABORT_ERR') return 'helper-aborted'
  if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'helper-output-limit'
  // execFile uses its default SIGTERM kill signal on timeout. Abort and output
  // overflow have their own codes; don't classify other exits as timeouts.
  if (error?.killed === true && error.signal === 'SIGTERM' && error.code === null) return 'helper-timeout'
  return 'helper-failed'
}

export async function requestAttention(
  { parentId = process.ppid, desktopExe = process.execPath, probe = false, test = false, signal } = {},
  { exec = execPowerShell, platform = process.platform, env = process.env } = {},
) {
  if (platform !== 'win32' || !env.SystemRoot) return skipped('wrong-desktop')
  if (signal?.aborted) return skipped('helper-aborted')
  const exe = win32.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
    /^(PATH|PATHEXT|PSMODULEPATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramData|ComSpec)$/i.test(key)))
  let response
  try {
    encodedScript ??= Buffer.from(readFileSync(new URL('./flash.ps1', import.meta.url), 'utf8'), 'utf16le').toString('base64')
    response = await exec(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript], {
      windowsHide: true, timeout: 12000, maxBuffer: 32 * 1024, signal,
      env: {
        ...childEnv, DSH_FLASH_PID: String(parentId), DSH_FLASH_EXE: desktopExe,
        DSH_FLASH_PROBE: probe ? '1' : '0', DSH_TOAST_TEST: test ? '1' : '0',
      },
    })
  } catch (error) {
    // Node's error may contain the encoded command, paths, stdout and stderr.
    // Only the fixed classification leaves this boundary.
    return skipped(classifyExecError(error))
  }
  return parseAttentionResult(response?.stdout, probe) ?? skipped('helper-invalid-result')
}
