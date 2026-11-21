import assert from 'node:assert/strict'
import { parseAttentionResult, requestAttention } from './windows.js'

const json = (attention, toast) => JSON.stringify({ attention, toast })
const skipped = attention => ({ attention, toast: 'skipped' })

for (const [attention, toast, probe] of [
  ['flash-requested', 'submitted', false],
  ['no-window', 'submitted', false], // tray-hidden DSH can still receive a toast
  ['foreground', 'skipped', false],
  ['ready', 'ready', true],
  ['foreground', 'ready', true],
  ['no-window', 'disabled:DisabledByGroupPolicy', true],
  ['interop-unavailable', 'skipped', true],
  ['invalid-parent', 'skipped', true],
  ['parent-exited', 'skipped', false],
  ['parent-inaccessible', 'skipped', false],
]) {
  assert.deepEqual(parseAttentionResult(json(attention, toast) + '\r\n', probe), { attention, toast })
}

const privateText = 'C:\\Private\\desktop.exe: secret-value'
for (const stdout of [
  undefined, Buffer.from(json('foreground', 'skipped')), '', 'not JSON ' + privateText,
  'null', '[]', '1', '"foreground"', 'true', '{}', '{"attention":"foreground"}',
  JSON.stringify({ attention: 'foreground', toast: 'skipped', diagnostic: privateText }),
  json('foreground', null), json(7, 'skipped'), json('no-window', {}), json(['foreground'], 'skipped'),
  json(privateText, 'skipped'), json('constructor', 'skipped'), json('no-window', 'constructor'),
  json('no-window', `disabled:${privateText}`), json('no-window', 'disabled:Enabled'),
  json('no-window', 'disabled:'), json('foreground', 'submitted'), json('parent-exited', 'submitted'),
  json('ready', 'skipped'), json('no-window', 'ready'), json('helper-timeout', 'skipped'),
]) {
  assert.equal(parseAttentionResult(stdout), null)
}
for (const stdout of [
  json('flash-requested', 'skipped'), json('no-window', 'submitted'), json('parent-inaccessible', 'ready'),
]) {
  assert.equal(parseAttentionResult(stdout, true), null)
}

// Every request injects an executor: this suite never starts PowerShell or
// queries the native notifier, even on a system with a running Desktop.
const env = { SystemRoot: 'C:\\Windows', PATH: 'C:\\Tools', FAKE_SECRET: privateText }
const runtime = exec => ({ exec, platform: 'win32', env })
const mockError = props => Object.assign(new Error(privateText), { stdout: privateText, stderr: privateText }, props)
const failingExec = props => async () => { throw mockError(props) }
const unexpectedExec = async () => { assert.fail('No helper should be launched') }
for (const [error, expected] of [
  [{ code: 'ABORT_ERR', killed: true, signal: 'SIGTERM' }, 'helper-aborted'],
  [{ code: null, killed: true, signal: 'SIGTERM' }, 'helper-timeout'],
  [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', killed: true }, 'helper-output-limit'],
  [{ code: 'ENOENT' }, 'helper-failed'],
  [{ code: 1, killed: true, signal: 'SIGTERM' }, 'helper-failed'],
  [{ code: null, killed: false, signal: 'SIGTERM' }, 'helper-failed'],
]) {
  assert.deepEqual(await requestAttention({}, runtime(failingExec(error))), skipped(expected))
}
assert.deepEqual(await requestAttention({}, { ...runtime(unexpectedExec), platform: 'linux' }), skipped('wrong-desktop'))
assert.deepEqual(await requestAttention({}, { ...runtime(unexpectedExec), env: {} }), skipped('wrong-desktop'))
assert.deepEqual(await requestAttention({ signal: AbortSignal.abort(privateText) }, runtime(unexpectedExec)), skipped('helper-aborted'))
for (const response of [null, { stdout: json('no-window', `disabled:${privateText}`), stderr: privateText }]) {
  assert.deepEqual(await requestAttention({}, runtime(async () => response)), skipped('helper-invalid-result'))
}
const desktopExe = 'C:\\Apps\\DeepSeek Harness.exe'
const { signal } = new AbortController()
let launch
const probe = await requestAttention({ parentId: 42, desktopExe, probe: true, test: true, signal }, runtime(async (...args) => {
  launch = args
  return { stdout: json('no-window', 'ready'), stderr: privateText }
}))
assert.deepEqual(probe, { attention: 'no-window', toast: 'ready' })
const [exe, args, options] = launch
assert.equal(exe, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
assert.deepEqual(args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand'])
assert.deepEqual(options, {
  windowsHide: true, timeout: 12000, maxBuffer: 32 * 1024, signal,
  env: { SystemRoot: env.SystemRoot, PATH: env.PATH, DSH_FLASH_PID: '42', DSH_FLASH_EXE: desktopExe, DSH_FLASH_PROBE: '1', DSH_TOAST_TEST: '1' },
})
console.log('PASS: Windows result schema, bounded diagnostics, and isolated helper launch/failure mapping')
