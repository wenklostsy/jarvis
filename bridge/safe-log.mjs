const privateKey = /key|token|secret|password|authorization|cookie|prompt|transcript|content|text|body|stack/i
export function redact(value, env = process.env) {
  const secrets = Object.entries(env).filter(([k, v]) => /key|token|secret|password/i.test(k) && typeof v === 'string' && v.length >= 6).map(([,v]) => v)
  const seen = new WeakSet()
  function clean(v) {
    if (typeof v === 'string') {
      let out = v.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/((?:api[_-]?key|token|secret|password|authorization|cookie)\s*[:=]\s*)[^\s&,;]+/gi, '$1[REDACTED]').replace(/https?:\/\/\S+/gi, '[URL]')
      for (const secret of secrets) out = out.split(secret).join('[REDACTED]')
      return out.slice(0, 300)
    }
    if (v && typeof v === 'object') {
      if (seen.has(v)) return '[circular]'
      seen.add(v)
      return Array.isArray(v) ? v.map(clean) : Object.fromEntries(Object.entries(v).map(([k, val]) => [k, privateKey.test(k) ? '[REDACTED]' : clean(val)]))
    }
    return v
  }
  return clean(value)
}
export function publicError() { return 'Não consegui concluir a operação. Verifique a conexão e o diagnóstico do JARVIS.' }
export function safeLog(event, metadata = {}) {
  const allowed = ['requestId', 'researchId', 'actionRequestId', 'operation', 'duration', 'state', 'code', 'status', 'backend', 'model']
  console.log('[jarvis]', redact(event), redact(Object.fromEntries(Object.entries(metadata).filter(([key]) => allowed.includes(key)))))
}
