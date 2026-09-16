-- ============================================================
-- SEED -- Candidaturas ERM 2026, Mariano Melgar (Arequipa/Arequipa), nivel DISTRITAL
--
-- Fuente: prensa (El Búho y Evidencia.pe, ago 2026 -- ambos coinciden en los
-- mismos 6 candidatos). Reemplaza/completa la plantilla nacional (CALI): 3 de
-- los 6 candidatos van por partidos nacionales que ya estaban en la plantilla
-- (Somos Perú, Ahora Nación, Acción Popular); los otros 3 van por movimientos
-- regionales de Arequipa que NO estaban en la plantilla (solo trae partidos
-- nacionales) y se insertan como filas nuevas. El resto de partidos de la
-- plantilla que no presentaron candidato en Mariano Melgar se desactivan.
--
-- Idempotente: ON CONFLICT sobre (nivel, departamento, provincia, distrito, partido).
-- ============================================================

insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, sigla, color, orden, activo, fuente) values
  ('DISTRITAL','Arequipa','Arequipa','Mariano Melgar','Somos Perú','Edwin Rolando Tito Orozco', 'SP', '#e11d48', 1, true, 'prensa 2026'),
  ('DISTRITAL','Arequipa','Arequipa','Mariano Melgar','Ahora Nación','Carlos Alejandro Andrade Pareja', 'AN', '#7c3aed', 5, true, 'prensa 2026'),
  ('DISTRITAL','Arequipa','Arequipa','Mariano Melgar','Acción Popular','Ángel Gerardo Esquivel Quispe', 'AP', '#d97706', 6, true, 'prensa 2026'),
  ('DISTRITAL','Arequipa','Arequipa','Mariano Melgar','Arequipa Avancemos','Percy Luis Cornejo Barragán', 'AAV', '#9333ea', 31, true, 'prensa 2026'),
  ('DISTRITAL','Arequipa','Arequipa','Mariano Melgar','Arequipa, Tradición y Futuro','Sergio Gonzales Apaza', 'ATF', '#0d9488', 32, true, 'prensa 2026'),
  ('DISTRITAL','Arequipa','Arequipa','Mariano Melgar','Fuerza Arequipeña','Cascely Williams Calizaya Mamani', 'FAR', '#db2777', 33, true, 'prensa 2026')
on conflict (nivel, departamento, provincia, distrito, partido)
do update set candidato = excluded.candidato, sigla = excluded.sigla, color = excluded.color,
              orden = excluded.orden, fuente = excluded.fuente, activo = excluded.activo,
              updated_at = now();

-- Desactivar partidos de la plantilla CALI que no presentaron candidato en Mariano Melgar.
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Arequipa' and provincia = 'Arequipa'
  and distrito = 'Mariano Melgar' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Ahora Nación', 'Acción Popular');

-- ── Verificación ───────────────────────────────────────────
select partido, candidato, activo, fuente from public.candidaturas
  where nivel = 'DISTRITAL' and departamento = 'Arequipa' and provincia = 'Arequipa'
  and distrito = 'Mariano Melgar' and activo = true
  order by orden;
