import assert from 'node:assert/strict'
import { setImmediate as flush } from 'node:timers/promises'
import { watchCompletions } from './completion.js'
import { apply } from './index.js'
import { requestAttention } from './windows.js'

function fixtures() {
  const listeners = new Map()
  const agents = new Map()
  const commands = new Map()
  let dispose
  const ctx = {
    agents,
    goals: { get: agent => agent.goal },
    profileContext: { name: 'desktop' },
    on(name, fn) { listeners.set(name, fn); return () => listeners.delete(name) },
    commands: { register(cmd) { commands.set(cmd.name, cmd); return () => commands.delete(cmd.name) } },
    effect(fn) { dispose = fn() },
  }
  const emit = (name, ...args) => listeners.get(name)?.(...args)
  function agent(id, origin) {
    const a = { id, session: { id, header: { origin } }, status: 'running', inbox: { hasPending: false } }
    agents.set(id, a)
    return a
  }
  function event(a, type, turn, reason) { emit('session/event', a.session, { type, data: { turn, reason: { kind: reason } } }) }
  function end(a, turn = 1, reason = 'completed', work = true, source = 'user') {
    event(a, 'turn/start', turn)
    if (work) {
      event(a, 'step/start', turn)
      emit('session/event', a.session, { type: 'user/message', data: { source: { kind: source } } })
    }
    event(a, 'turn/end', turn, reason)
  }
  function idle(a) { a.status = 'idle'; emit('agent/status', { agent: a, status: 'idle' }) }
  return { ctx, listeners, commands, dispose: () => dispose(), emit, agent, event, end, idle }
}

const f = fixtures()
let calls = 0
const stop = watchCompletions(f.ctx, () => calls++)
const a = f.agent('root')
f.end(a)
await flush()
assert.equal(calls, 0, 'no reminder while still running')
f.idle(a)
await flush()
assert.equal(calls, 1, 'root completion')
f.idle(a)
await flush()
assert.equal(calls, 1, 'not repeated on idle')
const child = f.agent('child', 'subagent')
f.end(child)
f.idle(child)
f.end(a, 2, 'aborted')
f.end(a, 3, 'completed', false)
f.end(a, 31, 'completed', true, 'schedule')
await flush()
assert.equal(calls, 1, 'ignore child, cancellation, empty and schedule-only turns')
a.inbox.hasPending = true
f.end(a, 4)
await flush()
assert.equal(calls, 1, 'queued input suppresses reminder')
a.inbox.hasPending = false
f.end(a, 5)
await flush()
assert.equal(calls, 2, 'only final queued turn reminds')
a.goal = { phase: 'active', activation: 'armed' }
f.end(a, 6)
await flush()
assert.equal(calls, 2, 'automatic continuation gap suppressed')
f.end(a, 7)
a.goal = { phase: 'complete', activation: 'disarmed' }
f.emit('goal/changed', { agent: a })
await flush()
assert.equal(calls, 3, 'terminal goal reminds once')
a.goal = { phase: 'active', activation: 'armed' }
f.end(a, 8)
await flush()
a.goal = { phase: 'paused', activation: 'disarmed' }
f.emit('goal/activation-changed', { sessionId: a.id })
await flush()
assert.equal(calls, 3, 'user pause does not remind')
a.goal = undefined
f.end(a, 9, 'error')
await flush()
assert.equal(calls, 4, 'conversation error is terminal and needs attention')
f.end(a, 10)
f.emit('session/disposed', a.session)
await flush()
assert.equal(calls, 4, 'disposed session discarded')
const b = f.agent('another-root')
f.idle(b)
f.end(a, 11)
f.end(b)
await flush()
assert.equal(calls, 5, 'simultaneous completions coalesce for a single taskbar button')
f.end(a, 12)
stop()
await flush()
assert.equal(f.listeners.size, 0)
assert.equal(calls, 5, 'pending emission cancelled when disabled')

const live = fixtures()
apply(live.ctx)
assert.deepEqual([...live.commands.keys()], ['taskbar-test', 'taskbar-test-status'])
assert.match(live.commands.get('taskbar-test').handler().text, /10 秒/)
live.dispose()
assert.equal(live.commands.size + live.listeners.size, 0)
console.log('PASS: conversation lifecycle, queue, Goal, cancellation, error and cleanup')

const pid = Number(process.argv[2])
if (pid) {
  const desktopExe = process.argv[3] ?? process.env.DSH_NODE_EXECUTABLE
  assert.ok(desktopExe, 'Pass the absolute path of the DSH Desktop executable as the second argument.')
  const outcome = await requestAttention({ parentId: pid, desktopExe, probe: true, test: true })
  assert.match(outcome.attention, /^(foreground|ready|no-window)$/)
  assert.match(outcome.toast, /^(ready|disabled:[a-zA-Z]+)$/)
  console.log('PASS: Windows helper, registered DSH notifier and toast payload in probe-only mode:', outcome)
}
