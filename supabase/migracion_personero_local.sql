-- ============================================================
-- "Coordinador de Local" -> "Personero de Local de Votación"
-- Ese rol ya no existe; se unifica en Personero de Local de Votación.
-- Además: columnas para que ese personero marque la asistencia de los
-- Personeros de Mesa de su mismo local.
--
-- Ejecutar en Supabase > SQL Editor. Idempotente.
-- ============================================================

-- 1) Renombrar el rol en los perfiles existentes (176 filas aprox.)
update profiles
set rol = 'Personero de Local de Votación'
where rol = 'Coordinador de Local';

-- 2) Marca de asistencia (la pone el Personero de Local de Votación)
alter table profiles add column if not exists asistencia_local_at  timestamptz;
alter table profiles add column if not exists asistencia_local_por  uuid references profiles(id);

-- 3) Alinear la política RLS de asistencias con el nuevo nombre de rol
--    (por si RLS se activa; no afecta si está desactivada)
drop policy if exists "asistencias_admin" on asistencias;
create policy "asistencias_admin" on asistencias
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.rol in ('Administrador General','Coordinador de Distritos',
                          'Coordinador Provincial','Personero de Local de Votación'))
  );

-- Verificación: debe devolver 0
select count(*) as coordinadores_de_local_restantes
from profiles where rol = 'Coordinador de Local';
