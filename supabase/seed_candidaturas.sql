-- ============================================================
-- SEED — Candidaturas ERM 2026 para los ámbitos donde opera Somos Perú
--
-- Requisito: haber corrido antes  supabase/candidaturas_multinivel.sql
--
-- Alcance de esta siembra (padrón actual = 100% Lima Metropolitana):
--   • PROVINCIAL  -> Lima / Lima   (Alcaldía Metropolitana de Lima) — 27 listas
--   • DISTRITAL   -> Villa María del Triunfo, Villa El Salvador, San Isidro,
--                    La Victoria, Pueblo Libre
--   • REGIONAL    -> (ninguno) Lima Metropolitana no elige Gobernador Regional.
--
-- Fuentes:
--   • 'prensa 2026'        -> nombre de candidato confirmado por prensa (El Comercio,
--                             América TV, ATV) al cierre de inscripciones jun-2026.
--   • 'plantilla nacional' -> el partido presenta lista en ese ámbito pero el
--                             nombre del cabeza de lista aún no está cargado.
--                             La conteo-app muestra un aviso "lista provisional"
--                             mientras haya filas con esta fuente en el ámbito.
--
-- Para reemplazar por la data OFICIAL de ONPE/JNE:
--   node scripts/importar_candidaturas.mjs <ruta-al-excel-oficial>
--
-- Idempotente: ON CONFLICT sobre (nivel, departamento, provincia, distrito, partido).
-- ============================================================

