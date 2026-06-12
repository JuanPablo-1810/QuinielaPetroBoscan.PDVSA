-- =====================================================================
-- Los puntos se calculan SOLO cuando el partido está FINALIZADO (FT).
-- En cualquier otro estado (no empezado / en vivo / medio tiempo) el
-- trigger NO toca nada: predicciones y puntos se mantienen tal como están.
-- Mantiene security definer para que el recálculo aplique a TODOS.
-- No borra historiales ni altera las predicciones de nadie.
-- =====================================================================

create or replace function public.rescore_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  c record;
begin
  -- Solo al FINALIZAR se calculan y guardan los puntos
  if new.status = 'FT'
     and new.home_goals is not null
     and new.away_goals is not null then
    for r in select * from public.predictions where match_id = new.id loop
      select * into c
        from public.calc_points(r.pred_home, r.pred_away, new.home_goals, new.away_goals);
      update public.predictions
         set points          = c.points,
             outcome_hit     = c.outcome_hit,
             exact_hit       = c.exact_hit,
             goals_total_hit = c.goals_total_hit,
             updated_at      = now()
       where id = r.id;
    end loop;
  end if;
  -- En cualquier otro estado: no se toca nada (se mantienen como están)
  return new;
end;
$$;
