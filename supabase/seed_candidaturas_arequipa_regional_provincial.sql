-- ============================================================
-- SEED -- Candidaturas ERM 2026, departamento/provincia Arequipa,
-- niveles REGIONAL (Gobernador Regional) y PROVINCIAL (Alcalde Provincial
-- de Arequipa). Completa lo que quedó pendiente tras cargar solo el nivel
-- DISTRITAL de Mariano Melgar (ver seed_candidaturas_mariano_melgar.sql).
--
-- Fuente: El Búho (jun-ago 2026) + Wikipedia "Elecciones regionales de
-- Arequipa de 2026". REGIONAL: 15 candidatos admitidos. PROVINCIAL: 17
-- candidatos válidos (se excluyen 2 listas declaradas improcedentes por
-- el JNE: Lizbeth Zavala Vilca -Frepap- y Lorenzo Colque Arias -Salvemos
-- al Perú-, esta última SÍ corre a nivel REGIONAL con otro candidato).
--
-- Reemplaza/completa la plantilla nacional (CALI): varios candidatos van
-- por movimientos regionales de Arequipa que no estaban en la plantilla
-- (Yo Arequipa, Arequipa Tradición y Futuro, Arequipa Avancemos, Fuerza
-- Arequipeña, Primero La Gente, Salvemos al Perú) y se insertan como
-- filas nuevas; el resto de la plantilla sin candidato real se desactiva.
--
-- Idempotente: ON CONFLICT sobre (nivel, departamento, provincia, distrito, partido).
-- ============================================================

-- ── REGIONAL: Gobernador Regional de Arequipa (15 candidatos) ──────────
insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente) values
  ('REGIONAL','Arequipa',null,null,'Somos Perú','Héctor Herrera Herrera', 'SP', '#e11d48', 1, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Alianza para el Progreso','Elmer Cáceres Llica', 'APP', '#16a34a', 2, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Renovación Popular','Harold Rodríguez Quispe', 'RP', '#1d4ed8', 7, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Partido Aprista Peruano','Hugo Aguilar Gonzales', 'PA', '#b91c1c', 15, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Acción Popular','Edwin Martínez Talavera', 'AP', '#d97706', 6, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'FREPAP','Yackelin Huarsaya Calizaya', 'FR', '#059669', 17, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Alianza Electoral Venceremos','José Ancalle Gutiérrez', 'VE', '#0284c7', 29, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Partido Cívico Obras','Miguel Zárate Flores', 'PC', '#b45309', 13, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Ahora Nación','Jenry Huisa Calapuja', 'AN', '#7c3aed', 5, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Coalición Transformadora Tierra Verde','Milco Torres Barrionuevo', 'TV', '#16a34a', 22, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Yo Arequipa','Berly Gonzáles Arias', 'YA', '#0ea5e9', 31, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Arequipa, Tradición y Futuro','César Huamantuma Alarcón', 'ATF', '#0d9488', 32, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Arequipa Avancemos','Benigno Cornejo Valencia', 'AAV', '#9333ea', 33, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Fuerza Arequipeña','Alfredo Zegarra Tejada', 'FAR', '#db2777', 34, true, 'prensa 2026'),
  ('REGIONAL','Arequipa',null,null,'Salvemos al Perú','David Ardiles Saravia', 'SAP', '#a21caf', 35, true, 'prensa 2026')
on conflict (nivel, departamento, provincia, distrito, partido)
do update set candidato = excluded.candidato, sigla = excluded.sigla, color = excluded.color,
              orden = excluded.orden, fuente = excluded.fuente, activo = excluded.activo,
              updated_at = now();

update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'REGIONAL' and departamento = 'Arequipa' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Alianza para el Progreso', 'Renovación Popular', 'Partido Aprista Peruano', 'Acción Popular', 'FREPAP', 'Alianza Electoral Venceremos', 'Partido Cívico Obras', 'Ahora Nación', 'Coalición Transformadora Tierra Verde');

-- ── PROVINCIAL: Alcalde Provincial de Arequipa (17 candidatos) ─────────
insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente) values
  ('PROVINCIAL','Arequipa','Arequipa',null,'Acción Popular','Andrés Eliseo Risueño Portugal', 'AP', '#d97706', 6, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Ahora Nación','Alfredo Willy Benavente Godoy', 'AN', '#7c3aed', 5, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Alianza para el Progreso','Elizabeth Genesis Amado Quispe', 'APP', '#16a34a', 2, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Partido Aprista Peruano','Yamel Deyson Romero Peralta', 'PA', '#b91c1c', 15, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Partido del Buen Gobierno','Deyanira Yajaira Salazar Rivera', 'BG', '#0369a1', 20, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Somos Perú','José Miguel Briones Silva', 'SP', '#e11d48', 1, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Frente de la Esperanza 2021','Elmer Ángel Acero Bruna', 'FE', '#65a30d', 16, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Pueblo Consciente','Javier Antonio Onofre Ccama', 'CT', '#6d28d9', 23, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Partido Popular Cristiano (PPC)','Jorge Luis Reyes Luján Martínez', 'PPC', '#1e40af', 14, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Podemos Perú','Isidro Flores Sosa', 'PP', '#dc2626', 4, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Progresemos','Tomás Job Delgado Zúñiga', 'PRG', '#047857', 11, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Renovación Popular','Ricardo Alfredo Ramírez del Villar Llosa', 'RP', '#1d4ed8', 7, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Arequipa, Tradición y Futuro','Renzo Alonso Salas Herrera', 'ATF', '#0d9488', 31, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Fuerza Arequipeña','Manuel Enrique Vera Paredes', 'FAR', '#db2777', 32, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Arequipa Avancemos','Juan Roberto Muñoz Pinto', 'AAV', '#9333ea', 33, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Primero La Gente','Ruccy Judith Oscco Polar', 'PLG', '#84cc16', 34, true, 'prensa 2026'),
  ('PROVINCIAL','Arequipa','Arequipa',null,'Yo Arequipa','Alfredo Álvarez Díaz', 'YA', '#0ea5e9', 35, true, 'prensa 2026')
on conflict (nivel, departamento, provincia, distrito, partido)
do update set candidato = excluded.candidato, sigla = excluded.sigla, color = excluded.color,
              orden = excluded.orden, fuente = excluded.fuente, activo = excluded.activo,
              updated_at = now();

update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'PROVINCIAL' and departamento = 'Arequipa' and provincia = 'Arequipa' and fuente = 'plantilla (CALI)'
  and partido not in ('Acción Popular', 'Ahora Nación', 'Alianza para el Progreso', 'Partido Aprista Peruano', 'Partido del Buen Gobierno', 'Somos Perú', 'Frente de la Esperanza 2021', 'Pueblo Consciente', 'Partido Popular Cristiano (PPC)', 'Podemos Perú', 'Progresemos', 'Renovación Popular');

-- ── Verificación ───────────────────────────────────────────
select nivel, count(*) as activos from public.candidaturas
  where departamento = 'Arequipa' and activo = true and nivel in ('REGIONAL','PROVINCIAL')
  group by nivel order by nivel;
