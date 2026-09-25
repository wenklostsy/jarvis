import { createHash, randomUUID } from 'node:crypto'
import { safeUrl } from './security.mjs'

export const Risk = Object.freeze({ READ: 'READ', LOCAL_REVERSIBLE: 'LOCAL_REVERSIBLE', LOCAL_EFFECT: 'LOCAL_EFFECT', EXTERNAL_EFFECT: 'EXTERNAL_EFFECT', DESTRUCTIVE: 'DESTRUCTIVE' })
const known = new Map()
function register(risk, names) { for (const name of names.split(' ')) known.set(name, risk) }
register(Risk.READ, 'diagnostics research read_source time date help list_timers search_prompt report_prompt invalid_url invalid_timer invalid_search')
register(Risk.LOCAL_REVERSIBLE, 'timer cancel_timers hud playback')
register(Risk.LOCAL_EFFECT, 'site app folder settings search report')
register(Risk.LOCAL_REVERSIBLE, 'mcp__jarvis__display mcp__jarvis__blade')
for (const name of ['theme', 'reactor', 'orbit', 'chrome', 'effect', 'screen', 'reset']) known.set(`mcp__jarvis_ui__ui_${name}`, Risk.LOCAL_REVERSIBLE)
register(Risk.READ, 'mcp__jarvis__probe_url mcp__jarvis_eyes__look mcp__jarvis_eyes__watch')
for (const name of ['status', 'tabs', 'read_page', 'page_text', 'find', 'screenshot', 'console', 'network']) known.set(`mcp__jarvis_chrome__chrome_${name}`, Risk.READ)
register(Risk.LOCAL_REVERSIBLE, 'mcp__jarvis_chrome__chrome_scroll')
register(Risk.LOCAL_EFFECT, 'mcp__jarvis_chrome__chrome_navigate mcp__jarvis_chrome__chrome_new_tab mcp__jarvis_chrome__chrome_close_tab')
for (const name of ['click', 'type', 'key', 'form_input']) known.set(`mcp__jarvis_chrome__chrome_${name}`, Risk.EXTERNAL_EFFECT)
export const classify = (operation) => known.get(operation) || null
export const requiresConfirmation = (risk) => risk === Risk.EXTERNAL_EFFECT || risk === Risk.DESTRUCTIVE
export function assertCapability(operation) {
  const risk = classify(operation)
  if (!risk || requiresConfirmation(risk)) throw new Error('Operação não autorizada pela política local.')
  return risk
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]))
  return value
}
export const parameterHash = (parameters) => createHash('sha256').update(JSON.stringify(canonical(parameters))).digest('hex')

/** Per-connection state. No input from a model can call resolve(). */
export function createConfirmations(send, { now = Date.now, ttl = 30_000 } = {}) {
  const pending = new Map(), executions = new Map()
  let closed = false
  function settle(entry, state) {
    if (entry.state !== 'pending') return false
    entry.state = state; clearTimeout(entry.timer); pending.delete(entry.actionRequestId)
    send({ ...entry.frame, confirmationState: state }); entry.finish(state === 'confirmed')
    return true
  }
  const api = {
    request(operation, parameters, risk, signal, summary) {
      if (closed || signal?.aborted || !Object.values(Risk).includes(risk)) return Promise.resolve(false)
      if (!requiresConfirmation(risk)) return Promise.resolve(true)
      if (pending.size) return Promise.resolve(false)
      if (typeof summary !== 'string' || !summary.trim()) return Promise.resolve(false)
      const actionRequestId = randomUUID(), hash = parameterHash(parameters)
      // Summary is deliberately metadata only: no browser text/password/prompt content.
      const frame = { type: 'confirmation', actionRequestId, operation, risk, parameterHash: hash, parametersSummary: summary.slice(0, 1000), expiresAt: now() + ttl, confirmationRequired: true, confirmationState: 'pending' }
      return new Promise(finish => {
        const entry = { ...frame, frame, state: 'pending', finish }
        entry.timer = setTimeout(() => settle(entry, 'expired'), ttl); entry.timer.unref?.()
        pending.set(actionRequestId, entry)
        const abort = () => settle(entry, 'rejected')
        signal?.addEventListener('abort', abort, { once: true })
        entry.finish = value => { signal?.removeEventListener('abort', abort); finish(value) }
        send(frame)
      })
    },
    resolve(message, source = 'ui') {
      if (closed || !['ui', 'voice'].includes(source)) return false
      const entry = pending.get(message.actionRequestId)
      if (!entry) return false
      if (now() >= entry.expiresAt) return settle(entry, 'expired') && false
      if (entry.operation !== message.operation || entry.parameterHash !== message.parameterHash || typeof message.confirmed !== 'boolean') return false
      return settle(entry, message.confirmed ? 'confirmed' : 'rejected')
    },
    runOnce(id, operation, parameters, effect) {
      if (closed) return Promise.reject(new Error('Sessão encerrada.'))
      const fingerprint = `${operation}:${parameterHash(parameters)}`
      const previous = executions.get(id)
      if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.reject(new Error('Parâmetros alterados.'))
      if (executions.size >= 1000) return Promise.reject(new Error('Limite da sessão atingido.'))
      const promise = Promise.resolve().then(effect)
      executions.set(id, { fingerprint, promise }); return promise
    },
    execute(id, operation, parameters, risk, summary, effect, signal) {
      const snapshot = structuredClone(parameters)
      return api.runOnce(id, operation, snapshot, async () => {
        if (!await api.request(operation, snapshot, risk, signal, summary) || closed || signal?.aborted) throw new Error('Ação não confirmada.')
        return effect(snapshot)
      })
    },
    close() { closed = true; for (const entry of pending.values()) settle(entry, 'rejected') },
  }
  return api
}

export function attachPermissions(socket) {
  const gate = createConfirmations(frame => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame)) })
  socket.on('message', raw => { try { const m = JSON.parse(raw.toString()); if (m.type === 'confirmation_response') gate.resolve(m, m.source) } catch { /* Malformed frames never grant permission. */ } })
  socket.once('close', () => gate.close())
  const used = new Set()
  return async (input, id, signal) => {
    let allowed = false
    const risk = classify(input.tool_name)
    if (socket.readyState === socket.OPEN && used.size < 1000 && risk && !signal?.aborted && !used.has(id)) {
      used.add(id)
      try {
        if (input.tool_input?.url) safeUrl(input.tool_input.url)
        // External browser interactions stay disabled: a generic click cannot provide
        // a trustworthy destination/effect summary. Future adapters must supply it.
        allowed = !requiresConfirmation(risk)
      } catch { allowed = false }
    }
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: allowed ? 'allow' : 'deny', permissionDecisionReason: allowed ? 'Capacidade local conhecida.' : 'Operação sem autorização contextual; não disponível nesta etapa.' } }
  }
}
