import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { matchState } from '../lib/matchState'
import { useTeamView } from '../lib/teamView'

const ROUNDS = [
  { key: 'r32', label: 'Ronda de 32', slots: 16 },
  { key: 'r16', label: 'Octavos', slots: 8 },
  { key: 'qf', label: 'Cuartos', slots: 4 },
  { key: 'sf', label: 'Semifinales', slots: 2 },
  { key: 'third', label: 'Tercer puesto', slots: 1 },
  { key: 'final', label: 'Final', slots: 1 },
]

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MESES[d.getMonth()]} · ${hh}:${mm}`
}

function Lado({ team, ganador, perdedor, goles }) {
  const openTeam = useTeamView()
  return (
    <div className={`flex items-center justify-between gap-2 ${perdedor ? 'opacity-40' : ''}`}>
      <button type="button" disabled={!team}
        onClick={(e) => { e.stopPropagation(); if (team) openTeam(team) }}
        className="flex min-w-0 items-center gap-2 text-left transition enabled:hover:opacity-80 enabled:active:scale-[0.98] disabled:cursor-default">
        {team?.flag_url
          ? <img src={team.flag_url} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/30" />
          : <span className="h-4 w-6 shrink-0 rounded-sm border border-linea" />}
        <span className={`truncate font-display text-sm uppercase tracking-wide ${team ? (ganador ? 'text-gilded' : 'text-crema') : 'text-crema/30'}`}>
          {team ? (team.code || team.name) : 'Por definir'}
        </span>
      </button>
      <span className={`font-display text-base tabular ${ganador ? 'text-gilded' : 'text-crema/60'}`}>{goles}</span>
    </div>
  )
}

function Llave({ m }) {
  const st = m ? matchState(m) : 'soon'
  const done = st === 'finished'
  const live = st === 'live'
  const hg = m?.home_goals
  const ag = m?.away_goals
  const homeWin = done && hg != null && ag != null && hg > ag
  const awayWin = done && hg != null && ag != null && ag > hg
  const verMarcador = done || live

  return (
    <div className={`rounded-xl border bg-petroleo-2 px-3 py-2.5 ${live ? 'border-cancha/40' : 'border-linea'}`}>
      <div className="space-y-1.5">
        <Lado team={m?.home ?? null} ganador={homeWin} perdedor={awayWin} goles={verMarcador ? (hg ?? '–') : ''} />
        <div className="h-px bg-linea/60" />
        <Lado team={m?.away ?? null} ganador={awayWin} perdedor={homeWin} goles={verMarcador ? (ag ?? '–') : ''} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-body text-[10px] uppercase tracking-widest text-crema/35">
          {m ? fechaCorta(m.kickoff) : 'Por definir'}
        </span>
        {live && (
          <span className="flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-cancha">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cancha" />En vivo
          </span>
        )}
        {done && m?.prediction && (
          <span className={`rounded px-1.5 py-0.5 font-display text-[11px] tabular ${Number(m.prediction.points) > 0 ? 'bg-cancha/15 text-cancha' : 'bg-red-500/15 text-red-300'}`}>
            {Number(m.prediction.points) > 0 ? '+' : ''}{Number(m.prediction.points)} pts
          </span>
        )}
      </div>
    </div>
  )
}

export default function Bracket() {
  const [matches, setMatches] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    getMatches()
      .then((m) => { if (active) { setMatches(m); setState('ready') } })
      .catch((e) => { if (active) { console.error(e); setState('error') } })
    return () => { active = false }
  }, [])

  if (state === 'loading') return <div className="py-20 text-center font-body text-crema/60">Cargando bracket…</div>
  if (state === 'error') return <div className="py-20 text-center font-body text-crema/60">No se pudo cargar el bracket.</div>

  const porFase = {}
  for (const m of matches) {
    if (m.stage && m.stage !== 'group') (porFase[m.stage] ??= []).push(m)
  }
  for (const k in porFase) porFase[k].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))

  return (
    <div>
      <h2 className="mb-2 font-display text-4xl uppercase leading-none tracking-wide">Bracket</h2>
      <p className="mb-6 font-body text-sm text-crema/50">El cuadro se llena solo a medida que terminan los grupos y avanza el torneo.</p>

      <div className="space-y-8">
        {ROUNDS.map((r, ri) => {
          const reales = porFase[r.key] ?? []
          const faltan = Math.max(0, r.slots - reales.length)
          const llaves = [...reales, ...Array.from({ length: faltan }, () => null)]
          return (
            <motion.section
              key={r.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: Math.min(ri * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="h-1.5 w-1.5 rotate-45 bg-ambar shadow-[0_0_10px_rgba(232,180,78,0.7)]" />
                <h3 className="font-display text-lg uppercase tracking-wide text-gilded">{r.label}</h3>
                <span className="h-px flex-1 bg-gradient-to-r from-linea to-transparent" />
                <span className="font-body text-[11px] tabular text-crema/35">{reales.length}/{r.slots}</span>
              </div>
              <div className={`grid gap-2.5 ${r.slots > 1 ? 'sm:grid-cols-2' : ''}`}>
                {llaves.map((m, i) => <Llave key={m?.id ?? `${r.key}-ph-${i}`} m={m} />)}
              </div>
            </motion.section>
          )
        })}
      </div>
    </div>
  )
}