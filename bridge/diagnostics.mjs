import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'

const root = new URL('./', import.meta.url)
function revision() {
  const hash = createHash('sha256')
  for (const name of readdirSync(root).filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs')).sort()) {
    hash.update(name).update(readFileSync(new URL(name, root)))
  }
  return hash.digest('hex').slice(0, 12)
}
const identity = { revision: revision(), instance: randomUUID().slice(0, 8), startedAt: new Date().toISOString() }

export function attachDiagnostics(socket, { request = fetch } = {}) {
  const backend = ['ollama', 'gemini', 'openai'].includes(process.env.JARVIS_BRAIN) ? process.env.JARVIS_BRAIN : 'claude'
  const configured = backend === 'ollama' ? process.env.JARVIS_LOCAL_MODEL || 'qwen3.5:4b'
    : process.env.JARVIS_MODEL || ({ gemini: 'gemini-3.5-flash', openai: 'gpt-5.1', claude: 'claude-opus-5' })[backend]
  const model = /^[a-zA-Z0-9_.:/[\]-]{1,100}$/.test(configured) ? configured : 'configurado (nome omitido)'
  let checking = false
  let lastCheck = 0
  let ollama = 'não verificado'
  let sourceStatus = 'não verificado'
  const send = () => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'diagnostics', protocol: 2, backend, model, ollama, sourceStatus, ...identity }))
  }
  async function refresh() {
    if (checking || Date.now() - lastCheck < 5000) return send()
    checking = true
    try { sourceStatus = revision() === identity.revision ? 'código correspondente' : 'código alterado; reinicie o servidor' }
    catch { sourceStatus = 'não foi possível comparar o código' }
    try {
      const response = await request('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) })
      ollama = response.ok ? 'disponível' : 'respondeu com erro'
    } catch { ollama = 'indisponível' }
    finally { checking = false; lastCheck = Date.now(); send() }
  }
  send()
  void refresh()
  socket.on('message', (raw) => {
    try { if (JSON.parse(raw.toString()).type === 'diagnostics') void refresh() } catch { /* Ignore malformed frames. */ }
  })
}
