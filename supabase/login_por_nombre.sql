-- ============================================================
-- Login por nombre — permitir ingresar con nombre completo además de DNI
--
-- profiles no es legible por anon (rls_seguridad.sql cerró esa lectura),
-- así que para resolver "nombre -> DNI" antes de autenticar se necesita
-- una RPC SECURITY DEFINER, igual que clave_acceso_por_dni. Solo hace
-- match EXACTO (case/espacios-insensitive) y devuelve un único DNI: no
-- permite buscar por texto parcial ni volcar el padrón.
--
-- Ejecutar en Supabase > SQL Editor. Idempotente.
-- ============================================================

-- Ignora mayúsculas, tildes (Américo = Americo), la ñ y espacios de más: mucha
-- gente se registró con tildes y luego escribe su nombre sin ellas al ingresar.
create or replace function public.dni_por_nombre(p_nombre text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select dni from public.profiles
  where lower(regexp_replace(translate(trim(nombre_completo), 'áéíóúÁÉÍÓÚäëïöüÄËÏÖÜñÑ', 'aeiouAEIOUaeiouAEIOUnN'), '\s+', ' ', 'g'))
      = lower(regexp_replace(translate(trim(p_nombre),        'áéíóúÁÉÍÓÚäëïöüÄËÏÖÜñÑ', 'aeiouAEIOUaeiouAEIOUnN'), '\s+', ' ', 'g'))
  limit 1;
$$;
revoke all on function public.dni_por_nombre(text) from public;
grant execute on function public.dni_por_nombre(text) to anon, authenticated;
