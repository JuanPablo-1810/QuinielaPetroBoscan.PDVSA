// scripts/seed.mjs
// Siembra equipos y partidos del Mundial 2026 desde football-data.org a Supabase.
// Uso:  npm run seed     (lee las variables del archivo .env)
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const FD_TOKEN     = process.env.FOOTBALL_DATA_TOKEN

function die(msg) { console.error('\u2716 ' + msg); process.exit(1) }
if (!SUPABASE_URL) die('Falta SUPABASE_URL (o VITE_SUPABASE_URL) en .env')
if (!SERVICE_KEY)  die('Falta SUPABASE_SERVICE_ROLE_KEY en .env')
if (!FD_TOKEN)     die('Falta FOOTBALL_DATA_TOKEN en .env')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const FD = 'https://api.football-data.org/v4'
async function fd(path) {
  const res = await fetch(FD + path, { headers: { 'X-Auth-Token': FD_TOKEN } })
  if (!res.ok) {
    const t = await res.text()
    die(`football-data respondio ${res.status}: ${t.slice(0, 300)}`)
  }
  return res.json()
}

function groupLetter(g) {
  const m = String(g || '').match(/GROUP[_\s]?([A-L])/i)
  return m ? m[1].toUpperCase() : null
}

function mapStage(stage) {
  switch (String(stage || '').toUpperCase()) {
    case 'GROUP_STAGE': return 'group'
    case 'LAST_32': case 'ROUND_OF_32': return 'r32'
    case 'LAST_16': case 'ROUND_OF_16': return 'r16'
    case 'QUARTER_FINALS': case 'QUARTER_FINAL': return 'qf'
    case 'SEMI_FINALS': case 'SEMI_FINAL': return 'sf'
    case 'THIRD_PLACE': return 'third'
    case 'FINAL': return 'final'
    default: return 'group'
  }
}

function mapStatus(s) {
  switch (String(s || '').toUpperCase()) {
    case 'IN_PLAY': return '1H'
    case 'PAUSED':  return 'HT'
    case 'FINISHED': case 'AWARDED': return 'FT'
    default: return 'NS'   // SCHEDULED / TIMED / etc. = no iniciado
  }
}

async function main() {
  console.log('\u2192 Pidiendo partidos del Mundial (football-data.org)\u2026')
  const data = await fd('/competitions/WC/matches')
  const raw = data.matches ?? []
  console.log(`  partidos recibidos: ${raw.length}`)
  if (!raw.length) die('No llegaron partidos. Revisa que el token sea valido.')

  const teamsMap  = new Map()
  const teamGroup = new Map()

  // 1) grupos, a partir de los partidos de fase de grupos
  for (const m of raw) {
    if (mapStage(m.stage) === 'group') {
      const letter = groupLetter(m.group)
      for (const t of [m.homeTeam, m.awayTeam]) {
        if (t?.id != null && letter) teamGroup.set(t.id, letter)
      }
    }
  }

  // 2) equipos y partidos
  const matches = []
  for (const m of raw) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (t?.id != null && !teamsMap.has(t.id)) {
        teamsMap.set(t.id, {
          id: t.id,
          name: t.name ?? t.shortName ?? `Equipo ${t.id}`,
          code: t.tla ?? null,
          flag_url: t.crest ?? null,
          group_label: teamGroup.get(t.id) ?? null,
        })
      }
    }
    const stage = mapStage(m.stage)
    matches.push({
      id: m.id,
      stage,
      group_label: stage === 'group' ? groupLetter(m.group) : null,
      round_label: m.matchday != null ? `Jornada ${m.matchday}` : (m.stage ?? null),
      kickoff: m.utcDate,
      home_team_id: m.homeTeam?.id ?? null,
      away_team_id: m.awayTeam?.id ?? null,
      status: mapStatus(m.status),
      home_goals: m.score?.fullTime?.home ?? null,
      away_goals: m.score?.fullTime?.away ?? null,
      venue: null,
      city: null,
    })
  }

  const teams = [...teamsMap.values()]
  console.log(`\u2192 Insertando ${teams.length} equipos\u2026`)
  {
    const { error } = await supabase.from('teams').upsert(teams, { onConflict: 'id' })
    if (error) die('Error insertando equipos: ' + error.message)
  }
  console.log(`\u2192 Insertando ${matches.length} partidos\u2026`)
  {
    const { error } = await supabase.from('matches').upsert(matches, { onConflict: 'id' })
    if (error) die('Error insertando partidos: ' + error.message)
  }

  // Calcular la ventana de apertura (opens_at) de cada partido segun su jornada
  console.log('\u2192 Calculando ventana de prediccion (opens_at)\u2026')
  {
    const { error } = await supabase.rpc('recompute_open_windows')
    if (error) die('Error calculando opens_at: ' + error.message + '\n  (Corre antes la migracion 0002_ventana_opens_at.sql en el SQL Editor.)')
  }

  const porGrupo = {}
  for (const t of teams) { const k = t.group_label ?? '\u2014'; porGrupo[k] = (porGrupo[k] ?? 0) + 1 }
  console.log('\n\u2714 Siembra completa.')
  console.log('  Equipos por grupo:', porGrupo)
  console.log('  Total de partidos:', matches.length)
}

main().catch(e => die(e.message))