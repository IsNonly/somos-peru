-- ============================================================
-- RESET DE INSTANCIA — deja un proyecto Supabase YA BOOTSTRAPEADO
-- (con datos de una provincia/distrito anterior, ej. Tumbes o Arequipa)
-- LIMPIO para reusarlo con un ámbito nuevo (ej. Cercado de Lima o
-- Villa El Salvador), sin tener que crear un proyecto Supabase nuevo.
--
-- ⚠️  DESTRUCTIVO E IRREVERSIBLE. Borra TODO lo operativo del proyecto:
--   - actas, votos, asistencias (conteo)
--   - profiles + auth.users (TODAS las cuentas: admin, coordinadores, personeros)
--   - training_progress, quiz_intentos, app_config (dependen de profiles/auth.users)
--   - colegios, mesas, candidaturas (padrón y listas de candidatos del ámbito viejo)
--
-- NO borra (son contenido genérico, no ámbito-específico):
--   - training_items, quiz_preguntas (video/cartilla/quiz de capacitación)
--   - partidos, distritos (tablas de referencia legacy, no dependen del ámbito)
--
-- NO borra los archivos ya subidos al bucket "actas" de Storage — la fila en
-- storage.objects no es el archivo en sí. Bórralos aparte si hace falta
-- (Supabase Dashboard > Storage > actas > seleccionar todo > Delete),
-- o déjalos: son fotos de actas viejas, no afectan al ámbito nuevo.
--
-- Uso: pegar y correr en Supabase > SQL Editor del proyecto a reusar.
-- Después de correr esto:
--   1. node scripts/importar_cali_ambito.mjs   (padrón/colegios del distrito nuevo)
--   2. supabase/seed_candidaturas_cali.sql     (plantilla de partidos, deja contar)
--   3. cargar candidatos reales del distrito nuevo (prensa/Excel oficial) con
--      node scripts/importar_candidaturas.mjs <excel>
--   4. node scripts/crear_admin.mjs --env <.env de esa instancia> --dni ... --nombre ... --password ...
-- ============================================================

begin;

delete from public.votos;
delete from public.actas;
delete from public.asistencias;
delete from public.training_progress;
delete from public.quiz_intentos;
delete from public.app_config;
delete from public.candidaturas;
delete from public.colegios;
delete from public.mesas;

-- Cascada automática: profiles (ON DELETE CASCADE desde auth.users.id) y
-- cualquier fila de las tablas de arriba que aún colgara de un profile.
delete from auth.users;

commit;
