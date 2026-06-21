import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useSession } from './hooks/useSession'
import { useProfile } from './hooks/useProfile'
import { supabase } from './lib/supabase'
import { missingEnv } from './lib/supabase'
import Auth from './components/Auth'
import Onboarding from './components/Onboarding'
import Groups from './components/Groups'
import Matches from './components/Matches'
import Standings from './components/Standings'
import Admin from './components/Admin'
import Historial from './components/Historial'
import Bracket from './components/Bracket'
import { TeamViewProvider } from './lib/teamView'

function Cargando() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <span className="relative grid h-12 w-12 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-ambar/20" />
          <span className="h-3 w-3 rounded-full bg-ambar" />
        </span>
        <span className="font-body text-sm uppercase tracking-[0.3em] text-crema/50">Cargando</span>
      </div>
    </div>
  )
}

// Sello / marca: hexagono dorado (industria petrolera) con estrella (campeon)
function Marca({ className = '' }) {
  return (
    <span className={`relative grid place-items-center ${className}`}>
      <svg viewBox="0 0 44 44" className="h-9 w-9 drop-shadow-[0_4px_10px_rgba(232,180,78,0.35)]">
        <defs>
          <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FBE8BE" />
            <stop offset="55%" stopColor="#E8B44E" />
            <stop offset="100%" stopColor="#C8902F" />
          </linearGradient>
        </defs>
        <path d="M22 2 L39 12 V32 L22 42 L5 32 V12 Z" fill="none" stroke="url(#oro)" strokeWidth="2" />
        <path d="M22 13l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" fill="url(#oro)" />
      </svg>
    </span>
  )
}

function MissingConfig() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-xl rounded-lg bg-[#2a0a0e]/80 p-6 text-center border border-linea">
        <h2 className="font-display text-xl text-ambar mb-2">Configuración faltante</h2>
        <p className="text-crema/80 mb-4">No se han configurado las variables de entorno de Supabase. Agrega <strong>VITE_SUPABASE_URL</strong> y <strong>VITE_SUPABASE_ANON_KEY</strong> en las Environment variables de Netlify y vuelve a desplegar.</p>
        <a className="text-ambar underline" href="https://app.netlify.com/sites">Abrir Netlify</a>
      </div>
    </div>
  )
}

function NavBtn({ id, active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 whitespace-nowrap py-3.5 text-center font-display text-[11px] uppercase tracking-[0.06em] transition-colors ${active ? 'text-ambar' : 'text-crema/45 hover:text-crema/70'}`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="navUnderline"
          className="absolute inset-x-0 -bottom-px mx-auto h-0.5 w-10 rounded-full bg-oro-grad shadow-[0_0_12px_rgba(232,180,78,0.7)]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  )
}

export default function App() {
  const { session, loading } = useSession()
  const { profile, loading: loadingProfile, refresh } = useProfile(session)
  const [view, setView] = useState('partidos')
  const reduce = useReducedMotion()

  if (missingEnv) return <MissingConfig />

  if (loading) return <Cargando />
  if (!session) return <Auth />
  if (loadingProfile) return <Cargando />
  if (!profile) return <Auth />
  if (!profile.onboarding_done) return <Onboarding onDone={refresh} />

  const nombre = profile.full_name || session.user?.email

  return (
    <TeamViewProvider>
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-linea/70 bg-petroleo/70 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-ambar/50 to-transparent" />
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Marca />
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.32em] text-ambar/90">Mundial 2026</p>
              <h1 className="font-display text-xl uppercase leading-none tracking-wide">
                Quiniela <span className="text-gilded">PetroBoscan</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile.is_admin && (
              <button
                onClick={() => setView(view === 'admin' ? 'partidos' : 'admin')}
                className={`rounded-lg border px-3 py-1.5 font-body text-xs uppercase tracking-wider transition active:scale-95 ${view === 'admin' ? 'border-ambar/70 bg-ambar/10 text-ambar' : 'border-linea text-crema/65 hover:border-ambar/60 hover:text-ambar'}`}
              >
                Admin
              </button>
            )}
            <span className="hidden font-body text-sm text-crema/55 sm:block">{nombre}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-linea px-3 py-1.5 font-body text-xs uppercase tracking-wider text-crema/65 transition hover:border-ambar/60 hover:text-ambar active:scale-95"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-7 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === 'partidos' ? <Matches /> : view === 'historial' ? <Historial /> : view === 'tabla' ? <Standings /> : view === 'bracket' ? <Bracket /> : view === 'admin' ? <Admin onClose={() => setView('partidos')} /> : <Groups />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-linea/70 bg-petroleo/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl">
          <NavBtn id="partidos" active={view === 'partidos'} onClick={() => setView('partidos')}>Partidos</NavBtn>
          <NavBtn id="historial" active={view === 'historial'} onClick={() => setView('historial')}>Historial</NavBtn>
          <NavBtn id="tabla" active={view === 'tabla'} onClick={() => setView('tabla')}>Tabla</NavBtn>
          <NavBtn id="grupos" active={view === 'grupos'} onClick={() => setView('grupos')}>Grupos</NavBtn>
          <NavBtn id="bracket" active={view === 'bracket'} onClick={() => setView('bracket')}>Bracket</NavBtn>
        </div>
      </nav>
    </div>
    </TeamViewProvider>
  )
}