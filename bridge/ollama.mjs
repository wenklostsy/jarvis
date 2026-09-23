import { createLocalCommands } from './local-commands.mjs'

const SYSTEM = 'Você é JARVIS, o assistente pessoal de voz de Matheus Ribeiro. Chame o usuário de Matheus naturalmente. Responda sempre em português brasileiro, em frases curtas e naturais para serem faladas. Seu nome é JARVIS. Não use Markdown. O aplicativo executa comandos locais explícitos para abrir sites, aplicativos e pastas, pesquisar na web, consultar data e hora e criar timers e lembretes. Os lembretes duram somente enquanto a conexão estiver aberta. Se um pedido chegou até você, ele ainda não foi executado: nunca afirme ter aberto, salvo, enviado ou alterado algo. Explique sua limitação ou ajude a reformular o pedido. Não invente acesso a arquivos, mensagens ou dados atuais.'

export function ollamaConnection(socket) {
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
      send({ type: 'done', ask: id, text: localResult, costUsd: 0 })
      return
    }

    const controller = new AbortController()
    active = controller
    const messages = [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: text }]
    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.JARVIS_LOCAL_MODEL || 'qwen3.5:4b',
          messages,
          stream: false,
          think: false,
          options: { num_ctx: 4096 },
        }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Ollama HTTP ${response.status}`)
      if (controller.signal.aborted) return
      const output = result.message?.content?.trim()
      if (!output) throw new Error('O modelo local não retornou texto.')
      history.push({ role: 'user', content: text }, { role: 'assistant', content: output })
      if (history.length > 20) history.splice(0, history.length - 20)
      send({ type: 'text', ask: id, delta: output })
      send({ type: 'done', ask: id, text: output, costUsd: 0 })
    } catch (error) {
      if (!controller.signal.aborted) {
        const offline = error.cause?.code === 'ECONNREFUSED' || error.message === 'fetch failed'
        send({
          type: 'error', ask: id,
          message: offline
            ? 'O Ollama local não está aberto. Inicie o Ollama e tente novamente.'
            : String(error.message || error),
        })
      }
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
