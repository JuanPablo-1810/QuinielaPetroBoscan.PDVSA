-- ============================================================
--  QUINIELA PETROBOSCAN — Fase eliminatoria (16vos -> Final)
--  Bracket dinámico + motor de puntos de eliminatoria.
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run.
--  Es idempotente: puede correrse de nuevo sin romper nada
--  (no borra resultados ya cargados ni predicciones de las llaves).
--
--  REGLA CRÍTICA (intacta): rescore_match NUNCA escribe updated_at.
--  El trigger trg_prediction_touch solo mueve updated_at cuando cambia
--  pred_home/pred_away. La auditoría de horas depende de eso.
-- ============================================================

-- ------------------------------------------------------------
-- 1. COLUMNAS NUEVAS
-- ------------------------------------------------------------
-- En matches: el armazón del bracket.
--   bracket_slot  -> casilla única de este partido (R32-1..R32-16, R16-A..R16-H,
--                    QF-1..QF-4, SF-1, SF-2, FINAL, 3P)
--   feeds_slot    -> a qué casilla va el GANADOR de este partido
--   feeds_as      -> si entra como 'home' o 'away' en esa casilla
--   pen_home/away -> goles de la tanda de penales (null si no hubo)
--   winner_team_id-> equipo que avanzó (null hasta resolverse)
--   home_goals/away_goals se reutilizan para el marcador de los 120'.
alter table public.matches
  add column if not exists bracket_slot   text,
  add column if not exists feeds_slot      text,
  add column if not exists feeds_as        text,
  add column if not exists pen_home        int,
  add column if not exists pen_away        int,
  add column if not exists winner_team_id  int references public.teams(id);

-- feeds_as solo puede ser 'home' o 'away' (o null en FINAL / 3er puesto)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_feeds_as_chk') then
    alter table public.matches
      add constraint matches_feeds_as_chk
      check (feeds_as is null or feeds_as in ('home','away'));
  end if;
end $$;

-- Cada casilla del bracket es única
create unique index if not exists idx_matches_bracket_slot
  on public.matches(bracket_slot) where bracket_slot is not null;

-- En predictions: qué equipo cree el usuario que AVANZA ('home'/'away').
-- Null en los partidos de grupo.
alter table public.predictions
  add column if not exists pred_advance text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'predictions_pred_advance_chk') then
    alter table public.predictions
      add constraint predictions_pred_advance_chk
      check (pred_advance is null or pred_advance in ('home','away'));
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. MOTOR DE PUNTOS DE ELIMINATORIA
--    +1  si el marcador predicho coincide EXACTO con los 120' (sin penales)
--    +3  si el equipo que el usuario marcó como "avanza" es el que avanzó
--    Máximo 4. Sin medio punto por cantidad de goles.
--
--    Para deducir el "avanza" del usuario:
--      - si su marcador tiene ganador -> avanza ese
--      - si predijo empate            -> usa pred_advance
-- ------------------------------------------------------------
create or replace function public.calc_points_ko(
  ph int, pa int, padv text,
  ah int, aa int,
  home_id int, away_id int, win_id int,
  out points numeric, out advance_hit boolean, out exact_hit boolean
)
language plpgsql immutable
as $$
declare
  user_adv int;
begin
  points := 0; advance_hit := false; exact_hit := false;

  -- Partido sin resultado todavía
  if ah is null or aa is null then
    return;
  end if;

  -- +1 marcador exacto de los 120 minutos
  if ph = ah and pa = aa then
    exact_hit := true;
    points := points + 1;
  end if;

  -- Equipo que el usuario cree que avanza
  if ph > pa then
    user_adv := home_id;
  elsif pa > ph then
    user_adv := away_id;
  elsif padv = 'home' then
    user_adv := home_id;
  elsif padv = 'away' then
    user_adv := away_id;
  else
    user_adv := null;          -- empate predicho sin "avanza" elegido
  end if;

  -- +3 si acertó quién avanzó
  if win_id is not null and user_adv is not null and user_adv = win_id then
    advance_hit := true;
    points := points + 3;
  end if;
