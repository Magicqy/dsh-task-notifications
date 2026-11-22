import { watchCompletions } from './completion.js'
import { registerControls } from './control.js'
import { resolveSessionTitle } from './titles.js'
import { requestAttention } from './windows.js'

export { Config } from './config.js'
export const inject = ['profileContext', 'agents', 'goals', 'connection']

export function titleEnabled(config) {
  return config?.showConversationTitle === true || config?.showConversationTitle?.get?.() === true
}

export function notificationTitle(ctx, config, sessionId) {
  // An opted-out profile must not read title projections at all.
  if (!titleEnabled(config) || sessionId === undefined) return undefined
  return resolveSessionTitle(ctx, sessionId)
}

function publicStatus(kind, showTitle, result) {
  const { attention, toast, activation, titleIncluded } = result
  const title = toast !== 'submitted' ? 'not-submitted'
    : titleIncluded ? (kind === 'test' ? 'sample' : 'attached')
      : showTitle ? 'unavailable' : 'hidden'
  return { kind, attention, toast, title, activation }
}

export function apply(ctx, config) {
  if (process.platform !== 'win32' || ctx.profileContext.name !== 'desktop') return
  ctx.effect(() => {
    let timer
    let attempt
    let rerun
    let disposed = false
    let status = null
    let testStatus = null
    function record(result) {
      if (result.kind === 'test') testStatus = result
      else status = result
    }

    function trigger(kind, sessionId) {
      if (disposed) return
      if (attempt !== undefined) {
        if (kind === 'test' || rerun === undefined) rerun = { kind, sessionId }
        else if (rerun.kind === 'auto' && rerun.sessionId !== sessionId) rerun = { kind: 'auto' }
        return
      }
      const run = new AbortController()
      attempt = run
      const showTitle = titleEnabled(config)
      const sampleTitle = kind === 'test' && showTitle
      const conversationTitle = kind === 'test' ? undefined : notificationTitle(ctx, config, sessionId)
      void requestAttention({ signal: run.signal, test: kind === 'test', sampleTitle, conversationTitle }).then(result => {
        if (!disposed) record(publicStatus(kind, showTitle, result))
      }).finally(() => {
        attempt = undefined
        if (rerun !== undefined && !disposed) {
          const next = rerun
          rerun = undefined
          trigger(next.kind, next.sessionId)
        }
      }).catch(() => {
        if (!disposed && attempt === undefined) {
          record({ kind, attention: 'helper-failed', toast: 'skipped', title: 'not-submitted', activation: 'not-submitted' })
        }
      })
    }

    const stopWatching = watchCompletions(ctx, ({ sessionId } = {}) => trigger('auto', sessionId))
    const stopControls = registerControls(ctx, {
      snapshot() { return { showConversationTitle: titleEnabled(config), status, testStatus, pending: timer !== undefined || attempt !== undefined } },
      async setTitle(enabled) {
        const entry = ctx.fiber?.entry
        const editor = ctx.get('configEditor')
        if (!entry || !editor) throw new Error('Plugin configuration is not editable')
        await editor.edit(entry, current => ({ ...current, showConversationTitle: enabled }))
      },
      test() {
        if (disposed || timer !== undefined || attempt !== undefined) return false
        timer = setTimeout(() => {
          timer = undefined
          trigger('test')
        }, 10_000)
        return true
      },
    })
    return () => {
      disposed = true
      stopWatching()
      clearTimeout(timer)
      attempt?.abort()
      return stopControls()
    }
  }, 'notification completion events and owner controls')
}
