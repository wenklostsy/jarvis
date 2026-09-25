import { createRequests, bindRequests } from './requests.mjs'
import { createLocalCommands } from './local-commands.mjs'
import { createResearch } from './research.mjs'
import { summarizeResearch } from './research-model.mjs'

import { createConversation } from './conversation-context.mjs'

export function ollamaConnection(socket) {
  socket.send(JSON.stringify({ type: 'ready', servers: [] }))
  const conversation = createConversation()
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
      conversation.local(text, context)
      send({ type: 'text', ask: id, delta: localResult })
      send({ type: 'done', ask: id, text: localResult, costUsd: 0 })
      return
    }

    const messages = conversation.messages(text)
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
      conversation.chat(text, output)
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
    }
  }

  bindRequests(socket, requests, answer, () => { research.close(); local.close() })
}
