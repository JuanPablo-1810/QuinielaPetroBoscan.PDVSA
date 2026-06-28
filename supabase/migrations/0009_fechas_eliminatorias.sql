-- ============================================================
--  QUINIELA PETROBOSCAN — Fechas confirmadas de la fase final
--  Reemplaza las fechas PROVISIONALES de Octavos, Cuartos, Semis,
--  3er puesto y Final por las oficiales.
--  Horas en hora de Venezuela (VET, UTC-4) -> convertidas a UTC.
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run.
--
--  Nota: re-ejecutar 0008 NO pisa estas fechas (su upsert respeta el
--  kickoff existente a propósito), por eso este ajuste va aparte.
--  El admin puede reajustar cualquier hora desde el panel cuando quiera.
-- ============================================================

update public.matches m
   set kickoff = v.k::timestamptz
from (values
  -- Octavos (R16-A..H)
  ('R16-A', '2026-07-04T17:00:00Z'),  -- Sáb 4/7  1:00 p.m. VET
  ('R16-B', '2026-07-04T21:00:00Z'),  -- Sáb 4/7  5:00 p.m. VET
  ('R16-C', '2026-07-05T20:00:00Z'),  -- Dom 5/7  4:00 p.m. VET
  ('R16-D', '2026-07-06T00:00:00Z'),  -- Dom 5/7  8:00 p.m. VET
  ('R16-E', '2026-07-06T19:00:00Z'),  -- Lun 6/7  3:00 p.m. VET
  ('R16-F', '2026-07-07T00:00:00Z'),  -- Lun 6/7  8:00 p.m. VET
  ('R16-G', '2026-07-07T16:00:00Z'),  -- Mar 7/7 12:00 p.m. VET
  ('R16-H', '2026-07-07T20:00:00Z'),  -- Mar 7/7  4:00 p.m. VET
  -- Cuartos (QF-1..4)
  ('QF-1',  '2026-07-09T20:00:00Z'),  -- Jue 9/7  4:00 p.m. VET
  ('QF-2',  '2026-07-10T19:00:00Z'),  -- Vie 10/7 3:00 p.m. VET
  ('QF-3',  '2026-07-11T21:00:00Z'),  -- Sáb 11/7 5:00 p.m. VET
  ('QF-4',  '2026-07-12T01:00:00Z'),  -- Sáb 11/7 9:00 p.m. VET
  -- Semifinales (SF-1, SF-2)
  ('SF-1',  '2026-07-14T19:00:00Z'),  -- Mar 14/7 3:00 p.m. VET
  ('SF-2',  '2026-07-15T19:00:00Z'),  -- Mié 15/7 3:00 p.m. VET
  -- Tercer puesto
  ('3P',    '2026-07-18T21:00:00Z'),  -- Sáb 18/7 5:00 p.m. VET
  -- Final
  ('FINAL', '2026-07-19T19:00:00Z')   -- Dom 19/7 3:00 p.m. VET
) as v(slot, k)
where m.bracket_slot = v.slot;
