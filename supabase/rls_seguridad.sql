-- ============================================================
-- RLS de seguridad — cerrar la lectura ANÓNIMA de datos personales
--
-- Problema: con la anon key (visible en F12) cualquiera podía hacer
--   GET /rest/v1/profiles  y descargar los 333 registros (nombre, DNI,
--   celular, correo). Este script lo cierra.
--
-- Regla:
--   • profiles y tablas con datos personales / de proceso  -> SOLO usuarios autenticados
--   • colegios, ubigeo, partidos, distritos, resultados agregados -> lectura pública
--   • votos -> lectura pública (resultados en vivo, sin PII), escritura autenticada
--
-- Ejecutar en Supabase > SQL Editor. Idempotente.
-- Antes de correrlo hay que desplegar el cambio de los logins (usan la RPC de abajo).
-- ============================================================

-- ── RPC para el fallback de login ────────────────────────────
-- Devuelve la clave_acceso generada de UN dni exacto. SECURITY DEFINER
-- para poder llamarse antes de autenticar. No permite volcar el padrón:
-- solo entrega un valor por DNI conocido.
create or replace function public.clave_acceso_por_dni(p_dni text)
returns text
language sql
security definer
set search_path = public
as $$
  select clave_acceso from public.profiles where dni = p_dni limit 1;
$$;
revoke all on function public.clave_acceso_por_dni(text) from public;
grant execute on function public.clave_acceso_por_dni(text) to anon, authenticated;

-- ── profiles: authenticated = todo; anon = SOLO insert (registro) ────────
alter table public.profiles enable row level security;
drop policy if exists "profiles_own"        on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;
drop policy if exists "profiles_auth_all"   on public.profiles;
drop policy if exists "profiles_anon_insert" on public.profiles;
create policy "profiles_auth_all"   on public.profiles for all    to authenticated using (true) with check (true);
-- Registro nuevo: si signUp no devuelve sesión (confirmación de correo activada)
-- el upsert corre como anon; se permite SOLO insertar (no leer ni editar a otros).
create policy "profiles_anon_insert" on public.profiles for insert to anon with check (true);

-- Nota: profiles queda legible por CUALQUIER usuario autenticado (los paneles
-- de coordinador necesitan ver a los personeros de su zona; el acotamiento por
-- geografía se hace en la app). Lo que se cierra es el acceso ANÓNIMO de lectura.

-- ── Resto de tablas con PII / proceso -> solo authenticated ──────────────
do $$
declare t text;
begin
  foreach t in array array[
    'actas', 'asistencias', 'quiz_intentos', 'training_progress', 'training_items', 'app_config'
  ]
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_auth_all" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_admin" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_admin_read" on public.%1$I', t);
    execute format(
      'create policy "%1$s_auth_all" on public.%1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ── votos: lectura pública, escritura autenticada ───────────
alter table public.votos enable row level security;
drop policy if exists "votos_read_all" on public.votos;
drop policy if exists "votos_insert_personero" on public.votos;
drop policy if exists "votos_read_pub" on public.votos;
drop policy if exists "votos_write_auth" on public.votos;
drop policy if exists "votos_upd_auth" on public.votos;
create policy "votos_read_pub"  on public.votos for select using (true);
create policy "votos_write_auth" on public.votos for insert to authenticated with check (true);
create policy "votos_upd_auth"   on public.votos for update to authenticated using (true) with check (true);

-- ── Data de referencia (no sensible): lectura pública ───────
do $$
declare t text;
begin
  foreach t in array array['colegios', 'distritos', 'partidos', 'mesas',
    'candidatos_provinciales', 'candidatos_distritales']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_read_pub" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_write_auth" on public.%1$I', t);
    execute format('create policy "%1$s_read_pub" on public.%1$I for select using (true)', t);
    execute format('create policy "%1$s_write_auth" on public.%1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ── Verificación ───────────────────────────────────────────
-- Como anónimo (solo apikey, sin token de sesión) esto debe devolver 0 filas / error:
--   select * from profiles limit 1;
-- Como usuario autenticado debe funcionar normal.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relname in ('profiles','actas','votos','asistencias','colegios','quiz_intentos','training_progress')
order by relname;
