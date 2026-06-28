import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import AuthBackground from './AuthBackground'

function traducirError(msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('already registered')) return 'Ese correo ya está registrado. Inicia sesión.'
  if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  return msg || 'Algo salió mal. Intenta de nuevo.'
}

function EyeIcon({ off }) {
  return off ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, autoComplete, reveal = false }) {
  const [show, setShow] = useState(false)
  const inputType = reveal ? (show ? 'text' : 'password') : type
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-[11px] uppercase tracking-[0.2em] text-crema/45">
        {label}
      </span>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border border-linea bg-petroleo-2/80 px-4 py-3 font-body text-crema outline-none transition placeholder:text-crema/30 focus:border-ambar/70 focus:ring-2 focus:ring-ambar/20 ${reveal ? 'pr-12' : ''}`}
        />
        {reveal && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-crema/45 transition hover:text-ambar"
          >
            <EyeIcon off={show} />
          </button>
        )}
      </div>
    </label>
  )
}

function Marca() {
  return (
    <svg viewBox="0 0 44 44" className="mx-auto mb-4 h-14 w-14 drop-shadow-[0_6px_16px_rgba(232,180,78,0.4)]">
      <defs>
        <linearGradient id="oroAuth" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBE8BE" /><stop offset="55%" stopColor="#E8B44E" /><stop offset="100%" stopColor="#C8902F" />
        </linearGradient>
      </defs>
      <path d="M22 2 L39 12 V32 L22 42 L5 32 V12 Z" fill="none" stroke="url(#oroAuth)" strokeWidth="2" />
      <path d="M22 13l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="url(#oroAuth)" />
    </svg>
  )
}

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'

  // Si el enlace de recuperación llegó vencido/usado, Supabase devuelve a la
  // app con #error=...&error_code=otp_expired. Lo detectamos y guiamos al
  // usuario a pedir uno nuevo (en vez de dejar un login sin contexto).
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (hash && hash.includes('error')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const code = params.get('error_code') || params.get('error')
      if (code) {
        setMode('forgot')
        setError('El enlace de recuperación expiró o ya se había usado. Pide uno nuevo aquí abajo y ábrelo apenas te llegue.')
        try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* noop */ }
      }
    }
  }, [])

  function switchMode(next) {
    setMode(next); setError(''); setInfo('')
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    setError(''); setInfo('')
    if (isForgot) {
      if (!email.trim()) { setError('Escribe tu correo.'); return }
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setInfo('Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja (y la carpeta de spam).')
      } catch (err) {
        setError(traducirError(err.message))
      } finally {
        setLoading(false)
      }
      return
    }
    if (!email || !password || (isSignup && !fullName.trim())) {
      setError('Completa todos los campos.'); return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.'); return
    }
    setLoading(true)
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Cuenta creada. Si te pide confirmar el correo, revísalo y luego inicia sesión.')
          switchMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
      }
    } catch (err) {
      setError(traducirError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-10">
      <AuthBackground />
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <Marca />
          <p className="mb-2 font-body text-[11px] uppercase tracking-[0.32em] text-ambar/90">Mundial 2026</p>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wide">
            Quiniela <span className="text-gilded">PetroBoscan</span>
          </h1>
          <p className="mt-3 font-body text-sm text-crema/55">
            {isForgot ? 'Te enviaremos un enlace a tu correo' : isSignup ? 'Crea tu cuenta para jugar' : 'Entra para hacer tus predicciones'}
          </p>
        </div>

        {!isForgot && (
        <div className="relative mb-6 grid grid-cols-2 rounded-xl border border-linea bg-petroleo-2/80 p-1">
          <motion.span
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-oro-grad shadow-oro"
            animate={{ x: isSignup ? 'calc(100% + 0.5rem)' : '0%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          />
          <button onClick={() => switchMode('login')}
            className={`relative z-10 rounded-lg py-2 font-display text-sm uppercase tracking-wide transition-colors ${!isSignup ? 'text-petroleo' : 'text-crema/60'}`}>
            Entrar
          </button>
          <button onClick={() => switchMode('signup')}
            className={`relative z-10 rounded-lg py-2 font-display text-sm uppercase tracking-wide transition-colors ${isSignup ? 'text-petroleo' : 'text-crema/60'}`}>
            Registrarse
          </button>
        </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignup && (
            <Field label="Nombre completo" value={fullName} onChange={setFullName}
              placeholder="Juan Guerra" autoComplete="name" />
          )}
          <Field label="Correo" type="email" value={email} onChange={setEmail}
            placeholder="tucorreo@ejemplo.com" autoComplete="email" />
          {!isForgot && (
            <Field label="Contraseña" type="password" value={password} onChange={setPassword}
              placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'} reveal />
          )}

          {!isSignup && !isForgot && (
            <div className="text-right">
              <button type="button" onClick={() => switchMode('forgot')}
                className="font-body text-xs text-crema/45 transition hover:text-ambar">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {error && <p className="font-body text-sm text-red-300">{error}</p>}
          {info && <p className="font-body text-sm text-cancha">{info}</p>}

          <button type="submit" disabled={loading}
            className="group/btn relative mt-2 w-full overflow-hidden rounded-xl bg-oro-grad py-3 font-display text-lg uppercase tracking-[0.12em] text-petroleo shadow-oro transition active:scale-[0.98] disabled:opacity-60">
            <span className="relative z-10">{loading ? 'Un momento…' : isForgot ? 'Enviar enlace' : isSignup ? 'Crear cuenta' : 'Entrar'}</span>
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-all duration-700 group-hover/btn:left-[120%] group-hover/btn:opacity-100" />
          </button>

          {isForgot && (
            <button type="button" onClick={() => switchMode('login')}
              className="w-full text-center font-body text-xs text-crema/45 transition hover:text-ambar">
              ← Volver a entrar
            </button>
          )}
        </form>
      </motion.div>
    </div>
  )
}