import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Landing explicativa de la FASE DE ELIMINACIÓN DIRECTA.
// Se muestra en los primeros 2 inicios de sesión de cada usuario
// (contador por usuario en localStorage). Luego no vuelve a salir.
const VECES = 2

function Regla({ icon, titulo, children, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-3"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ambar/30 bg-ambar/10 text-lg">{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-sm uppercase tracking-wide text-crema">{titulo}</p>
        <p className="mt-0.5 font-body text-[13px] leading-snug text-crema/55">{children}</p>
      </div>
    </motion.div>
  )
}

export default function ElimIntro({ uid }) {
  const KEY = `pb_elim_intro_${uid}`
  const [open, setOpen] = useState(() => {
    try { return parseInt(localStorage.getItem(KEY) || '0', 10) < VECES } catch { return false }
  })

  function cerrar() {
    try {
      const n = parseInt(localStorage.getItem(KEY) || '0', 10)
      localStorage.setItem(KEY, String(n + 1))
    } catch { /* noop */ }
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-petroleo/80 px-4 py-6 backdrop-blur-md"
          onClick={cerrar}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-ambar/30 bg-petroleo-2 p-6 shadow-card"
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ambar/60 to-transparent" />

            <div className="mb-5 text-center">
              <p className="mb-1 font-body text-[10px] uppercase tracking-[0.32em] text-ambar/90">Mundial 2026 · Novedades</p>
              <h2 className="font-display text-3xl uppercase leading-none tracking-wide">
                Empieza la <span className="text-gilded">eliminación directa</span>
              </h2>
              <p className="mt-2 font-body text-sm text-crema/55">Cambia la forma de predecir. Léelo en 20 segundos 👇</p>
            </div>

            <div className="space-y-3.5">
              <Regla icon="🎯" titulo="Predice marcador + quién avanza" delay={0.05}>
                Pones el marcador de los 120′ y eliges <span className="text-crema/80">qué equipo avanza</span>. Si tu marcador ya tiene ganador, el “avanza” se elige solo.
              </Regla>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 }}
                className="rounded-xl border border-linea bg-petroleo p-3"
              >
                <p className="mb-2 text-center font-body text-[11px] uppercase tracking-[0.2em] text-crema/40">Cómo se puntúa</p>
                <div className="flex items-stretch justify-center gap-2 text-center">
                  <div className="flex-1 rounded-lg bg-cancha/10 px-2 py-2">
                    <p className="font-display text-2xl tabular text-cancha">+3</p>
                    <p className="font-body text-[10px] leading-tight text-crema/55">aciertas quién avanza</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-ambar/10 px-2 py-2">
                    <p className="font-display text-2xl tabular text-gilded">+1</p>
                    <p className="font-body text-[10px] leading-tight text-crema/55">marcador exacto</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-petroleo-3 px-2 py-2">
                    <p className="font-display text-2xl tabular text-crema">4</p>
                    <p className="font-body text-[10px] leading-tight text-crema/55">máximo por partido</p>
                  </div>
                </div>
                <p className="mt-2 text-center font-body text-[11px] text-crema/45">
                  …y <span className="text-gilded">+0.5</span> si aciertas la cantidad total de goles
                </p>
              </motion.div>

              <Regla icon="⚽" titulo="Penales: tú decides" delay={0.18}>
                Si predices empate, eliges <span className="text-crema/80">quién pasa en penales</span> — esa es tu apuesta de quién avanza.
              </Regla>

              <Regla icon="🏆" titulo="Nueva pestaña: Bracket" delay={0.24}>
                El cuadro completo (16vos → Final) que <span className="text-crema/80">se llena solo</span> a medida que avanza el torneo.
              </Regla>

              <Regla icon="★" titulo="Desempate en la tabla" delay={0.30}>
                Si dos quedan con los mismos puntos, gana quien tenga <span className="text-crema/80">más marcadores exactos</span>.
              </Regla>
            </div>

            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.36 }}
              onClick={cerrar}
              className="mt-6 w-full rounded-xl bg-oro-grad py-3 font-display text-base uppercase tracking-[0.14em] text-petroleo shadow-oro transition active:scale-[0.98]"
            >
              ¡Entendido, a jugar!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
