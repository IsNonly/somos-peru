-- ============================================================
-- FIX: usuarios importados no pueden iniciar sesión
-- Síntoma: POST /auth/v1/token -> 500 "Database error querying schema"
--          para cuentas que SÍ existen, con CUALQUIER contraseña.
-- Causa:  filas insertadas a mano en auth.users con columnas de token en
--         NULL (GoTrue las espera como ''), metadata nula, o sin fila en
--         auth.identities. GoTrue falla al DESERIALIZAR la fila del usuario,
--         antes de comparar la contraseña -> por eso da 500 y no 400.
--
-- Ejecutar en: Supabase Dashboard > SQL Editor (rol `postgres`). Idempotente:
-- solo corrige lo que está mal y no toca las cuentas que ya funcionan.
-- ============================================================

-- 1) Normalizar columnas de token: NULL -> '' (cadena vacía)
update auth.users
set
  confirmation_token          = coalesce(confirmation_token, ''),
  recovery_token              = coalesce(recovery_token, ''),
  email_change                = coalesce(email_change, ''),
  email_change_token_new      = coalesce(email_change_token_new, ''),
  email_change_token_current  = coalesce(email_change_token_current, ''),
  phone_change                = coalesce(phone_change, ''),
  phone_change_token          = coalesce(phone_change_token, ''),
  reauthentication_token      = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_new is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;

-- 2) Metadata no nula
update auth.users
set raw_app_meta_data  = coalesce(raw_app_meta_data,  '{"provider":"email","providers":["email"]}'::jsonb),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
where raw_app_meta_data is null or raw_user_meta_data is null;

-- 3) aud / role
update auth.users
set aud  = coalesce(nullif(aud, ''),  'authenticated'),
    role = coalesce(nullif(role, ''), 'authenticated')
where aud is null or aud = '' or role is null or role = '';

-- 4) Confirmar correo (NO tocar confirmed_at: es columna GENERADA)
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- 5) Crear la identidad 'email' faltante
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(), now(), now()
from auth.users u
where u.email is not null
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

-- 6) (OPCIONAL) Igualar la contraseña de Auth al DNI. Descomenta SOLO si tras
--    lo anterior alguna cuenta da 400 "Invalid login credentials".
--    create extension if not exists pgcrypto;
-- update auth.users u
-- set encrypted_password = crypt(p.dni, gen_salt('bf'))
-- from public.profiles p
-- where p.id = u.id and p.dni is not null;

-- ── Verificación: ambas consultas deben devolver 0 filas ──
select 'sin identity' as problema, u.id, u.email
from auth.users u
left join auth.identities i on i.user_id = u.id and i.provider = 'email'
where u.email is not null and i.id is null
union all
select 'token NULL', id, email from auth.users
where confirmation_token is null or recovery_token is null or email_change is null
   or email_change_token_new is null or email_change_token_current is null
   or phone_change is null or phone_change_token is null or reauthentication_token is null;
