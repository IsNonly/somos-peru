-- Habilitar lectura e inserción pública/admin para colegios y mesas
ALTER TABLE colegios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colegios_read_all" ON colegios FOR SELECT USING (true);
CREATE POLICY "colegios_insert_all" ON colegios FOR INSERT WITH CHECK (true);
CREATE POLICY "colegios_update_all" ON colegios FOR UPDATE USING (true);

CREATE POLICY "mesas_read_all" ON mesas FOR SELECT USING (true);
CREATE POLICY "mesas_insert_all" ON mesas FOR INSERT WITH CHECK (true);
CREATE POLICY "mesas_update_all" ON mesas FOR UPDATE USING (true);
