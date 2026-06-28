import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { matchState, opensAt, formatTime, formatShort, msToKickoff, formatCountdown } from '../lib/matchState'
import { savePrediction } from '../lib/queries'
import { useTeamView } from '../lib/teamView'

// ── Auditoría de predicciones ──────────────────────────────────────────────
// Muestra a qué hora se registró cada predicción y con qué marcador. Visible
// desde el primer partido del 22-jun-2026 (Argentina vs Austria) en adelante.
// Para incluir partidos anteriores, adelanta esta fecha.
const AUDITORIA_DESDE = new Date('2026-06-22T04:00:00Z') // 00:00 en Venezuela/Miami (-04)

const MESES_AUD = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fmtStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  let hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ampm = hh >= 12 ? 'p.\u00a0m.' : 'a.\u00a0m.'
  hh = hh % 12 || 12
  return `${d.getDate()} ${MESES_AUD[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm} ${ampm}`
}

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

// Botón "¿Quién avanza?" (bandera + nombre)
function AvanzaBtn({ team, active, disabled, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`flex items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
        active ? 'border-ambar/70 bg-ambar/10 text-crema shadow-[0_0_16px_-8px_rgba(232,180,78,0.7)]'
               : 'border-linea text-crema/70 enabled:hover:border-ambar/40'
      } ${disabled ? 'cursor-default opacity-35' : ''}`}>
      <Flag src={team?.flag_url} size="h-5 w-5" />
      <span className="min-w-0 flex-1 truncate font-display text-sm uppercase tracking-wide">{team?.name ?? '—'}</span>
      {active && <span className="shrink-0 text-ambar">✓</span>}
    </button>
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

function PuntosBadge({ pred, isKO }) {
  const p = Number(pred.points) || 0
  const ok = p > 0
  const partes = []
  if (isKO) {
    if (pred.outcome_hit) partes.push('Avanza')
    if (pred.exact_hit) partes.push('Marcador exacto')
    else if (pred.goals_total_hit) partes.push('Cantidad de goles')
  } else {
    if (pred.outcome_hit) partes.push(pred.pred_home === pred.pred_away ? 'Empate' : 'Ganador')
    if (pred.exact_hit) partes.push('Marcador exacto')
    else if (pred.goals_total_hit) partes.push('Cantidad de goles')
  }
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
function Desglose({ pred, isKO }) {
  const partes = []
  if (isKO) {
    if (pred.outcome_hit) partes.push({ t: 'Acertó quién avanza', p: '+3' })
    if (pred.exact_hit) partes.push({ t: 'Marcador exacto', p: '+1' })
    else if (pred.goals_total_hit) partes.push({ t: 'Cantidad de goles', p: '+0.5' })
  } else {
    if (pred.outcome_hit) {
      const empate = pred.pred_home === pred.pred_away
      partes.push({ t: empate ? 'Acertó el empate' : 'Acertó el ganador', p: empate ? '1.5' : '3' })
    }
    if (pred.exact_hit) partes.push({ t: 'Marcador exacto', p: '+1' })
    else if (pred.goals_total_hit) partes.push({ t: 'Cantidad de goles', p: '+0.5' })
  }

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
  const openTeam = useTeamView()
  const pred = match.prediction
  const [now, setNow] = useState(() => new Date())
  const [h, setH] = useState(pred?.pred_home ?? 0)
  const [a, setA] = useState(pred?.pred_away ?? 0)
  const [adv, setAdv] = useState(pred?.pred_advance ?? null)
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

  // Llave de eliminatoria que aún no tiene a sus dos equipos definidos
  const pendingKO = match.stage !== 'group' && (!match.home || !match.away)
  const chip = pendingKO ? { txt: 'Por definir', cls: 'border-linea text-crema/40' } : CHIP[st](match)
  const showScore = st === 'finished' || st === 'live' || st === 'halftime'
  const canPredict = st === 'open' && match.home && match.away
  const isLive = st === 'live'

  // Eliminatoria: el "avanza" se fija solo si el marcador tiene ganador;
  // si es empate, el usuario debe elegir uno (validación).
  const isKO = match.stage !== 'group'
  const forcedAdv = isKO ? (h > a ? 'home' : a > h ? 'away' : null) : null
  const advValue = forcedAdv ?? adv          // 'home' | 'away' | null
  const advMissing = isKO && advValue == null // empate sin elegir

  // Resultado de eliminatoria: penales y equipo que avanzó
  const hasPens = match.pen_home != null && match.pen_away != null
  const winId = isKO && st === 'finished' ? (match.winner_team_id ?? null) : null
  const homeAdv = winId != null && match.home_team_id === winId
  const awayAdv = winId != null && match.away_team_id === winId

  async function guardar() {
    if (advMissing) { setErr('Empate: elige quién avanza.'); return }
    setSaving(true); setMsg(''); setErr('')
    try {
      const saved = await savePrediction(match.id, h, a, isKO ? advValue : undefined)
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
        <button type="button" disabled={!match.home}
          onClick={(e) => { e.stopPropagation(); if (match.home) openTeam(match.home) }}
          className="flex flex-1 items-center gap-2.5 overflow-hidden text-left transition enabled:hover:opacity-80 enabled:active:scale-[0.98] disabled:cursor-default">
          <Flag src={match.home?.flag_url} />
          <span className={`font-display text-base uppercase leading-tight tracking-wide [overflow-wrap:anywhere] ${homeAdv ? 'text-gilded' : 'text-crema'}`}>{match.home?.name ?? 'Por definir'}</span>
        </button>
        <div className="min-w-[72px] px-1 text-center">
          {showScore ? (
            <div className="flex flex-col items-center gap-0.5">
              <div className="inline-flex items-center gap-1 rounded-lg bg-petroleo px-2.5 py-1 ring-1 ring-linea/80">
                <span className="font-display text-2xl tabular leading-none text-crema">{match.home_goals ?? '–'}</span>
                <span className="font-display text-lg leading-none text-ambar/60">:</span>
                <span className="font-display text-2xl tabular leading-none text-crema">{match.away_goals ?? '–'}</span>
              </div>
              {hasPens && (
                <span className="font-body text-[10px] tabular text-crema/50">pen <span className="text-crema/75">{match.pen_home}-{match.pen_away}</span></span>
              )}
            </div>
          ) : (
            <span className="font-body text-xs tabular text-crema/55">{formatTime(match.kickoff)}</span>
          )}
        </div>
        <button type="button" disabled={!match.away}
          onClick={(e) => { e.stopPropagation(); if (match.away) openTeam(match.away) }}
          className="flex flex-1 items-center justify-end gap-2.5 overflow-hidden text-right transition enabled:hover:opacity-80 enabled:active:scale-[0.98] disabled:cursor-default">
          <span className={`text-right font-display text-base uppercase leading-tight tracking-wide [overflow-wrap:anywhere] ${awayAdv ? 'text-gilded' : 'text-crema'}`}>{match.away?.name ?? 'Por definir'}</span>
          <Flag src={match.away?.flag_url} />
        </button>
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

          {isKO && (
            <div className="mt-3.5">
              <p className="mb-2 text-center font-body text-[11px] uppercase tracking-[0.2em] text-crema/40">¿Quién avanza?</p>
              <div className="grid grid-cols-2 gap-2">
                <AvanzaBtn team={match.home} active={advValue === 'home'} disabled={forcedAdv === 'away'} onClick={() => setAdv('home')} />
                <AvanzaBtn team={match.away} active={advValue === 'away'} disabled={forcedAdv === 'home'} onClick={() => setAdv('away')} />
              </div>
              {forcedAdv ? (
                <p className="mt-1.5 text-center font-body text-[10px] text-crema/35">Tu marcador ya define quién avanza.</p>
              ) : (
                <p className="mt-1.5 text-center font-body text-[10px] text-ambar/80">Empate: elige quién pasa en penales.</p>
              )}
            </div>
          )}

          <button onClick={guardar} disabled={saving || advMissing}
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
            {st === 'finished' && <PuntosBadge pred={pred} isKO={isKO} />}
          </div>
          {isKO && (() => {
            const side = pred.pred_home > pred.pred_away ? 'home'
              : pred.pred_away > pred.pred_home ? 'away' : pred.pred_advance
            const t = side === 'home' ? match.home : side === 'away' ? match.away : null
            if (!t) return null
            return (
              <p className="mt-1.5 flex items-center gap-1.5 font-body text-[11px] text-crema/50">
                <span className="uppercase tracking-wider text-crema/35">Tu avanza:</span>
                <Flag src={t.flag_url} size="h-4 w-4" />
                <span className="font-display uppercase tracking-wide text-crema/80">{t.name}</span>
              </p>
            )
          })()}
          {st === 'finished' && <Desglose pred={pred} isKO={isKO} />}
          {(() => {
            const stamp = pred.updated_at || pred.created_at
            if (!stamp || new Date(match.kickoff) < AUDITORIA_DESDE) return null
            return (
              <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-petroleo/60 px-2.5 py-1.5 font-body text-[11px] text-crema/45 ring-1 ring-linea/50">
                <span className="mt-px text-crema/35">🕒</span>
                <span>
                  Predicción <span className="font-display tabular text-crema/65">{pred.pred_home}–{pred.pred_away}</span> registrada el <span className="text-crema/65">{fmtStamp(stamp)}</span>
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {pendingKO ? (
        <p className="mt-2 font-body text-[11px] text-crema/35">Se define al terminar la ronda anterior.</p>
      ) : st === 'soon' && !pred && (
        <p className="mt-2 font-body text-[11px] text-crema/35">Se abre cuando arranque la jornada anterior.</p>
      )}
    </motion.div>
  )
}