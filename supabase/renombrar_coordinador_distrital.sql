-- ============================================================
-- "Coordinador Distrital" pasa a ser el nombre oficial de este rol
-- (antes "Coordinador de Distritos"; "Coordinador Zonal" es también
-- el mismo rol, solo que con otro nombre en el padrón importado).
-- "Coordinador Provincial" es un rol aparte y no se toca.
--
-- Este script NO cambia profiles.rol de los registros existentes —
-- las filas reales pueden seguir teniendo cualquiera de los 3 nombres.
-- Solo actualiza las políticas RLS que comparan el rol por nombre
-- exacto, para que sigan reconociendo a estos coordinadores.
--
-- Ejecutar en Supabase > SQL Editor. Idempotente.
-- ============================================================

drop policy if exists "actas_admin" on actas;
create policy "actas_admin" on actas
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.rol in ('Administrador General','Coordinador Distrital','Coordinador de Distritos',
                          'Coordinador Zonal','Coordinador Provincial'))
  );

drop policy if exists "asistencias_admin" on asistencias;
create policy "asistencias_admin" on asistencias
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid()
            and p.rol in ('Administrador General','Coordinador Distrital','Coordinador de Distritos',
                          'Coordinador Zonal','Coordinador Provincial','Personero de Local de Votación'))
  );
