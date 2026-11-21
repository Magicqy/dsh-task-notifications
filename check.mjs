import assert from 'node:assert/strict'
import { setImmediate as flush } from 'node:timers/promises'
import { watchCompletions } from './completion.js'
import { resolveSessionTitle } from './titles.js'
import { apply } from './index.js'
import { requestAttention } from './windows.js'

function fixtures() {
  const listeners = new Map()
  const agents = new Map()
  const routes = new Map()
  let dispose
  let messageSeq = 0
  const ctx = {
    agents,
    goals: { get: agent => agent.goal },
    profileContext: { name: 'desktop' },
    on(name, fn, options) {
      assert.equal(options?.global, true, `${name} must observe scoped Host events`)
      listeners.set(name, fn)
      return () => listeners.delete(name)
    },
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path) } } },
    effect(fn) { dispose = fn() },
  }
  const emit = (name, ...args) => listeners.get(name)?.(...args)
  function agent(id, origin) {
    const a = { id, session: { id, header: { origin } }, status: 'idle', inbox: { nextTurn: [], nextStep: [] } }
    agents.set(id, a)
    return a
  }
  function event(a, type, data) { emit('session/event', a.session, { type, data }) }
  function status(a, value) {
    if (a.status === value) return
    a.status = value
    emit('agent/status', { agent: a, status: value })
  }
  function message(kind = 'user', goal) {
    const id = `message-${++messageSeq}`
    const source = kind === 'goal'
      ? { kind, goalId: goal.id, revision: goal.revision, round: goal.roundsStarted + 1 }
      : kind === 'retry' ? { kind, rpcId: id } : { kind }
    return { role: 'user', id, source, content: kind === 'retry' ? [] : [{ type: 'text', text: 'test' }] }
  }
  function start(a, turn) {
    status(a, 'running')
    event(a, 'turn/start', { turn })
  }
  function claim(a, turn, input) {
    for (const queue of [a.inbox.nextStep, a.inbox.nextTurn]) {
      const index = queue.indexOf(input)
      if (index !== -1) queue.splice(index, 1)
    }
    emit('agent/inbox/claimed', { agent: a, message: input, turn })
  }
  function finish(a, turn, kind = 'completed') {
    const reason = kind === 'error' ? { kind, error: { code: 'UNKNOWN', message: 'preparation failed' } }
      : kind === 'aborted' ? { kind, reason: { kind: 'user' } } : { kind }
    event(a, 'turn/end', { turn, reason })
  }
  function end(a, turn = 1, { input = message(), kind = 'completed', step = true, commit = step } = {}) {
    start(a, turn)
    if (input) claim(a, turn, input)
    if (step) event(a, 'step/start', { turn, step: 1 })
    if (commit) {
      if (input.source.kind === 'goal' && input.source.goalId === a.goal?.id) {
        a.goal = { ...a.goal, roundsStarted: input.source.round }
      }
      event(a, 'user/message', input)
    }
    if (step) event(a, 'step/end', { turn, step: 1 })
    finish(a, turn, kind)
  }
  function goal(a, operation, phase, activation = 'disarmed') {
    const ref = { id: `goal-${a.id}`, revision: (a.goal?.revision ?? 0) + 1 }
    a.goal = { ...ref, phase, activation, objective: 'test', maxGoalRounds: 10, roundsStarted: a.goal?.roundsStarted ?? 0, createdAt: 1, updatedAt: ref.revision }
    if (phase === 'blocked') a.goal.blockedReason = { code: 'prompt-rejected', message: 'Goal round was rejected before entering its step.' }
    emit('goal/changed', { agent: a, change: { operation, ref, goal: a.goal } })
  }
  function disarm(a) {
    a.goal = { ...a.goal, activation: 'disarmed' }
    const { id, revision, activation } = a.goal
    emit('goal/activation-changed', { sessionId: a.id, goal: { id, revision, activation } })
  }
  return { ctx, listeners, routes, dispose: () => dispose(), emit, agent, status, message, start, claim, finish, end, goal, disarm }
}

const f = fixtures()
const notifications = []
let expected = 0
async function expect(delta, description, context) {
  expected += delta
  await flush()
  assert.equal(notifications.length, expected, description)
  if (context !== undefined) assert.deepEqual(notifications.at(-1), [context], description)
}
const stop = watchCompletions(f.ctx, (...args) => notifications.push(args))
const a = f.agent('root')
f.end(a)
await expect(0, 'no reminder while still running')
f.status(a, 'idle')
await expect(1, 'root completion exposes only its session ID', { sessionId: a.id })
f.emit('agent/inbox/discarded', { agent: a, message: f.message() })
await expect(0, 'a delivered completion is not repeated')

