-- ============================================================
-- MIGRACIÓN — Ubigeo nacional en `colegios` + rol "Coordinador Provincial"
-- Ejecutar UNA vez en el SQL Editor de Supabase antes de correr
-- scripts/importar_cali_nacional.mjs
-- Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================

-- 1) Columnas de ubigeo y electores en colegios ---------------
ALTER TABLE colegios ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE colegios ADD COLUMN IF NOT EXISTS provincia    TEXT;
ALTER TABLE colegios ADD COLUMN IF NOT EXISTS electores    INTEGER DEFAULT 0;

-- 2) Soltar la FK a distritos(nombre): ahora hay distritos de todo el país,
--    y el mismo nombre de distrito se repite entre provincias.
ALTER TABLE colegios DROP CONSTRAINT IF EXISTS colegios_distrito_fkey;

-- 2b) Ubigeo también en el perfil (distrito solo no basta: se repite entre provincias)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS departamento_vota     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provincia_vota        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS departamento_asignado TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS provincia_asignado    TEXT;

-- 2c) Soltar la FK profiles.distrito_vota → distritos(nombre): ahora es ubigeo nacional
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_distrito_vota_fkey;

-- 3) Índice para la cascada Departamento → Provincia → Distrito
CREATE INDEX IF NOT EXISTS idx_colegios_ubigeo
  ON colegios (departamento, provincia, distrito);

-- 4) Vistas que alimentan los selectores del formulario -------
CREATE OR REPLACE VIEW vista_departamentos AS
  SELECT DISTINCT departamento
  FROM colegios
  WHERE departamento IS NOT NULL
  ORDER BY departamento;

CREATE OR REPLACE VIEW vista_provincias AS
  SELECT DISTINCT departamento, provincia
  FROM colegios
  WHERE departamento IS NOT NULL
  ORDER BY departamento, provincia;

CREATE OR REPLACE VIEW vista_ubigeo AS
  SELECT DISTINCT departamento, provincia, distrito
  FROM colegios
  WHERE departamento IS NOT NULL
  ORDER BY departamento, provincia, distrito;

GRANT SELECT ON vista_departamentos, vista_provincias, vista_ubigeo TO anon, authenticated;

-- 5) Renombrar el rol en los perfiles ya registrados ---------
UPDATE profiles SET rol = 'Coordinador Provincial' WHERE rol = 'Coordinador Zonal';

-- 6) Políticas RLS que mencionaban el rol anterior ----------
DROP POLICY IF EXISTS "actas_admin" ON actas;
CREATE POLICY "actas_admin" ON actas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.rol IN ('Administrador General','Coordinador de Distritos','Coordinador Provincial'))
  );

DROP POLICY IF EXISTS "asistencias_admin" ON asistencias;
CREATE POLICY "asistencias_admin" ON asistencias
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.rol IN ('Administrador General','Coordinador de Distritos','Coordinador Provincial','Coordinador de Local'))
  );
