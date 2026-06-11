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

// ───────────────────────────────────────────────────────────────────────────
// Cálculo de la tabla de cada grupo a partir de los partidos terminados.
//
//   Gana  → +3 puntos        (suma al ganador, nada al perdedor)
//   Empata → +1 punto a cada uno
//   Pierde → +0 puntos       (NUNCA se resta: 0 se queda en 0, 2 en 2, etc.)
//
// Solo cuentan los partidos en estado 'finished' con marcador cargado.
// ───────────────────────────────────────────────────────────────────────────
function construirGrupos(matches) {
  const porGrupo = {}

  for (const m of matches) {
    if (m.stage !== 'group' || !m.group_label) continue
    const G = (porGrupo[m.group_label] ??= { label: m.group_label, filas: {} })

    // Toda selección del grupo aparece, aunque aún no haya jugado.
    for (const t of [m.home, m.away]) {
      if (t && !G.filas[t.id]) {
        G.filas[t.id] = { team: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
      }
    }

    const terminado =
      matchState(m) === 'finished' &&
      m.home_goals != null && m.away_goals != null &&
      m.home && m.away

    if (!terminado) continue

    const h = G.filas[m.home.id]
    const a = G.filas[m.away.id]

    h.pj++; a.pj++
    h.gf += m.home_goals; h.gc += m.away_goals
    a.gf += m.away_goals; a.gc += m.home_goals

    if (m.home_goals > m.away_goals) {
      h.g++; h.pts += 3   // local gana
      a.p++               // visitante pierde → sin cambios de puntos
    } else if (m.home_goals < m.away_goals) {
      a.g++; a.pts += 3   // visitante gana
      h.p++               // local pierde → sin cambios de puntos
    } else {
      h.e++; a.e++        // empate
      h.pts += 1; a.pts += 1
    }
  }

  const orden = 'ABCDEFGHIJKL'.split('')
  return Object.values(porGrupo)
    .sort((x, y) => orden.indexOf(x.label) - orden.indexOf(y.label))
    .map((G) => ({
      label: G.label,
      filas: Object.values(G.filas)
        .map((f) => ({ ...f, pts: Math.max(0, f.pts), dg: f.gf - f.gc }))
        // Orden FIFA: puntos → diferencia de gol → goles a favor → nombre
        .sort(
          (a, b) =>
            b.pts - a.pts ||
            b.dg - a.dg ||
            b.gf - a.gf ||
            a.team.name.localeCompare(b.team.name)
        ),
    }))
}

// Una sola rejilla compartida por el encabezado y por cada fila: así las
// columnas (PJ G E P DG PTS) quedan SIEMPRE alineadas verticalmente.
const GRID =
  'grid grid-cols-[3px_18px_30px_minmax(0,1fr)_26px_22px_22px_22px_34px_32px] items-center gap-x-1'

function zona(pos) {
  // 1-2 clasifica · 3 mejor tercero · 4 eliminado
  if (pos <= 2) return { band: 'bg-cancha', tint: 'bg-cancha/[0.045]' }
  if (pos === 3) return { band: 'bg-ambar/80', tint: 'bg-ambar/[0.04]' }
  return { band: 'bg-red-500/60', tint: '' }
}

function Fila({ f, pos }) {
  const { band, tint } = zona(pos)
  const dg = f.dg > 0 ? `+${f.dg}` : `${f.dg}`
  const lider = pos === 1

  return (
    <li className={`${GRID} px-3 py-2.5 transition-colors hover:bg-petroleo-3/60 ${tint}`}>
      <span className={`h-7 w-[3px] shrink-0 rounded-full ${band}`} />
      <span className="text-center font-display text-sm tabular text-crema/40">{pos}</span>
      <span className="grid h-[22px] w-[30px] place-items-center overflow-hidden rounded-md ring-1 ring-linea/80">
        <img
          src={f.team.flag_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
        />
      </span>
      <span className={`min-w-0 truncate font-display text-sm uppercase tracking-wide ${lider ? 'text-gilded' : 'text-crema'}`}>
        {f.team.code || f.team.name}
      </span>
      <span className="text-center font-display text-[13px] tabular text-crema/60">{f.pj}</span>
      <span className="text-center font-display text-[13px] tabular text-crema/45">{f.g}</span>
      <span className="text-center font-display text-[13px] tabular text-crema/45">{f.e}</span>
      <span className="text-center font-display text-[13px] tabular text-crema/45">{f.p}</span>
      <span className="text-center font-display text-[13px] tabular text-crema/70">{dg}</span>
      <span className="text-center font-display text-base leading-none tabular text-gilded">{f.pts}</span>
    </li>
  )
}

function EncabezadoColumnas() {
  const cell = 'text-center font-body text-[10px] uppercase tracking-wider text-crema/35'
  return (
    <div className={`${GRID} border-b border-linea/50 px-3 pb-1.5 pt-1`}>
      <span />
      <span />
      <span />
      <span className="font-body text-[10px] uppercase tracking-wider text-crema/35">Equipo</span>
      <span className={cell}>PJ</span>
      <span className={cell}>G</span>
      <span className={cell}>E</span>
      <span className={cell}>P</span>
      <span className={cell}>DG</span>
      <span className="text-center font-body text-[10px] uppercase tracking-wider text-ambar/70">PTS</span>
    </div>
  )
}

export default function Groups() {
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
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ambar/80" /> Mejor 3.º</span>
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
            <span className="pointer-events-none absolute -right-5 -top-7 select-none font-display text-[7rem] leading-none text-oro opacity-[0.06]">
              {G.label}
            </span>

            {/* Título de la tarjeta */}
            <div className="relative flex items-center gap-3 px-4 pt-3.5 pb-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-oro-grad font-display text-xl leading-none text-petroleo shadow-oro">
                {G.label}
              </span>
              <span className="font-body text-[11px] uppercase tracking-[0.22em] text-crema/50">
                Grupo {G.label}
              </span>
            </div>

            {/* Etiquetas de columnas alineadas con las filas */}
            <EncabezadoColumnas />

            <ul className="relative divide-y divide-linea/30">
              {G.filas.map((f, idx) => (
                <Fila key={f.team.id} f={f} pos={idx + 1} />
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  )
}