-- ============================================================
-- SOMOS PERÚ 2026 — Schema Supabase (PostgreSQL)
-- Cubre: registro, conteo-app, conteo-web
-- ============================================================

-- ─── EXTENSIONES ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- para distancia GPS

-- ─── DISTRITOS Y METAS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS distritos (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  meta_mesas INTEGER NOT NULL DEFAULT 0
);

INSERT INTO distritos (nombre, meta_mesas) VALUES
  ('Ancón',164),('Ate',1671),('Barranco',149),('Breña',349),
  ('Carabayllo',861),('Cercado de Lima',1015),('Chaclacayo',138),
  ('Chorrillos',899),('Cieneguilla',105),('Comas',1499),
  ('El Agustino',566),('Independencia',595),('Jesús María',427),
  ('La Molina',574),('La Victoria',640),('Lince',290),
  ('Los Olivos',984),('Lurigancho-Chosica',550),('Lurín',248),
  ('Magdalena del Mar',256),('Miraflores',478),('Pachacámac',319),
  ('Pucusana',44),('Pueblo Libre',337),('Puente Piedra',891),
  ('Punta Hermosa',33),('Punta Negra',25),('Rímac',560),
  ('San Bartolo',24),('San Borja',422),('San Isidro',282),
  ('San Juan de Lurigancho',2731),('San Juan de Miraflores',1115),
  ('San Luis',228),('San Martín de Porres',1786),('San Miguel',507),
  ('Santa Anita',631),('Santa María del Mar',6),('Santa Rosa',68),
  ('Santiago de Surco',1179),('Surquillo',338),('Villa El Salvador',1171),
  ('Villa María del Triunfo',1234)
ON CONFLICT (nombre) DO NOTHING;

-- ─── LOCALES DE VOTACIÓN ───────────────────────────────────
CREATE TABLE IF NOT EXISTS colegios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          TEXT NOT NULL,
  distrito        TEXT NOT NULL REFERENCES distritos(nombre),
  direccion       TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  total_mesas     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MESAS DE SUFRAGIO ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          TEXT NOT NULL UNIQUE, -- ej: "060037"
  colegio_id      UUID REFERENCES colegios(id),
  colegio_nombre  TEXT,
  distrito        TEXT NOT NULL REFERENCES distritos(nombre),
  total_electores INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PARTIDOS POLÍTICOS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS partidos (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  sigla  TEXT,
  color  TEXT DEFAULT '#6B7280' -- color hex para mapa/gráficos
);

INSERT INTO partidos (nombre, sigla, color) VALUES
  ('Somos Perú','SP','#E8534A'),
  ('Alianza para el Progreso','APP','#F59E0B'),
  ('Acción Popular','AP','#10B981'),
  ('Partido Aprista Peruano','APRA','#EF4444'),
  ('Partido Popular Cristiano','PPC','#3B82F6'),
  ('Avanza País','AVZ','#8B5CF6'),
  ('Ahora Nación','AHN','#06B6D4'),
  ('Partido Morado','PM','#7C3AED'),
  ('Partido Demócrata Verde','PDV','#16A34A'),
  ('Alianza Regional por el Perú','ARP','#D97706'),
  ('Partido Cívico Obras','PCO','#6366F1'),
  ('Partido del Buen Gobierno','PBG','#EC4899'),
  ('Partido Patriótico del Perú','PPP','#0EA5E9'),
  ('Integridad Democrática','ID','#84CC16'),
  ('NULO','','#9CA3AF'),
  ('BLANCO','','#D1D5DB'),
  ('IMPUGNADO','','#FCA5A5')
ON CONFLICT (nombre) DO NOTHING;

-- ─── CANDIDATOS PROVINCIALES (Alcaldía Metropolitana) ──────
CREATE TABLE IF NOT EXISTS candidatos_provinciales (
  id          SERIAL PRIMARY KEY,
  partido_id  INTEGER REFERENCES partidos(id),
  nombre      TEXT NOT NULL,
  partido     TEXT NOT NULL
);

INSERT INTO candidatos_provinciales (partido, nombre) VALUES
  ('Somos Perú','Alfredo Reynaga Ramírez'),
  ('Alianza para el Progreso','Alan Carrasco Bobadilla'),
  ('Acción Popular','Alberto Fernando Moreno Mejía'),
  ('Partido Aprista Peruano','Adolfo Israel Mattos Piaggio'),
  ('Avanza País','Alexander Enrique Von Ehren Campos'),
  ('Ahora Nación','Alberto Luis Peralta Huatuco'),
  ('Partido Morado','Alejandro Hipólito Ramos Rivera'),
  ('Partido Demócrata Verde','Alberto Hurtado'),
  ('Integridad Democrática','Anatoly Renán Bedriñana Córdova'),
  ('Partido Popular Cristiano','Amílcar Alessio Cantella Vega'),
  ('Alianza Regional por el Perú','Américo Zegarra Acuña')
ON CONFLICT DO NOTHING;

