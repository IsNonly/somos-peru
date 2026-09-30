-- ============================================================
-- Seguridad por ROL (reemplaza a rls_seguridad.sql / fix_*_rls.sql)
--
-- Problemas que cierra:
--   1. fix_profiles_rls.sql dejaba `profiles` legible y editable por ANÓNIMOS
--      (con la anon key, que es pública, se descargaba todo el padrón con DNI,
--      celular y clave_acceso). Ese script ya no debe volver a correrse.
--   2. Con rls_seguridad.sql, CUALQUIER cuenta (incluso una recién creada desde
--      el registro público) podía leer todo el padrón, editar a cualquiera,
--      ponerse a sí misma "Administrador General", y cambiar actas y votos
--      ajenos.
--
-- Reglas nuevas:
--   • Anónimo: no lee nada personal. Solo puede registrarse (insert) y leer
--     tablas de referencia (colegios, mesas, candidaturas…) y votos (resultados).
--   • Personero de Mesa: ve y edita SOLO su propio perfil, su acta y sus votos.
--   • Personero de Centro de Votación (PCV): además, los personeros, actas y
--     asistencias de SU centro de votación.
--   • Administrador / Coordinadores: todo el padrón de la instancia (igual que hoy).
--   • Nadie se asigna un rol de Administrador / Coordinador Regional salvo el
--     Administrador. Solo Admin/Coordinadores cambian roles, DNI o claves.
--   • Un acta transmitida (bloqueada) solo la corrige Admin/Coordinador.
--   • Borrar perfiles: solo Administrador (o la Edge Function con service_role).
--
-- Ejecutar en Supabase > SQL Editor de CADA instancia (VES, Cercado, San Isidro).
-- Idempotente: se puede volver a correr. No toca datos, solo permisos.
-- ============================================================

-- ── Funciones auxiliares (SECURITY DEFINER: leen profiles sin pasar por RLS) ──

create or replace function public.sp_norm(t text)
returns text language sql immutable as $$
  select upper(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'))
$$;

-- DNI de quien llama (las cuentas son <dni>@somosperu.com).
create or replace function public.sp_yo_dni()
returns text language sql stable as $$
  select nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '')
$$;

-- Perfil de quien llama. En cuentas importadas profiles.id != auth.uid(), por
-- eso también se busca por DNI (mismo criterio que usan las apps).
create or replace function public.sp_mi_perfil()
returns public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles
   where id = auth.uid() or (public.sp_yo_dni() is not null and dni = public.sp_yo_dni())
   order by (id = auth.uid()) desc
   limit 1
$$;

create or replace function public.sp_mi_perfil_id()
returns uuid language sql stable security definer set search_path = public as $$
  select (public.sp_mi_perfil()).id
$$;

create or replace function public.sp_mi_mesa()
returns text language sql stable security definer set search_path = public as $$
  select (public.sp_mi_perfil()).mesa_asignada
$$;

create or replace function public.sp_mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.sp_mi_perfil()
$$;

create or replace function public.sp_es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.sp_mi_rol() ilike '%Administrador%', false)
$$;

-- Admin + coordinadores (todos los nombres viejos del mismo rol). "Coordinador
-- de Local" es el nombre viejo del PCV, NO es coordinador.
create or replace function public.sp_es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.sp_mi_rol() ilike '%Administrador%'
    or public.sp_mi_rol() in ('Coordinador Regional', 'Coordinador Provincial', 'Coordinador Distrital',
                              'Coordinador de Distritos', 'Coordinador Zonal'),
    false)
$$;

create or replace function public.sp_es_pcv()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.sp_mi_rol() in ('Personero de Centro de Votación', 'Personero de Local de Votación',
                                         'Coordinador de Local'), false)
$$;

-- Centro de votación del PCV que llama (normalizado).
create or replace function public.sp_mi_local()
returns text language sql stable security definer set search_path = public as $$
  select nullif(public.sp_norm(coalesce((p).local_asignado, (p).local_votacion)), '')
    from (select public.sp_mi_perfil() as p) x
$$;

