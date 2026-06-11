import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { matchState, opensAt, formatTime, formatShort, msToKickoff, formatCountdown } from '../lib/matchState'
import { savePrediction } from '../lib/queries'

function Flag({ src, size = 'h-7 w-7' }) {
  return (
    <span className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-md ring-1 ring-linea/80 shadow-[0_2px_8px_rgba(0,0,0,0.5)]`}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover"
             onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
      ) : (
        <span className="h-full w-full bg-linea-2" />
      )}
    </span>
  )
}

function Stepper({ value, setValue }) {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" aria-label="Restar" onClick={() => setValue(Math.max(0, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-lg border border-linea text-lg text-crema/70 transition hover:border-ambar/60 hover:text-ambar active:scale-90">−</button>
      <span className="relative grid h-10 w-9 place-items-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={reduce ? false : { y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: -14, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="absolute font-display text-3xl tabular text-crema"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" aria-label="Sumar" onClick={() => setValue(Math.min(20, value + 1))}
        className="grid h-9 w-9 place-items-center rounded-lg border border-linea text-lg text-crema/70 transition hover:border-ambar/60 hover:text-ambar active:scale-90">+</button>
    </div>
  )
}

const CHIP = {
  soon:     (m) => ({ txt: `Abre ${formatShort(opensAt(m))}`, cls: 'border-linea text-crema/40' }),
  open:     () => ({ txt: 'Abierto',  cls: 'border-cancha/50 text-cancha' }),
  locked:   () => ({ txt: 'Cerrado',  cls: 'border-linea text-crema/40' }),
  live:     () => ({ txt: 'En juego', cls: 'border-ambar/60 text-ambar' }),
  halftime: () => ({ txt: 'Medio tiempo', cls: 'border-ambar/60 text-ambar' }),
  finished: () => ({ txt: 'Final',    cls: 'border-linea text-crema/50' }),
}

function PuntosBadge({ pred }) {
  const p = Number(pred.points) || 0
  const ok = p > 0
  const partes = []
  if (pred.outcome_hit) partes.push(pred.pred_home === pred.pred_away ? 'Empate' : 'Ganador')
  if (pred.exact_hit) partes.push('Marcador exacto')
  else if (pred.goals_total_hit) partes.push('Cantidad de goles')
  const detalle = partes.length ? partes.join(' + ') : 'Sin aciertos'
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      title={detalle}
      className={`rounded-lg px-2.5 py-1 font-display text-sm tabular ${ok ? 'bg-cancha/15 text-cancha shadow-[0_0_18px_-6px_rgba(31,214,138,0.6)]' : 'bg-red-500/10 text-red-300'}`}>
      {ok ? `+${p}` : '0'} pts
    </motion.span>
  )
}

// Desglose explícito de por qué se ganaron los puntos
function Desglose({ pred }) {
  const partes = []
  if (pred.outcome_hit) {
    const empate = pred.pred_home === pred.pred_away
    partes.push({ t: empate ? 'Acertó el empate' : 'Acertó el ganador', p: empate ? '1.5' : '3' })
  }
  if (pred.exact_hit) partes.push({ t: 'Marcador exacto', p: '+1' })
  else if (pred.goals_total_hit) partes.push({ t: 'Cantidad de goles', p: '+0.5' })

  if (!partes.length)
    return <p className="mt-2 font-body text-[11px] uppercase tracking-wide text-crema/35">Sin aciertos</p>

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {partes.map((x, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-cancha/10 px-2 py-0.5 font-body text-[11px] text-cancha">
          <span className="text-cancha/80">✓</span> {x.t}
          <span className="font-display tabular text-cancha/70">{x.p}</span>
        </span>
      ))}
    </div>
  )
}

export default function MatchCard({ match, onSaved, predLabel = 'Tu predicción' }) {
  const reduce = useReducedMotion()
  const pred = match.prediction
  const [now, setNow] = useState(() => new Date())
  const [h, setH] = useState(pred?.pred_home ?? 0)
  const [a, setA] = useState(pred?.pred_away ?? 0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState(false)

  const st = matchState(match, now)

  // Reloj vivo: solo tictea cuando hace falta.
  //  open  -> cada 1s (contador hacia el pitazo; al llegar a 0 se bloquea solo)
  //  soon  -> cada 30s (basta para que se abra a tiempo)
  // En locked/live/finished no corre nada.
  useEffect(() => {
    if (st !== 'open' && st !== 'soon') return
    const period = st === 'open' ? 1000 : 30000
    const id = setInterval(() => setNow(new Date()), period)
    return () => clearInterval(id)
  }, [st])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1500)
    return () => clearTimeout(t)
  }, [flash])

  const chip = CHIP[st](match)
  const showScore = st === 'finished' || st === 'live' || st === 'halftime'
  const canPredict = st === 'open' && match.home && match.away
  const isLive = st === 'live'

  async function guardar() {
    setSaving(true); setMsg(''); setErr('')
    try {
      const saved = await savePrediction(match.id, h, a)
      setMsg('¡Guardado!')
      setFlash(true)
      onSaved?.(saved)
    } catch (e) {
      const t = (e.message || '').toLowerCase()
      if (t.includes('row-level security') || t.includes('policy') || t.includes('violates'))
        setErr('Este partido ya no admite predicciones.')
      else setErr('No se pudo guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`group relative overflow-hidden rounded-2xl border bg-petroleo-2 px-4 py-3.5 shadow-card transition-colors
        ${canPredict ? 'border-linea hover:border-ambar/45' : 'border-linea/70'}
        ${flash ? 'border-cancha/70 shadow-glow-cancha' : ''}`}
    >
      {/* borde superior dorado sutil al pasar el mouse en partidos abiertos */}
      {canPredict && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ambar/0 to-transparent transition-[background] duration-500 group-hover:via-ambar/60" />
      )}

      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-body text-[11px] uppercase tracking-wide text-crema/40">
          {match.round_label}{match.group_label ? ` · Grupo ${match.group_label}` : ''}
        </span>
        <span className={`relative flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-wider ${chip.cls}`}>
          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-ambar animate-live-pulse" />}
          {chip.txt}
          {isLive && !reduce && (
            <span className="pointer-events-none absolute inset-0 w-1/3 animate-shimmer bg-sheen" />
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2.5 overflow-hidden">
          <Flag src={match.home?.flag_url} />
          <span className="font-display text-base uppercase leading-tight tracking-wide text-crema [overflow-wrap:anywhere]">{match.home?.name ?? 'Por definir'}</span>
        </div>
        <div className="min-w-[72px] px-1 text-center">
          {showScore ? (
            <div className="inline-flex items-center gap-1 rounded-lg bg-petroleo px-2.5 py-1 ring-1 ring-linea/80">
              <span className="font-display text-2xl tabular leading-none text-crema">{match.home_goals ?? '–'}</span>
              <span className="font-display text-lg leading-none text-ambar/60">:</span>
              <span className="font-display text-2xl tabular leading-none text-crema">{match.away_goals ?? '–'}</span>
            </div>
          ) : (
            <span className="font-body text-xs tabular text-crema/55">{formatTime(match.kickoff)}</span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2.5 overflow-hidden">
          <span className="text-right font-display text-base uppercase leading-tight tracking-wide text-crema [overflow-wrap:anywhere]">{match.away?.name ?? 'Por definir'}</span>
          <Flag src={match.away?.flag_url} />
        </div>
      </div>

      {canPredict && (
        <div className="mt-3.5 border-t border-linea/60 pt-3.5">
          {(() => {
            const left = msToKickoff(match, now)
            const urgent = left <= 60 * 60 * 1000      // última hora
            const critical = left <= 5 * 60 * 1000      // últimos 5 min
            return (
              <div className={`mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-body text-[11px] uppercase tracking-wider transition-colors ${
                critical ? 'border-red-400/60 text-red-300'
                : urgent ? 'border-ambar/60 text-ambar'
                : 'border-linea text-crema/45'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${critical ? 'bg-red-400 animate-live-pulse' : urgent ? 'bg-ambar animate-live-pulse' : 'bg-crema/30'}`} />
                Cierra en <span className="font-display tabular tracking-normal">{formatCountdown(left)}</span>
              </div>
            )
          })()}
          <p className="mb-2.5 text-center font-body text-[11px] uppercase tracking-[0.2em] text-crema/40">Tu predicción</p>
          <div className="flex items-center justify-center gap-5">
            <Stepper value={h} setValue={setH} />
            <span className="font-display text-2xl text-ambar/40">:</span>
            <Stepper value={a} setValue={setA} />
          </div>
          <button onClick={guardar} disabled={saving}
            className="group/btn relative mt-3.5 w-full overflow-hidden rounded-xl bg-oro-grad py-2.5 font-display text-sm uppercase tracking-[0.15em] text-petroleo shadow-oro transition active:scale-[0.99] disabled:opacity-60">
            <span className="relative z-10">{saving ? 'Guardando…' : pred ? 'Actualizar predicción' : 'Guardar predicción'}</span>
            {!reduce && (
              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-all duration-700 group-hover/btn:left-[120%] group-hover/btn:opacity-100" />
            )}
          </button>
          <AnimatePresence>
            {msg && (
              <motion.p key="ok" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-2 flex items-center justify-center gap-1.5 font-body text-xs text-cancha">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-cancha/20">✓</span> {msg}
              </motion.p>
            )}
            {err && (
              <motion.p key="err" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-2 text-center font-body text-xs text-red-300">{err}</motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {!canPredict && pred && (
        <div className="mt-3.5 border-t border-linea/60 pt-3.5">
          <div className="flex items-center justify-between">
            <span className="font-body text-xs text-crema/50">
              {predLabel}: <span className="font-display text-base tabular text-crema">{pred.pred_home}–{pred.pred_away}</span>
            </span>
            {st === 'finished' && <PuntosBadge pred={pred} />}
          </div>
          {st === 'finished' && <Desglose pred={pred} />}
        </div>
      )}

      {st === 'soon' && !pred && (
        <p className="mt-2 font-body text-[11px] text-crema/35">Se abre cuando arranque la jornada anterior.</p>
      )}
    </motion.div>
  )
}