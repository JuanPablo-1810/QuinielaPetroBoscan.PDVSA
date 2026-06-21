import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { matchState } from '../lib/matchState'
import MatchCard from './MatchCard'

// Panel con el historial de UN equipo: todos sus partidos (jugados y próximos),
// con el marcador real y —en los jugados— TU predicción y tus puntos en ese
// partido. Se abre al tocar cualquier equipo en cualquier pantalla.
export default function TeamHistory({ team, onClose }) {
  const [matches, setMatches] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    setState('loading')
    getMatches()
      .then((m) => { if (active) { setMatches(m); setState('ready') } })
      .catch((e) => { if (active) { console.error(e); setState('error') } })
    return () => { active = false }
  }, [team.id])

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const suyos = matches.filter(
    (m) => m.home_team_id === team.id || m.away_team_id === team.id
  )
  const jugados = suyos
    .filter((m) => matchState(m) === 'finished')
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))
  const proximos = suyos
    .filter((m) => { const s = matchState(m); return s !== 'finished' && s !== 'annulled' })
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))

  // Récord del equipo (desde los jugados) + tus puntos en sus partidos
  let g = 0, e = 0, p = 0, gf = 0, gc = 0, misPts = 0, conPred = 0
  for (const m of jugados) {
    const esLocal = m.home_team_id === team.id
    const tg = esLocal ? m.home_goals : m.away_goals
    const og = esLocal ? m.away_goals : m.home_goals
    if (tg != null && og != null) {
      gf += tg; gc += og
      if (tg > og) g++
      else if (tg < og) p++
      else e++
    }
    if (m.prediction) { misPts += Number(m.prediction.points) || 0; conPred++ }
  }
  const dg = gf - gc
  const dgTxt = dg > 0 ? `+${dg}` : `${dg}`

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
          {/* Encabezado: bandera + nombre del equipo */}
          <div className="flex items-center justify-between gap-3 border-b border-linea/70 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-12 shrink-0 place-items-center overflow-hidden rounded-md ring-1 ring-linea/80">
                {team.flag_url
                  ? <img src={team.flag_url} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                  : <span className="h-full w-full bg-linea-2" />}
              </span>
              <div className="min-w-0">
                <p className="font-body text-[11px] uppercase tracking-[0.25em] text-crema/40">Equipo</p>
                <h3 className="truncate font-display text-2xl uppercase tracking-wide text-crema">{team.name}</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-linea text-lg text-crema/70 transition hover:border-ambar/60 hover:text-ambar active:scale-90"
            >
              ✕
            </button>
          </div>

          {/* Resumen: récord del equipo + tus puntos en sus partidos */}
          {state === 'ready' && jugados.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-linea/50 px-5 py-3">
              <span className="font-body text-xs text-crema/55">
                {jugados.length} jugados · <span className="text-cancha">{g}G</span> {e}E <span className="text-red-300">{p}P</span> · {gf}:{gc} <span className="text-crema/40">({dgTxt})</span>
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span className="font-display text-xl tabular text-gilded">{misPts} pts</span>
                <span className="font-body text-[10px] uppercase tracking-wider text-crema/35">tus puntos aquí</span>
              </span>
            </div>
          )}

          {/* Cuerpo */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {state === 'loading' && <p className="py-16 text-center font-body text-sm text-crema/55">Cargando…</p>}
            {state === 'error' && <p className="py-16 text-center font-body text-sm text-red-300">No se pudo cargar.</p>}
            {state === 'ready' && jugados.length === 0 && proximos.length === 0 && (
              <p className="py-16 text-center font-body text-sm text-crema/55">No hay partidos de este equipo todavía.</p>
            )}

            {state === 'ready' && jugados.length > 0 && (
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rotate-45 bg-ambar shadow-[0_0_10px_rgba(232,180,78,0.7)]" />
                  <h4 className="font-display text-base uppercase tracking-wide text-gilded">Jugados</h4>
                  <span className="h-px flex-1 bg-gradient-to-r from-linea to-transparent" />
                  {conPred > 0 && <span className="rounded-lg bg-ambar/10 px-2 py-0.5 font-display text-sm tabular text-gilded">+{misPts} pts</span>}
                </div>
                <div className="space-y-2.5">
                  {jugados.map((m) => <MatchCard key={m.id} match={m} predLabel="Tu predicción" />)}
                </div>
              </section>
            )}

            {state === 'ready' && proximos.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rotate-45 bg-crema/40" />
                  <h4 className="font-display text-base uppercase tracking-wide text-crema/70">Próximos</h4>
                  <span className="h-px flex-1 bg-gradient-to-r from-linea to-transparent" />
                </div>
                <div className="space-y-2.5">
                  {proximos.map((m) => <MatchCard key={m.id} match={m} predLabel="Tu predicción" />)}
                </div>
              </section>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
