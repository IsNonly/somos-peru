-- ============================================================
-- SEED — Candidaturas para TODO el país usando el ubigeo de CALI
--
-- Requisito: haber corrido antes  supabase/candidaturas_multinivel.sql
--            (y tener `colegios` cargada con importar_cali_nacional.mjs).
--
-- Qué hace: por cada departamento / provincia / distrito que EXISTE en
-- `colegios` (que viene de CALI.xlsx), inserta la lista estándar de partidos
-- nacionales, SIN nombre de candidato. Así la conteo-app ya muestra la cédula
-- de cualquier ámbito del país; los nombres reales se cargan después con
-- `scripts/importar_candidaturas.mjs` y el Excel oficial (columna FUENTE).
--
-- - Usa el MISMO texto de ubigeo que `colegios`, así que calza siempre con
--   el perfil del personero (no hay problema de tildes ni de mayúsculas).
-- - NO toca Lima Metropolitana (departamento 'Lima' + provincia 'Lima'):
--   esa cédula ya está sembrada a mano en seed_candidaturas.sql.
-- - Lima Metropolitana no lleva nivel REGIONAL (ya excluida).
-- - `on conflict do nothing`: no pisa nada que ya exista (Lima ni una carga
--   oficial previa).
--
-- Idempotente. Ejecutar en Supabase > SQL Editor.
-- ============================================================

with parties(partido, sigla, color, orden) as (values
  ('Somos Perú',                              'SP',   '#e11d48',  1),
  ('Alianza para el Progreso',                'APP',  '#16a34a',  2),
  ('Perú Primero',                            'PPR',  '#0284c7',  3),
  ('Podemos Perú',                            'PP',   '#dc2626',  4),
  ('Ahora Nación',                            'AN',   '#7c3aed',  5),
  ('Acción Popular',                          'AP',   '#d97706',  6),
  ('Renovación Popular',                      'RP',   '#1d4ed8',  7),
  ('Fuerza Popular',                          'FP',   '#f59e0b',  8),
  ('Avanza País',                             'AV',   '#0891b2',  9),
  ('Juntos por el Perú',                      'JP',   '#15803d', 10),
  ('Progresemos',                             'PRG',  '#047857', 11),
  ('Batalla Perú',                            'BAT',  '#0f766e', 12),
  ('Partido Cívico Obras',                    'PC',   '#b45309', 13),
  ('Partido Popular Cristiano (PPC)',         'PPC',  '#1e40af', 14),
  ('Partido Aprista Peruano',                 'PA',   '#b91c1c', 15),
  ('Frente de la Esperanza 2021',             'FE',   '#65a30d', 16),
  ('FREPAP',                                  'FR',   '#059669', 17),
  ('Perú Libre',                              'PL',   '#ca8a04', 18),
  ('Partido Morado',                          'PM',   '#7c3aed', 19),
  ('Partido del Buen Gobierno',               'BG',   '#0369a1', 20),
  ('Partido Demócrata Verde',                 'DV',   '#15803d', 21),
  ('Coalición Transformadora Tierra Verde',   'TV',   '#16a34a', 22),
  ('Pueblo Consciente',                       'CT',   '#6d28d9', 23),
  ('Partido Patriótico del Perú',             'PTR',  '#1e3a8a', 24),
  ('Integridad Democrática',                  'ID',   '#0f766e', 25),
  ('Fuerza Ciudadana',                        'FC',   '#ea580c', 26),
  ('Libertad Popular',                        'LP',   '#6d28d9', 27),
  ('Perú Moderno',                            'PMO',  '#1d4ed8', 28),
  ('Alianza Electoral Venceremos',            'VE',   '#0284c7', 29),
  ('Visión Perú',                             'VP',   '#4f46e5', 30)
),
-- Ámbitos reales del país tomados de `colegios` (CALI). Se excluye Lima Metro.
reg as (
  select distinct departamento
  from public.colegios
  where departamento is not null
    and not (departamento = 'Lima' and provincia = 'Lima')
),
prov as (
  select distinct departamento, provincia
  from public.colegios
  where departamento is not null and provincia is not null
    and not (departamento = 'Lima' and provincia = 'Lima')
),
dist as (
  select distinct departamento, provincia, distrito
  from public.colegios
  where departamento is not null and provincia is not null and distrito is not null
    and not (departamento = 'Lima' and provincia = 'Lima')
)
insert into public.candidaturas
  (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente)
select 'REGIONAL', r.departamento, null, null,
       p.partido, null, p.sigla, p.color, p.orden, true, 'plantilla (CALI)'
from reg r cross join parties p
union all
select 'PROVINCIAL', pr.departamento, pr.provincia, null,
       p.partido, null, p.sigla, p.color, p.orden, true, 'plantilla (CALI)'
from prov pr cross join parties p
union all
select 'DISTRITAL', d.departamento, d.provincia, d.distrito,
       p.partido, null, p.sigla, p.color, p.orden, true, 'plantilla (CALI)'
from dist d cross join parties p
on conflict (nivel, departamento, provincia, distrito, partido) do nothing;

-- ── Verificación ───────────────────────────────────────────
select nivel,
       count(*)                                  as filas,
       count(distinct (departamento, coalesce(provincia,''), coalesce(distrito,''))) as ambitos
from public.candidaturas
group by nivel
order by nivel;