const child = f.agent('child', 'subagent')
f.end(child)
f.status(child, 'idle')
f.end(a, 2, { kind: 'aborted' })
f.end(a, 3, { input: null, step: false })
f.end(a, 4, { input: f.message('schedule') })
f.status(a, 'idle')
await expect(0, 'ignore subagents, cancellation, empty and schedule-only turns')
f.finish(a, 5, 'interrupted')
await expect(0, 'ignore recovery closers without a live turn start')

const scheduled = f.message('schedule')
a.inbox.nextTurn.push(scheduled)
f.end(a, 6)
await expect(0, 'do not notify before the queued schedule turn runs')
f.end(a, 7, { input: scheduled })
f.status(a, 'idle')
await expect(1, 'a schedule-only follow-up cannot erase a conversation completion')

const queued = f.message()
const injected = f.message('schedule')
f.end(a, 8)
a.inbox.nextTurn.push(queued)
a.inbox.nextStep.push(injected)
f.status(a, 'idle')
await expect(0, 'an idle agent can still have queued input')
a.inbox.nextTurn.pop()
f.emit('agent/inbox/discarded', { agent: a, message: queued })
await expect(0, 'pending next-step input alone also gates the reminder')
a.inbox.nextStep.pop()
f.emit('agent/inbox/discarded', { agent: a, message: injected })
await expect(1, 'discarding the last queued input releases the earned reminder')

const g = f.agent('goal-root')
f.goal(g, 'create', 'active', 'armed')
f.end(g, 1, { input: f.message('goal', g.goal) })
f.status(g, 'idle')
await expect(0, 'automatic continuation gap suppressed')
f.start(g, 2)
f.claim(g, 2, f.message('goal', g.goal))
f.goal(g, 'block', 'blocked') // The driver blocks the Goal inside pre-step before the loop closes the turn.
f.finish(g, 2, 'blocked')
f.status(g, 'idle')
await expect(1, 'rejected no-step Goal round retains the earlier completion')

f.goal(g, 'resume', 'active', 'armed')
f.end(g, 3, { input: f.message('goal', g.goal) })
f.status(g, 'idle')
await expect(0, 'a completed round waits for an armed Goal')
f.goal(g, 'pause', 'paused')
await expect(0, 'pause suppresses work attributable only to the same Goal, despite a new revision')
f.end(g, 4)
f.status(g, 'idle')
await expect(1, 'a paused Goal must not mute a direct human turn')
f.end(g, 5, { input: f.message('retry') })
f.status(g, 'idle')
await expect(1, 'a paused Goal must not mute a human retry')
f.goal(g, 'resume', 'active', 'armed')
f.end(g, 6)
f.end(g, 7, { input: f.message('goal', g.goal) })
f.status(g, 'idle')
await expect(0, 'armed Goal gates even when a direct turn has earned a reminder')
f.goal(g, 'pause', 'paused')
await expect(1, 'pausing a later Goal round does not erase the earned direct reminder')
f.goal(g, 'resume', 'active', 'armed')
f.end(g, 8, { input: f.message('goal', g.goal) })
f.status(g, 'idle')
await expect(0, 'armed Goal still holds completion before activation changes')
f.disarm(g)
await expect(1, 'disarming an active Goal releases its completed work')

let turn = 9
for (const kind of ['user', 'retry']) {
  f.end(a, turn++, { input: f.message(kind), kind: 'error', step: false })
  f.status(a, 'idle')
  await expect(1, `claimed ${kind} input faults before either step/start or user/message`)
}
f.goal(g, 'resume', 'active', 'armed')
f.start(g, 9)
f.claim(g, 9, f.message('goal', g.goal))
f.disarm(g) // The Goal driver disarms on agent/error before the loop appends the closer.
f.finish(g, 9, 'error')
f.status(g, 'idle')
await expect(1, 'claimed Goal input faults before either step/start or user/message')
f.end(a, turn++, { kind: 'error', commit: false })
f.status(a, 'idle')
await expect(1, 'request preparation can fault after step/start but before user/message')
f.end(a, turn++, { kind: 'error' })
f.status(a, 'idle')
await expect(1, 'fault after committing a user message is still terminal')
for (const kind of ['blocked', 'max-tokens']) {
  f.end(a, turn++, { kind })
  f.status(a, 'idle')
  await expect(1, `entered conversation with ${kind} outcome earns a reminder`)
}

for (const [description, options] of [
  ['schedule-only fault', { input: f.message('schedule'), kind: 'error' }],
  ['fault with no claimed input', { input: null, kind: 'error' }],
  ['empty successful turn after a claim', { kind: 'completed' }],
  ['rejected Goal round without an earlier candidate', { input: f.message('goal', g.goal), kind: 'blocked' }],
  ['abort after a claim', { kind: 'aborted' }],
]) {
  f.end(a, turn++, { ...options, step: false })
  f.status(a, 'idle')
  await expect(0, `does not notify for ${description}`)
}
f.start(a, turn)
f.claim(a, turn - 1, f.message())
f.finish(a, turn++, 'error')
f.status(a, 'idle')
await expect(0, 'a stale-turn claim cannot qualify another turn')
f.end(a, turn++)
f.end(a, turn++, { kind: 'aborted', step: false })
f.status(a, 'idle')
await expect(0, 'a subsequent abort cancels a pending batch')

