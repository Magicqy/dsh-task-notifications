import assert from 'node:assert/strict'
import { apply, notificationTitle, titleEnabled } from './index.js'
import { Config } from './config.js'

let titleReads = 0
const session = { id: 'chat', header: {} }
const ctx = {
  agents: new Map([['chat', { session }]]),
  get(name) {
    assert.equal(name, 'sessionProjections')
    titleReads++
    return { snapshot: () => ({ values: { title: 'Example title' } }) }
  },
}
for (const config of [undefined, {}, { showConversationTitle: false }, { showConversationTitle: 'true' }]) {
  assert.equal(notificationTitle(ctx, config, 'chat'), undefined)
}
assert.equal(notificationTitle(ctx, { showConversationTitle: true }, undefined), undefined)
assert.equal(titleReads, 0, 'No title lookup on invalid config, explicit opt-out, or merged reminder')
assert.equal(titleEnabled(Config({})), true)
assert.equal(titleEnabled(Config(undefined)), true)
assert.equal(notificationTitle(ctx, Config({}), 'chat'), 'Example title')
assert.equal(titleReads, 1)
const savedOptOut = Config({ showConversationTitle: false })
assert.equal(titleEnabled(savedOptOut), false, 'A saved off value overrides the default')
assert.equal(notificationTitle(ctx, savedOptOut, 'chat'), undefined)
assert.equal(titleReads, 1, 'Opt-out does not read the title')
assert.equal(Config.dict.showConversationTitle.meta.volatile, true)

// The settings page writes through the plugin's control route. Simulate the
// Loader's volatile config reference so a save is observable in the same
// snapshot the page reads back, and cover the rejection paths.
if (process.platform === 'win32') {
  const routes = new Map()
  let dispose
  let saved = true
  let editorAvailable = true
  let rejectEdit = false
  const entry = { options: { id: 'dsh-task-notifications' } }
  const writes = []
  const editor = {
    async edit(target, change) {
      assert.equal(target, entry)
      if (rejectEdit) throw new Error('private configuration path')
      const next = change({ showConversationTitle: saved })
      writes.push(next)
      saved = next.showConversationTitle
    },
  }
  const connection = {
    fetch: {
      register(route) {
        routes.set(route.path, route)
        return async () => { routes.delete(route.path) }
      },
    },
  }
  const ctx = {
    profileContext: { name: 'desktop' },
    agents: new Map(),
    goals: { get: () => undefined },
    fiber: { entry },
    get(name) {
      if (name === 'connection') return connection
      if (name === 'configEditor' && editorAvailable) return editor
      return undefined
    },
    on() { return () => {} },
    effect(fn) { dispose = fn() },
  }
  const config = { showConversationTitle: { get: () => saved } }
  apply(ctx, config)
  const route = routes.get('/api/dsh-task-notifications')
  assert.ok(route, 'the settings control route must be registered')
  const url = 'http://dsh.internal/api/dsh-task-notifications'
  const post = body => route.fetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))

  let response = await route.fetch(new Request(url))
  assert.deepEqual(await response.json(), { showConversationTitle: true, status: null, testStatus: null, pending: false })
  response = await post({ action: 'setTitle', enabled: false })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { showConversationTitle: false, status: null, testStatus: null, pending: false })
  assert.deepEqual(writes, [{ showConversationTitle: false }], 'the save must persist exactly the toggled field')
  response = await post({ action: 'setTitle', enabled: true })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { showConversationTitle: true, status: null, testStatus: null, pending: false })

  rejectEdit = true
  response = await post({ action: 'setTitle', enabled: false })
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: 'title-not-saved' })
  rejectEdit = false
  editorAvailable = false
  response = await post({ action: 'setTitle', enabled: false })
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: 'title-not-saved' })
  editorAvailable = true
  ctx.fiber = {}
  response = await post({ action: 'setTitle', enabled: false })
  assert.equal(response.status, 409)
  ctx.fiber = { entry }

  await dispose()
  assert.equal(routes.size, 0, 'disposal removes the control route')
  assert.equal(saved, true, 'rejected saves must not change the live value')
}
console.log('PASS: titles enabled by default, saved opt-out respected, volatile schema declaration, and owner save path')
