// Gemini generateContent backend for the existing JARVIS WebSocket protocol.
import { createLocalCommands } from './local-commands.mjs'

export function geminiConnection(socket) {
  socket.send(JSON.stringify({ type: 'ready', servers: [] }))
  const history = []
  let active = null
  let queue = Promise.resolve()
  const send = (message) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
  }
  const local = createLocalCommands((message) => send({ type: 'timer', message }))

  async function answer(id, text) {
    const localResult = await local.tryHandle(text)
    if (localResult !== null) {
      send({ type: 'text', ask: id, delta: localResult })
      send({ type: 'done', ask: id, text: localResult, costUsd: null })
      return
    }
    const key = process.env.GEMINI_API_KEY
    if (!key) {
      send({ type: 'error', ask: id, message: 'Configure GEMINI_API_KEY no arquivo .env.' })
      return
    }
    const controller = new AbortController()
    active = controller
    const model = process.env.JARVIS_MODEL || 'gemini-3.5-flash'
    const contents = [...history, { role: 'user', parts: [{ text }] }]
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: 'Você é JARVIS, o assistente pessoal de voz de Matheus Ribeiro. Chame o usuário de Matheus naturalmente. Responda sempre em português brasileiro. Seja direto, útil e breve, em linguagem natural para ser falada. O aplicativo executa comandos explícitos para abrir sites, aplicativos e pastas, pesquisar na web, consultar data e hora e criar timers e lembretes enquanto a conexão estiver aberta. Se um pedido chegou até você, ele ainda não foi executado. Nunca afirme ter aberto, salvo, enviado ou alterado algo. Quando não puder executar uma ação no computador, diga isso claramente e ajude a reformular o pedido. Não use Markdown.' }] },
            contents,
          }),
          signal: controller.signal,
        },
      )
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 429) throw new Error('A cota gratuita do Gemini acabou por enquanto. Comandos locais como hora, sites e timers continuam disponíveis.')
        throw new Error(result.error?.message || `Gemini HTTP ${response.status}`)
      }
      if (controller.signal.aborted) return
      const output = (result.candidates?.[0]?.content?.parts || [])
        .filter((part) => typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
      if (!output) throw new Error('O Gemini não retornou texto.')
      history.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: output }] })
      if (history.length > 20) history.splice(0, history.length - 20)
      send({ type: 'text', ask: id, delta: output })
      send({ type: 'done', ask: id, text: output, costUsd: null })
    } catch (error) {
      if (!controller.signal.aborted) send({ type: 'error', ask: id, message: String(error.message || error) })
    } finally {
      if (active === controller) active = null
    }
  }

  socket.on('message', (raw) => {
    let message
    try { message = JSON.parse(raw.toString()) } catch { return }
    if (message.type === 'interrupt') active?.abort()
    else if (message.type === 'ask' && typeof message.text === 'string') {
      const id = typeof message.id === 'string' ? message.id : null
      queue = queue.then(() => answer(id, message.text))
    }
  })
  socket.on('close', () => { active?.abort(); local.close() })
}
