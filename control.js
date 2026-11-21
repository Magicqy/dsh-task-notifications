const CONTROL_PATH = '/api/dsh-task-notifications'
const MAX_BODY_BYTES = 512

const attentionCodes = new Set([
  'flash-requested', 'ready', 'foreground', 'no-window', 'ambiguous-window',
  'wrong-desktop', 'no-foreground', 'enumeration-failed', 'invalid-parent',
  'parent-exited', 'parent-inaccessible', 'interop-unavailable', 'window-check-failed',
  'helper-aborted', 'helper-timeout', 'helper-output-limit', 'helper-invalid-result', 'helper-failed',
])
const toastCodes = new Set([
  'submitted', 'ready', 'skipped', 'app-not-registered', 'failed',
  'disabled:DisabledForApplication', 'disabled:DisabledForUser',
  'disabled:DisabledByGroupPolicy', 'disabled:DisabledByManifest',
])
const titleCodes = new Set(['hidden', 'unavailable', 'attached', 'sample', 'not-submitted'])
const activationCodes = new Set(['attached', 'protocol-unavailable', 'not-submitted'])

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

function failure(status, error) {
  return json({ error }, status)
}

function publicStatus(status) {
  if (status === null) return null
  const { kind, attention, toast, title, activation } = status
  if ((kind !== 'auto' && kind !== 'test') || !attentionCodes.has(attention) || !toastCodes.has(toast)
    || !titleCodes.has(title) || !activationCodes.has(activation)) return undefined
  return { kind, attention, toast, title, activation }
}

function publicSnapshot(state) {
  const { showConversationTitle, pending, status, testStatus = null } = state
  if (typeof showConversationTitle !== 'boolean' || typeof pending !== 'boolean') return undefined
  const auto = publicStatus(status)
  const manual = publicStatus(testStatus)
  if (auto === undefined || manual === undefined || (manual && manual.kind !== 'test')) return undefined
  // Project only fixed fields and values; never forward an operation object or helper text.
  return { showConversationTitle, status: auto, testStatus: manual, pending }
}

async function readAction(request) {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'application/json' || request.headers.has('content-encoding')) {
    return { failure: failure(415, 'unsupported-content-type') }
  }
  const length = request.headers.get('content-length')
  const tooLarge = () => ({ failure: failure(413, 'body-too-large') })
  const invalid = () => ({ failure: failure(400, 'invalid-body') })
  if (length !== null) {
    if (!/^\d+$/u.test(length)) return invalid()
    if (Number(length) > MAX_BODY_BYTES) return tooLarge()
  }
  if (request.body === null) return invalid()
  const reader = request.body.getReader()
  try {
    // rc.5 selects body mode per path; GET requires buffered mode. Bound the
    // bytes decoded here even when the carrier allows larger buffered bodies.
    const bytes = new Uint8Array(MAX_BODY_BYTES)
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (received + value.byteLength > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {})
        return tooLarge()
      }
      bytes.set(value, received)
      received += value.byteLength
    }
    if (length !== null && received !== Number(length)) return invalid()
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, received))
    const body = JSON.parse(text)
    if (body === null || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(body, 'action')) return invalid()
    const size = Object.keys(body).length
    const isTest = size === 1 && body.action === 'test'
    const isSetTitle = size === 2 && body.action === 'setTitle' && Object.hasOwn(body, 'enabled')
      && typeof body.enabled === 'boolean'
    if (!isTest && !isSetTitle) return invalid()
    // The accepted forms are flat. Count their JSON member separators outside
    // quoted literals, so duplicate keys that JSON.parse would collapse fail.
    const memberCount = text.match(/"(?:[^"\\]|\\.)*"|:/gu).filter(token => token === ':').length
    if (memberCount !== size) return invalid()
    return { body }
  } catch {
    return invalid()
  } finally {
    reader.releaseLock()
  }
}

/** Own the desktop control route; Host Connection checks trust and owner identity before invoking it. */
export function registerControls(ctx, operations) {
  const connection = ctx.get?.('connection') ?? ctx.connection
  if (!connection) return async () => {}

  let active = true
  const unavailable = () => failure(409, 'controls-unavailable')
  function snapshot() {
    try {
      const value = publicSnapshot(operations.snapshot())
      if (value) return json(value)
    } catch {
      // Do not expose runtime/helper/config details, even from an unexpected error.
    }
    return unavailable()
  }

  const remove = connection.fetch.register({
    path: CONTROL_PATH,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    async fetch(request) {
      const url = new URL(request.url)
      if (url.href !== `${url.origin}${CONTROL_PATH}`) return failure(400, 'invalid-request')
      if (!active || request.signal.aborted) return unavailable()
      if (request.method === 'GET') {
        const length = request.headers.get('content-length')
        if (request.body !== null || (length !== null && !/^0+$/u.test(length)) || request.headers.has('transfer-encoding')) {
          return failure(400, 'invalid-request')
        }
        return snapshot()
      }
      if (request.method !== 'POST') return failure(405, 'invalid-request')

      const parsed = await readAction(request)
      if (parsed.failure) return parsed.failure
      if (!active || request.signal.aborted) return unavailable()
      const { body } = parsed
      if (body.action === 'setTitle') {
        try {
          if (await operations.setTitle(body.enabled) === false) return failure(409, 'title-not-saved')
        } catch {
          return failure(409, 'title-not-saved')
        }
      } else {
        try {
          if (await operations.test() === false) return failure(409, 'test-pending')
        } catch {
          return failure(409, 'test-unavailable')
        }
      }
      return active ? snapshot() : unavailable()
    },
  })
  let disposing
  return () => {
    active = false
    return disposing ??= Promise.resolve(remove())
  }
}
