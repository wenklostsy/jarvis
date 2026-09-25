import { useEffect, useState } from 'react'
import { watchConfirmation, confirmPending, type PendingConfirmation } from '../lib/bridge'
export function Confirmation() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  useEffect(() => watchConfirmation(setPending), [])
  if (!pending) return null
  return <aside role="alertdialog" aria-label="Confirmar ação" style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#082027', color: '#fff', padding: 20, maxWidth: 480 }}>
    <p>{pending.parametersSummary}</p>
    <p>Risco: {pending.risk}. Expira em 30 segundos.</p>
    <button onClick={() => confirmPending(true)}>Confirmar</button>{' '}
    <button onClick={() => confirmPending(false)}>Cancelar</button>
  </aside>
}
