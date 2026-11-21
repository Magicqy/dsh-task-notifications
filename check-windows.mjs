import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { win32 } from 'node:path'
import { fileURLToPath } from 'node:url'
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

// Every attention request injects an executor, never contacting the notifier.
const env = {
  SystemRoot: 'C:\\Windows', PATH: 'C:\\Tools', FAKE_SECRET: privateText,
  dsh_toast_conversation_title: privateText, DSH_TOAST_BODY: privateText,
}
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
const titleText = `🔔 <tag attr="value"> & $env:PATH dsh://not-open`
for (const [conversationTitle, expected] of [
  [undefined, undefined], [null, undefined], [7, undefined], [{ title: titleText }, undefined],
  ['  \r\n\t\0\x1b\u0085\u202e  ', undefined],
  [`\r\n  ${titleText}\r\n second\0\tline\u202e\ud800\uffff `, `${titleText} second line`],
  ['🔔'.repeat(130), '🔔'.repeat(120)],
  [`${'a'.repeat(119)} word`, 'a'.repeat(119)],
]) {
  const result = await requestAttention({ conversationTitle, body: privateText }, runtime(async (_exe, args, { env }) => {
    assert.equal(env.DSH_TOAST_CONVERSATION_TITLE, expected)
    assert.equal(Object.hasOwn(env, 'DSH_TOAST_CONVERSATION_TITLE'), expected !== undefined)
    assert.equal(Object.hasOwn(env, 'dsh_toast_conversation_title'), false)
    assert.equal(Object.hasOwn(env, 'DSH_TOAST_BODY'), false)
    assert.deepEqual(args, launch[1])
    return { stdout: json('no-window', 'submitted'), stderr: titleText }
  }))
  assert.deepEqual(result, { attention: 'no-window', toast: 'submitted' })
}

// Parse the real script but evaluate only the pure XML-builder function. This
// cannot load the notifier, flash the taskbar, submit a toast or launch a URL.
if (process.platform === 'win32') {
  const checkPayload = String.raw`
$ErrorActionPreference = 'Stop'
$tokens = $errors = $null
$source = [IO.File]::ReadAllText($env:DSH_TEST_SOURCE, [Text.Encoding]::UTF8)
$tree = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Helper contains PowerShell syntax errors' }
$definition = @($tree.EndBlock.Statements | Where-Object {
    $_ -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -ceq 'New-ToastPayload'
})
if ($definition.Count -ne 1) { throw 'Expected exactly one XML builder' }
. ([scriptblock]::Create($definition[0].Extent.Text))

function Assert-That([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
foreach ($canActivate in @($false, $true)) {
    foreach ($isTest in @($false, $true)) {
        foreach ($title in @('', $env:DSH_TEST_TITLE)) {
            $payload = New-ToastPayload $canActivate $isTest $title
            $xml = [System.Xml.XmlDocument]::new()
            $xml.LoadXml($payload)
            $toast = $xml.DocumentElement
            Assert-That ($toast.Name -ceq 'toast' -and $toast.SelectNodes('.//*').Count -eq 5) 'Unexpected toast nodes'
            if ($canActivate) {
                Assert-That ($toast.Attributes.Count -eq 2 -and $toast.GetAttribute('launch') -ceq 'dsh://open' -and
                    $toast.GetAttribute('activationType') -ceq 'protocol') 'Incorrect protocol activation'
            } else {
                Assert-That ($toast.Attributes.Count -eq 0) 'Unexpected activation when protocol handler is unverified'
            }
            $text = $toast.SelectNodes('visual/binding[@template="ToastGeneric"]/text')
            Assert-That ($text.Count -eq 2 -and $null -ne $toast.SelectSingleNode('audio[@silent="true"]')) 'Incorrect visual or audio'
            if ($isTest) {
                $expectedHeading = 'DSH 提醒测试'
                $expectedBody = '这是手动触发的 Windows 通知。'
            } else {
                $expectedHeading = 'DSH 对话已结束'
                $expectedBody = '可以切回 DeepSeek Harness 查看结果。'
            }
            if ($title) {
                $expectedBody = $title
                Assert-That ($payload.Contains('&lt;tag') -and $payload.Contains('&amp;')) 'Title was not escaped'
            }
            Assert-That ($text.Item(0).InnerText -ceq $expectedHeading -and
                $text.Item(1).InnerText -ceq $expectedBody) 'Incorrect toast text'
        }
    }
}
'payload-ok'
`
  const exe = win32.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const encoded = Buffer.from(checkPayload, 'utf16le').toString('base64')
  const stdout = execFileSync(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8', windowsHide: true, timeout: 12000,
    env: {
      SystemRoot: process.env.SystemRoot,
      DSH_TEST_SOURCE: fileURLToPath(new URL('./flash.ps1', import.meta.url)),
      DSH_TEST_TITLE: titleText,
    },
  })
  assert.equal(stdout.trim(), 'payload-ok')
}
console.log('PASS: Windows result schema, bounded title transport and isolated helper launch/failure mapping' +
  (process.platform === 'win32' ? ', and silent ToastGeneric XML/activation' : ' (XML payload check requires Windows)'))
