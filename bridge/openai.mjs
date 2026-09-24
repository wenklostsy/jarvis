import { createRequests, bindRequests } from './requests.mjs'
// OpenAI Responses API backend for the existing JARVIS WebSocket protocol.
import { createLocalCommands } from './local-commands.mjs'
import { createResearch } from './research.mjs'
import { summarizeResearch } from './research-model.mjs'
const API_URL = 'https://api.openai.com/v1/responses'

export function openaiConnection(socket, systemPrompt) {
  socket.send(JSON.stringify({ type: 'ready', servers: [] }))
  const history = []
  const requests = createRequests((message) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
  })
  const send = requests.send
  const research = createResearch({ generate: summarizeResearch, send })
  const local = createLocalCommands((message) => { if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'timer', message })) }, { research: (command, context) => research.run(command, context) })

  async function answer(id, text, context) {
    const controller = context.controller
    const localResult = context.action ? await research.action(context.action, context) : await local.tryHandle(text, context)
    context.signal.throwIfAborted()
    if (localResult !== null) {
      send({ type: 'text', ask: id, delta: localResult })
      send({ type: 'done', ask: id, text: localResult, costUsd: null })
      return
    }
    const key = process.env.OPENAI_API_KEY
    if (!key) {
      send({ type: 'error', ask: id, message: 'Configure OPENAI_API_KEY no arquivo .env.' })
      return
    }
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
    }
  }

  bindRequests(socket, requests, answer, () => { research.close(); local.close() })
}
