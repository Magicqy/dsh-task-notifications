import assert from 'node:assert/strict'
import { notificationTitle, titleEnabled } from './index.js'
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
console.log('PASS: titles enabled by default, saved opt-out respected and volatile schema declaration')
