import { useEffect, useState } from 'react'
import { getMatches, adminUpdateMatch } from '../lib/queries'

const ESTADOS = [
  { code: 'NS', label: 'No empezado' },
  { code: '1H', label: 'En vivo' },
  { code: 'HT', label: 'Medio T.' },
  { code: 'FT', label: 'Final' },
]

// En eliminatorias se agrega el estado "Penales".
const ESTADOS_KO = [
  { code: 'NS', label: 'No empezado' },
  { code: '1H', label: 'En vivo' },
  { code: 'HT', label: 'Medio T.' },
  { code: 'PEN', label: 'Penales' },
  { code: 'FT', label: 'Final' },
]

// ISO -> valor para <input type="datetime-local"> (en hora local del admin)
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function Equipo({ team, align = 'left' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {team?.flag_url
        ? <img src={team.flag_url} alt="" className="h-5 w-7 shrink-0 rounded-sm object-cover ring-1 ring-black/30" />
        : <span className="h-5 w-7 shrink-0 rounded-sm border border-linea" />}
      <span className="truncate font-display text-sm uppercase tracking-wide text-crema">{team?.code || team?.name || '—'}</span>
    </div>
  )
}

function Stepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-8 w-8 place-items-center rounded-lg border border-linea font-display text-lg text-crema/70 active:scale-90">−</button>
      <span className="w-6 text-center font-display text-xl tabular text-gilded">{value}</span>
      <button onClick={() => onChange(value + 1)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-linea font-display text-lg text-crema/70 active:scale-90">+</button>
    </div>
  )
}

