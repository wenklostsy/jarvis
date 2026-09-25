import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, accentFor, type Phase } from '../store'
import { SessionHud } from './SessionHud'
import { Suggestions } from './Suggestions'
import { BladeSweep, Blades } from './Blades'
import { Effects } from './Effects'
import { Pointer } from './Pointer'
import { GestureGuide } from './GestureGuide'

const statusText: Record<Phase, string> = {
  offline: 'DESLIGADO',
  boot: 'INICIANDO',
  dormant: 'EM ESPERA — DIGA “JARVIS”',
  waking: 'ATIVO',
  listening: 'OUVINDO',
  thinking: 'PROCESSANDO',
  tooling: 'ACESSANDO SISTEMAS',
  speaking: 'RESPONDENDO',
}

function Corner({ at }: { at: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <div className={`corner corner-${at}`} />
}

/* --------------------------------------------------------------------- hud */

export function Hud() {
  const phase = useStore((s) => s.phase)
  const activeTool = useStore((s) => s.activeTool)
  const connected = useStore((s) => s.connected)
  const level = useStore((s) => s.level)
  const voice = useStore((s) => s.voice)
  const bootNote = useStore((s) => s.bootNote)
  const gestures = useStore((s) => s.gestures)
  const looking = useStore((s) => s.looking)
  const ui = useStore((s) => s.ui)

  // accentFor folds JARVIS's overrides in over the phase colour, so one
  // variable on the root carries a theme change into every .hud-* rule without
  // a single component knowing a theme exists.
  const colour = accentFor(phase, ui)

  useEffect(() => {
    // The ground has to be set on the document, not painted here: the HUD sits
    // above the 3D scene, so a background drawn inside it would cover the
    // reactor rather than sit behind it. --bg is what html, body, #root and the
    // boot screen all pin themselves to.
    const root = document.documentElement
    if (ui.background) root.style.setProperty('--bg', ui.background)
    else root.style.removeProperty('--bg')
  }, [ui.background])

  return (
    <div className="hud" style={{ ['--accent' as string]: colour }}>
      {/* First in the tree on purpose. Everything after it is positioned with
          `z-index: auto`, so paint order is document order and the sweep stays
          behind the transcript and the panels without a z-index war. */}
      <BladeSweep />

      <Corner at="tl" />
      <Corner at="tr" />
      <Corner at="bl" />
      <Corner at="br" />

      <header className="hud-top">
        {ui.chrome.brand && (
          <div className="brand">
            <span className="brand-mark">J.A.R.V.I.S.</span>
            <span className="brand-sub">Assistente pessoal por voz</span>
          </div>
        )}

        <div className="status">
          <span className="dot" />
          <span className="status-text">
            {/* bootNote is the voice-model download readout. It is only ever
                the right thing to show during boot — as a general fallback a
                note that never got cleared (a stuck 'voice 97%') sits over
                LISTENING and PROCESSING for the rest of the session. */}
            {phase === 'boot' && bootNote ? bootNote : statusText[phase]}
          </span>
        </div>
      </header>

      {/* Left rail: which integrations are live */}
      {ui.chrome.systems && (
        <aside className="rail rail-left">
          <div className="rail-title">SISTEMAS</div>
          {connected.length === 0 && <div className="rail-item dim">comandos locais</div>}
          {connected.map((c) => (
            <div key={c} className="rail-item">
              <span className="tick" />
              {c}
            </div>
          ))}
          <div className="rail-item">
            <span className="tick" />
            Navegador
          </div>
        </aside>
      )}

      {/* Right rail: live telemetry, mostly for flavour */}
      <aside className="rail rail-right">
        <div className="rail-title">SINAL</div>
        <div className="meter">
          <div className="meter-fill" style={{ height: `${level * 100}%` }} />
        </div>
        <div className="rail-item mono">{(level * 100).toFixed(0).padStart(3, '0')}%</div>
      </aside>

      <AnimatePresence>
        {activeTool && ui.chrome.toolBadge && (
          <motion.div
            className="tool-badge"
            // Anchored to the TOP of the frame, not the middle. The old home was
            // viewport-centre plus a fixed drop, which on a tall or square
            // window landed the headline straight on top of the bottom
            // transcript — two elements pinned to different edges of the screen
            // were always going to meet somewhere. Up here it sits in its own
            // band with the rest of the status chrome and can never collide with
            // the log. Framer owns `transform` on an animated element, so the
            // centring (x: -50%) lives in these props, not the stylesheet.
            initial={{ opacity: 0, x: '-50%', y: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: '-50%', y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: '-50%', y: -8, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <span className="tool-kicker">
              <span className="spinner" />
              accessing
            </span>
            <span className="tool-name">{activeTool.replace(/[_-]/g, ' ')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {ui.chrome.transcript && <SessionHud />}

      {/* The one surface. Panels used to sit alongside this as a second place
          for things to appear, which meant two places to look and a decision
          the model had to make on grounds it could not know. Everything renders
          here now; Panels.tsx is unmounted rather than deleted so the design
          system it documents stays findable. */}
      <Blades />

      {ui.chrome.suggestions && <Suggestions />}



      <footer className="hud-bottom">
        <span className="hint">
          diga <b>“jarvis”</b> · <kbd>Espaço</kbd> para falar · <kbd>G</kbd> gestos
          {voice && (
            <>
              {' · '}
              <kbd>V</kbd> voz: {voice.replace(/\(.*?\)/g, '').trim()}
            </>
          )}
        </span>
      </footer>

      {/* Last, so a flash or a tear reads as being on the glass rather than
          underneath the chrome. It is pointer-events: none and unmounts the
          instant it finishes. */}
      <Effects />

      {/* Above even the effects: the reticle shows where a press will land, and
          a press that lands under a flourish is a press you cannot aim. */}
      <Pointer />
      {(gestures || looking) && (
        <div className="hands-live">
          {looking ? `OBSERVANDO — ${looking.toUpperCase()}` : 'CÂMERA LIGADA · G PARA PARAR'}
        </div>
      )}
      <GestureGuide live={gestures} />
    </div>
  )
}
