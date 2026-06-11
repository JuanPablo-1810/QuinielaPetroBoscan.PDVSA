import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { matchState } from '../lib/matchState'

function Estado({ children, icon }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full border border-linea text-xl text-ambar/70">{icon}</div>
      <p className="font-body text-sm text-crema/55">{children}</p>
    </div>
  )
}

// Construye la tabla de cada grupo a partir de los partidos jugados
function construirGrupos(matches) {
  const porGrupo = {}
  for (const m of matches) {
    if (m.stage !== 'group' || !m.group_label) continue
    const G = (porGrupo[m.group_label] ??= { label: m.group_label, filas: {} })
    for (const t of [m.home, m.away]) {
      if (t && !G.filas[t.id]) G.filas[t.id] = { team: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
    }
    if (matchState(m) === 'finished' && m.home_goals != null && m.away_goals != null && m.home && m.away) {
      const h = G.filas[m.home.id], a = G.filas[m.away.id]
      h.pj++; a.pj++
      h.gf += m.home_goals; h.gc += m.away_goals
      a.gf += m.away_goals; a.gc += m.home_goals
      if (m.home_goals > m.away_goals) { h.g++; h.pts += 3; a.p++ }
      else if (m.home_goals < m.away_goals) { a.g++; a.pts += 3; h.p++ }
      else { h.e++; a.e++; h.pts++; a.pts++ }
    }
  }
  const orden = 'ABCDEFGHIJKL'.split('')
  return Object.values(porGrupo)
    .sort((x, y) => orden.indexOf(x.label) - orden.indexOf(y.label))
    .map((G) => ({
      label: G.label,
      filas: Object.values(G.filas)
        .map((f) => ({ ...f, dg: f.gf - f.gc }))
        .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.team.name.localeCompare(b.team.name)),
    }))
}

const COL = 'w-[26px] text-center font-display text-[11px] tabular'

function Fila({ f, pos }) {
  // 1-2 clasifica (verde) · 3 mejor tercero (ámbar) · 4 eliminado (rojo)
  const banda = pos <= 2 ? 'bg-cancha' : pos === 3 ? 'bg-ambar/70' : 'bg-red-500/60'
  const dg = f.dg > 0 ? `+${f.dg}` : `${f.dg}`
  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      <span className={`h-7 w-1 shrink-0 rounded-full ${banda}`} />
      <span className="w-4 shrink-0 text-center font-display text-sm tabular text-crema/45">{pos}</span>
      <span className="grid h-6 w-8 shrink-0 place-items-center overflow-hidden rounded-md ring-1 ring-linea/80">
        <img src={f.team.flag_url} alt="" className="h-full w-full object-cover"
             onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide text-crema">{f.team.code || f.team.name}</span>
      <span className={COL + ' text-crema/55'}>{f.pj}</span>
      <span className={COL + ' text-crema/45'}>{f.g}</span>
      <span className={COL + ' text-crema/45'}>{f.e}</span>
      <span className={COL + ' text-crema/45'}>{f.p}</span>
      <span className={COL + ' text-crema/70'}>{dg}</span>
      <span className={COL.replace('text-[11px]', 'text-sm') + ' text-gilded'}>{f.pts}</span>
    </li>
  )
}

export default function Groups() {
  const reduce = useReducedMotion()
  const [grupos, setGrupos] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    const load = () =>
      getMatches()
        .then((ms) => { if (active) { setGrupos(construirGrupos(ms)); setState('ready') } })
        .catch((e) => { console.error(e); if (active) setState((s) => (s === 'loading' ? 'error' : s)) })
    load()
    const t = setInterval(load, 30000) // se actualiza sola con los resultados
    return () => { active = false; clearInterval(t) }
  }, [])

  if (state === 'loading') return <Estado icon="⏱">Cargando grupos…</Estado>
  if (state === 'error') return <Estado icon="!">No se pudieron cargar los grupos.</Estado>

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-display text-4xl uppercase leading-none tracking-wide">Fase de grupos</h2>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cancha" title="Se actualiza sola" />
      </div>
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 font-body text-[11px] text-crema/45">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cancha" /> Clasifica</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ambar/70" /> Mejor 3.º</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500/60" /> Eliminado</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grupos.map((G, i) => (
          <motion.div
            key={G.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
            className="group relative overflow-hidden rounded-2xl border border-linea bg-petroleo-2 shadow-card"
          >
            <span className="pointer-events-none absolute -right-6 -top-8 select-none font-display text-[8rem] leading-none text-oro opacity-[0.06]">{G.label}</span>
            <div className="relative flex items-center gap-3 border-b border-linea/70 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-oro-grad font-display text-xl leading-none text-petroleo shadow-oro">{G.label}</span>
              <span className="font-body text-[11px] uppercase tracking-[0.22em] text-crema/50">Grupo {G.label}</span>
              <span className="ml-auto flex items-center gap-2 pr-1 font-body text-[10px] uppercase tracking-wider text-crema/35">
                <span className="w-[26px] text-center">PJ</span>
                <span className="w-[26px] text-center">G</span>
                <span className="w-[26px] text-center">E</span>
                <span className="w-[26px] text-center">P</span>
                <span className="w-[26px] text-center">DG</span>
                <span className="w-[26px] text-center text-ambar/70">PTS</span>
              </span>
            </div>
            <ul className="relative divide-y divide-linea/40">
              {G.filas.map((f, idx) => <Fila key={f.team.id} f={f} pos={idx + 1} />)}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  )
}