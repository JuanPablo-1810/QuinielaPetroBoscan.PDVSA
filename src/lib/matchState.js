// Estado de la ventana de predicción de un partido.
// La hora de apertura (opens_at) la calcula la base: cada partido abre
// cuando arranca la JORNADA ANTERIOR y cierra justo al pitazo (kickoff).
//  soon     -> aun no abre (la jornada anterior no ha arrancado)
//  open     -> se puede predecir (ya abrió, falta el pitazo)
//  locked   -> ya llegó la hora (status aun NS pero pasó el kickoff)
//  live     -> en juego
//  finished -> terminado

// Respaldo: si opens_at no viniera (base sin recalcular), usa 12h antes.
const FALLBACK_MS = 12 * 60 * 60 * 1000

export function opensAt(match) {
  if (match.opens_at) return new Date(match.opens_at)
  return new Date(new Date(match.kickoff).getTime() - FALLBACK_MS)
}

export function matchState(match, now = new Date()) {
  const kickoff = new Date(match.kickoff)
  const opens = opensAt(match)
  if (match.status === 'FT') return 'finished'
  if (match.status === 'HT') return 'halftime'
  if (match.status !== 'NS') return 'live'
  if (now >= kickoff) return 'locked'
  if (now >= opens) return 'open'
  return 'soon'
}

// Milisegundos que faltan para el cierre (el pitazo). Nunca negativo.
export function msToKickoff(match, now = new Date()) {
  return Math.max(0, new Date(match.kickoff).getTime() - now.getTime())
}

// Contador estilo H:MM:SS (o "Nd HH:MM:SS" si falta más de un día).
export function formatCountdown(ms) {
  if (ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
  return `${h}:${pad(m)}:${pad(s)}`
}

const FECHA = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })
const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })
const CORTA = new Intl.DateTimeFormat('es', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

export function dayKey(d) {
  return new Date(d).toLocaleDateString('en-CA') // YYYY-MM-DD local, para agrupar
}
export function formatDay(d) {
  const s = FECHA.format(new Date(d))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export function formatTime(d) {
  return HORA.format(new Date(d))
}
// Día corto + hora, p.ej. "lun 14:00" (para "Abre …" cuando falta más de un día)
export function formatShort(d) {
  const s = CORTA.format(new Date(d)).replace(',', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}