-- ─── CANDIDATOS DISTRITALES (por distrito) ─────────────────
CREATE TABLE IF NOT EXISTS candidatos_distritales (
  id          SERIAL PRIMARY KEY,
  partido     TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  distrito    TEXT NOT NULL REFERENCES distritos(nombre)
);

-- ─── PERFILES DE USUARIO (extiende auth.users) ─────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo   TEXT NOT NULL,
  dni               TEXT UNIQUE,
  celular           TEXT,
  correo            TEXT,
  usa_whatsapp      TEXT,
  whatsapp_alterno  TEXT,

  -- Dónde vota
  distrito_vota     TEXT REFERENCES distritos(nombre),
  mesa_sufragio     TEXT,
  local_votacion    TEXT,

  -- Rol en la organización
  rol               TEXT NOT NULL DEFAULT 'Personero de Mesa',
  -- 'Administrador General' | 'Coordinador de Distritos' |
  -- 'Coordinador Zonal' | 'Coordinador de Local' | 'Personero de Mesa'

  -- Asignación
  distrito_asignado TEXT,
  mesa_asignada     TEXT,
  local_asignado    TEXT,

  -- Datos adicionales
  tiene_experiencia  BOOLEAN DEFAULT FALSE,
  cuenta_movilidad   BOOLEAN DEFAULT FALSE,
  se_compromete      BOOLEAN DEFAULT FALSE,

  -- Capacitación
  videos_vistos      INTEGER DEFAULT 0,
  pdfs_vistos        INTEGER DEFAULT 0,
  quiz_estado        TEXT DEFAULT 'Pendiente', -- 'Pendiente' | 'Aprobado'

  -- Credencial
  token_verificacion TEXT UNIQUE,
  clave_acceso       TEXT,
  credencial_estado  TEXT DEFAULT 'Pendiente', -- 'Pendiente' | 'Confirmado' | 'Bloqueado'

  -- Estado de conteo (para conteo-app)
  acta_transmitida   BOOLEAN DEFAULT FALSE,

  fecha_registro    TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROGRESO DE CAPACITACIÓN ──────────────────────────────
CREATE TABLE IF NOT EXISTS training_items (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL, -- 'VIDEO' | 'PDF'
  titulo      TEXT NOT NULL,
  url         TEXT,
  orden       INTEGER DEFAULT 0,
  activo      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS training_progress (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_id     INTEGER REFERENCES training_items(id),
  completado  BOOLEAN DEFAULT FALSE,
  completado_at TIMESTAMPTZ,
  UNIQUE(user_id, item_id)
);

-- ─── QUIZ DE CAPACITACIÓN ──────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_preguntas (
  id          SERIAL PRIMARY KEY,
  pregunta    TEXT NOT NULL,
  opciones    JSONB NOT NULL, -- ["opción A", "opción B", ...]
  correcta    INTEGER NOT NULL, -- índice 0-based de la respuesta correcta
  orden       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_intentos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  puntaje     INTEGER NOT NULL, -- ej: 4 de 5
  aprobado    BOOLEAN NOT NULL,
  respuestas  JSONB, -- {pregunta_id: respuesta_elegida}
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ACTAS DE VOTACIÓN ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS actas (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesa_numero      TEXT NOT NULL,
  colegio_nombre   TEXT,
  distrito         TEXT REFERENCES distritos(nombre),

  personero_id     UUID REFERENCES profiles(id),
  personero_dni    TEXT,

  -- Imagen del acta
  imagen_url       TEXT,
  imagen_base64    TEXT, -- temporal hasta subir a storage

  -- Método de registro
  metodo           TEXT DEFAULT 'MANUAL', -- 'MANUAL' | 'OCR'
  ocr_raw          JSONB, -- respuesta cruda del OCR

  -- Estado
  estado           TEXT DEFAULT 'PENDIENTE', -- 'PENDIENTE' | 'TRANSMITIDA' | 'OBSERVADA'
  bloqueada        BOOLEAN DEFAULT FALSE, -- solo 1 transmisión permitida

  -- GPS del personero al transmitir
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  gps_valido       BOOLEAN,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  transmitida_at   TIMESTAMPTZ,

  UNIQUE(mesa_numero) -- solo 1 acta por mesa
);

-- ─── VOTOS POR MESA ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acta_id          UUID REFERENCES actas(id) ON DELETE CASCADE,
  mesa_numero      TEXT NOT NULL,
  distrito         TEXT REFERENCES distritos(nombre),

  -- Tipo de voto
  nivel            TEXT NOT NULL, -- 'PROVINCIAL' | 'DISTRITAL'
  partido          TEXT NOT NULL,
  candidato        TEXT,
  cantidad         INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ASISTENCIAS / LLEGADAS GPS ────────────────────────────
CREATE TABLE IF NOT EXISTS asistencias (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  distrito        TEXT REFERENCES distritos(nombre),
  colegio_nombre  TEXT,
  mesa_numero     TEXT,

  -- GPS
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  distancia_m     DOUBLE PRECISION, -- distancia al colegio en metros

  tipo            TEXT DEFAULT 'LLEGADA', -- 'LLEGADA' | 'SALIDA'
  confirmada      BOOLEAN DEFAULT FALSE,
  confirmada_por  UUID REFERENCES profiles(id), -- coordinador que confirmó

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── VISTAS PARA EL PANEL ──────────────────────────────────

-- Resumen de votos por partido y distrito
CREATE OR REPLACE VIEW vista_resultados AS
SELECT
  v.distrito,
  v.nivel,
  v.partido,
  SUM(v.cantidad) AS total_votos,
  COUNT(DISTINCT v.mesa_numero) AS mesas_con_reporte
FROM votos v
JOIN actas a ON v.acta_id = a.id
WHERE a.estado = 'TRANSMITIDA'
GROUP BY v.distrito, v.nivel, v.partido;

-- Mesas aperturadas vs pendientes por distrito
CREATE OR REPLACE VIEW vista_mesas_estado AS
SELECT
  d.nombre AS distrito,
  d.meta_mesas,
  COUNT(a.id) AS mesas_aperturadas,
  d.meta_mesas - COUNT(a.id) AS mesas_pendientes,
  ROUND(COUNT(a.id)::NUMERIC / NULLIF(d.meta_mesas, 0) * 100, 1) AS pct_avance
FROM distritos d
LEFT JOIN actas a ON a.distrito = d.nombre AND a.estado = 'TRANSMITIDA'
GROUP BY d.nombre, d.meta_mesas;

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_intentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE actas ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario ve solo su perfil; admins ven todos
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "profiles_admin_read" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.rol IN ('Administrador General','Coordinador de Distritos'))
  );

-- Training progress: solo el propio usuario
CREATE POLICY "training_own" ON training_progress
  FOR ALL USING (auth.uid() = user_id);

-- Quiz: solo el propio usuario
CREATE POLICY "quiz_own" ON quiz_intentos
  FOR ALL USING (auth.uid() = user_id);

-- Actas: el personero ve y crea las suyas; admins ven todas
CREATE POLICY "actas_own" ON actas
  FOR ALL USING (auth.uid() = personero_id);

CREATE POLICY "actas_admin" ON actas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.rol IN ('Administrador General','Coordinador de Distritos','Coordinador Zonal'))
  );

