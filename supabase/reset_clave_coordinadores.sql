-- ============================================================
-- MIGRACIÓN — Extender "restablecer clave" a Coordinadores
--
-- Contexto: resetear_clave_personero() solo dejaba restablecer la clave de
-- Personero de Mesa / Personero de Centro de Votación. Un Coordinador
-- Distrital o Provincial que se quedaba con su clave desincronizada (el
-- valor mostrado en su perfil ya no coincidía con la contraseña real de
-- Auth -caso real detectado con Nelly Milagros Huamani Candia, Coordinador
-- de Distritos en VES-) no tenía forma de corregirlo desde el panel; había
-- que hacerlo a mano en la base de datos.
--
-- Esta migración reemplaza la función para permitir también restablecer la
-- clave de Coordinador Distrital / Coordinador Provincial, con esta
-- jerarquía de permisos:
--   - Administrador General: puede restablecer a cualquiera.
--   - Coordinador Provincial: puede restablecer a los personeros Y a los
--     Coordinadores Distritales de su propia provincia (no a otro Provincial).
--   - Coordinador Distrital: igual que antes, solo a los personeros de su
--     propio distrito (no gana la capacidad de resetear a otros coordinadores).
--
-- Ejecutar en Supabase > SQL Editor. Idempotente: se puede volver a correr.
-- ============================================================

create or replace function public.resetear_clave_personero(p_dni text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller_email    text;
  v_caller_dni      text;
  v_caller          record;
  v_target          record;
  v_permitido       boolean := false;
  v_target_auth_id  uuid;
begin
  select email into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null then
    raise exception 'No autenticado';
  end if;
  v_caller_dni := split_part(v_caller_email, '@', 1);

  select rol, departamento_asignado, provincia_asignado, distrito_asignado
    into v_caller
    from public.profiles
   where id = auth.uid() or dni = v_caller_dni
   limit 1;

  if v_caller.rol is null then
    raise exception 'Perfil de quien llama no encontrado';
  end if;

  select id, dni, rol, departamento_asignado, provincia_asignado, distrito_asignado
    into v_target
    from public.profiles
   where dni = p_dni
   limit 1;

  if v_target.dni is null then
    raise exception 'Personero no encontrado';
  end if;

  if v_target.rol not in (
    'Personero de Mesa', 'Personero de Centro de Votación', 'Personero de Local de Votación', 'Coordinador de Local',
    'Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal',
    'Coordinador Provincial'
  ) then
    raise exception 'Rol no permitido para restablecer clave';
  end if;

  if v_caller.rol = 'Administrador General' then
    v_permitido := true;
  elsif v_caller.rol = 'Coordinador Provincial'
        and v_caller.departamento_asignado = v_target.departamento_asignado
        and v_caller.provincia_asignado = v_target.provincia_asignado
        and v_target.rol <> 'Coordinador Provincial' then
    v_permitido := true;
  elsif v_caller.rol in ('Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal')
        and v_caller.distrito_asignado = v_target.distrito_asignado
        and v_target.rol not in ('Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal', 'Coordinador Provincial') then
    v_permitido := true;
  end if;

  if not v_permitido then
    raise exception 'Fuera de tu ámbito';
  end if;

  select id into v_target_auth_id from auth.users where email = p_dni || '@somosperu.com';
  if v_target_auth_id is null then
    raise exception 'Esta persona todavía no tiene cuenta de acceso creada';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_dni, extensions.gen_salt('bf')),
         updated_at = now()
   where id = v_target_auth_id;

  update public.profiles set clave_acceso = p_dni, updated_at = now() where dni = p_dni;
end;
$$;

revoke all on function public.resetear_clave_personero(text) from public;
grant execute on function public.resetear_clave_personero(text) to authenticated;
