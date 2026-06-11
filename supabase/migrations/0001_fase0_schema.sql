-- ============================================================
--  QUINIELA PETROBOSCAN — Fase 0: Cimientos
--  Supabase / PostgreSQL
--  DONDE EJECUTARLO: Supabase Dashboard > SQL Editor > pegar y Run
--  (opcional, para versionar) guardar copia en:
--      quiniela-petroboscan/supabase/migrations/0001_fase0_schema.sql
-- ============================================================

-- ============================================================
--  1. PERFILES  (datos del usuario, ligados a Supabase Auth)
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  employee_id text,          -- para el carnet (fase posterior)
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Crear el perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
--  2. EQUIPOS  (se siembran desde API-Football)
-- ============================================================
create table if not exists public.teams (
  id          int primary key,        -- id de API-Football
  name        text not null,
  code        text,                   -- 3 letras (MEX, BRA...)
  flag_url    text,
  group_label char(1)                 -- 'A'..'L'
);


-- ============================================================
--  3. PARTIDOS  (escritos SOLO por la Edge Function / service role)
-- ============================================================
create table if not exists public.matches (
  id            bigint primary key,   -- fixture id de API-Football
  stage         text not null default 'group',  -- group, r32, r16, qf, sf, third, final
  group_label   char(1),
  round_label   text,                 -- p.ej. 'Jornada 1'  (sirve para la tabla por jornada)
  kickoff       timestamptz not null,
  home_team_id  int references public.teams(id),
  away_team_id  int references public.teams(id),
  home_placeholder text,              -- p.ej. '1A', '3C', 'W73' (eliminatorias)
  away_placeholder text,
  status        text not null default 'NS',  -- NS,1H,HT,2H,ET,P,FT,AET,PEN...
  home_goals    int,
  away_goals    int,
  venue         text,
  city          text,
  updated_at    timestamptz default now()
);

create index if not exists idx_matches_kickoff on public.matches(kickoff);
create index if not exists idx_matches_group   on public.matches(group_label);


-- ============================================================
--  4. PREDICCIONES
-- ============================================================
create table if not exists public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid   not null references public.profiles(id) on delete cascade,
  match_id        bigint not null references public.matches(id)  on delete cascade,
  pred_home       int    not null check (pred_home >= 0),
  pred_away       int    not null check (pred_away >= 0),
  points          numeric(4,1) default 0,
  outcome_hit     boolean default false,   -- acertó ganador o empate (+3 / +1.5)
  exact_hit       boolean default false,   -- acertó marcador exacto (+1)
  goals_total_hit boolean default false,   -- acertó cantidad total de goles (+0.5)
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_id, match_id)
);


-- ============================================================
--  5. MOTOR DE PUNTOS  (server-side, fuente única de verdad)
--     Empate = 1.5 | Ganador = 3
--     + 1   si marcador EXACTO
--     + 0.5 si coincide la CANTIDAD TOTAL de goles (y NO fue exacto)
-- ============================================================
create or replace function public.calc_points(
  ph int, pa int, ah int, aa int,
  out points numeric, out outcome_hit boolean,
  out exact_hit boolean, out goals_total_hit boolean
)
language plpgsql immutable
as $$
declare
  pred_sign numeric;
  real_sign numeric;
begin
  points := 0; outcome_hit := false; exact_hit := false; goals_total_hit := false;

  -- Partido sin resultado todavía
  if ah is null or aa is null then
    return;
  end if;

  pred_sign := sign(ph - pa);   -- 1 gana local, -1 gana visitante, 0 empate
  real_sign := sign(ah - aa);

  -- Acierto de resultado (ganador o empate)
  if pred_sign = real_sign then
    outcome_hit := true;
    if real_sign = 0 then
      points := 1.5;            -- acertó empate
    else
      points := 3;              -- acertó ganador
    end if;
  end if;

  -- Bono de goles: el marcador exacto manda; si no, la cantidad total
  if ph = ah and pa = aa then
    exact_hit := true;
    points := points + 1;
  elsif (ph + pa) = (ah + aa) then
    goals_total_hit := true;
    points := points + 0.5;
  end if;
end;
$$;

-- Recalcular todas las predicciones cuando cambia el marcador de un partido
create or replace function public.rescore_match()
returns trigger
language plpgsql
as $$
declare
  r record;
  c record;
begin
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
  return new;
end;
$$;

drop trigger if exists trg_rescore on public.matches;
create trigger trg_rescore
  after update of home_goals, away_goals, status on public.matches
  for each row execute function public.rescore_match();


-- ============================================================
--  6. SEGURIDAD (RLS) — aquí viven tus reglas anti-trampa
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.teams       enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;

-- Perfiles: todos los logueados leen (para la tabla); solo el dueño edita
create policy "perfiles legibles" on public.profiles
  for select to authenticated using (true);
create policy "edita su perfil" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Equipos y partidos: lectura para logueados; escritura SOLO service role (Edge Function)
create policy "equipos legibles" on public.teams
  for select to authenticated using (true);
create policy "partidos legibles" on public.matches
  for select to authenticated using (true);

-- Predicciones — VER: las propias siempre; las de otros SOLO si el partido ya empezó
--                (anti-copia: nadie ve tu pronóstico antes del pitazo)
create policy "ver predicciones" on public.predictions
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.matches m
       where m.id = predictions.match_id
         and now() >= m.kickoff
    )
  );

-- Predicciones — CREAR: solo las propias y SOLO en la ventana [kickoff-12h, kickoff)
create policy "crear prediccion" on public.predictions
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
       where m.id = match_id
         and m.status = 'NS'
         and now() >= m.kickoff - interval '12 hours'
         and now() <  m.kickoff
    )
  );

-- Predicciones — EDITAR: igual que crear, dentro de la misma ventana
create policy "editar prediccion" on public.predictions
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
       where m.id = match_id
         and m.status = 'NS'
         and now() >= m.kickoff - interval '12 hours'
         and now() <  m.kickoff
    )
  );


-- ============================================================
--  7. TABLA DE POSICIONES (vista agregada para el ranking general)
-- ============================================================
create or replace view public.standings as
select
  pr.id          as user_id,
  pr.full_name,
  pr.avatar_url,
  coalesce(sum(p.points), 0)                  as total_points,
  count(p.id) filter (where m.status = 'FT')  as jugados,
  count(p.id) filter (where p.outcome_hit)    as aciertos,
  count(p.id) filter (where p.exact_hit)      as exactos
from public.profiles pr
left join public.predictions p on p.user_id = pr.id
left join public.matches     m on m.id      = p.match_id
group by pr.id, pr.full_name, pr.avatar_url
order by total_points desc, exactos desc, aciertos desc;

-- Fin Fase 0.
