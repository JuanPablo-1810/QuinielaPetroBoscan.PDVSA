import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import AuthBackground from './AuthBackground'

function Marca() {
  return (
    <svg viewBox="0 0 44 44" className="mx-auto mb-4 h-14 w-14 drop-shadow-[0_6px_16px_rgba(232,180,78,0.4)]">
      <defs>
        <linearGradient id="oroReset" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBE8BE" /><stop offset="55%" stopColor="#E8B44E" /><stop offset="100%" stopColor="#C8902F" />
        </linearGradient>
      </defs>
      <path d="M22 2 L39 12 V32 L22 42 L5 32 V12 Z" fill="none" stroke="url(#oroReset)" strokeWidth="2" />
      <path d="M22 13l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="url(#oroReset)" />
    </svg>
  )
}

function PwField({ label, value, onChange }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-[11px] uppercase tracking-[0.2em] text-crema/45">{label}</span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          className="w-full rounded-xl border border-linea bg-petroleo-2/80 px-4 py-3 pr-12 font-body text-crema outline-none transition placeholder:text-crema/30 focus:border-ambar/70 focus:ring-2 focus:ring-ambar/20"
        />
        <button type="button" onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg font-body text-[11px] uppercase text-crema/45 transition hover:text-ambar">
          {show ? 'Ocultar' : 'Ver'}
        </button>
      </div>
    </label>
  )
}

export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  async function submit(e) {
    e?.preventDefault?.()
    setError(''); setOkMsg('')
    if (pw.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (pw !== pw2) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw error
      setOkMsg('¡Listo! Tu contraseña fue actualizada.')
      // Limpia el hash de recuperación de la URL para que no se repita al refrescar.
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search) } catch { /* noop */ }
      setTimeout(() => onDone?.(), 1300)
    } catch (err) {
      const m = (err.message || '').toLowerCase()
      if (m.includes('session') || m.includes('jwt') || m.includes('expired'))
        setError('El enlace expiró o no es válido. Vuelve a pedir uno desde "¿Olvidaste tu contraseña?".')
      else if (m.includes('should be different'))
        setError('La nueva contraseña debe ser distinta a la anterior.')
      else setError('No se pudo actualizar la contraseña. Intenta de nuevo.')
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
          <p className="mb-2 font-body text-[11px] uppercase tracking-[0.32em] text-ambar/90">Recuperación</p>
          <h1 className="font-display text-3xl uppercase leading-none tracking-wide">Nueva contraseña</h1>
          <p className="mt-3 font-body text-sm text-crema/55">Define tu nueva clave para entrar.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <PwField label="Nueva contraseña" value={pw} onChange={setPw} />
          <PwField label="Repite la contraseña" value={pw2} onChange={setPw2} />

          {error && <p className="font-body text-sm text-red-300">{error}</p>}
          {okMsg && <p className="font-body text-sm text-cancha">{okMsg}</p>}

          <button type="submit" disabled={loading}
            className="group/btn relative mt-2 w-full overflow-hidden rounded-xl bg-oro-grad py-3 font-display text-lg uppercase tracking-[0.12em] text-petroleo shadow-oro transition active:scale-[0.98] disabled:opacity-60">
            <span className="relative z-10">{loading ? 'Guardando…' : 'Guardar contraseña'}</span>
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-all duration-700 group-hover/btn:left-[120%] group-hover/btn:opacity-100" />
          </button>
        </form>
      </motion.div>
    </div>
  )
}
