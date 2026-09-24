-- ============================================================
-- MIGRACIÓN — Fotos de acta separadas por nivel
--
-- Contexto: ONPE emite un acta física SEPARADA por cada nivel
-- (Gobernador Regional, Alcaldía Provincial, Alcaldía Distrital) —no
-- siempre viene todo combinado en una sola hoja—, así que la app ahora
-- permite subir una foto distinta por cada nivel en vez de una sola foto
-- global por mesa. 'imagen_url' se mantiene (queda con la primera foto
-- subida) por compatibilidad; 'imagenes_url' trae el detalle completo,
-- ej: {"PROVINCIAL": "https://...", "DISTRITAL": "https://..."}.
--
-- Ejecutar en Supabase > SQL Editor. Idempotente: se puede volver a correr.
-- ============================================================

alter table public.actas
  add column if not exists imagenes_url jsonb;
