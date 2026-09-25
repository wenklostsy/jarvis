import type { Turn } from '../store'

export function currentInteraction(turns: Turn[]) {
  const index = turns.findLastIndex(t => t.role === 'user')
  const current = index < 0 ? turns.slice(-1) : turns.slice(index)
  return [current.find(t => t.role === 'user'), current.findLast(t => t.role === 'jarvis' && !t.error && t.presentation !== 'notice')].filter((t): t is Turn => Boolean(t))
}

export function compactText(text: string, limit = 220) {
  return text.length > limit ? text.slice(0, limit).trimEnd() + '…' : text
}

export function scheduleNoticeDismiss(id: string, dismiss: (id: string) => void, delay = 5500) {
  const timer = setTimeout(() => dismiss(id), delay)
  return () => clearTimeout(timer)
}
