import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { bridgeDiagnostics as b, refreshDiagnostics } from '../lib/bridge'
import { BACKEND, MODEL } from '../config'

/**
 * The "why can't he hear me / why can't I hear him" panel.
 *
 * Both halves of the voice loop fail silently by nature. Speech recognition
 * that ignores you and speech synthesis that produces no sound look identical
 * from the outside — nothing throws, nothing logs, the interface carries on as
 * though it were working. Every bug in this loop has therefore cost a round
 * trip of guesswork, and that is the actual problem this fixes: it is not a
 * developer toy, it is the instrument that turns "it doesn't work" into a
 * specific, answerable fact.
 *
 * Press D to show it. It polls rather than subscribing, because the two
 * diagnostic records are plain mutable objects written from outside React —
 * that is deliberate, since the whole point is to observe the loop without
 * changing its timing.
 */

type VoiceDiag = {
  running: boolean
  sessions: number
  heard: string
  heardAt: number
  lastError: string
  wakes: number
  mode: string
  dropped: string
  accepted: number
  restarts: number
  idleMs: number
}

type TtsDiag = {
  request: string; state: string; responseLength: number; segments: number; currentSegment: number; queued: number; startedAt: number; endedAt: number; reason: string; controllerActive: boolean
  engine: string
  spoken: number
  started: number
  failures: number
  lastError: string
  nativeBroken: boolean
  rescued: number
  voice: string
  lastText: string
}

const ago = (t: number) => (t ? `${((Date.now() - t) / 1000).toFixed(1)}s ago` : '—')

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="diag-row">
      <span className="diag-k">{k}</span>
      <span className={bad ? 'diag-v diag-bad' : 'diag-v'}>{v}</span>
    </div>
  )
}

export function Diagnostics() {
  const [open, setOpen] = useState(false)
  const [, tick] = useState(0)
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'd' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    refreshDiagnostics()
    const refresh = setInterval(refreshDiagnostics, 5000)
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => { clearInterval(id); clearInterval(refresh) }
  }, [open])

  if (!open) return null

  const w = window as unknown as Record<string, unknown>
  const v = (w.__voice ?? {}) as Partial<VoiceDiag>
  const t = (w.__tts ?? {}) as Partial<TtsDiag>

  // The two verdicts worth stating outright, rather than making you infer them
  // from the numbers underneath.
  const earsOk = Boolean(v.running) && (v.accepted ?? 0) > 0
  const mouthOk = (t.started ?? 0) > 0 || (t.rescued ?? 0) > 0

  return (
    <div className="diag" aria-live="polite">
      <div className="diag-head">DIAGNOSTICS · D to close</div>

      <div className="diag-verdict">
        <span className={earsOk ? 'diag-ok' : 'diag-bad'}>
          {earsOk ? '● hearing you' : '● not hearing you'}
        </span>
        <span className={mouthOk ? 'diag-ok' : 'diag-bad'}>
          {mouthOk ? '● speaking' : '● no sound produced'}
        </span>
      </div>

      <div className="diag-sec">EXECUÇÃO</div>
      <Row k="backend" v={BACKEND === 'bridge' ? b.backend : 'Anthropic direto'} />
      <Row k="modelo" v={BACKEND === 'bridge' ? b.model : MODEL} />
      <Row k="Ollama" v={b.ollama} />
      <Row k="WebSocket" v={BACKEND === 'bridge' ? b.connection : 'não utilizado'} />
      <Row k="servidor" v={b.revision} />
      <Row k="código em disco" v={b.sourceStatus} />
      <Row k="instância" v={b.instance} />
      <Row k="iniciado em" v={b.startedAt} />
      <Row k="solicitação" v={b.request + ' · ' + b.state} />
      <Row k="pesquisa / modelo" v={b.research + ' / ' + b.modelState} />
      <Row k="frontend / fila" v={b.frontend + ' / ' + b.queueDepth} />
      <Row k="controller execução" v={String(b.controllerActive)} />
      <Row k="resultado caracteres" v={String(b.responseLength)} />
      <Row k="conclusão execução" v={b.completedAt ? new Date(b.completedAt).toLocaleTimeString() : '—'} />
      <Row k="último erro" v={b.lastError || '—'} bad={Boolean(b.lastError)} />
      <Row k="API reconhecimento" v={'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? 'presente; acesso depende do navegador' : 'ausente; verificar serviço alternativo'} />
      <Row k="API síntese" v={'speechSynthesis' in window ? 'presente; áudio não confirmado' : 'ausente; verificar serviço alternativo'} />
      <div className="diag-sec">LISTENING</div>
      <Row k="recogniser" v={v.running ? 'running' : 'STOPPED'} bad={!v.running} />
      <Row k="sessions" v={String(v.sessions ?? 0)} />
      <Row
        k="silent for"
        v={`${((v.idleMs ?? 0) / 1000).toFixed(1)}s`}
        bad={(v.idleMs ?? 0) > 15000}
      />
      <Row k="forced restarts" v={String(v.restarts ?? 0)} bad={(v.restarts ?? 0) > 0} />
      <Row k="mode" v={`${v.mode ?? '—'} (phase ${phase})`} />
      <Row k="accepted" v={String(v.accepted ?? 0)} bad={(v.accepted ?? 0) === 0} />
      <Row k="wakes" v={String(v.wakes ?? 0)} />
      <Row k="last heard" v={v.heard ? ago(v.heardAt ?? 0) : '— nothing yet'} bad={!v.heard} />
      <Row k="last drop" v={v.dropped ? 'segmento descartado' : '—'} bad={Boolean(v.dropped)} />
      <Row k="error" v={v.lastError ? 'falha no reconhecimento' : '—'} bad={Boolean(v.lastError)} />

      <div className="diag-sec">SPEAKING · press T to test</div>
      <Row k="pedido TTS" v={t.request || '—'} />
      <Row k="estado TTS" v={t.state || 'idle'} />
      <Row k="fala caracteres" v={String(t.responseLength ?? 0)} />
      <Row k="segmento / total" v={(t.currentSegment ?? 0) + ' / ' + (t.segments ?? 0)} />
      <Row k="fila TTS" v={String(t.queued ?? 0)} />
      <Row k="controller TTS" v={String(t.controllerActive ?? false)} />
      <Row k="início / fim" v={(t.startedAt ? new Date(t.startedAt).toLocaleTimeString() : '—') + ' / ' + (t.endedAt ? new Date(t.endedAt).toLocaleTimeString() : '—')} />
      <Row k="interrupção" v={t.reason || '—'} />
      <Row k="engine" v={String(t.engine ?? 'system')} />
      <Row k="voice" v={String(t.voice || '—')} />
      <Row k="handed to OS" v={String(t.spoken ?? 0)} />
      <Row k="actually spoke" v={String(t.started ?? 0)} bad={(t.started ?? 0) === 0} />
      <Row k="failures" v={String(t.failures ?? 0)} bad={(t.failures ?? 0) > 0} />
      <Row k="cloud rescues" v={String(t.rescued ?? 0)} />
      <Row k="error" v={t.lastError ? 'falha na síntese' : '—'} bad={Boolean(t.lastError)} />
    </div>
  )
}
