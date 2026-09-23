// OpenAI Responses API backend for the existing JARVIS WebSocket protocol.
const API_URL = 'https://api.openai.com/v1/responses'

export function openaiConnection(socket, systemPrompt) {
  socket.send(JSON.stringify({ type: 'ready', servers: [] }))
  const history = []
  let active = null
  let queue = Promise.resolve()
  const send = (message) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
  }

  async function answer(id, text) {
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      send({ type: 'error', ask: id, message: 'Configure OPENAI_API_KEY no arquivo .env.' })
      return
    }
    const controller = new AbortController()
    active = controller
    const input = [...history, { role: 'user', content: text }]
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.JARVIS_MODEL || 'gpt-5.1',
          instructions: systemPrompt,
          input,
          store: false,
        }),
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || `OpenAI HTTP ${response.status}`)
      if (controller.signal.aborted) return
      const output = (result.output || [])
        .flatMap((item) => item.content || [])
        .filter((part) => part.type === 'output_text')
        .map((part) => part.text)
        .join('')
      if (!output) throw new Error('A OpenAI não retornou texto.')
      history.push({ role: 'user', content: text }, { role: 'assistant', content: output })
      // Bound context and keep complete user/assistant pairs.
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
    if (message.type === 'interrupt') {
      active?.abort()
    } else if (message.type === 'ask' && typeof message.text === 'string') {
      const id = typeof message.id === 'string' ? message.id : null
      queue = queue.then(() => answer(id, message.text))
    }
  })
  socket.on('close', () => active?.abort())
}
