-- ============================================================
--  QUINIELA PETROBOSCAN — Reincorpora el +0.5 en eliminatorias
--  Igual que en fase de grupos: si NO aciertas el marcador exacto
--  pero sí la CANTIDAD TOTAL de goles, ganas +0.5.
--  Puntuación de llave: +3 avanza · +1 exacto · +0.5 total de goles · máx 4.
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run.
--  NO toca predictions.updated_at (regla crítica intacta).
-- ============================================================

-- 1) calc_points_ko ahora también devuelve goals_total_hit.
--    (Cambia la firma de salida -> hay que DROP + CREATE.)
drop function if exists public.calc_points_ko(int, int, text, int, int, int, int, int);

create function public.calc_points_ko(
  ph int, pa int, padv text,
  ah int, aa int,
  home_id int, away_id int, win_id int,
  out points numeric, out advance_hit boolean, out exact_hit boolean, out goals_total_hit boolean
)
language plpgsql immutable
as $$
declare
  user_adv int;
begin
  points := 0; advance_hit := false; exact_hit := false; goals_total_hit := false;

  if ah is null or aa is null then
    return;
  end if;

  -- Marcador (120'): exacto +1, o si no, cantidad total de goles +0.5
  if ph = ah and pa = aa then
    exact_hit := true;
    points := points + 1;
  elsif (ph + pa) = (ah + aa) then
    goals_total_hit := true;
    points := points + 0.5;
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
    user_adv := null;
  end if;

  -- +3 si acertó quién avanzó
  if win_id is not null and user_adv is not null and user_adv = win_id then
    advance_hit := true;
    points := points + 3;
  end if;
end;
$$;


-- 2) rescore_match: en eliminatoria ahora guarda también goals_total_hit.
--    Grupos intacto. Sigue SIN tocar updated_at.
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
        select * into c
          from public.calc_points(r.pred_home, r.pred_away, new.home_goals, new.away_goals);
        update public.predictions
           set points          = c.points,
               outcome_hit     = c.outcome_hit,
               exact_hit       = c.exact_hit,
               goals_total_hit = c.goals_total_hit
         where id = r.id;
      else
        select * into k
          from public.calc_points_ko(
            r.pred_home, r.pred_away, r.pred_advance,
            new.home_goals, new.away_goals,
            new.home_team_id, new.away_team_id, new.winner_team_id);
        update public.predictions
           set points          = k.points,
               outcome_hit     = k.advance_hit,
               exact_hit       = k.exact_hit,
               goals_total_hit = k.goals_total_hit
         where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end;
$$;


-- 3) Recalcular las llaves YA finalizadas (si las hay) con el nuevo motor.
--    Tocar la columna status dispara trg_rescore sin cambiar el resultado.
update public.matches
   set status = status
 where stage <> 'group' and status = 'FT';
