import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { win32 } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const script = readFileSync(new URL('./flash.ps1', import.meta.url), 'utf8')
const encoded = Buffer.from(script, 'utf16le').toString('base64')

export async function requestAttention({ parentId = process.ppid, desktopExe = process.execPath, probe = false, test = false, signal } = {}) {
  if (process.platform !== 'win32' || !process.env.SystemRoot) return { attention: 'wrong-desktop', toast: 'skipped' }
  const exe = win32.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|PSMODULEPATH|SystemRoot|windir|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramData|ComSpec)$/i.test(key)))
  const { stdout } = await exec(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    windowsHide: true, timeout: 12000, maxBuffer: 32 * 1024, signal,
    env: {
      ...env, DSH_FLASH_PID: String(parentId), DSH_FLASH_EXE: desktopExe,
      DSH_FLASH_PROBE: probe ? '1' : '0', DSH_TOAST_TEST: test ? '1' : '0',
    },
  })
  return JSON.parse(stdout.trim())
}
