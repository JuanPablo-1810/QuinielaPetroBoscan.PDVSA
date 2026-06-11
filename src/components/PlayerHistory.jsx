import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getUserHistory } from '../lib/queries'
import { matchState } from '../lib/matchState'
import MatchCard from './MatchCard'

// Panel con el historial de UNA persona: los partidos ya jugados que predijo,
// con su marcador, sus puntos y el desglose de por qué los ganó.
// La base solo entrega predicciones de partidos que ya arrancaron (anti-copia).
export default function PlayerHistory({ userId, name, isMe = false, onClose }) {
  const [matches, setMatches] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    setState('loading')
    getUserHistory(userId)
      .then((m) => { if (active) { setMatches(m); setState('ready') } })
      .catch((e) => { if (active) { console.error(e); setState('error') } })
    return () => { active = false }
  }, [userId])

  // Cerrar con la tecla Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Solo partidos jugados que esta persona predijo
  const jugados = matches
    .filter((m) => matchState(m) === 'finished' && m.prediction)
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))

  const total = jugados.reduce((s, m) => s + (Number(m.prediction.points) || 0), 0)
  const exactos = jugados.filter((m) => m.prediction.exact_hit).length

  // Agrupar por jornada
  const grupos = []
  const idx = {}
  for (const m of jugados) {
    const k = m.round_label || 'Partidos'
    if (idx[k] == null) { idx[k] = grupos.length; grupos.push({ label: k, items: [], pts: 0 }) }
    const g = grupos[idx[k]]
    g.items.push(m)
    g.pts += Number(m.prediction.points) || 0
  }

  const etiqueta = isMe ? 'Tu predicción' : 'Predicción'

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 grid place-items-end bg-black/70 backdrop-blur-sm sm:place-items-center sm:p-6"
      >
        <motion.div
          key="panel"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-linea bg-petroleo-2 shadow-card sm:rounded-2xl"
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between gap-3 border-b border-linea/70 px-5 py-4">
            <div className="min-w-0">
              <p className="font-body text-[11px] uppercase tracking-[0.25em] text-crema/40">Historial</p>
              <h3 className="truncate font-display text-2xl uppercase tracking-wide text-crema">
                {name}{isMe && <span className="ml-1 text-ambar/80">(tú)</span>}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-linea text-lg text-crema/70 transition hover:border-ambar/60 hover:text-ambar active:scale-90"
            >
              ✕
            </button>
          </div>

          {/* Resumen */}
          {state === 'ready' && jugados.length > 0 && (
            <div className="flex items-center justify-between border-b border-linea/50 px-5 py-3">
              <span className="font-body text-xs text-crema/50">
                {jugados.length} jugados · {exactos} exactos
              </span>
              <span className="font-display text-xl tabular text-gilded">{total} pts</span>
            </div>
          )}

          {/* Cuerpo */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {state === 'loading' && <p className="py-16 text-center font-body text-sm text-crema/55">Cargando historial…</p>}
            {state === 'error' && <p className="py-16 text-center font-body text-sm text-red-300">No se pudo cargar el historial.</p>}
            {state === 'ready' && jugados.length === 0 && (
              <p className="py-16 text-center font-body text-sm text-crema/55">
                {isMe ? 'Aún no tienes partidos jugados.' : 'Esta persona aún no tiene predicciones en partidos jugados.'}
              </p>
            )}
            {state === 'ready' && grupos.map((g) => (
              <section key={g.label} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rotate-45 bg-ambar shadow-[0_0_10px_rgba(232,180,78,0.7)]" />
                  <h4 className="font-display text-base uppercase tracking-wide text-gilded">{g.label}</h4>
                  <span className="h-px flex-1 bg-gradient-to-r from-linea to-transparent" />
                  <span className="rounded-lg bg-ambar/10 px-2 py-0.5 font-display text-sm tabular text-gilded">+{g.pts} pts</span>
                </div>
                <div className="space-y-2.5">
                  {g.items.map((m) => <MatchCard key={m.id} match={m} predLabel={etiqueta} />)}
                </div>
              </section>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
