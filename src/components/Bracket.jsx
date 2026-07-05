import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMatches } from '../lib/queries'
import { matchState } from '../lib/matchState'
import { useTeamView } from '../lib/teamView'

// ── Estructura del cuadro (estilo KNOCKOUTS: dos mitades que convergen al centro) ─
// Columnas (izq→der): R32 · R16 · QF · SF · FINAL · SF · QF · R16 · R32
const L_R32 = ['R32-1', 'R32-2', 'R32-3', 'R32-4', 'R32-5', 'R32-6', 'R32-7', 'R32-8']
const L_R16 = ['R16-A', 'R16-B', 'R16-C', 'R16-D']
const L_QF  = ['QF-1', 'QF-2']
const L_SF  = ['SF-1']
const R_SF  = ['SF-2']
const R_QF  = ['QF-3', 'QF-4']
const R_R16 = ['R16-E', 'R16-F', 'R16-G', 'R16-H']
const R_R32 = ['R32-9', 'R32-10', 'R32-11', 'R32-12', 'R32-13', 'R32-14', 'R32-15', 'R32-16']

// Columnas de cada mitad, con su índice de columna (0..8) y nº de llaves.
const LEFT  = [{ slots: L_R32, c: 0, n: 8 }, { slots: L_R16, c: 1, n: 4 }, { slots: L_QF, c: 2, n: 2 }, { slots: L_SF, c: 3, n: 1 }]
const RIGHT = [{ slots: R_SF, c: 5, n: 1 }, { slots: R_QF, c: 6, n: 2 }, { slots: R_R16, c: 7, n: 4 }, { slots: R_R32, c: 8, n: 8 }]

const COLS = 9
// Centro X en % con un pequeño margen lateral para que no se corten las banderas.
const PAD = 3
const colX = (c) => PAD + ((c + 0.5) / COLS) * (100 - 2 * PAD)
// Centro Y en % de la llave j (de n llaves de esa ronda).
const rowY = (j, n) => ((j + 0.5) / n) * 100
// Separación vertical (en %) entre las dos banderas de una misma llave.
const gap = (n) => Math.min(3.4, (100 / n) * 0.26)

function winnerId(m) {
  if (!m) return null
  if (m.winner_team_id != null) return m.winner_team_id
  if (matchState(m) === 'finished' && m.home_goals != null && m.away_goals != null) {
    if (m.home_goals > m.away_goals) return m.home_team_id
    if (m.away_goals > m.home_goals) return m.away_team_id
  }
  return null
}

