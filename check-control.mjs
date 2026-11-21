import assert from 'node:assert/strict'
import { registerControls } from './control.js'

const path = '/api/dsh-task-notifications'
const url = `http://dsh.internal${path}`
const events = []
let route
let removeCalls = 0
let showConversationTitle = false
let pending = false
let status = null
let rejectSet = false
let rejectTest = false
const ctx = {
  get(name) {
    assert.equal(name, 'connection')
    return { fetch: { register(options) {
      route = options
      return async () => { removeCalls++ }
    } } }
  },
}
const dispose = registerControls(ctx, {
  snapshot() { return { showConversationTitle, pending, status, token: 'private token' } },
  async setTitle(enabled) {
    if (rejectSet) throw new Error('private configuration path')
    events.push(['setTitle', enabled])
    showConversationTitle = enabled
  },
  test(...args) {
    assert.equal(args.length, 0, 'settings test must not receive title, Session, or URI')
    if (rejectTest) throw new Error('private helper details')
    if (pending) return false
    events.push(['test'])
    pending = true
    return true
  },
})
assert.equal(route.path, path)
assert.deepEqual(route.methods, ['GET', 'POST'])
assert.equal(route.requestBody, 'buffered')

async function expect(request, code, body) {
  const res = await route.fetch(request)
  assert.equal(res.status, code)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.match(res.headers.get('content-type'), /^application\/json\b/u)
  assert.deepEqual(await res.json(), body)
}
function post(body, contentType = 'application/json', target = url, more = {}) {
  return new Request(target, { method: 'POST', body, headers: { 'Content-Type': contentType }, ...more })
}

await expect(new Request(url), 200, { showConversationTitle: false, status: null, testStatus: null, pending: false })
for (const target of [`${url}?`, `${url}?action=test`, `${url}#x`, `${url}/`, `${url}-related`]) {
  await expect(post('{"action":"test"}', 'application/json', target), 400, { error: 'invalid-request' })
}
await expect(new Request(url, { headers: { 'content-length': '1' } }), 400, { error: 'invalid-request' })
await expect(new Request(url, { method: 'PUT' }), 405, { error: 'invalid-request' })
await expect(post('{"action":"test"}', 'text/plain'), 415, { error: 'unsupported-content-type' })
await expect(post('{"action":"test"}', 'application/json', url, {
  headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
}), 415, { error: 'unsupported-content-type' })

for (const body of [
  undefined, '', 'this is not JSON', '{}', 'null', '[]', '"test"', '[{"action":"test"}]',
  '{"action":"other"}', '{"action":"setTitle"}', '{"action":"setTitle","enabled":"true"}',
  '{"action":"setTitle","enabled":0}', '{"action":"setTitle","enabled":null}',
  '{"action":"setTitle","enabled":true,"sessionId":"some-session"}',
  '{"action":"test","enabled":false}', '{"action":"test","uri":"https://example.invalid"}',
  '{"action":"test","__proto__":{"owner":true}}',
  '{"action":"setTitle","enabled":false,"enabled":true}',
  '{"action":"test","act\\u0069on":"test"}',
  new Uint8Array([0x7b, 0xff, 0x7d]),
]) await expect(post(body), 400, { error: 'invalid-body' })
await expect(post(`${' '.repeat(513)}{"action":"test"}`), 413, { error: 'body-too-large' })
await expect(post('{"action":"test"}', 'application/json', url, {
  headers: { 'content-type': 'application/json', 'content-length': '1024' },
}), 413, { error: 'body-too-large' })
const aborted = AbortSignal.abort()
await expect(post('{"action":"test"}', 'application/json', url, { signal: aborted }),
  409, { error: 'controls-unavailable' })
assert.deepEqual(events, [], 'rejected requests must not call operations')

await expect(post('{ "enabled":true, "action":"setTitle" }', 'Application/JSON; charset=utf-8'),
  200, { showConversationTitle: true, status: null, testStatus: null, pending: false })
rejectSet = true
await expect(post('{"action":"setTitle","enabled":false}'), 409, { error: 'title-not-saved' })
assert.equal(showConversationTitle, true)
rejectTest = true
await expect(post('{"action":"test"}'), 409, { error: 'test-unavailable' })
rejectTest = false
await expect(post('{"action":"t\\u0065st"}'), 200, { showConversationTitle: true, status: null, testStatus: null, pending: true })
await expect(post('{"action":"test"}'), 409, { error: 'test-pending' })
assert.deepEqual(events, [['setTitle', true], ['test']])

const expectedStatus = { kind: 'test', attention: 'flash-requested', toast: 'submitted', title: 'sample', activation: 'attached' }
status = { ...expectedStatus, uri: 'dsh://internal/path', stdout: 'private helper output', conversationTitle: 'private title' }
pending = false
await expect(new Request(url), 200, { showConversationTitle: true, status: expectedStatus, testStatus: null, pending: false })
for (const key of Object.keys(expectedStatus)) {
  status = { ...expectedStatus, [key]: 'untrusted text' }
  await expect(new Request(url), 409, { error: 'controls-unavailable' })
}

await dispose()
await dispose()
assert.equal(removeCalls, 1)
await expect(post('{"action":"test"}'), 409, { error: 'controls-unavailable' })
assert.deepEqual(events, [['setTitle', true], ['test']])
await registerControls({ get() {} }, {})()
console.log('PASS: exact notification control registration, input validation, and bounded output')
