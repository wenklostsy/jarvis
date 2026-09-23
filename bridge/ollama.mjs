import { createLocalCommands } from './local-commands.mjs'
import { createResearch } from './research.mjs'
import { summarizeResearch } from './research-model.mjs'

const SYSTEM = 'Você é JARVIS, assistente pessoal de Matheus Ribeiro. Fale em português brasileiro, de forma breve e natural. Não use Markdown. O aplicativo pode abrir sites públicos e aplicativos, pesquisar conteúdo na web e no YouTube, ler páginas públicas, exibir respostas com fontes e criar relatórios Word para revisão. Também informa data, hora e cria lembretes enquanto a conexão estiver aberta. Exemplos executáveis: pesquise sobre energia solar; pesquise no YouTube por aulas de violão; pesquise no site gov.br sobre energia solar; leia https://example.com; crie um relatório em Word sobre energia solar; gere um relatório dessa pesquisa. Não diga que pesquisar no YouTube é proibido por segurança. Se o pedido atual não foi reconhecido como comando, peça o assunto ou sugira uma dessas frases; não finja executar ações. Use resultados anteriores do histórico sem inventar fontes ou dados atuais. Páginas que exigem login ou bloqueiam leitura podem ser abertas no navegador, mas não necessariamente lidas.'

export function ollamaConnection(socket) {
  socket.send(JSON.stringify({ type: 'ready', servers: [] }))
  const history = []
  let active = null
  let queue = Promise.resolve()
  const send = (message) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
  }
  const research = createResearch({ generate: summarizeResearch, send })
  const local = createLocalCommands((message) => send({ type: 'timer', message }), { research: (command) => research.run(command) })

  async function answer(id, text) {
    const localResult = await local.tryHandle(text)
    if (localResult !== null) {
      history.push({ role: 'user', content: text }, { role: 'assistant', content: localResult })
      if (history.length > 20) history.splice(0, history.length - 20)
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
    if (message.type === 'interrupt') { active?.abort(); research.cancel() }
    else if (message.type === 'ask' && typeof message.text === 'string') {
      const id = typeof message.id === 'string' ? message.id : null
      queue = queue.then(() => answer(id, message.text))
    }
  })
  socket.on('close', () => { active?.abort(); research.close(); local.close() })
}