// Una fila de la tanda de penales: casillas que togglean verde (✓) / rojo (✕).
function PenRow({ team, kicks, setKicks }) {
  const toggle = (i) => setKicks(kicks.map((k, j) => (j === i ? (k === 'scored' ? 'missed' : 'scored') : k)))
  return (
    <div className="flex items-center gap-2">
      <div className="flex w-16 shrink-0 items-center gap-1.5">
        {team?.flag_url
          ? <img src={team.flag_url} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-black/30" />
          : <span className="h-4 w-6 shrink-0 rounded-sm border border-linea" />}
        <span className="truncate font-display text-xs uppercase tracking-wide text-crema/80">{team?.code || '—'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {kicks.map((k, i) => (
          <button key={i} onClick={() => toggle(i)}
            className={`grid h-5 w-5 place-items-center rounded-md border text-[10px] font-bold transition active:scale-90 ${
              k === 'scored' ? 'border-cancha bg-cancha/80 text-petroleo' : 'border-red-400 bg-red-500/70 text-white'}`}>
            {k === 'scored' ? '✓' : '✕'}
          </button>
        ))}
        <button onClick={() => setKicks([...kicks, 'scored'])}
          className="grid h-5 w-5 place-items-center rounded-md border border-linea text-crema/60 active:scale-90">+</button>
        {kicks.length > 0 && (
          <button onClick={() => setKicks(kicks.slice(0, -1))}
            className="grid h-5 w-5 place-items-center rounded-md border border-linea text-crema/60 active:scale-90">−</button>
        )}
      </div>
    </div>
  )
}

function AdminRow({ m }) {
  const isKO = m.stage !== 'group'
  const [h, setH] = useState(m.home_goals ?? 0)
  const [a, setA] = useState(m.away_goals ?? 0)
  const [status, setStatus] = useState(m.status)
  const [fecha, setFecha] = useState(toLocalInput(m.kickoff))
  const [kicksH, setKicksH] = useState(() => Array(m.pen_home ?? 0).fill('scored'))
  const [kicksA, setKicksA] = useState(() => Array(m.pen_away ?? 0).fill('scored'))
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

  const penH = kicksH.filter((k) => k === 'scored').length
  const penA = kicksA.filter((k) => k === 'scored').length
  // El editor de penales aparece cuando hace falta desempatar (empate en 120')
  const showPens = isKO && (status === 'PEN' || h === a || penH > 0 || penA > 0)

  async function push(patch) {
    setErr('')
    try {
      await adminUpdateMatch(m.id, patch)
      setOk(true); setTimeout(() => setOk(false), 1300)
    } catch (e) { console.error(e); setErr('Error al guardar') }
  }

  function cambiarGoles(nh, na) {
    setH(nh); setA(na)
    const s = status === 'NS' ? '1H' : status
    if (s !== status) setStatus(s)
    push({ home_goals: nh, away_goals: na, status: s })
  }

  function cambiarEstado(s) {
    setStatus(s)
    if (s === 'NS') { setH(0); setA(0); push({ status: 'NS', home_goals: null, away_goals: null }) }
    else push({ status: s, home_goals: h, away_goals: a })
  }

  function guardarPenales() {
    const s = status === 'FT' ? 'FT' : 'PEN'
    setStatus(s)
    // Manda también el marcador de los 120' para que la base pueda
    // deducir al que avanza cuando se marque Final.
    push({ pen_home: penH, pen_away: penA, status: s, home_goals: h, away_goals: a })
  }

  return (
    <div className="rounded-xl border border-linea bg-petroleo-2 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Equipo team={m.home} />
        <div className="flex shrink-0 items-center gap-1.5">
          <Stepper value={h} onChange={(v) => cambiarGoles(v, a)} />
          <span className="text-crema/40">:</span>
          <Stepper value={a} onChange={(v) => cambiarGoles(h, v)} />
        </div>
        <Equipo team={m.away} align="right" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(isKO ? ESTADOS_KO : ESTADOS).map((e) => (
          <button key={e.code} onClick={() => cambiarEstado(e.code)}
            className={`rounded-lg border px-2.5 py-1 font-body text-[11px] uppercase tracking-wider transition active:scale-95 ${
              status === e.code ? 'border-ambar/70 bg-ambar/10 text-ambar' : 'border-linea text-crema/55 hover:text-crema'
            }`}>
            {e.label}
          </button>
        ))}
        <span className="ml-auto font-body text-[11px]">
          {err ? <span className="text-red-400">{err}</span> : ok ? <span className="text-cancha">✓ guardado</span> : null}
        </span>
      </div>

      {showPens && (
        <div className="mt-2 border-t border-linea/50 pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-body text-[11px] uppercase tracking-wider text-crema/45">Penales</span>
            <span className="font-display text-sm tabular text-gilded">{penH} – {penA}</span>
          </div>
          <div className="space-y-1.5">
            <PenRow team={m.home} kicks={kicksH} setKicks={setKicksH} />
            <PenRow team={m.away} kicks={kicksA} setKicks={setKicksA} />
          </div>
          {h === a && penH === penA && (
            <p className="mt-1.5 font-body text-[10px] text-ambar/80">Empate: los penales deben quedar distintos para definir quién avanza.</p>
          )}
          <button onClick={guardarPenales}
            className="mt-2 w-full rounded-lg border border-ambar/50 bg-ambar/10 py-1.5 font-body text-[11px] uppercase tracking-wider text-ambar transition active:scale-95">
            Guardar penales
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 border-t border-linea/50 pt-2">
        <span className="shrink-0 font-body text-[11px] uppercase tracking-wider text-crema/45">Fecha</span>
        <input
          type="datetime-local"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-linea bg-petroleo px-2 py-1 font-body text-xs text-crema [color-scheme:dark] focus:border-ambar/60 focus:outline-none"
        />
        <button
          onClick={() => { if (fecha) push({ kickoff: new Date(fecha).toISOString() }) }}
          className="shrink-0 rounded-lg border border-linea px-2.5 py-1 font-body text-[11px] uppercase tracking-wider text-crema/65 transition hover:border-ambar/60 hover:text-ambar active:scale-95"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

export default function Admin({ onClose }) {
  const [matches, setMatches] = useState([])
  const [state, setState] = useState('loading')
  const [q, setQ] = useState('')
  const [verTodos, setVerTodos] = useState(false)

  function load() {
    setState('loading')
    getMatches()
      .then((ms) => { setMatches(ms); setState('ready') })
      .catch((e) => { console.error(e); setState('error') })
  }
  useEffect(() => { load() }, [])

  if (state === 'loading') return <div className="py-20 text-center font-body text-crema/60">Cargando panel…</div>
  if (state === 'error') return <div className="py-20 text-center font-body text-crema/60">No se pudo cargar el panel.</div>

  let lista = [...matches].sort((x, y) => new Date(x.kickoff) - new Date(y.kickoff))
  if (!verTodos) lista = lista.filter((m) => m.status !== 'FT')
  if (q.trim()) {
    const t = q.trim().toLowerCase()
    lista = lista.filter((m) =>
      (m.home?.name || '').toLowerCase().includes(t) || (m.away?.name || '').toLowerCase().includes(t) ||
      (m.home?.code || '').toLowerCase().includes(t) || (m.away?.code || '').toLowerCase().includes(t))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl uppercase tracking-wide">Panel admin</h2>
        <button onClick={onClose}
          className="rounded-lg border border-linea px-3 py-1.5 font-body text-xs uppercase tracking-wider text-crema/65 transition hover:border-ambar/60 hover:text-ambar active:scale-95">
          Volver
        </button>
      </div>
      <p className="mb-4 font-body text-sm text-crema/50">Cambia marcador y estado en vivo. Cada toque se guarda al instante y recalcula los puntos de todos.</p>

      <div className="mb-4 flex items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipo…"
          className="min-w-0 flex-1 rounded-lg border border-linea bg-petroleo-2 px-3 py-2 font-body text-sm text-crema placeholder:text-crema/35 focus:border-ambar/60 focus:outline-none" />
        <button onClick={() => setVerTodos((v) => !v)}
          className={`shrink-0 rounded-lg border px-3 py-2 font-body text-xs uppercase tracking-wider active:scale-95 ${verTodos ? 'border-ambar/70 text-ambar' : 'border-linea text-crema/60'}`}>
          {verTodos ? 'Todos' : 'Activos'}
        </button>
        <button onClick={load} title="Refrescar"
          className="shrink-0 rounded-lg border border-linea px-3 py-2 font-body text-sm text-crema/60 active:scale-95">↻</button>
      </div>

      {lista.length === 0 ? (
        <div className="py-16 text-center font-body text-sm text-crema/50">Sin partidos para mostrar.</div>
      ) : (
        <div className="space-y-2.5">
          {lista.map((m) => <AdminRow key={m.id} m={m} />)}
        </div>
      )}
    </div>
  )
}