const disposed = f.agent('disposed')
f.end(disposed)
f.status(disposed, 'idle')
f.emit('session/disposed', disposed.session)
await expect(0, 'disposed session discarded')
const b = f.agent('another-root')
f.end(b)
const replacement = f.agent(b.id)
f.status(b, 'idle')
await expect(0, 'session replacement discards a stale candidate')
f.start(replacement, 1)
f.claim(b, 1, f.message())
f.finish(replacement, 1, 'error')
f.status(replacement, 'idle')
await expect(0, 'claims from a replaced agent cannot qualify a current session')
f.end(a, turn++)
f.end(replacement, 2)
f.status(a, 'idle')
f.status(replacement, 'idle')
await expect(1, 'simultaneous completions coalesce without naming any session', {})
f.end(a, turn++)
f.goal(replacement, 'create', 'active', 'armed')
f.end(replacement, 3, { input: f.message('goal', replacement.goal) })
f.goal(replacement, 'pause', 'paused')
f.status(a, 'idle')
f.status(replacement, 'idle')
await expect(1, 'a paused Goal in the same batch does not hide the sole qualifying session', { sessionId: a.id })
f.end(a, turn++)
f.status(a, 'idle')
stop()
await expect(0, 'pending emission cancelled when disabled')
assert.equal(f.listeners.size, 0)

if (process.platform === 'win32') {
  const live = fixtures()
  live.ctx.get = key => live.ctx[key]
  apply(live.ctx)
  assert.deepEqual([...live.routes.keys()], ['/api/dsh-task-notifications'])
  await live.dispose()
  assert.equal(live.routes.size + live.listeners.size, 0)
}
console.log('PASS: conversation lifecycle, queue, Goal, cancellation, error and cleanup')

const titleSession = { id: 'title-session', header: {} }
let projectedTitle = '  会话标题 📝  '
let reads = 0
const titleContext = {
  agents: new Map([[titleSession.id, { session: titleSession }]]),
  get(name) {
    assert.equal(name, 'sessionProjections')
    return {
      snapshot(session, keys) {
        assert.equal(session, titleSession)
        assert.deepEqual(keys, ['title'])
        reads++
        if (projectedTitle instanceof Error) throw projectedTitle
        return { asOfSeq: 42, values: { title: projectedTitle } }
      },
    }
  },
}
assert.equal(resolveSessionTitle(titleContext), undefined, 'coalesced context skips lookup')
assert.equal(resolveSessionTitle(titleContext, 'unknown'), undefined, 'cold/missing sessions are not opened')
assert.equal(reads, 0)
assert.equal(resolveSessionTitle(titleContext, titleSession.id), '会话标题 📝')
projectedTitle = 'renamed'
assert.equal(resolveSessionTitle(titleContext, titleSession.id), 'renamed', 'reads the current title; no title cache')
for (const unavailable of [null, undefined, 41, '\r\n  ', new Error('could not read title')]) {
  projectedTitle = unavailable
  assert.equal(resolveSessionTitle(titleContext, titleSession.id), undefined)
}
assert.equal(reads, 7, 'each title read selects the exact session and title key')
assert.equal(resolveSessionTitle({ ...titleContext, get: () => undefined }, titleSession.id), undefined)
console.log('PASS: optional current title lookup and generic fallback')

const parentArg = process.argv[2]
if (parentArg !== undefined) {
  const pid = Number(parentArg)
  assert.ok(/^[1-9]\d*$/u.test(parentArg) && Number.isInteger(pid) && pid <= 0x7fffffff, 'Pass a positive Windows process ID.')
  const desktopExe = process.argv[3] ?? process.env.DSH_NODE_EXECUTABLE
  assert.ok(desktopExe, 'Pass the absolute path of the DSH Desktop executable as the second argument.')
  const outcome = await requestAttention({ parentId: pid, desktopExe, probe: true, test: true })
  assert.match(outcome.attention, /^(foreground|ready|no-window)$/u, `Window probe: ${outcome.attention}`)
  if (outcome.toast.startsWith('disabled:')) {
    console.log('SKIP: Windows notifications disabled by system settings:', outcome.toast)
  } else {
    assert.equal(outcome.toast, 'ready', `Toast probe: ${outcome.toast}`)
    console.log('PASS: DSH notifier and toast payload are ready in probe-only mode.')
  }
}
