-- ============================================================
--  QUINIELA PETROBOSCAN — 3er puesto automático
--  Los DOS perdedores de las semifinales caen solos a la casilla '3P'
--  (perdedor de SF-1 -> local, perdedor de SF-2 -> visitante) y se
--  abre su ventana de predicción.
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run.
--  NO toca predictions.updated_at (regla crítica intacta).
-- ============================================================

-- 1) Ampliar la propagación: además del ganador (que ya iba a su feeds_slot),
--    el PERDEDOR de cada semifinal va al 3er puesto.
create or replace function public.ko_propagate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Ganador -> su casilla destino (lógica original)
  if new.stage <> 'group'
     and new.winner_team_id is not null
     and new.feeds_slot is not null
     and (old.winner_team_id is distinct from new.winner_team_id) then

    if new.feeds_as = 'home' then
      update public.matches set home_team_id = new.winner_team_id where bracket_slot = new.feeds_slot;
    else
      update public.matches set away_team_id = new.winner_team_id where bracket_slot = new.feeds_slot;
    end if;

    update public.matches
       set opens_at = now()
     where bracket_slot = new.feeds_slot
       and home_team_id is not null
       and away_team_id is not null
       and (opens_at is null or opens_at > now());
  end if;

  -- Perdedor de SEMIFINALES -> partido por el 3er puesto
  if new.stage = 'sf'
     and new.winner_team_id is not null
     and new.home_team_id is not null
     and new.away_team_id is not null
     and (old.winner_team_id is distinct from new.winner_team_id) then

    if new.bracket_slot = 'SF-1' then
      update public.matches
         set home_team_id = case when new.home_team_id = new.winner_team_id
                                 then new.away_team_id else new.home_team_id end
       where bracket_slot = '3P';
    elsif new.bracket_slot = 'SF-2' then
      update public.matches
         set away_team_id = case when new.home_team_id = new.winner_team_id
                                 then new.away_team_id else new.home_team_id end
       where bracket_slot = '3P';
    end if;

    update public.matches
       set opens_at = now()
     where bracket_slot = '3P'
       and home_team_id is not null
       and away_team_id is not null
       and (opens_at is null or opens_at > now());
  end if;

  return new;
end;
$$;


-- 2) Relleno inmediato: toma los perdedores de las semis YA finalizadas
--    y los coloca en el 3er puesto (coalesce = no borra si aún no hay dato).
update public.matches tp
   set home_team_id = coalesce(
         (select case when s.home_team_id = s.winner_team_id then s.away_team_id else s.home_team_id end
            from public.matches s where s.bracket_slot = 'SF-1' and s.winner_team_id is not null),
         tp.home_team_id),
       away_team_id = coalesce(
         (select case when s.home_team_id = s.winner_team_id then s.away_team_id else s.home_team_id end
            from public.matches s where s.bracket_slot = 'SF-2' and s.winner_team_id is not null),
         tp.away_team_id)
 where tp.bracket_slot = '3P';

-- 3) Abrir la ventana del 3er puesto si ya tiene sus dos equipos.
update public.matches
   set opens_at = now()
 where bracket_slot = '3P'
   and home_team_id is not null
   and away_team_id is not null
   and (opens_at is null or opens_at > now());

-- 4) Comprobar cómo quedó
select tp.bracket_slot, h.name as local, a.name as visitante, tp.kickoff, tp.opens_at
from public.matches tp
left join public.teams h on h.id = tp.home_team_id
left join public.teams a on a.id = tp.away_team_id
where tp.bracket_slot = '3P';
