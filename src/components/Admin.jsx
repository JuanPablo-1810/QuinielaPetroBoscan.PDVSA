import { useEffect, useState } from 'react'
import { getMatches, adminUpdateMatch } from '../lib/queries'

const ESTADOS = [
  { code: 'NS', label: 'No empezado' },
  { code: '1H', label: 'En vivo' },
  { code: 'HT', label: 'Medio T.' },
  { code: 'FT', label: 'Final' },
]

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

function AdminRow({ m }) {
  const [h, setH] = useState(m.home_goals ?? 0)
  const [a, setA] = useState(m.away_goals ?? 0)
  const [status, setStatus] = useState(m.status)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

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
        {ESTADOS.map((e) => (
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