end;
$$;


-- ------------------------------------------------------------
-- 3. RESCORE: ahora ramifica por etapa (grupo vs eliminatoria).
--    NUNCA toca updated_at (regla crítica intacta).
--    Mantiene security definer para recalcular a TODOS.
--    Para eliminatorias guardamos:
--      outcome_hit = acertó quién avanzó (+3)   -> cuenta como "acierto"
--      exact_hit   = marcador exacto de 120'    -> cuenta como "exacto"
--      goals_total_hit = false (no aplica)
-- ------------------------------------------------------------
create or replace function public.rescore_match()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  c record;
  k record;
begin
  if new.status = 'FT'
     and new.home_goals is not null
     and new.away_goals is not null then

    for r in select * from public.predictions where match_id = new.id loop
      if new.stage = 'group' then
        -- Fase de grupos: motor original, intacto
        select * into c
          from public.calc_points(r.pred_home, r.pred_away, new.home_goals, new.away_goals);
        update public.predictions
           set points          = c.points,
               outcome_hit     = c.outcome_hit,
               exact_hit       = c.exact_hit,
               goals_total_hit = c.goals_total_hit
         where id = r.id;
      else
        -- Eliminatoria: marcador 120' + quién avanza
        select * into k
          from public.calc_points_ko(
            r.pred_home, r.pred_away, r.pred_advance,
            new.home_goals, new.away_goals,
            new.home_team_id, new.away_team_id, new.winner_team_id);
        update public.predictions
           set points          = k.points,
               outcome_hit     = k.advance_hit,
               exact_hit       = k.exact_hit,
               goals_total_hit = false
         where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end;
$$;


-- ------------------------------------------------------------
-- 4. RESOLVER EL GANADOR (BEFORE UPDATE)
--    Al marcar FT en una llave, calcula winner_team_id:
--      - distinto en 120'  -> el de más goles
--      - empate en 120'    -> el de más penales (si ya están cargados)
--      - empate sin penales-> queda null (el admin carga la tanda)
--    Se ejecuta BEFORE para que winner_team_id quede persistido en la
--    misma fila y el rescore (AFTER) ya lo vea.
-- ------------------------------------------------------------
create or replace function public.ko_set_winner()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.stage <> 'group'
     and new.status = 'FT'
     and new.home_goals is not null
     and new.away_goals is not null
     and new.home_team_id is not null
     and new.away_team_id is not null then

    if new.home_goals > new.away_goals then
      new.winner_team_id := new.home_team_id;
    elsif new.away_goals > new.home_goals then
      new.winner_team_id := new.away_team_id;
    elsif new.pen_home is not null and new.pen_away is not null
          and new.pen_home <> new.pen_away then
      new.winner_team_id := case
        when new.pen_home > new.pen_away then new.home_team_id
        else new.away_team_id end;
    else
      new.winner_team_id := null;   -- empate sin penales definidos
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ko_set_winner on public.matches;
create trigger trg_ko_set_winner
  before update of status, home_goals, away_goals, pen_home, pen_away
  on public.matches
  for each row execute function public.ko_set_winner();


