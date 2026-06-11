// scripts/sync.mjs
// Sincroniza marcadores y estado del Mundial desde football-data -> Supabase.
// La base recalcula los puntos automaticamente (trigger trg_rescore).
// Uso:
//   npm run sync            -> una sola pasada
//   npm run sync -- watch   -> repite cada 60s (ideal en dias de partidos)
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const FD_TOKEN     = process.env.FOOTBALL_DATA_TOKEN

function die(m) { console.error('\u2716 ' + m); process.exit(1) }
if (!SUPABASE_URL || !SERVICE_KEY || !FD_TOKEN)
  die('Faltan variables en .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_TOKEN)')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function mapStatus(s) {
  switch (String(s || '').toUpperCase()) {
    case 'IN_PLAY': return '1H'
    case 'PAUSED':  return 'HT'
    case 'FINISHED': case 'AWARDED': return 'FT'
    default: return 'NS'
  }
}

async function onePass() {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': FD_TOKEN },
  })
  if (!res.ok) {
    console.error('football-data respondio ' + res.status)
    return
  }
  const { matches = [] } = await res.json()

  let tocados = 0, finalizados = 0, enJuego = 0
  for (const m of matches) {
    const status = mapStatus(m.status)
    if (status === 'NS') continue // aun no empieza: nada que sincronizar

    const hg = m.score?.fullTime?.home ?? null
    const ag = m.score?.fullTime?.away ?? null

    const { error } = await supabase
      .from('matches')
      .update({ status, home_goals: hg, away_goals: ag, updated_at: new Date().toISOString() })
      .eq('id', m.id)
    if (error) { console.error('partido', m.id, '->', error.message); continue }

    tocados++
    if (status === 'FT') finalizados++
    else enJuego++
  }

  const ts = new Date().toLocaleTimeString('es')
  console.log(`[${ts}] sincronizados ${tocados} partidos · ${enJuego} en juego · ${finalizados} finalizados`)
}

const watch = process.argv.includes('watch')
await onePass()
if (watch) {
  console.log('Modo watch activo: repito cada 60s. Ctrl+C para detener.')
  setInterval(onePass, 60_000)
}
