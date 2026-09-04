-- ============================================================
-- Auditoría ligera de edición de perfiles desde el Panel ConteoLima
-- (pantalla Capacitaciones → modal "Modificar Registro y Asignación").
--
-- Guarda quién hizo la ÚLTIMA modificación y cuándo (no historial
-- completo por campo, solo el último editor/fecha sobre el registro).
--
-- Ejecutar en Supabase > SQL Editor. Idempotente.
-- ============================================================

alter table profiles add column if not exists modificado_por text;
alter table profiles add column if not exists modificado_at  timestamptz;
