import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

// Scope survives asynchronous callbacks: an old tool can never acquire a new ID.
export function createRequests(write, { timeoutMs = 180_000, drainOnCancel = false } = {}) {
  const scope = new AsyncLocalStorage()
  const requests = new Map()
  const seen = new Set()
  let tail = Promise.resolve()
  let closed = false
  const emit = (r, state) => write({ type: 'request', ask: r.id, state })
  const send = (message) => {
    const r = scope.getStore()
    if (closed || (r && (r.signal.aborted || r.finished))) return
    if (r && message.type === 'error') r.failed = true
    if (r && message.type === 'progress' && message.state === 'failed') r.failed = true
    if (r && message.type === 'progress' && message.state === 'effect_unconfirmed') r.effectUnconfirmed = true
    if (r && message.type === 'done') message = { ...message, state: r.failed ? 'failed' : r.effectUnconfirmed ? 'effect_unconfirmed' : 'completed' }
    write(r ? { ...message, ask: r.id } : message)
  }
  function cancel(id) {
    for (const r of requests.values()) {
      if ((id == null || r.id === id) && !r.finished && !r.signal.aborted) {
        r.controller.abort()
        emit(r, 'cancelled')
      }
    }
  }
  return {
    send,
    cancel,
    close() { closed = true; cancel() },
    enqueue(id, execute) {
      if (closed) return Promise.resolve()
      id = typeof id === 'string' && id.length <= 128 ? id : randomUUID()
      if (seen.has(id)) return Promise.resolve() // Never replay an accepted ID.
      if (seen.size >= 10000) return Promise.resolve() // Bound per-connection bookkeeping.
      seen.add(id)
      const controller = new AbortController()
      const r = { id, controller, signal: controller.signal, finished: false, failed: false }
      requests.set(id, r)
      emit(r, 'queued')
      const task = tail.then(async () => {
        if (closed || r.signal.aborted) return
        emit(r, 'running')
        let abort
        const stopped = new Promise((resolve) => { abort = resolve; r.signal.addEventListener('abort', abort, { once: true }) })
        const timer = setTimeout(() => {
          if (!r.signal.aborted) {
            write({ type: 'error', ask: id, message: 'A solicitação excedeu o tempo limite.' })
            cancel(id)
          }
        }, timeoutMs)
        const pulse = setInterval(() => { if (!closed && !r.signal.aborted) write({ type: 'progress', ask: id, state: 'running' }) }, 10000)
        try {
          const work = scope.run(r, () => Promise.resolve().then(() => { r.signal.throwIfAborted(); return execute(Object.assign(r, { send: (message) => scope.run(r, () => send(message)) })) }))
          // Attach rejection handling even when cancellation wins the race.
          const handled = work.catch(() => {
            if (!r.signal.aborted && !closed) {
              r.failed = true
              write({ type: 'error', ask: id, message: 'Não foi possível concluir a solicitação. Tente novamente.' })
            }
          })
          await (drainOnCancel ? handled : Promise.race([handled, stopped]))
          if (!r.signal.aborted && !closed) emit(r, r.failed ? 'failed' : 'completed')
        } finally {
          clearInterval(pulse)
          clearTimeout(timer)
          r.signal.removeEventListener('abort', abort)
        }
      }).finally(() => { r.finished = true; requests.delete(id) })
      tail = task.catch(() => {})
      return task
    },
  }
}

export function bindRequests(socket, requests, answer, close) {
  socket.on('message', (raw) => {
    let message
    try { message = JSON.parse(raw.toString()) } catch { return }
    if (message.type === 'interrupt') requests.cancel(message.ask ?? message.id)
    else if (message.type === 'ask' && typeof message.text === 'string') {
      void requests.enqueue(message.id, (context) => answer(context.id, message.text, context))
    }
  })
  socket.on('close', () => { requests.close(); close?.() })
}
