import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllTeams, finishOnboarding } from '../lib/queries'

const PASOS = ['Bienvenida', 'Puntos', 'Reglas', 'Favoritos']

function Bienvenida() {
  return (
    <div className="text-center">
      <svg viewBox="0 0 44 44" className="mx-auto mb-5 h-16 w-16 drop-shadow-[0_6px_16px_rgba(232,180,78,0.4)]">
        <defs>
          <linearGradient id="oroOn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBE8BE" /><stop offset="55%" stopColor="#E8B44E" /><stop offset="100%" stopColor="#C8902F" />
          </linearGradient>
        </defs>
        <path d="M22 2 L39 12 V32 L22 42 L5 32 V12 Z" fill="none" stroke="url(#oroOn)" strokeWidth="2" />
        <path d="M22 13l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="url(#oroOn)" />
      </svg>
      <p className="mb-2 font-body text-[11px] uppercase tracking-[0.3em] text-ambar/90">Bienvenido</p>
      <h2 className="font-display text-4xl uppercase leading-none tracking-wide">
        Quiniela <span className="text-gilded">PetroBoscan</span>
      </h2>
      <p className="mx-auto mt-5 max-w-md font-body text-crema/70">
        Predice los resultados de los partidos del Mundial 2026 y compite con tus compañeros.
        Quien más puntos acumule a lo largo del torneo se lleva la quiniela. Te explico cómo en 30 segundos.
      </p>
    </div>
  )
}

function Fila({ label, sub, pts }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-linea bg-petroleo-2 px-4 py-3 transition-colors hover:border-ambar/35">
      <div>
        <p className="font-body text-sm text-crema">{label}</p>
        {sub && <p className="font-body text-xs text-crema/45">{sub}</p>}
      </div>
      <span className="font-display text-xl tabular text-gilded">{pts}</span>
    </div>
  )
}

function Puntos() {
  return (
    <div>
      <h2 className="mb-4 text-center font-display text-3xl uppercase tracking-wide">¿Cómo se ganan los puntos?</h2>
      <div className="space-y-2">
        <Fila label="Aciertas el empate" sub="Sin importar el marcador" pts="1.5" />
        <Fila label="Aciertas el ganador" sub="Sin importar el marcador" pts="3" />
        <Fila label="+ Marcador exacto" sub="El resultado clavado" pts="+1" />
        <Fila label="+ Cantidad total de goles" sub="Si no acertaste el exacto" pts="+0.5" />
        <Fila label="Uno de tus favoritos es campeón" sub="Bono al final del torneo" pts="+15" />
      </div>
      <p className="mt-4 text-center font-body text-xs text-crema/50">
        Ejemplo: predices 2-1 y queda 2-1 → ganador (3) + exacto (1) = <span className="text-ambar">4 puntos</span>.
      </p>
    </div>
  )
}

function Regla({ children }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-ambar shadow-[0_0_8px_rgba(232,180,78,0.7)]" />
      <span className="font-body text-sm text-crema/80">{children}</span>
    </li>
  )
}

function Reglas() {
  return (
    <div>
      <h2 className="mb-4 text-center font-display text-3xl uppercase tracking-wide">Reglas del juego</h2>
      <ul className="space-y-3">
        <Regla>Cada partido se abre para predecir <b className="text-crema">cuando arranca la jornada anterior</b>. La Jornada 1 está abierta desde ya.</Regla>
        <Regla>No se puede predecir todo el torneo de golpe: se va abriendo por jornada, para que sea más emocionante.</Regla>
        <Regla>Justo al <b className="text-crema">pitazo inicial</b> el contador llega a <span className="tabular">0:00:00</span>, tu predicción se cierra y nadie ve la tuya hasta ese momento.</Regla>
        <Regla>Al terminar verás tus <span className="text-cancha">aciertos en verde</span> con el detalle de cada punto (ganador, empate, marcador exacto…), y la tabla se reordena.</Regla>
        <Regla>En la <b className="text-crema">Tabla</b>, toca a cualquier persona para ver su historial: qué predijo y cómo sumó sus puntos en los partidos ya jugados.</Regla>
      </ul>
    </div>
  )
}

function Favoritos({ teams, favorites, toggle }) {
  return (
    <div>
      <h2 className="mb-1 text-center font-display text-3xl uppercase tracking-wide">Elige tus 3 favoritos</h2>
      <p className="mb-4 text-center font-body text-sm text-crema/60">
        Para todo el torneo y no se pueden cambiar. Si alguno sale campeón ganas <span className="text-ambar">+15 puntos</span>.
        {' '}Llevas <span className="font-semibold text-ambar">{favorites.length}/3</span>.
      </p>
      <div className="grid max-h-[44vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
        {teams.map((t) => {
          const sel = favorites.includes(t.id)
          const full = favorites.length >= 3 && !sel
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              disabled={full}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98] ${
                sel ? 'border-ambar bg-ambar/10 shadow-glow-oro' : 'border-linea bg-petroleo-2 hover:border-ambar/40'
              } ${full ? 'opacity-35' : ''}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded ring-1 ring-linea/80">
                <img src={t.flag_url} alt="" className="h-full w-full object-cover"
                     onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              </span>
              <span className="flex-1 font-body text-sm leading-tight text-crema [overflow-wrap:anywhere]">{t.name}</span>
              {sel && <span className="text-ambar">★</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const [teams, setTeams] = useState([])
  const [favorites, setFavorites] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAllTeams().then(setTeams).catch((e) => console.error(e))
  }, [])

  const next = () => setStep((s) => Math.min(s + 1, PASOS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const toggle = (id) =>
    setFavorites((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]
    )

  async function confirmar() {
    if (favorites.length !== 3) { setError('Elige exactamente 3 equipos para continuar.'); return }
    setSaving(true); setError('')
    try {
      await finishOnboarding(favorites)
      onDone?.()
    } catch (e) {
      setError(e.message || 'No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-7 flex items-center justify-center gap-2">
          {PASOS.map((_, i) => (
            <motion.span
              key={i}
              animate={{ width: i === step ? 32 : 12, opacity: i <= step ? 1 : 0.5 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              className={`h-1.5 rounded-full ${i <= step ? 'bg-oro-grad' : 'bg-linea'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && <Bienvenida />}
            {step === 1 && <Puntos />}
            {step === 2 && <Reglas />}
            {step === 3 && <Favoritos teams={teams} favorites={favorites} toggle={toggle} />}
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-center font-body text-sm text-red-300">{error}</p>}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button onClick={back} disabled={step === 0}
            className="font-body text-sm text-crema/50 transition hover:text-crema disabled:opacity-0">
            ← Atrás
          </button>
          {step < PASOS.length - 1 ? (
            <button onClick={next}
              className="group/btn relative overflow-hidden rounded-xl bg-oro-grad px-7 py-3 font-display text-lg uppercase tracking-[0.12em] text-petroleo shadow-oro transition active:scale-[0.98]">
              <span className="relative z-10">Siguiente</span>
              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-all duration-700 group-hover/btn:left-[120%] group-hover/btn:opacity-100" />
            </button>
          ) : (
            <button onClick={confirmar} disabled={saving}
              className="rounded-xl bg-oro-grad px-7 py-3 font-display text-lg uppercase tracking-[0.12em] text-petroleo shadow-oro transition active:scale-[0.98] disabled:opacity-60">
              {saving ? 'Guardando…' : 'Confirmar y empezar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}