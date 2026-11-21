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
assert.equal(titleReads, 0, 'No title lookup on default, invalid opt-in, or merged reminder')
assert.equal(notificationTitle(ctx, { showConversationTitle: true }, 'chat'), 'Example title')
assert.equal(titleReads, 1)
assert.equal(titleEnabled(Config({})), false)
assert.equal(titleEnabled(Config(undefined)), false)
assert.equal(titleEnabled(Config({ showConversationTitle: true })), true)
assert.equal(Config.dict.showConversationTitle.meta.volatile, true)
console.log('PASS: default privacy, explicit title opt-in and volatile schema declaration')
