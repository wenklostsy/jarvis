import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'

/**
 * Rotating example commands, shown only while idle.
 *
 * A voice interface has no menus — nothing tells you what it can do. This is
 * the affordance. It disappears the moment JARVIS is doing anything, so it
 * never competes with the answer.
 *
 * Each line is phrased the way you'd actually say it, not as a feature name.
 */
const EXAMPLES = [
  'que horas são',
  'abra o YouTube',
  'abra o Spotify',
  'pesquise por notícias de tecnologia',
  'coloque um timer de dez minutos',
  'abra o VS Code',
  'me conte uma piada',
  'o que você pode fazer',
  'que dia é hoje',
  'você pode abrir a pasta downloads',
  'pesquise no YouTube por aulas de violão',
  'procure farmácias no Maps',
  'me lembre de beber água em dez minutos',
  'quanto tempo falta',
  'abra as configurações de som',
]

const ROTATE_MS = 4200

export function Suggestions() {
  const phase = useStore((s) => s.phase)
  const turns = useStore((s) => s.turns)
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  // Only while genuinely idle, and only until the first exchange — once the
  // user knows how it works, the prompt is just clutter.
  if (phase !== 'dormant' || turns.length > 0) return null

  return (
    <div className="suggest">
      <span className="suggest-lead">experimente</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          className="suggest-text"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
        >
          “jarvis, {EXAMPLES[i]}”
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
