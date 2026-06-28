import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { matchState } from '../lib/matchState'
import { useTeamView } from '../lib/teamView'

// ── Estructura del cuadro (estilo KNOCKOUTS: mitades que convergen al centro) ─
// Columnas (de izq. a der.): R32 · R16 · QF · SF · FINAL · SF · QF · R16 · R32
// La mitad izquierda y la derecha apuntan hacia el trofeo central.
const L_R32 = ['R32-1', 'R32-2', 'R32-3', 'R32-4', 'R32-5', 'R32-6', 'R32-7', 'R32-8']
const L_R16 = ['R16-A', 'R16-B', 'R16-C', 'R16-D']
const L_QF  = ['QF-1', 'QF-2']
const L_SF  = ['SF-1']
const R_SF  = ['SF-2']
const R_QF  = ['QF-3', 'QF-4']
const R_R16 = ['R16-E', 'R16-F', 'R16-G', 'R16-H']
const R_R32 = ['R32-9', 'R32-10', 'R32-11', 'R32-12', 'R32-13', 'R32-14', 'R32-15', 'R32-16']

// Índice de columna (0..8) -> centro X en % para alinear líneas y celdas.
const COLS = 9
const colX = (c) => ((c + 0.5) / COLS) * 100
// Centro Y en % de la llave j de una ronda con N llaves.
const rowY = (j, n) => ((j + 0.5) / n) * 100

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (d.getFullYear() > 2090) return '' // casilla provisional "Por definir"
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MESES[d.getMonth()]} · ${hh}:${mm}`
}

function winnerId(m) {
  if (!m) return null
  if (m.winner_team_id != null) return m.winner_team_id
  if (matchState(m) === 'finished' && m.home_goals != null && m.away_goals != null) {
    if (m.home_goals > m.away_goals) return m.home_team_id
    if (m.away_goals > m.home_goals) return m.away_team_id
  }
  return null
}

// ── Bandera circular (estilo de la imagen) ─────────────────────────────────
function FlagDot({ team, win, lose, size = 'h-7 w-7 sm:h-9 sm:w-9' }) {
  const openTeam = useTeamView()
  return (
    <button type="button" disabled={!team}
      onClick={(e) => { e.stopPropagation(); if (team) openTeam(team) }}
      title={team?.name || 'Por definir'}
      className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full transition
        enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-default
        ${team ? (win ? 'ring-2 ring-ambar shadow-[0_0_12px_-2px_rgba(232,180,78,0.85)]' : 'ring-2 ring-linea/70') : 'border-2 border-dashed border-linea/50'}
        ${lose ? 'opacity-35 grayscale' : ''}`}>
      {team?.flag_url
        ? <img src={team.flag_url} alt="" className="h-full w-full object-cover"
               onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
        : <span className="h-full w-full bg-petroleo-2" />}
    </button>
  )
}

// ── Una llave: dos banderas + marcador/penales que quepa ───────────────────
function Llave({ m, big = false }) {
  const st = m ? matchState(m) : 'soon'
  const done = st === 'finished'
  const live = st === 'live' || st === 'halftime'
  const showScore = done || live
  const wId = done ? winnerId(m) : null
  const homeWin = wId != null && m?.home_team_id === wId
  const awayWin = wId != null && m?.away_team_id === wId
  const hasPens = m?.pen_home != null && m?.pen_away != null
  const size = big ? 'h-9 w-9 sm:h-11 sm:w-11' : undefined

  return (
    <div className="flex flex-col items-center gap-0.5">
      <FlagDot team={m?.home ?? null} win={homeWin} lose={awayWin} size={size} />
      <FlagDot team={m?.away ?? null} win={awayWin} lose={homeWin} size={size} />
      {showScore && (
        <span className="mt-0.5 font-display text-[10px] leading-none tabular text-crema/85">
          {m.home_goals ?? '–'}<span className="text-ambar/50">–</span>{m.away_goals ?? '–'}
        </span>
      )}
      {hasPens && (
        <span className="font-body text-[8px] leading-none tabular text-crema/45">pen {m.pen_home}-{m.pen_away}</span>
      )}
      {live && (
        <span className="flex items-center gap-0.5 font-body text-[8px] uppercase tracking-wider text-cancha">
          <span className="h-1 w-1 animate-live-pulse rounded-full bg-cancha" />vivo
        </span>
      )}
      {done && m?.prediction && (
        <span title={`${Number(m.prediction.points) > 0 ? '+' : ''}${Number(m.prediction.points)} pts`}
          className={`h-1.5 w-1.5 rounded-full ${Number(m.prediction.points) > 0 ? 'bg-cancha' : 'bg-red-400/70'}`} />
      )}
    </div>
  )
}

// Genera los segmentos de línea que unen un par de llaves con su llave padre.
function buildLinks(feederCol, parentCol, parentSlots, bySlot) {
  const fN = parentSlots.length * 2
  const segs = []
  parentSlots.forEach((slot, k) => {
    const y0 = rowY(2 * k, fN)
    const y1 = rowY(2 * k + 1, fN)
    const yp = (y0 + y1) / 2
    const fx = colX(feederCol)
    const px = colX(parentCol)
    const mx = (fx + px) / 2
    const pm = bySlot[slot]
    const lit = !!(pm?.home && pm?.away)
    segs.push({ x1: fx, y1: y0, x2: mx, y2: y0, lit })
    segs.push({ x1: fx, y1: y1, x2: mx, y2: y1, lit })
    segs.push({ x1: mx, y1: y0, x2: mx, y2: y1, lit })
    segs.push({ x1: mx, y1: yp, x2: px, y2: yp, lit })
  })
  return segs
}

