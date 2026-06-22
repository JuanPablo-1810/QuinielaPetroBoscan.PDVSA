import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { matchState } from '../lib/matchState'
import MatchCard from './MatchCard'

function Estado({ children, icon }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full border border-linea text-xl text-ambar/70">{icon}</div>
      <p className="font-body text-sm text-crema/55">{children}</p>
    </div>
  )
}

// Un partido entra al historial cuando su contador YA cerró (arrancó el partido),
// aunque todavía no haya finalizado. Así las predicciones de todos quedan a la
// vista apenas cierra la ventana y nadie puede alterar nada después.
const CERRADO = ['locked', 'live', 'halftime', 'finished']

export default function Historial() {
  const [matches, setMatches] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    const load = () =>
      getMatches()
        .then((m) => { if (active) { setMatches(m); setState('ready') } })
        .catch((e) => { console.error(e); if (active) setState((st) => (st === 'loading' ? 'error' : st)) })
    load()
    const t = setInterval(load, 30000) // auto-refresco: refleja los cambios del admin
    return () => { active = false; clearInterval(t) }
  }, [])

  if (state === 'loading') return <Estado icon="⏱">Cargando historial…</Estado>
  if (state === 'error') return <Estado icon="!">No se pudo cargar el historial.</Estado>

  const cerrados = matches.filter((m) => CERRADO.includes(matchState(m)))

  // En curso: contador cerrado pero el partido aún no finaliza (sin puntos todavía)
  const enCurso = cerrados
    .filter((m) => matchState(m) !== 'finished')
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))

  // Finalizados: con puntos ya calculados
  const finalizados = cerrados
    .filter((m) => matchState(m) === 'finished')
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff))

  if (!enCurso.length && !finalizados.length)
    return <Estado icon="📅">Aún no hay partidos cerrados.</Estado>

  // Finalizados agrupados por jornada con tu total de puntos
  const grupos = []
  const idx = {}
  for (const m of finalizados) {
    const k = m.round_label || 'Partidos'
    if (idx[k] == null) { idx[k] = grupos.length; grupos.push({ label: k, items: [], pts: 0, conPred: 0 }) }
    const g = grupos[idx[k]]
    g.items.push(m)
    if (m.prediction) { g.pts += Number(m.prediction.points) || 0; g.conPred += 1 }
  }

  return (
    <div>
      <h2 className="mb-6 font-display text-4xl uppercase leading-none tracking-wide">Historial</h2>

      {enCurso.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-9"
        >
          <div className="mb-2.5 flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-ambar animate-live-pulse" />
            <h3 className="font-display text-lg uppercase tracking-wide text-ambar">En curso</h3>
            <span className="h-px flex-1 bg-gradient-to-r from-ambar/40 to-transparent" />
            <span className="font-body text-[11px] uppercase tracking-wider text-crema/40">cerrado · sin puntuar</span>
          </div>
          <p className="mb-3 font-body text-[11px] leading-relaxed text-crema/45">
            El contador ya cerró: las predicciones quedan a la vista de todos. Los puntos se calculan cuando el partido finalice.
          </p>
          <div className="space-y-2.5">
            {enCurso.map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        </motion.section>
      )}

      <div className="space-y-8">
        {grupos.map((g, gi) => (
          <motion.section
            key={g.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(gi * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rotate-45 bg-ambar shadow-[0_0_10px_rgba(232,180,78,0.7)]" />
              <h3 className="font-display text-lg uppercase tracking-wide text-gilded">{g.label}</h3>
              <span className="h-px flex-1 bg-gradient-to-r from-linea to-transparent" />
              {g.conPred > 0 && (
                <span className="rounded-lg bg-ambar/10 px-2 py-0.5 font-display text-sm tabular text-gilded">+{g.pts} pts</span>
              )}
            </div>
            <div className="space-y-2.5">
              {g.items.map((m) => <MatchCard key={m.id} match={m} />)}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  )
}