-- ============================================================
-- 1) PROVINCIAL — Lima / Lima  (Alcaldía Metropolitana de Lima)
--    Cierre de inscripciones jun-2026 (El Comercio, actualizado ago-2026).
-- ============================================================
insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente) values
  ('PROVINCIAL','Lima','Lima',null,'Somos Perú',                            'Carlos Ricardo Bruce Montes de Oca',        'SP',  '#e11d48', 1,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Renovación Popular',                     'Rafael López Aliaga',                        'RP',  '#1d4ed8', 2,  true,  'prensa 2026: Luis Rubio renunció (04-ago); López Aliaga encabeza la lista como primer regidor / teniente alcalde y asume la alcaldía si RP gana (Art. 194 impide reelección directa)'),
  ('PROVINCIAL','Lima','Lima',null,'Ahora Nación',                           'Susel Ana María Paredes Piqué',             'AN',  '#7c3aed', 3,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Avanza País',                            'Francis James Allison Oyague',              'AV',  '#0891b2', 4,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Podemos Perú',                           'Daniel Belizario Urresti Elera',           'PP',  '#dc2626', 5,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Juntos por el Perú',                     'Oswaldo Hernán Vargas Cuéllar',            'JP',  '#16a34a', 6,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Partido Cívico Obras',                   'Ricardo Pablo Belmont Cassinelli',         'PC',  '#b45309', 7,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'FREPAP',                                 'Segundo Valdez Zavala',                     'FR',  '#059669', 8,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Acción Popular',                         'Carlos Alberto Tejada Noriega',            'AP',  '#d97706', 9,  true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Frente de la Esperanza 2021',            'Elizabeth María del Rosario León Chinchay', 'FE',  '#65a30d', 10, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Alianza Electoral Venceremos',           'Juan Carlos Alvarado Mestanza',            'VE',  '#0284c7', 11, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Visión Perú',                            null,                                        'VP',  '#4f46e5', 12, true,  'plantilla nacional'),
  ('PROVINCIAL','Lima','Lima',null,'Partido Aprista Peruano',                'Mónica Yadira Yaya Luyo',                  'PA',  '#b91c1c', 13, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Fuerza Popular',                         'Samuel Marcos Daza Taype',                 'FP',  '#f59e0b', 14, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Partido Popular Cristiano (PPC)',        'Edgardo Renán de Pomar Vizcarra',          'PPC', '#1e40af', 15, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Progresemos',                            'Luis Miguel Llanos Carrillo',             'PRG', '#047857', 16, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Partido Morado',                         'Victoria Betzabé La Cruz Garcés',         'PM',  '#7c3aed', 17, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Partido del Buen Gobierno',              null,                                        'BG',  '#0369a1', 18, true,  'plantilla nacional'),
  ('PROVINCIAL','Lima','Lima',null,'Partido Demócrata Verde',                'Flor de María Hurtado Valdez',            'DV',  '#15803d', 19, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Perú Libre',                             null,                                        'PL',  '#ca8a04', 20, true,  'prensa 2026: Rubén Ramírez renunció (04-ago)'),
  ('PROVINCIAL','Lima','Lima',null,'Coalición Transformadora Tierra Verde',  'Yehude Simon Munaro',                     'TV',  '#16a34a', 21, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Pueblo Consciente',                      'Luis Alberto Huette Tolentino',          'CT',  '#6d28d9', 22, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Partido Patriótico del Perú',            'Sandro Caller Gutiérrez',                 'PTR', '#1e3a8a', 23, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Integridad Democrática',                 null,                                        'ID',  '#0f766e', 24, false, 'prensa 2026: lista declarada improcedente'),
  ('PROVINCIAL','Lima','Lima',null,'Fuerza Ciudadana',                       'Rubén Daniel Bonilla Espinoza',          'FC',  '#ea580c', 25, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Batalla Perú',                           'Samir Frank Quispe Caballero',           'BAT', '#0891b2', 26, true,  'prensa 2026'),
  ('PROVINCIAL','Lima','Lima',null,'Alianza para el Progreso',               'Elio Fernando Riera Garro',              'APP', '#16a34a', 27, true,  'prensa 2026')
on conflict (nivel, departamento, provincia, distrito, partido)
do update set candidato = excluded.candidato, sigla = excluded.sigla, color = excluded.color,
              orden = excluded.orden, activo = excluded.activo, fuente = excluded.fuente,
              updated_at = now();

-- ============================================================
-- 2) DISTRITAL — plantilla nacional para los 5 distritos donde opera SP.
--    Se siembra la lista de partidos con más presencia distrital en Lima
--    (candidato NULL). Luego el bloque 3 sobrescribe los confirmados.
-- ============================================================
insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente)
select 'DISTRITAL','Lima','Lima', d.distrito, p.nombre, null, p.sigla, p.color, p.orden, true, 'plantilla nacional'
from (values
  ('Villa María del Triunfo'), ('Villa El Salvador'), ('San Isidro'),
  ('La Victoria'), ('Pueblo Libre')
) as d(distrito)
cross join (values
  ('Somos Perú',                        'SP',  '#e11d48', 1),
  ('Perú Primero',                      'PPR', '#0284c7', 2),
  ('Partido Cívico Obras',              'PC',  '#b45309', 3),
  ('Partido Popular Cristiano (PPC)',   'PPC', '#1e40af', 4),
  ('Alianza para el Progreso',          'APP', '#16a34a', 5),
  ('Avanza País',                       'AV',  '#0891b2', 6),
  ('Acción Popular',                    'AP',  '#d97706', 7),
  ('Frente de la Esperanza 2021',       'FE',  '#65a30d', 8),
  ('Podemos Perú',                      'PP',  '#dc2626', 9),
  ('Ahora Nación',                      'AN',  '#ca8a04', 10),
  ('Renovación Popular',                'RP',  '#1d4ed8', 11),
  ('Batalla Perú',                      'BAT', '#0f766e', 12),
  ('Fuerza Popular',                    'FP',  '#f59e0b', 13),
  ('Juntos por el Perú',               'JP',  '#15803d', 14),
  ('Partido Aprista Peruano',           'PA',  '#b91c1c', 15),
  ('Partido del Buen Gobierno',         'BG',  '#0369a1', 16),
  ('Partido Demócrata Verde',           'DV',  '#15803d', 17),
  ('Perú Libre',                        'PL',  '#ca8a04', 18),
  ('Progresemos',                       'PRG', '#047857', 19),
  ('Visión Perú',                       'VP',  '#4f46e5', 20)
) as p(nombre, sigla, color, orden)
on conflict (nivel, departamento, provincia, distrito, partido)
do nothing;

-- ============================================================
-- 3) DISTRITAL — nombres confirmados por prensa (jun-ago 2026).
--    El Comercio: "Elecciones 2026: candidatos a las 43 alcaldías de Lima".
--    Solo se sobrescribe el candidato/fuente; el resto queda de la plantilla.
-- ============================================================
insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente) values
  -- Villa María del Triunfo
  ('DISTRITAL','Lima','Lima','Villa María del Triunfo','Avanza País',          'David Morales',   'AV',  '#0891b2', 6, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa María del Triunfo','Somos Perú',           'Guido Íñigo',     'SP',  '#e11d48', 1, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa María del Triunfo','Acción Popular',       'Roger Parra',     'AP',  '#d97706', 7, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa María del Triunfo','Partido Cívico Obras', 'Juan Castillo',   'PC',  '#b45309', 3, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa María del Triunfo','Perú Primero',         'Carlos Chávez',   'PPR', '#0284c7', 2, true, 'prensa 2026'),
  -- Villa El Salvador
  ('DISTRITAL','Lima','Lima','Villa El Salvador','Podemos Perú',               'Walter Quispe',      'PP',  '#dc2626', 9, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa El Salvador','Alianza para el Progreso',   'Marcelino Huamán',   'APP', '#16a34a', 5, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa El Salvador','Avanza País',                'Homero Díaz',        'AV',  '#0891b2', 6, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','Villa El Salvador','Renovación Popular',         'Alberto Peralta',    'RP',  '#1d4ed8', 11, true, 'prensa 2026'),
  -- San Isidro
  ('DISTRITAL','Lima','Lima','San Isidro','Avanza País',                       'César Augusto Combina Salvatierra', 'AV',  '#0891b2', 6, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','San Isidro','Somos Perú',                        'Víctor Hugo Bazán Pastor',         'SP',  '#e11d48', 1, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','San Isidro','Acción Popular',                    'Carlomagno Chacón Gómez',          'AP',  '#d97706', 7, true, 'prensa 2026'),
  -- La Victoria
  ('DISTRITAL','Lima','Lima','La Victoria','Somos Perú',                       'Alberto Fernando Moreno Mejía',    'SP',  '#e11d48', 1, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Perú Primero',                     'Aldo Horacio Rosales Pacheco',    'PPR', '#0284c7', 2, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Avanza País',                      'Joe Zanobria Soberón',            'AV',  '#0891b2', 6, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Ahora Nación',                     'Nilda Esperanza Carranza Rodríguez','AN', '#ca8a04', 10, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Renovación Popular',               'Susana Liliana Saldaña Ramos',    'RP',  '#1d4ed8', 11, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Partido Cívico Obras',             'Alejandro Nilo Pérez Moreno',     'PC',  '#b45309', 3, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Partido Popular Cristiano (PPC)',  'César Rafael Ibarra Nureña',      'PPC', '#1e40af', 4, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Alianza para el Progreso',         'Joaquín Reynaldo Albarracín Ramos','APP','#16a34a', 5, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Acción Popular',                   'Luis Álvaro Pletikosic Guzmán',   'AP',  '#d97706', 7, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Frente de la Esperanza 2021',      'María Teresa Rosas García',       'FE',  '#65a30d', 8, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Podemos Perú',                     'Mesías Máximo Gonzales Sánchez',  'PP',  '#dc2626', 9, true, 'prensa 2026'),
  ('DISTRITAL','Lima','Lima','La Victoria','Batalla Perú',                     'Walter Ciro Pérez Noreña',       'BAT', '#0f766e', 12, true, 'prensa 2026')
on conflict (nivel, departamento, provincia, distrito, partido)
do update set candidato = excluded.candidato, fuente = excluded.fuente, activo = excluded.activo,
              updated_at = now();

-- ── Verificación ───────────────────────────────────────────
select nivel, departamento, provincia, distrito,
       count(*) filter (where activo)                              as listas_activas,
       count(*) filter (where candidato is not null)               as con_nombre,
       count(*) filter (where fuente = 'plantilla nacional')       as provisionales
from public.candidaturas
group by nivel, departamento, provincia, distrito
order by nivel, distrito nulls first;
