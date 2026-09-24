export type ResearchAction = { operation: 'retry' | 'report'; researchId: string }
export type ResearchResult = {
  id: string; query: string; content: string; spokenSummary: string; date: string; provider: string
  sources: Array<{ title: string; url: string; status: string; publishedAt?: string; media?: string }>
  artifacts: Array<{ kind: string; name: string }>
  limitations: string[]; actions: string[]
}
export type ResultAction = { operation: 'listen' | 'stop' | 'retry' | 'report'; result: ResearchResult }
export function parseResultVoiceCommand(text: string): ResultAction['operation'] | null {
  const value = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?,]/g, '').trim()
  if (/^(?:ouvir|ouca|leia|reproduza) (?:o )?resumo(?: da pesquisa)?$/.test(value)) return 'listen'
  if (/^(?:pare|parar|cancele) (?:a )?(?:leitura|fala)$/.test(value)) return 'stop'
  if (/^(?:pesquise|pesquisar) novamente$/.test(value)) return 'retry'
  return null
}
let handler: ((action: ResultAction) => Promise<void>) | null = null
const running = new Set<string>()
export function watchResultActions(next: (action: ResultAction) => Promise<void>) {
  handler = next
  return () => { if (handler === next) handler = null }
}
export async function runResultAction(action: ResultAction) {
  if (!handler) throw new Error('Ative o JARVIS para usar esta ação.')
  const key = `${action.result.id}:${action.operation}`
  if (running.has(key)) return
  running.add(key)
  try { await handler(action) } finally { running.delete(key) }
}
export function safeSourceUrl(raw: string) {
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