-- ------------------------------------------------------------
-- 5. PROPAGAR AL BRACKET (AFTER UPDATE)
--    Cuando se define winner_team_id, coloca al ganador en su casilla
--    destino (feeds_slot como feeds_as). Si la casilla destino ya tiene
--    sus dos equipos, ABRE su ventana de predicción (opens_at = now()).
--    El perdedor no se mueve (se queda eliminado).
-- ------------------------------------------------------------
create or replace function public.ko_propagate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.stage <> 'group'
     and new.winner_team_id is not null
     and new.feeds_slot is not null
     and (old.winner_team_id is distinct from new.winner_team_id) then

    if new.feeds_as = 'home' then
      update public.matches
         set home_team_id = new.winner_team_id
       where bracket_slot = new.feeds_slot;
    else
      update public.matches
         set away_team_id = new.winner_team_id
       where bracket_slot = new.feeds_slot;
    end if;

    -- Si la casilla destino ya tiene a sus dos equipos -> abrir su ventana
    update public.matches
       set opens_at = now()
     where bracket_slot = new.feeds_slot
       and home_team_id is not null
       and away_team_id is not null
       and (opens_at is null or opens_at > now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ko_propagate on public.matches;
create trigger trg_ko_propagate
  after update of winner_team_id, status
  on public.matches
  for each row execute function public.ko_propagate();


-- ------------------------------------------------------------
-- 6. RECREAR trg_rescore para que también dispare al definirse el
--    ganador (caso: empate resuelto por penales cargados DESPUÉS de FT).
-- ------------------------------------------------------------
drop trigger if exists trg_rescore on public.matches;
create trigger trg_rescore
  after update of home_goals, away_goals, status, winner_team_id
  on public.matches
  for each row execute function public.rescore_match();


-- ============================================================
--  7. SIEMBRA DEL BRACKET
-- ============================================================

-- 7.0 Limpiar cualquier partido de eliminatoria de football-data (id > 0)
--     para que no choque con el bracket personalizado. Nuestras llaves usan
--     ids negativos, así que esto NO toca lo que sembremos aquí.
delete from public.predictions
 where match_id in (select id from public.matches where stage <> 'group' and id > 0);
delete from public.matches where stage <> 'group' and id > 0;

-- 7.1 Mapa de equipos: español <-> nombre en football-data (inglés) <-> código.
--     Se usa para (a) renombrar los equipos a español y (b) resolver teams.id.
create temp table _tmap (es text, en text, code text) on commit drop;
insert into _tmap (es, en, code) values
  ('Alemania','Germany','GER'),
  ('Paraguay','Paraguay','PAR'),
  ('Francia','France','FRA'),
  ('Suecia','Sweden','SWE'),
  ('Sudáfrica','South Africa','RSA'),
  ('Canadá','Canada','CAN'),
  ('Países Bajos','Netherlands','NED'),
  ('Marruecos','Morocco','MAR'),
  ('Portugal','Portugal','POR'),
  ('Croacia','Croatia','CRO'),
  ('España','Spain','ESP'),
  ('Austria','Austria','AUT'),
  ('Estados Unidos','United States','USA'),
  ('Bosnia y Herzegovina','Bosnia and Herzegovina','BIH'),
  ('Bélgica','Belgium','BEL'),
  ('Senegal','Senegal','SEN'),
  ('Brasil','Brazil','BRA'),
  ('Japón','Japan','JPN'),
  ('Costa de Marfil','Ivory Coast','CIV'),
  ('Noruega','Norway','NOR'),
  ('México','Mexico','MEX'),
  ('Ecuador','Ecuador','ECU'),
  ('Inglaterra','England','ENG'),
  ('RD Congo','DR Congo','COD'),
  ('Argentina','Argentina','ARG'),
  ('Cabo Verde','Cape Verde','CPV'),
  ('Australia','Australia','AUS'),
  ('Egipto','Egypt','EGY'),
  ('Suiza','Switzerland','SUI'),
  ('Argelia','Algeria','ALG'),
  ('Colombia','Colombia','COL'),
  ('Ghana','Ghana','GHA');

-- 7.2 Resolver teams.id (por código TLA, o por nombre en inglés/español).
create temp table _team (es text primary key, id int) on commit drop;
insert into _team (es, id)
select m.es, hit.id
from _tmap m
join lateral (
  select t.id
  from public.teams t
  where upper(t.code) = upper(m.code)
     or t.name ilike m.en
     or t.name ilike m.es
  order by (upper(t.code) = upper(m.code)) desc   -- prioriza match por código
  limit 1
) hit on true;

-- 7.3 Renombrar a español los equipos emparejados.
update public.teams t
   set name = tm.es
  from _team tm
 where t.id = tm.id;

-- 7.4 Aviso si algún equipo no se pudo emparejar (revisar al final).
do $$
declare
  faltan text;
begin
  select string_agg(m.es, ', ')
    into faltan
  from _tmap m
  left join _team te on te.es = m.es
  where te.id is null;
  if faltan is not null then
    raise notice 'OJO: equipos sin emparejar en la tabla teams -> %', faltan;
  else
    raise notice 'OK: los 32 equipos del bracket se emparejaron correctamente.';
  end if;
end $$;

-- 7.5 Sembrar la RONDA DE 32 (16 partidos, hora VET +4 = UTC).
--     opens_at = sentinela pasada -> abiertos para predecir desde ya
--     (cierran en su propio kickoff).
insert into public.matches
  (id, stage, round_label, kickoff, opens_at, status,
   home_team_id, away_team_id, bracket_slot, feeds_slot, feeds_as)
select
  v.id, 'r32', 'Ronda de 32', v.kickoff::timestamptz,
  timestamptz '2000-01-01 00:00:00+00', 'NS',
  th.id, ta.id, v.slot, v.feeds_slot, v.feeds_as
from (values
  (-1001, '2026-06-29T20:30:00Z', 'Alemania',            'Paraguay',             'R32-1',  'R16-A', 'home'),
  (-1002, '2026-06-30T21:00:00Z', 'Francia',             'Suecia',               'R32-2',  'R16-A', 'away'),
  (-1003, '2026-06-28T19:00:00Z', 'Sudáfrica',           'Canadá',               'R32-3',  'R16-B', 'home'),
  (-1004, '2026-06-30T01:00:00Z', 'Países Bajos',        'Marruecos',            'R32-4',  'R16-B', 'away'),
  (-1005, '2026-07-02T23:00:00Z', 'Portugal',            'Croacia',              'R32-5',  'R16-C', 'home'),
  (-1006, '2026-07-02T19:00:00Z', 'España',              'Austria',              'R32-6',  'R16-C', 'away'),
  (-1007, '2026-07-02T00:00:00Z', 'Estados Unidos',      'Bosnia y Herzegovina', 'R32-7',  'R16-D', 'home'),
  (-1008, '2026-07-01T20:00:00Z', 'Bélgica',             'Senegal',              'R32-8',  'R16-D', 'away'),
  (-1009, '2026-06-29T17:00:00Z', 'Brasil',              'Japón',                'R32-9',  'R16-E', 'home'),
  (-1010, '2026-06-30T17:00:00Z', 'Costa de Marfil',     'Noruega',              'R32-10', 'R16-E', 'away'),
  (-1011, '2026-07-01T01:00:00Z', 'México',              'Ecuador',              'R32-11', 'R16-F', 'home'),
  (-1012, '2026-07-01T16:00:00Z', 'Inglaterra',          'RD Congo',             'R32-12', 'R16-F', 'away'),
  (-1013, '2026-07-03T22:00:00Z', 'Argentina',           'Cabo Verde',           'R32-13', 'R16-G', 'home'),
  (-1014, '2026-07-03T18:00:00Z', 'Australia',           'Egipto',               'R32-14', 'R16-G', 'away'),
  (-1015, '2026-07-03T03:00:00Z', 'Suiza',               'Argelia',              'R32-15', 'R16-H', 'home'),
  (-1016, '2026-07-04T01:30:00Z', 'Colombia',            'Ghana',                'R32-16', 'R16-H', 'away')
) as v(id, kickoff, home_es, away_es, slot, feeds_slot, feeds_as)
left join _team th on th.es = v.home_es
left join _team ta on ta.es = v.away_es
on conflict (id) do update set
  stage        = excluded.stage,
  round_label  = excluded.round_label,
  kickoff      = excluded.kickoff,
  home_team_id = excluded.home_team_id,
  away_team_id = excluded.away_team_id,
  bracket_slot = excluded.bracket_slot,
  feeds_slot   = excluded.feeds_slot,
  feeds_as     = excluded.feeds_as;

-- 7.6 Sembrar las casillas vacías de Octavos, Cuartos, Semis, Final y 3er puesto.
--     Equipos null ("Por definir"); opens_at sentinela FUTURA -> cerradas
--     hasta que la propagación las defina y abra su ventana.
--     Las fechas son PROVISIONALES; el admin las ajusta desde el panel.
insert into public.matches
  (id, stage, round_label, kickoff, opens_at, status, bracket_slot, feeds_slot, feeds_as)
select
  v.id, v.stage, v.round_label, v.kickoff::timestamptz,
  timestamptz '2099-01-01 00:00:00+00', 'NS',
  v.slot, v.feeds_slot, v.feeds_as
from (values
  (-2001, 'r16',   'Octavos',        '2026-07-04T17:00:00Z', 'R16-A', 'QF-1',  'home'),
  (-2002, 'r16',   'Octavos',        '2026-07-04T21:00:00Z', 'R16-B', 'QF-1',  'away'),
  (-2003, 'r16',   'Octavos',        '2026-07-05T20:00:00Z', 'R16-C', 'QF-2',  'home'),
  (-2004, 'r16',   'Octavos',        '2026-07-06T00:00:00Z', 'R16-D', 'QF-2',  'away'),
  (-2005, 'r16',   'Octavos',        '2026-07-06T19:00:00Z', 'R16-E', 'QF-3',  'home'),
  (-2006, 'r16',   'Octavos',        '2026-07-07T00:00:00Z', 'R16-F', 'QF-3',  'away'),
  (-2007, 'r16',   'Octavos',        '2026-07-07T16:00:00Z', 'R16-G', 'QF-4',  'home'),
  (-2008, 'r16',   'Octavos',        '2026-07-07T20:00:00Z', 'R16-H', 'QF-4',  'away'),
  (-3001, 'qf',    'Cuartos',        '2026-07-09T20:00:00Z', 'QF-1',  'SF-1',  'home'),
  (-3002, 'qf',    'Cuartos',        '2026-07-10T19:00:00Z', 'QF-2',  'SF-1',  'away'),
  (-3003, 'qf',    'Cuartos',        '2026-07-11T21:00:00Z', 'QF-3',  'SF-2',  'home'),
  (-3004, 'qf',    'Cuartos',        '2026-07-12T01:00:00Z', 'QF-4',  'SF-2',  'away'),
  (-4001, 'sf',    'Semifinales',    '2026-07-14T19:00:00Z', 'SF-1',  'FINAL', 'home'),
  (-4002, 'sf',    'Semifinales',    '2026-07-15T19:00:00Z', 'SF-2',  'FINAL', 'away'),
  (-5002, 'third', 'Tercer puesto',  '2026-07-18T21:00:00Z', '3P',    null,    null),
  (-5001, 'final', 'Final',          '2026-07-19T19:00:00Z', 'FINAL', null,    null)
) as v(id, stage, round_label, kickoff, slot, feeds_slot, feeds_as)
on conflict (id) do update set
  stage        = excluded.stage,
  round_label  = excluded.round_label,
  -- kickoff NO se sobrescribe en re-ejecución: respeta lo que el admin haya ajustado
  bracket_slot = excluded.bracket_slot,
  feeds_slot   = excluded.feeds_slot,
  feeds_as     = excluded.feeds_as;


-- ------------------------------------------------------------
-- 8. VERIFICACIÓN (lee esta tabla al terminar el Run)
--    Muestra cómo quedó el emparejamiento de los 32 equipos.
--    Si alguna fila trae team_id NULL, ese equipo no está en teams:
--    avísame el nombre y lo resolvemos.
-- ------------------------------------------------------------
select
  m.es              as equipo_bracket,
  te.id             as team_id,
  t.name            as nombre_en_db,
  t.code            as codigo
from _tmap m
left join _team te on te.es = m.es
left join public.teams t on t.id = te.id
order by m.es;
