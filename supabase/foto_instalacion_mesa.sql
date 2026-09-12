-- ============================================================
-- MIGRACIÓN — Foto de instalación de mesa
--
-- Contexto: en la pantalla de inicio del personero (conteo-app) se agregó
-- un botón "Tomar Foto" en la tarjeta "Instalación de Mesa de Sufragio",
-- para dejar evidencia de que la mesa quedó instalada ANTES de escrutar
-- los votos (paso independiente del envío del acta al final).
--
-- Ejecutar en Supabase > SQL Editor. Idempotente: se puede volver a correr.
-- ============================================================

alter table public.actas
  add column if not exists foto_instalacion_url text,
  add column if not exists instalada_at         timestamptz;
