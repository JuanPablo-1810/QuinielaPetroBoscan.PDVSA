import { supabase } from './supabase'

export async function getTeamsByGroup() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, code, flag_url, group_label')
    .not('group_label', 'is', null)
    .order('group_label', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  const map = {}
  for (const t of data) (map[t.group_label] ??= []).push(t)
  return Object.keys(map).sort().map((label) => ({ label, teams: map[label] }))
}

export async function getAllTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, code, flag_url, group_label')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

// Partidos + equipos + la predicción del usuario actual (todo unido en JS)
export async function getMatches() {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id

  const [{ data: matches, error: me }, { data: teams, error: te }] = await Promise.all([
    supabase
      .from('matches')
      .select('id, stage, group_label, round_label, kickoff, opens_at, status, home_goals, away_goals, home_team_id, away_team_id')
      .order('kickoff', { ascending: true }),
    supabase.from('teams').select('id, name, code, flag_url'),
  ])
  if (me) throw me
  if (te) throw te

  const teamById = {}
  for (const t of teams) teamById[t.id] = t

  const predByMatch = {}
  if (uid) {
    const { data: preds, error: pe } = await supabase
      .from('predictions')
      .select('match_id, pred_home, pred_away, points, outcome_hit, exact_hit, goals_total_hit')
      .eq('user_id', uid)
    if (pe) throw pe
    for (const p of preds ?? []) predByMatch[p.match_id] = p
  }

  return matches.map((m) => ({
    ...m,
    home: teamById[m.home_team_id] ?? null,
    away: teamById[m.away_team_id] ?? null,
    prediction: predByMatch[m.id] ?? null,
  }))
}

// Guardar / actualizar una predicción (la base valida la ventana [opens_at, kickoff))
export async function savePrediction(matchId, predHome, predAway) {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) throw new Error('No hay sesión.')
  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      { user_id: uid, match_id: matchId, pred_home: predHome, pred_away: predAway },
      { onConflict: 'user_id,match_id' }
    )
    .select('match_id, pred_home, pred_away, points, outcome_hit, exact_hit, goals_total_hit')
    .single()
  if (error) throw error
  return data
}

// Historial de CUALQUIER persona: partidos + equipos + las predicciones de ese
// usuario. La base (RLS) solo devuelve predicciones ajenas de partidos que ya
// arrancaron, así que el anti-copia se mantiene solo.
export async function getUserHistory(userId) {
  const [{ data: matches, error: me }, { data: teams, error: te }] = await Promise.all([
    supabase
      .from('matches')
      .select('id, stage, group_label, round_label, kickoff, opens_at, status, home_goals, away_goals, home_team_id, away_team_id')
      .order('kickoff', { ascending: true }),
    supabase.from('teams').select('id, name, code, flag_url'),
  ])
  if (me) throw me
  if (te) throw te

  const teamById = {}
  for (const t of teams) teamById[t.id] = t

  const { data: preds, error: pe } = await supabase
    .from('predictions')
    .select('match_id, pred_home, pred_away, points, outcome_hit, exact_hit, goals_total_hit')
    .eq('user_id', userId)
  if (pe) throw pe

  const predByMatch = {}
  for (const p of preds ?? []) predByMatch[p.match_id] = p

  return matches.map((m) => ({
    ...m,
    home: teamById[m.home_team_id] ?? null,
    away: teamById[m.away_team_id] ?? null,
    prediction: predByMatch[m.id] ?? null,
  }))
}

export async function getMyProfile() {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, favorite_team_ids, onboarding_done, is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function finishOnboarding(favoriteTeamIds) {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) throw new Error('No hay sesión activa.')
  const { error } = await supabase
    .from('profiles')
    .update({ favorite_team_ids: favoriteTeamIds, onboarding_done: true })
    .eq('id', user.id)
  if (error) throw error
}
// Tabla de posiciones (vista standings, con orden por puntos)
export async function getStandings() {
  const { data, error } = await supabase
    .from('standings')
    .select('user_id, full_name, avatar_url, favorite_team_ids, total_points, jugados, aciertos, exactos, bono_campeon')
    .order('total_points', { ascending: false })
    .order('exactos', { ascending: false })
    .order('aciertos', { ascending: false })
  if (error) throw error
  return data
}


// ADMIN: cambia marcador/estado de un partido (la base valida que seas admin)
export async function adminUpdateMatch(matchId, fields) {
  const patch = { ...fields, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('matches').update(patch).eq('id', matchId)
  if (error) throw error
}