export default function Bracket() {
  const [matches, setMatches] = useState([])
  const [state, setState] = useState('loading')

  useEffect(() => {
    let active = true
    const load = () =>
      getMatches()
        .then((m) => { if (active) { setMatches(m); setState('ready') } })
        .catch((e) => { if (active) { console.error(e); setState((s) => (s === 'loading' ? 'error' : s)) } })
    load()
    const t = setInterval(load, 30000)
    return () => { active = false; clearInterval(t) }
  }, [])

  if (state === 'loading') return <div className="py-20 text-center font-body text-crema/60">Cargando bracket…</div>
  if (state === 'error') return <div className="py-20 text-center font-body text-crema/60">No se pudo cargar el bracket.</div>

  const bySlot = {}
  for (const m of matches) if (m.bracket_slot) bySlot[m.bracket_slot] = m

  const final = bySlot['FINAL'] ?? null
  const tercero = bySlot['3P'] ?? null
  const champId = winnerId(final)
  const champ = champId != null
    ? (final?.home_team_id === champId ? final.home : final?.away_team_id === champId ? final.away : null)
    : null

  // Líneas del cuadro (mitad izq col 0->3, mitad der col 8->5, y SF->FINAL).
  const links = [
    ...buildLinks(0, 1, L_R16, bySlot),
    ...buildLinks(1, 2, L_QF, bySlot),
    ...buildLinks(2, 3, L_SF, bySlot),
    ...buildLinks(8, 7, R_R16, bySlot),
    ...buildLinks(7, 6, R_QF, bySlot),
    ...buildLinks(6, 5, R_SF, bySlot),
    { x1: colX(3), y1: 50, x2: colX(4), y2: 50, lit: !!final?.home },
    { x1: colX(5), y1: 50, x2: colX(4), y2: 50, lit: !!final?.away },
  ]

  // Una celda posicionada en la grilla (columna c, llave j de N).
  const Cell = ({ slot, c, j, n, big }) => {
    const span = 8 / n
    return (
      <div style={{ gridColumn: c + 1, gridRow: `${j * span + 1} / span ${span}` }}
        className="relative z-10 flex items-center justify-center">
        <Llave m={bySlot[slot] ?? null} big={big} />
      </div>
    )
  }

  const LABELS = ['16vos', 'Octavos', 'Cuartos', 'Semis', 'Final', 'Semis', 'Cuartos', 'Octavos', '16vos']

  return (
    <div>
      <h2 className="mb-4 font-display text-4xl uppercase leading-none tracking-wide">Bracket</h2>

      {/* Etiquetas de ronda alineadas a las columnas */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {LABELS.map((l, i) => (
          <span key={i} className={`text-center font-body text-[8px] uppercase leading-none tracking-[0.08em] sm:text-[10px] ${i === 4 ? 'text-gilded' : 'text-crema/35'}`}>{l}</span>
        ))}
      </div>

      {/* Cuadro: cabe al ancho de la pantalla, sin scroll horizontal */}
      <div className="relative mt-2 h-[34rem] w-full overflow-hidden sm:h-[42rem]">
        {/* Conectores dorados (SVG, escalan con el contenedor) */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {links.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke={s.lit ? '#E8B44E' : '#5A1A20'} strokeWidth="1" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" opacity={s.lit ? 0.8 : 0.7} />
          ))}
        </svg>

        {/* Banderas en grilla */}
        <div className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: 'repeat(8, 1fr)' }}>
          {/* Mitad izquierda */}
          {L_R32.map((s, j) => <Cell key={s} slot={s} c={0} j={j} n={8} />)}
          {L_R16.map((s, j) => <Cell key={s} slot={s} c={1} j={j} n={4} />)}
          {L_QF.map((s, j)  => <Cell key={s} slot={s} c={2} j={j} n={2} />)}
          {L_SF.map((s, j)  => <Cell key={s} slot={s} c={3} j={j} n={1} />)}
          {/* Final (centro) */}
          <div style={{ gridColumn: 5, gridRow: '1 / span 8' }} className="relative z-10 flex flex-col items-center justify-center gap-1">
            <Llave m={final} big />
            <AnimatePresence>
              {champ && (
                <motion.span key="c" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="max-w-[6rem] truncate text-center font-display text-[10px] uppercase tracking-wide text-gilded sm:text-xs">{champ.name}</motion.span>
              )}
            </AnimatePresence>
          </div>
          {/* Mitad derecha */}
          {R_SF.map((s, j)  => <Cell key={s} slot={s} c={5} j={j} n={1} />)}
          {R_QF.map((s, j)  => <Cell key={s} slot={s} c={6} j={j} n={2} />)}
          {R_R16.map((s, j) => <Cell key={s} slot={s} c={7} j={j} n={4} />)}
          {R_R32.map((s, j) => <Cell key={s} slot={s} c={8} j={j} n={8} />)}
        </div>
      </div>

      {/* 3.er puesto (si aplica), debajo del cuadro */}
      {tercero && (
        <div className="mt-4 flex flex-col items-center">
          <span className="mb-1 font-body text-[10px] uppercase tracking-[0.18em] text-crema/40">Tercer puesto</span>
          <Llave m={tercero} />
        </div>
      )}
    </div>
  )
}
