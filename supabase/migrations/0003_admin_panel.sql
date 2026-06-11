-- =====================================================================
-- Panel de administrador: control manual de marcador y estado.
-- =====================================================================

-- 1) Marcar quién es admin
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- >>> Pon TU correo aquí para hacerte admin (el de tu cuenta en la app):
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'TU_CORREO_AQUI');

-- 2) Que el recálculo de puntos actualice los de TODOS (no solo el del admin)
--    cuando un usuario admin cambia un partido desde la app.
alter function public.rescore_match() security definer;
alter function public.rescore_match() set search_path = public;

-- 3) Permitir que SOLO los admin actualicen partidos (marcador/estado) desde la app
drop policy if exists "admin actualiza partidos" on public.matches;
create policy "admin actualiza partidos" on public.matches
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