-- Votos: lectura pública para resultados (panel)
CREATE POLICY "votos_read_all" ON votos
  FOR SELECT USING (TRUE);

CREATE POLICY "votos_insert_personero" ON votos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM actas a
            WHERE a.id = acta_id AND a.personero_id = auth.uid())
  );

-- Asistencias
CREATE POLICY "asistencias_own" ON asistencias
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "asistencias_admin" ON asistencias
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
            AND p.rol IN ('Administrador General','Coordinador de Distritos','Coordinador Zonal','Coordinador de Local'))
  );

-- ─── FUNCIONES AUXILIARES ──────────────────────────────────

-- Función: verificar login por DNI + clave
CREATE OR REPLACE FUNCTION verificar_credencial(p_dni TEXT, p_clave TEXT)
RETURNS TABLE(user_id UUID, nombre TEXT, rol TEXT, token TEXT) AS $$
  SELECT p.id, p.nombre_completo, p.rol, p.token_verificacion
  FROM profiles p
  WHERE p.dni = p_dni
    AND p.clave_acceso = p_clave
    AND p.credencial_estado != 'Bloqueado'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Función: estadísticas del dashboard
CREATE OR REPLACE FUNCTION estadisticas_dashboard()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_personeros', COUNT(*) FILTER (WHERE rol = 'Personero de Mesa'),
    'total_coordinadores', COUNT(*) FILTER (WHERE rol LIKE 'Coordinador%'),
    'total_registros', COUNT(*),
    'credenciales_emitidas', COUNT(*) FILTER (WHERE credencial_estado = 'Confirmado'),
    'quiz_aprobados', COUNT(*) FILTER (WHERE quiz_estado = 'Aprobado'),
    'actas_transmitidas', (SELECT COUNT(*) FROM actas WHERE estado = 'TRANSMITIDA')
  ) INTO result
  FROM profiles;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: updated_at automático en profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── COLUMNAS ADICIONALES EN ACTAS (gps_valido, transmitida_at) ────────────
ALTER TABLE actas ADD COLUMN IF NOT EXISTS gps_valido BOOLEAN;
ALTER TABLE actas ADD COLUMN IF NOT EXISTS transmitida_at TIMESTAMPTZ;

-- ─── APP CONFIG (clave Gemini por usuario) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, key)
);
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_own" ON app_config
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── STORAGE: bucket actas ─────────────────────────────────────────────────
-- Ejecutar en Supabase Dashboard > Storage > New bucket: "actas" (public)
-- o via SQL Editor:
INSERT INTO storage.buckets (id, name, public)
  VALUES ('actas', 'actas', true)
  ON CONFLICT (id) DO NOTHING;

-- Política: cualquier usuario autenticado puede subir al bucket actas
CREATE POLICY "actas_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'actas');

-- Política: lectura pública de las imágenes de actas
CREATE POLICY "actas_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'actas');
