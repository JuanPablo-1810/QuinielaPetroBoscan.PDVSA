-- ============================================================
--  QUINIELA PETROBOSCAN — Arregla la bandera de Marruecos
--  Todos los equipos usan crests.football-data.org/{id}.svg,
--  pero Marruecos (815) quedó con ".../morocco.svg", que da 404.
--  Resultado: su bandera no cargaba en la Tabla, el Bracket ni
--  las tarjetas de partido.
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run.
-- ============================================================

-- 1) Ver si hay MÁS banderas con una URL fuera del patrón {id}.svg
--    (ejecútala primero; si devuelve filas además de Marruecos, avísame)
select id, name, code, flag_url
from public.teams
where flag_url !~ '/[0-9]+\.svg$'
order by name;

-- 2) Arreglar Marruecos con una bandera confiable
update public.teams
   set flag_url = 'https://flagcdn.com/w160/ma.png'
 where id = 815;

-- 3) Comprobar
select id, name, code, flag_url from public.teams where id = 815;
