// Watch only live work observed after activation; never replay a saved conversation.
export function watchCompletions(ctx, notify) {
  const turns = new Map()
  const checks = new Set()
  let scheduled
  const global = { global: true }
  const outcomes = new Set(['completed', 'error', 'max-tokens', 'blocked'])

  function checkSoon(sessionId) {
    if (!turns.get(sessionId)?.candidate) return
    checks.add(sessionId)
    if (scheduled !== undefined) return
    scheduled = setImmediate(() => {
      scheduled = undefined
      const batch = [...checks]
      checks.clear()
      let needsReminder = false
      for (const id of batch) {
        const state = turns.get(id)
        if (!state?.candidate) continue
        const agent = ctx.agents.get(id)
        if (agent?.session !== state.session) {
          turns.delete(id)
          continue
        }
        if (agent.status !== 'idle' || agent.inbox.hasPending) continue
        let goal
        try {
          goal = ctx.goals.get(agent)
        } catch {
          // An unreadable Goal must not cause a false completion or fail the Host.
          turns.delete(id)
          continue
        }
        if (goal?.phase === 'active' && goal.activation === 'armed') continue
        turns.delete(id)
        if (goal?.phase !== 'paused') needsReminder = true
      }
      if (needsReminder) notify()
    })
  }

  const off = [
    ctx.on('session/event', (session, event) => {
      if (session.header.origin === 'subagent' || ctx.agents.get(session.id)?.session !== session) return
      const id = session.id
      if (event.type === 'turn/start') {
        turns.set(id, { session, turn: event.data.turn, worked: false, conversational: false, candidate: false })
        return
      }
      const state = turns.get(id)
      if (state?.session !== session || state.candidate) return
      if (event.type === 'step/start' && state.turn === event.data.turn) {
        state.worked = true
      } else if (event.type === 'user/message') {
        const kind = event.data.source.kind
        if (kind === 'user' || kind === 'retry' || kind === 'goal') state.conversational = true
      } else if (event.type === 'turn/end' && state.turn === event.data.turn) {
        if (!state.worked || !state.conversational || !outcomes.has(event.data.reason.kind)) {
          turns.delete(id)
          return
        }
        state.candidate = true
        checkSoon(id)
      }
    }, global),
    ctx.on('agent/status', ({ agent }) => checkSoon(agent.id), global),
    ctx.on('agent/inbox/discarded', ({ agent }) => checkSoon(agent.id), global),
    ctx.on('goal/changed', ({ agent }) => checkSoon(agent.id), global),
    ctx.on('goal/activation-changed', ({ sessionId }) => checkSoon(sessionId), global),
    ctx.on('session/disposed', (session) => {
      if (turns.get(session.id)?.session !== session) return
      turns.delete(session.id)
      checks.delete(session.id)
    }, global),
  ]

  return () => {
    clearImmediate(scheduled)
    for (const remove of off.reverse()) remove()
    turns.clear()
    checks.clear()
  }
}