// ── Bandera circular. Estados: advance (color+brillo) · out (gris) · pending (neutro) ─
function Flag({ team, state, style, size }) {
  const openTeam = useTeamView()
  const ring =
    state === 'advance' ? 'ring-2 ring-ambar shadow-[0_0_10px_-1px_rgba(232,180,78,0.9)]'
    : state === 'out'   ? 'ring-1 ring-linea/40'
    : team              ? 'ring-1 ring-linea/70'
    :                     'border-2 border-dashed border-linea/40'
  return (
    <button type="button" disabled={!team} style={style}
      onClick={(e) => { e.stopPropagation(); if (team) openTeam(team) }}
      title={team?.name || 'Por definir'}
      className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full transition
        enabled:hover:scale-110 enabled:active:scale-95 disabled:cursor-default ${size} ${ring}
        ${state === 'out' ? 'opacity-40 grayscale' : ''}`}>
      {team?.flag_url
        ? <img src={team.flag_url} alt="" className="h-full w-full object-cover"
               onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
        : <span className="h-full w-full bg-petroleo-2" />}
    </button>
  )
}

// Estado de cada bandera dentro de una llave decidida/pendiente.
function flagStates(m) {
  const wId = winnerId(m)
  if (wId == null) return { home: 'pending', away: 'pending' }
  return {
    home: m?.home_team_id === wId ? 'advance' : 'out',
    away: m?.away_team_id === wId ? 'advance' : 'out',
  }
}

// Segmentos que unen cada par de llaves con su llave padre (en % de coordenadas).
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
    // "activa" = esa rama ya tiene a sus dos equipos (se ve más brillante).
    const lit = !!(pm?.home && pm?.away) || winnerId(pm) != null
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

  // Líneas del cuadro (izq col 0→3, der col 8→5, y SF→FINAL).
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

  // Tamaño de bandera según la ronda (más grande a medida que avanza).
  // En móvil van pequeñas para que las líneas respiren.
  const sizeFor = (n) =>
    n >= 8 ? 'h-5 w-5 sm:h-8 sm:w-8'
    : n >= 4 ? 'h-6 w-6 sm:h-9 sm:w-9'
    : 'h-7 w-7 sm:h-10 sm:w-10'

  // Recolecta todas las banderas (izq + der) como elementos posicionados.
  const flags = []
  for (const { slots, c, n } of [...LEFT, ...RIGHT]) {
    slots.forEach((slot, j) => {
      const m = bySlot[slot] ?? null
      const st = flagStates(m)
      const yc = rowY(j, n)
      const dy = gap(n)
      const size = sizeFor(n)
      flags.push({ key: slot + '-h', team: m?.home ?? null, state: st.home, x: colX(c), y: yc - dy, size })
      flags.push({ key: slot + '-a', team: m?.away ?? null, state: st.away, x: colX(c), y: yc + dy, size })
    })
  }
  // Final (columna central).
  {
    const st = flagStates(final)
    flags.push({ key: 'F-h', team: final?.home ?? null, state: st.home, x: colX(4), y: 50 - 4, size: 'h-9 w-9 sm:h-12 sm:w-12' })
    flags.push({ key: 'F-a', team: final?.away ?? null, state: st.away, x: colX(4), y: 50 + 4, size: 'h-9 w-9 sm:h-12 sm:w-12' })
  }

  return (
    <div>
      <h2 className="mb-3 font-display text-4xl uppercase leading-none tracking-wide">Bracket</h2>
      <p className="mb-4 font-body text-[11px] text-crema/45">
        En <span className="text-ambar">color</span> los que avanzan · en gris los eliminados. Toca una bandera para ver su historial.
      </p>

      {/* Cuadro: cabe al ancho de la pantalla, sin scroll horizontal */}
      <div className="relative mt-1 h-[42rem] w-full sm:h-[48rem]">
        {/* Conectores (SVG que escala con el contenedor) */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {/* Todas las líneas del mismo dorado (como en la referencia); las
              ramas ya definidas se ven un poco más brillantes. */}
          {links.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke="#E8B44E" strokeWidth="1.2" strokeLinecap="square"
              vectorEffect="non-scaling-stroke" opacity={s.lit ? 0.95 : 0.5} />
          ))}
        </svg>

        {/* Banderas */}
        {flags.map((f) => (
          <Flag key={f.key} team={f.team} state={f.state} size={f.size}
            style={{ left: `${f.x}%`, top: `${f.y}%` }} />
        ))}

        {/* Campeón */}
        <AnimatePresence>
          {champ && (
            <motion.div key="champ" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 text-center" style={{ top: '58%' }}>
              <div className="font-body text-[8px] uppercase tracking-[0.2em] text-gilded/70">Campeón</div>
              <div className="max-w-[7rem] truncate font-display text-xs uppercase tracking-wide text-gilded sm:text-sm">{champ.name}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3.er puesto (si aplica), debajo del cuadro */}
      {tercero && (tercero.home || tercero.away) && (
        <div className="mt-4 flex flex-col items-center gap-1.5 border-t border-linea/40 pt-4">
          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-crema/40">Tercer puesto</span>
          <div className="flex items-center gap-3">
            {(() => {
              const st = flagStates(tercero)
              return (
                <>
                  <Flag3 team={tercero?.home ?? null} state={st.home} />
                  <span className="font-body text-xs text-crema/30">vs</span>
                  <Flag3 team={tercero?.away ?? null} state={st.away} />
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

// Bandera del 3.er puesto (posición estática, fuera del cuadro absoluto).
function Flag3({ team, state }) {
  const openTeam = useTeamView()
  const ring =
    state === 'advance' ? 'ring-2 ring-ambar shadow-[0_0_10px_-1px_rgba(232,180,78,0.9)]'
    : team ? 'ring-1 ring-linea/70' : 'border-2 border-dashed border-linea/40'
  return (
    <button type="button" disabled={!team} onClick={() => team && openTeam(team)}
      title={team?.name || 'Por definir'}
      className={`grid h-8 w-8 place-items-center overflow-hidden rounded-full transition enabled:hover:scale-110 enabled:active:scale-95
        ${ring} ${state === 'out' ? 'opacity-40 grayscale' : ''}`}>
      {team?.flag_url
        ? <img src={team.flag_url} alt="" className="h-full w-full object-cover" />
        : <span className="h-full w-full bg-petroleo-2" />}
    </button>
  )
}
