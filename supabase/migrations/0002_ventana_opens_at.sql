-- ============================================================
--  QUINIELA PETROBOSCAN — Ventana de predicción dinámica
--  Regla: cada partido ABRE cuando arranca la JORNADA ANTERIOR
--         y CIERRA justo al pitazo (kickoff).
--         La Jornada 1 (sin anterior) queda ABIERTA desde ya.
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run
--  Es idempotente: puede correrse encima de la base ya existente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna que guarda la hora de apertura de cada partido
-- ------------------------------------------------------------
alter table public.matches
  add column if not exists opens_at timestamptz;

-- ------------------------------------------------------------
-- 2. Función que recalcula opens_at para TODOS los partidos.
--    Una "jornada/ronda" = el conjunto de partidos con el mismo
--    round_label. Se ordenan por su primer pitazo, y cada ronda
--    abre cuando arrancó la ronda inmediatamente anterior.
--    La primera ronda (Jornada 1) abre en un instante pasado
--    (sentinela) => disponible desde ya.
--    Ignora partidos de PRUEBA (id < 0, ver simulate.mjs).
-- ------------------------------------------------------------
create or replace function public.recompute_open_windows()
returns void
language plpgsql
as $$
declare
  sentinel constant timestamptz := timestamptz '2000-01-01 00:00:00+00';
begin
  with rounds as (
    select
      coalesce(round_label, stage) as rk,
      min(kickoff)                 as round_start
    from public.matches
    where id > 0
    group by coalesce(round_label, stage)
  ),
  ordered as (
    select
      rk,
      round_start,
      lag(round_start) over (order by round_start) as prev_start
    from rounds
  )
  update public.matches m
     set opens_at = coalesce(o.prev_start, sentinel)
    from ordered o
   where coalesce(m.round_label, m.stage) = o.rk
     and m.id > 0;
end;
$$;

-- Calcular de inmediato con lo que ya esté sembrado
select public.recompute_open_windows();

-- ------------------------------------------------------------
-- 3. Reemplazar las políticas de la ventana (antes [kickoff-12h])
--    por la ventana real [opens_at, kickoff).
--    coalesce(...) mantiene un respaldo seguro de 12h si por
--    alguna razón opens_at viniera nulo.
-- ------------------------------------------------------------

-- CREAR: solo las propias y SOLO dentro de la ventana abierta
drop policy if exists "crear prediccion" on public.predictions;
create policy "crear prediccion" on public.predictions
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
       where m.id = match_id
         and m.status = 'NS'
         and now() >= coalesce(m.opens_at, m.kickoff - interval '12 hours')
         and now() <  m.kickoff
    )
  );

-- EDITAR: igual que crear, dentro de la misma ventana
drop policy if exists "editar prediccion" on public.predictions;
create policy "editar prediccion" on public.predictions
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
       where m.id = match_id
         and m.status = 'NS'
         and now() >= coalesce(m.opens_at, m.kickoff - interval '12 hours')
         and now() <  m.kickoff
    )
  );

-- NOTA: la política "ver predicciones" NO cambia: las de otros
-- siguen ocultas hasta el pitazo (now() >= kickoff). Anti-copia intacto.

-- Fin: ventana de predicción dinámica.
