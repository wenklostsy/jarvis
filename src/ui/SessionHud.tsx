import { memo, useEffect, useRef } from 'react'
import { DecodeText } from './DecodeText'
import { useStore } from '../store'
import { compactText, currentInteraction, scheduleNoticeDismiss } from '../lib/hud-session'

export const SessionHud = memo(function SessionHud() {
  const turns = useStore(s => s.turns)
  const open = useStore(s => s.historyOpen)
  const blades = useStore(s => s.blades)
  const activeId = useStore(s => s.activeResearchId)
  const notice = useStore(s => s.notice)
  const caption = useStore(s => s.caption)
  const toggle = useStore(s => s.toggleHistory)
  const button = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLElement>(null)
  const active = blades.find(b => b.research?.id === activeId)
  const close = () => { toggle(); button.current?.focus() }

  useEffect(() => {
    if (open) drawer.current?.focus()
  }, [open])
  useEffect(() => notice ? scheduleNoticeDismiss(notice.id, id => useStore.getState().dismissNotice(id)) : undefined, [notice])

  return <>
    <nav className="session-controls" aria-label="Sessão">
      <button ref={button} aria-expanded={open} aria-controls="session-history" onClick={toggle}>Histórico · {turns.length}</button>
      {active && <button className="active-research" onClick={() => useStore.getState().reopenBlade(active.id)} title={active.research?.query}>
        Pesquisa ativa · {compactText(active.research?.query || '', 38)} · {active.visibility === 'closed' ? 'fechada' : active.visibility === 'minimized' ? 'minimizada' : 'aberta'}
      </button>}
    </nav>
    {!open && <section className="hud-interaction" aria-label="Interação atual">
      {currentInteraction(turns).map(t => <div className={`log-line log-${t.role}`} key={t.id}>
        <span className="log-who">{t.role === 'user' ? 'VOCÊ' : 'JARVIS'}</span>
        <span className="log-text">{t.role === 'jarvis' ? <DecodeText text={compactText(t.text, 160)} /> : compactText(t.text, 160)}</span>
      </div>)}
      {caption && <p className="hud-live-caption">{compactText(caption, 140)}</p>}
      {currentInteraction(turns).some(t => t.text.length > 160) && <button onClick={toggle}>Ler mensagem completa no histórico</button>}
    </section>}
    {open && <aside ref={drawer} tabIndex={-1} id="session-history" className="session-history" aria-label="Histórico da sessão">
      <header><strong>REGISTRO DA SESSÃO</strong><button onClick={close} aria-label="Recolher histórico">−</button><button onClick={close} aria-label="Fechar histórico">✕</button></header>
      <div className="session-history-scroll">
        <h2>Painéis da sessão</h2>
        {blades.map(b => <button className="history-result" key={b.id} aria-pressed={b.research ? b.research.id === activeId : false} onClick={() => useStore.getState().reopenBlade(b.id)}>
          {b.research?.query || b.title} · {b.visibility === 'closed' ? 'fechado' : b.visibility === 'minimized' ? 'minimizado' : 'aberto'}{b.research?.id === activeId ? ' · ativo' : ''}
        </button>)}
        <h2>Interações</h2>
        {turns.map(t => <article key={t.id} className={t.error ? 'history-error' : ''}>
          <strong>{t.role === 'user' ? 'VOCÊ' : t.error ? 'JARVIS · AVISO' : 'JARVIS'}</strong>
          {t.researchId ? <button onClick={() => { const b = blades.find(b => b.research?.id === t.researchId); if (b) useStore.getState().reopenBlade(b.id) }} disabled={!blades.some(b => b.research?.id === t.researchId)}>Consultar resultado da pesquisa</button> : <p>{t.text}</p>}
        </article>)}
        {!turns.length && <p>Nenhuma interação nesta sessão.</p>}
      </div>
    </aside>}
    {notice && <div className="hud-notice" role="status"><span>{notice.text}</span><button aria-label="Dispensar notificação" onClick={() => useStore.getState().dismissNotice(notice.id)}>✕</button></div>}
  </>
})
