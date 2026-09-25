import { BRIDGE_HTTP_URL } from '../config'
let pending: Promise<void> | null = null
export function establishSession(): Promise<void> {
  if (!pending) pending = fetch(`${BRIDGE_HTTP_URL}/session`, {
    method: 'POST', credentials: 'include', headers: { 'x-jarvis-client': 'hud' }, signal: AbortSignal.timeout(5000),
  }).then(response => { if (!response.ok) throw new Error('Sessão local recusada. Verifique as origins e reinicie o bridge.') }).finally(() => { pending = null })
  return pending
}
export async function bridgeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  options.signal?.throwIfAborted()
  await establishSession()
  options.signal?.throwIfAborted()
  return fetch(url, { ...options, credentials: 'include' })
}
