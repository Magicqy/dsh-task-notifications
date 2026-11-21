// Watch only live work observed after activation; never replay a saved conversation.
export function watchCompletions(ctx, notify) {
  const sessions = new Map()
  const checks = new Set()
  let scheduled
  const global = { global: true }
  const outcomes = new Set(['completed', 'error', 'max-tokens', 'blocked'])
  const notGoalOnly = Symbol()

  // Attribution is absent, limited to one Goal ID, or not limited to that Goal.
  function attribution({ kind, goalId }) {
    if (kind === 'user' || kind === 'retry') return notGoalOnly
    if (kind === 'goal') return goalId
  }

  function combine(a, b) {
    if (a === undefined) return b
    if (b === undefined || a === b) return a
    return notGoalOnly
  }

  function checkSoon(sessionId) {
    if (sessions.get(sessionId)?.candidate === undefined) return
    checks.add(sessionId)
    if (scheduled !== undefined) return
    scheduled = setImmediate(() => {
      scheduled = undefined
      const batch = [...checks]
      checks.clear()
      let needsReminder = false
      for (const id of batch) {
        const state = sessions.get(id)
        if (state?.candidate === undefined) continue
        const agent = ctx.agents.get(id)
        if (agent?.session !== state.session) {
          sessions.delete(id)
          continue
        }
        if (state.current || agent.status !== 'idle' || agent.inbox.nextTurn.length || agent.inbox.nextStep.length) continue
        let goal
        try {
          goal = ctx.goals.get(agent)
        } catch {
          // An unreadable Goal must not cause a false completion or fail the Host.
          sessions.delete(id)
          continue
        }
        if (goal?.phase === 'active' && goal.activation === 'armed') continue
        sessions.delete(id)
        // Pause advances the revision, not the ID. It only silences this Goal's own work.
        if (goal?.phase !== 'paused' || state.candidate !== goal.id) needsReminder = true
      }
      if (needsReminder) notify()
    })
  }

  const off = [
    ctx.on('session/event', (session, event) => {
      if (session.header.origin === 'subagent' || ctx.agents.get(session.id)?.session !== session) return
      const id = session.id
      let state = sessions.get(id)
      if (event.type === 'turn/start') {
        if (state?.session !== session) sessions.set(id, state = { session })
        state.current = { turn: event.data.turn, worked: false }
        return
      }
      if (state?.session !== session || !state.current) return
      const current = state.current
      if (event.type === 'step/start' && current.turn === event.data.turn) {
        current.worked = true
      } else if (event.type === 'user/message') {
        current.committed = combine(current.committed, attribution(event.data.source))
      } else if (event.type === 'turn/end' && current.turn === event.data.turn) {
        const { kind } = event.data.reason
        state.current = undefined
        if (kind === 'aborted') {
          // A cancellation ends the batch without a reminder.
          state.candidate = undefined
        } else if (outcomes.has(kind)) {
          let source = current.worked ? current.committed : undefined
          // Claims precede preparation. A thrown fault records `error`, not the
          // `blocked` of a pre-step rejection or `completed` of an empty turn.
          if (kind === 'error') source ??= current.claimed
          state.candidate = combine(state.candidate, source)
        }
        if (state.candidate === undefined) sessions.delete(id)
        else checkSoon(id)
      }
    }, global),
    ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
      const state = sessions.get(agent.id)
      if (state?.session !== agent.session || state.current?.turn !== turn || ctx.agents.get(agent.id) !== agent) return
      state.current.claimed = combine(state.current.claimed, attribution(message.source))
    }, global),
    ctx.on('agent/status', ({ agent }) => checkSoon(agent.id), global),
    ctx.on('agent/inbox/discarded', ({ agent }) => checkSoon(agent.id), global),
    ctx.on('goal/changed', ({ agent }) => checkSoon(agent.id), global),
    ctx.on('goal/activation-changed', ({ sessionId }) => checkSoon(sessionId), global),
    ctx.on('session/disposed', (session) => {
      if (sessions.get(session.id)?.session !== session) return
      sessions.delete(session.id)
      checks.delete(session.id)
    }, global),
  ]

  return () => {
    clearImmediate(scheduled)
    for (const remove of off.reverse()) remove()
    sessions.clear()
    checks.clear()
  }
}
