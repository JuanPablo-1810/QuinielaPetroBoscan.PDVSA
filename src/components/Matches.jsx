import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { dayKey, formatDay, matchState } from '../lib/matchState'
import MatchCard from './MatchCard'

function Estado({ children, icon }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full border border-linea text-xl text-ambar/70">{icon}</div>
      <p className="font-body text-sm text-crema/55">{children}</p>
    </div>
  )
}

export default function Matches() {
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

  function handleSaved(matchId, saved) {
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, prediction: saved } : m)))
  }

  if (state === 'loading') return <Estado icon="⏱">Cargando partidos…</Estado>
  if (state === 'error') return <Estado icon="!">No se pudieron cargar los partidos.</Estado>

  // los terminados pasan a Historial: aqui solo los proximos / en juego
  const visibles = matches.filter((m) => matchState(m) !== 'finished')
  if (!visibles.length) return <Estado icon="⚽">No hay partidos próximos. Revisa el Historial.</Estado>

  const days = []
  const idx = {}
  for (const m of visibles) {
    const k = dayKey(m.kickoff)
    if (idx[k] == null) { idx[k] = days.length; days.push({ key: k, date: m.kickoff, items: [] }) }
    days[idx[k]].items.push(m)
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <h2 className="font-display text-4xl uppercase leading-none tracking-wide">Partidos</h2>
        <span className="font-body text-xs uppercase tracking-widest text-crema/40">{visibles.length} próximos</span>
      </div>

      <div className="space-y-8">
        {days.map((d, di) => (
          <motion.section
            key={d.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(di * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rotate-45 bg-ambar shadow-[0_0_10px_rgba(232,180,78,0.7)]" />
              <h3 className="font-display text-lg uppercase tracking-wide text-gilded">{formatDay(d.date)}</h3>
              <span className="h-px flex-1 bg-gradient-to-r from-linea to-transparent" />
              <span className="font-body text-[11px] tabular text-crema/35">{d.items.length}</span>
            </div>
            <div className="space-y-2.5">
              {d.items.map((m, mi) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(di * 0.04 + mi * 0.03, 0.5), ease: [0.22, 1, 0.36, 1] }}
                >
                  <MatchCard match={m} onSaved={(saved) => handleSaved(m.id, saved)} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  )
}