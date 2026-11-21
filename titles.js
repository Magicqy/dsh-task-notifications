// Read only the current client-visible title of the completing live session.
export function resolveSessionTitle(ctx, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return
  try {
    const session = ctx.agents.get(sessionId)?.session
    if (!session || session.id !== sessionId || session.header.origin === 'subagent') return

    // DSH's registry already drives this projection on committed events. The
    // title service's get(session), by contrast, takes a full log snapshot.
    const title = ctx.get('sessionProjections')?.snapshot(session, ['title']).values.title
    if (typeof title === 'string') return title.trim() || undefined
  } catch {
    // Missing or unreadable title state must not prevent a generic reminder.
  }
}
