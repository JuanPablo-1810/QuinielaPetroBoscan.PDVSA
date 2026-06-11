// scripts/simulate.mjs
// ENSAYO sin tocar los partidos reales del Mundial.
// Crea 2 partidos de PRUEBA aislados (ids negativos, jornada "PRUEBA").
// El sync nunca los toca porque football-data no usa ids negativos.
//
// Uso:
//   npm run sim:setup             -> crea 2 partidos de prueba con la ventana ABIERTA (predice en la app)
//   npm run sim:live              -> ponlos EN VIVO (se cierra la predicción)
//   npm run sim:final -- 2 1 0 0  -> FINAL: prueba1 = 2-1, prueba2 = 0-0  (recalcula tus puntos)
//   npm run sim:clean             -> borra los partidos de prueba y sus predicciones (todo vuelve a normal)
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
function die(m) { console.error('\u2716 ' + m); process.exit(1) }
if (!SUPABASE_URL || !SERVICE_KEY)
  die('Faltan variables en .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const IDS = [-101, -102]
const cmd = process.argv[2]

async function cuatroEquipos() {
  const { data, error } = await supabase.from('teams').select('id, name').order('name').limit(4)
  if (error) die('No pude leer equipos: ' + error.message)
  if (!data || data.length < 4) die('Necesito equipos sembrados. Corre primero: npm run seed')
  return data
}

async function setup() {
  const t = await cuatroEquipos()
  const now = Date.now()
  const base = (id, h, a, horas) => ({
    id, stage: 'group', group_label: null, round_label: 'PRUEBA',
    kickoff: new Date(now + horas * 3600 * 1000).toISOString(),
    opens_at: new Date(now - 3600 * 1000).toISOString(), // abierto desde hace 1h
    home_team_id: h, away_team_id: a, status: 'NS',
    home_goals: null, away_goals: null, venue: null,
  })
  const rows = [base(IDS[0], t[0].id, t[1].id, 2), base(IDS[1], t[2].id, t[3].id, 3)]
  const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'id' })
  if (error) die('Error creando partidos de prueba: ' + error.message)
  console.log('\u2713 2 partidos de PRUEBA creados con ventana ABIERTA:')
  console.log(`   1) ${t[0].name} vs ${t[1].name}  (empieza en 2h)`)
  console.log(`   2) ${t[2].name} vs ${t[3].name}  (empieza en 3h)`)
  console.log('\u2192 Abre la app -> Partidos -> jornada "PRUEBA" y haz tus predicciones.')
}

async function live() {
  // El partido "arranca": movemos el pitazo a hace 1 min para que se cierre la
  // prediccion y se revelen las predicciones ajenas (igual que en la realidad).
  const arranco = new Date(Date.now() - 60 * 1000).toISOString()
  const { error } = await supabase.from('matches')
    .update({ status: '1H', kickoff: arranco, updated_at: new Date().toISOString() }).in('id', IDS)
  if (error) die('Error: ' + error.message)
  console.log('\u2713 Partidos de prueba EN VIVO. La predicción quedó cerrada (verás "En vivo").')
}

async function final() {
  const g = process.argv.slice(3).map(Number)
  const m1h = Number.isFinite(g[0]) ? g[0] : 2
  const m1a = Number.isFinite(g[1]) ? g[1] : 1
  const m2h = Number.isFinite(g[2]) ? g[2] : 0
  const m2a = Number.isFinite(g[3]) ? g[3] : 0
  const ts = new Date().toISOString()
  const pitazo = new Date(Date.now() - 2 * 3600 * 1000).toISOString() // ya pasó el pitazo
  let r = await supabase.from('matches').update({ status: 'FT', kickoff: pitazo, home_goals: m1h, away_goals: m1a, updated_at: ts }).eq('id', IDS[0])
  if (r.error) die('Error partido 1: ' + r.error.message)
  r = await supabase.from('matches').update({ status: 'FT', kickoff: pitazo, home_goals: m2h, away_goals: m2a, updated_at: ts }).eq('id', IDS[1])
  if (r.error) die('Error partido 2: ' + r.error.message)
  console.log(`\u2713 FINAL: prueba 1 = ${m1h}-${m1a}, prueba 2 = ${m2h}-${m2a}.`)
  console.log('\u2192 La base recalculó tus puntos. Míralos en Partidos->Historial y en la Tabla (se actualiza sola).')
}

async function clean() {
  let r = await supabase.from('predictions').delete().in('match_id', IDS)
  if (r.error) die('Error borrando predicciones de prueba: ' + r.error.message)
  r = await supabase.from('matches').delete().in('id', IDS)
  if (r.error) die('Error borrando partidos de prueba: ' + r.error.message)
  console.log('\u2713 Limpio. Partidos y predicciones de prueba eliminados. Todo vuelve a la normalidad.')
}

const acciones = { setup, live, final, clean }
if (!acciones[cmd]) die('Comando no válido. Usa: setup | live | final | clean')
acciones[cmd]().then(() => process.exit(0)).catch((e) => die(e.message))
