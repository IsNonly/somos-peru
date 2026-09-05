-- ============================================================
-- "Personero de Centro de Votación" pasa a ser el nombre oficial
-- de este rol (antes "Personero de Local de Votación", y antes de
-- eso "Coordinador de Local"). El código de las 3 apps ya reconoce
-- ambos nombres viejos mientras esta migración no se corra.
--
-- 1) Renombra las filas existentes al nombre nuevo.
-- 2) Alinea la política RLS de asistencias con el nuevo nombre
--    (por si RLS se activa; no afecta si está desactivada).
--
-- Ejecutar en Supabase > SQL Editor. Idempotente.
-- ============================================================

update profiles
set rol = 'Personero de Centro de Votación'
where rol = 'Personero de Local de Votación';

drop policy if exists "asistencias_admin" on asistencias;
create policy "asistencias_admin" on asistencias
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.rol in ('Administrador General','Coordinador Distrital','Coordinador de Distritos',
                          'Coordinador Zonal','Coordinador Provincial',
                          'Personero de Centro de Votación','Personero de Local de Votación'))
  );

-- Verificación: debe devolver 0
select count(*) as personeros_de_local_restantes
from profiles where rol = 'Personero de Local de Votación';