-- ¿La fila (id, dni) es de quien llama?
create or replace function public.sp_es_yo(p_id uuid, p_dni text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_id = auth.uid()
      or (p_dni is not null and p_dni = public.sp_yo_dni())
      or p_id = (public.sp_mi_perfil()).id, false)
$$;

-- ¿El centro de votación dado es el del PCV que llama?
create or replace function public.sp_es_mi_local(p_local text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.sp_es_pcv() and public.sp_mi_local() is not null
                  and public.sp_norm(p_local) = public.sp_mi_local(), false)
$$;

-- ¿El acta todavía no tiene votos? (un personero solo carga los votos UNA vez;
-- corregirlos después es tarea de Admin/Coordinador desde el Panel).
create or replace function public.sp_acta_sin_votos(p_acta_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.votos v where v.acta_id = p_acta_id)
$$;

-- Nadie las llama con datos ajenos: solo las usan las policies. Se quitan de anon.
do $$
declare f text;
begin
  foreach f in array array['sp_mi_perfil()', 'sp_mi_perfil_id()', 'sp_mi_mesa()', 'sp_mi_rol()', 'sp_es_admin()', 'sp_es_staff()', 'sp_es_pcv()',
                           'sp_mi_local()', 'sp_es_yo(uuid, text)', 'sp_es_mi_local(text)',
                           'sp_acta_sin_votos(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── Borrar TODAS las policies previas de las tablas que se reconfiguran ──
do $$
declare t text; p record;
begin
  foreach t in array array['profiles', 'actas', 'votos', 'asistencias', 'quiz_intentos', 'training_progress',
    'training_items', 'app_config', 'colegios', 'mesas', 'distritos', 'partidos', 'candidaturas',
    'candidatos_provinciales', 'candidatos_distritales']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ── profiles ──────────────────────────────────────────────────
create policy profiles_select on public.profiles for select to authenticated
  using ((select public.sp_es_staff()) or (id = (select auth.uid()) or id = (select public.sp_mi_perfil_id()) or (dni is not null and dni = (select public.sp_yo_dni())))
         or ((select public.sp_es_pcv()) and public.sp_norm(coalesce(local_asignado, local_votacion)) = (select public.sp_mi_local())));

-- Registro: la cuenta nueva crea SU perfil (o anon, si signUp no devolvió sesión).
-- El trigger de abajo impide que se asigne un rol de Administrador.
create policy profiles_insert_anon on public.profiles for insert to anon with check (true);
create policy profiles_insert_auth on public.profiles for insert to authenticated
  with check ((select public.sp_es_staff()) or id = auth.uid());

create policy profiles_update on public.profiles for update to authenticated
  using ((select public.sp_es_staff()) or (id = (select auth.uid()) or id = (select public.sp_mi_perfil_id()) or (dni is not null and dni = (select public.sp_yo_dni())))
         or ((select public.sp_es_pcv()) and public.sp_norm(coalesce(local_asignado, local_votacion)) = (select public.sp_mi_local())))
  with check ((select public.sp_es_staff()) or (id = (select auth.uid()) or id = (select public.sp_mi_perfil_id()) or (dni is not null and dni = (select public.sp_yo_dni())))
              or ((select public.sp_es_pcv()) and public.sp_norm(coalesce(local_asignado, local_votacion)) = (select public.sp_mi_local())));

create policy profiles_delete on public.profiles for delete to authenticated
  using ((select public.sp_es_admin()));

-- Qué columnas puede tocar cada quien (la policy solo decide QUÉ filas).
-- OJO: NO es security definer a propósito -si lo fuera, current_user sería el
-- dueño de la base y el trigger nunca filtraría nada-.
create or replace function public.sp_proteger_profiles()
returns trigger language plpgsql set search_path = public as $$
declare
  roles_admin constant text[] := array['Administrador General', 'Coordinador Regional'];
  es_admin boolean;
  es_staff boolean;
begin
  -- service_role (Edge Functions, scripts) y funciones SECURITY DEFINER no se filtran.
  if current_user not in ('anon', 'authenticated') then return new; end if;
  -- anon (registro sin sesión) no tiene identidad: nunca es admin ni staff.
  if current_user = 'anon' then
    es_admin := false; es_staff := false;
  else
    es_admin := (select public.sp_es_admin());
    es_staff := (select public.sp_es_staff());
  end if;

  if tg_op = 'INSERT' then
    if (new.rol = any(roles_admin) or new.rol ilike '%Administrador%') and not es_admin then
      raise exception 'No autorizado para registrar ese rol';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.rol is distinct from old.rol then
    if not es_staff then raise exception 'No autorizado para cambiar el rol'; end if;
    if (new.rol = any(roles_admin) or new.rol ilike '%Administrador%' or old.rol ilike '%Administrador%')
       and not es_admin then
      raise exception 'Solo el Administrador asigna o quita ese rol';
    end if;
  end if;
  if (new.dni is distinct from old.dni or new.clave_acceso is distinct from old.clave_acceso
      or new.token_verificacion is distinct from old.token_verificacion or new.id is distinct from old.id)
     and not es_staff then
    raise exception 'No autorizado para cambiar DNI, clave o token';
  end if;
  -- Estado de credencial: staff y PCV (de su centro) sí; el propio personero solo
  -- puede pasar a "Confirmado" al aprobar el cuestionario (CapacitarPage).
  if new.credencial_estado is distinct from old.credencial_estado and not es_staff
     and not public.sp_es_mi_local(coalesce(old.local_asignado, old.local_votacion)) then
    if not (new.credencial_estado = 'Confirmado' and new.quiz_estado = 'Aprobado'
            and coalesce(old.credencial_estado, '') <> 'Bloqueado') then
      raise exception 'No autorizado para cambiar el estado de la credencial';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_sp_proteger_profiles on public.profiles;
create trigger trg_sp_proteger_profiles before insert or update on public.profiles
  for each row execute function public.sp_proteger_profiles();

-- ── actas ─────────────────────────────────────────────────────
create policy actas_select on public.actas for select to authenticated
  using ((select public.sp_es_staff()) or (personero_id = (select auth.uid()) or personero_id = (select public.sp_mi_perfil_id()) or (personero_dni is not null and personero_dni = (select public.sp_yo_dni())))
         or ((select public.sp_es_pcv()) and public.sp_norm(colegio_nombre) = (select public.sp_mi_local()))
         or mesa_numero = (select public.sp_mi_mesa()));
create policy actas_insert on public.actas for insert to authenticated
  with check ((select public.sp_es_staff()) or (personero_id = (select auth.uid()) or personero_id = (select public.sp_mi_perfil_id()) or (personero_dni is not null and personero_dni = (select public.sp_yo_dni())))
              or ((select public.sp_es_pcv()) and public.sp_norm(colegio_nombre) = (select public.sp_mi_local())));
create policy actas_update on public.actas for update to authenticated
  using ((select public.sp_es_staff())
         or (not coalesce(bloqueada, false)
             and ((personero_id = (select auth.uid()) or personero_id = (select public.sp_mi_perfil_id()) or (personero_dni is not null and personero_dni = (select public.sp_yo_dni()))) or ((select public.sp_es_pcv()) and public.sp_norm(colegio_nombre) = (select public.sp_mi_local()))
                  or (personero_id is null and mesa_numero = (select public.sp_mi_mesa())))))
  with check ((select public.sp_es_staff()) or (personero_id = (select auth.uid()) or personero_id = (select public.sp_mi_perfil_id()) or (personero_dni is not null and personero_dni = (select public.sp_yo_dni())))
              or ((select public.sp_es_pcv()) and public.sp_norm(colegio_nombre) = (select public.sp_mi_local())));
create policy actas_delete on public.actas for delete to authenticated
  using ((select public.sp_es_staff()));

-- ── votos: lectura pública (resultados en vivo, sin datos personales) ──
create policy votos_select on public.votos for select using (true);
-- El personero (o su PCV) carga los votos de SU acta una sola vez, justo al
-- transmitir (el acta ya viene bloqueada en esa misma transmisión).
create policy votos_insert on public.votos for insert to authenticated
  with check ((select public.sp_es_staff())
              or (public.sp_acta_sin_votos(acta_id) and exists (
                    select 1 from public.actas a where a.id = acta_id
                      and ((a.personero_id = (select auth.uid()) or a.personero_id = (select public.sp_mi_perfil_id()) or (a.personero_dni is not null and a.personero_dni = (select public.sp_yo_dni()))) or ((select public.sp_es_pcv()) and public.sp_norm(a.colegio_nombre) = (select public.sp_mi_local()))))));
create policy votos_update on public.votos for update to authenticated
  using ((select public.sp_es_staff())) with check ((select public.sp_es_staff()));
create policy votos_delete on public.votos for delete to authenticated
  using ((select public.sp_es_staff()));

-- ── asistencias / capacitación / config: lo propio (+ PCV y staff) ──
create policy asistencias_rw on public.asistencias for all to authenticated
  using ((select public.sp_es_staff()) or (user_id = (select auth.uid()) or user_id = (select public.sp_mi_perfil_id())) or ((select public.sp_es_pcv()) and public.sp_norm(colegio_nombre) = (select public.sp_mi_local())))
  with check ((select public.sp_es_staff()) or (user_id = (select auth.uid()) or user_id = (select public.sp_mi_perfil_id())) or ((select public.sp_es_pcv()) and public.sp_norm(colegio_nombre) = (select public.sp_mi_local())));

do $$
declare t text;
begin
  foreach t in array array['quiz_intentos', 'training_progress', 'app_config'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format($f$create policy %1$s_rw on public.%1$I for all to authenticated
      using ((select public.sp_es_staff()) or (user_id = (select auth.uid()) or user_id = (select public.sp_mi_perfil_id())))
      with check ((select public.sp_es_staff()) or (user_id = (select auth.uid()) or user_id = (select public.sp_mi_perfil_id())))$f$, t);
  end loop;
end $$;

-- ── Datos de referencia: lectura pública, escritura solo Admin/Coordinador ──
do $$
declare t text;
begin
  foreach t in array array['colegios', 'mesas', 'distritos', 'partidos', 'candidaturas',
                           'candidatos_provinciales', 'candidatos_distritales', 'training_items']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('create policy %1$s_read on public.%1$I for select using (true)', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated
                    using ((select public.sp_es_staff())) with check ((select public.sp_es_staff()))', t);
  end loop;
end $$;

-- ── RPCs públicas para el registro (sin exponer datos personales) ──
-- Antes el registro leía `profiles` como anónimo para saber qué colegios de VES
-- ya tenían el cupo lleno y qué colegios ya tenían Coordinador Distrital; con
-- RLS esa lectura volvía vacía y esas dos validaciones no funcionaban.
create or replace function public.cupos_personeros_por_local(p_distrito text)
returns table(local text, inscritos bigint)
language sql stable security definer set search_path = public as $$
  select trim(local_asignado), count(*) from public.profiles
   where rol = 'Personero de Mesa' and distrito_asignado = p_distrito
     and coalesce(trim(local_asignado), '') <> ''
   group by trim(local_asignado)
$$;
create or replace function public.locales_con_coordinador_distrital(p_distrito text)
returns table(local_asignado text)
language sql stable security definer set search_path = public as $$
  select local_asignado from public.profiles
   where rol in ('Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal')
     and distrito_asignado = p_distrito and local_asignado is not null
$$;
revoke all on function public.cupos_personeros_por_local(text) from public;
revoke all on function public.locales_con_coordinador_distrital(text) from public;
grant execute on function public.cupos_personeros_por_local(text) to anon, authenticated;
grant execute on function public.locales_con_coordinador_distrital(text) to anon, authenticated;

-- ── Funciones viejas que exponían datos a anónimos ──
do $$
begin
  if to_regprocedure('public.verificar_credencial(text, text)') is not null then
    revoke all on function public.verificar_credencial(text, text) from public, anon;
  end if;
  if to_regprocedure('public.estadisticas_dashboard()') is not null then
    revoke all on function public.estadisticas_dashboard() from public, anon;
    grant execute on function public.estadisticas_dashboard() to authenticated;
  end if;
end $$;

-- ── Verificación: debe listar las policies nuevas y NINGUNA para {public}/{anon}
--    en profiles/actas/asistencias salvo profiles_insert_anon ──
select tablename, policyname, roles::text, cmd
  from pg_policies where schemaname = 'public'
 order by tablename, policyname;
