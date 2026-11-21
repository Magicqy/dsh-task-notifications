import assert from 'node:assert/strict'
import { apply, notificationTitle } from './index.js'

let titleReads = 0
const session = { id: 'chat', header: {} }
const entry = {}
const commands = new Map()
let stored = { unrelated: 'preserve' }
let available = true
let reject = false
let dispose
const ctx = {
  profileContext: { name: 'desktop' },
  fiber: { entry },
  agents: new Map([['chat', { session }]]),
  commands: {
    register(command) { commands.set(command.name, command); return () => commands.delete(command.name) },
  },
  effect(factory) { dispose = factory() },
  on() { return () => {} },
  get(name) {
    if (name === 'sessionProjections') {
      titleReads++
      return { snapshot: () => ({ values: { title: 'Example title' } }) }
    }
    if (name === 'configEditor' && available) return {
      async edit(target, update) {
        assert.equal(target, entry)
        if (reject) throw new Error('private detail must not appear in command status')
        stored = update(stored)
      },
    }
  },
}
for (const config of [undefined, {}, { showConversationTitle: false }, { showConversationTitle: 'true' }]) {
  assert.equal(notificationTitle(ctx, config, 'chat'), undefined)
}
assert.equal(notificationTitle(ctx, { showConversationTitle: true }, undefined), undefined)
assert.equal(titleReads, 0, 'No title lookup on default, invalid opt-in, or merged reminder')
assert.equal(notificationTitle(ctx, { showConversationTitle: true }, 'chat'), 'Example title')
assert.equal(titleReads, 1)

if (process.platform === 'win32') {
  apply(ctx, {})
  const on = commands.get('taskbar-title-on').handler
  const off = commands.get('taskbar-title-off').handler
  assert.equal((await on()).kind, 'success')
  assert.deepEqual(stored, { unrelated: 'preserve', showConversationTitle: true })
  assert.equal((await off()).kind, 'success')
  assert.deepEqual(stored, { unrelated: 'preserve', showConversationTitle: false })
  reject = true
  const result = await on()
  assert.equal(result.kind, 'error')
  assert.doesNotMatch(result.text, /private detail/u)
  assert.equal(stored.showConversationTitle, false)
  available = false
  assert.equal((await on()).kind, 'error')
  dispose()
  assert.equal(commands.size, 0)
}
console.log('PASS: default privacy, explicit title opt-in and profile-editor command boundaries')
