/**
 * Importa TODOS los locales de votación de CALI.xlsx a la tabla `colegios`
 * (todo el país, no solo Lima Metropolitana).
 *
 * Requisito previo: correr supabase/migracion_ubigeo_nacional.sql en el
 * SQL Editor de Supabase (agrega columnas departamento/provincia/electores).
 *
 * Uso, desde la raíz del repo:
 *   node scripts/importar_cali_nacional.mjs
 *
 * Lee credenciales de apps/conteo-web/.env y el Excel de ../CALI.xlsx
 * (mismo lugar que el script original importar_cali.mjs).
 */
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

// Lee VITE_SUPABASE_* de apps/conteo-web/.env sin depender de dotenv
function leerEnv(archivo) {
  const env = {}
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = leerEnv(path.resolve('./apps/conteo-web/.env'))
const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en apps/conteo-web/.env')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Normalización de nombres ────────────────────────────────
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en'])

const titleCase = (s) =>
  String(s).trim().toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && CONECTORES.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

// Distritos de Lima Metropolitana en su forma canónica (para que calcen con
// la tabla `distritos` y los perfiles ya registrados).
const LIMA_CANON = {
  'ANCON': 'Ancón', 'ATE': 'Ate', 'BARRANCO': 'Barranco', 'BREÑA': 'Breña', 'BRENA': 'Breña',
  'CARABAYLLO': 'Carabayllo', 'CERCADO DE LIMA': 'Cercado de Lima', 'LIMA': 'Cercado de Lima',
  'CHACLACAYO': 'Chaclacayo', 'CHORRILLOS': 'Chorrillos', 'CIENEGUILLA': 'Cieneguilla',
  'COMAS': 'Comas', 'EL AGUSTINO': 'El Agustino', 'INDEPENDENCIA': 'Independencia',
  'JESUS MARIA': 'Jesús María', 'LA MOLINA': 'La Molina', 'LA VICTORIA': 'La Victoria',
  'LINCE': 'Lince', 'LOS OLIVOS': 'Los Olivos', 'LURIGANCHO': 'Lurigancho-Chosica',
  'LURIGANCHO-CHOSICA': 'Lurigancho-Chosica', 'CHOSICA': 'Lurigancho-Chosica',
  'LURIN': 'Lurín', 'MAGDALENA DEL MAR': 'Magdalena del Mar', 'MAGDALENA': 'Magdalena del Mar',
  'MIRAFLORES': 'Miraflores', 'PACHACAMAC': 'Pachacámac', 'PUCUSANA': 'Pucusana',
  'PUEBLO LIBRE': 'Pueblo Libre', 'PUENTE PIEDRA': 'Puente Piedra', 'PUNTA HERMOSA': 'Punta Hermosa',
  'PUNTA NEGRA': 'Punta Negra', 'RIMAC': 'Rímac', 'SAN BARTOLO': 'San Bartolo',
  'SAN BORJA': 'San Borja', 'SAN ISIDRO': 'San Isidro', 'SAN JUAN DE LURIGANCHO': 'San Juan de Lurigancho',
  'SAN JUAN DE MIRAFLORES': 'San Juan de Miraflores', 'SAN LUIS': 'San Luis',
  'SAN MARTIN DE PORRES': 'San Martín de Porres', 'SAN MIGUEL': 'San Miguel',
  'SANTA ANITA': 'Santa Anita', 'SANTA MARIA DEL MAR': 'Santa María del Mar',
  'SANTA ROSA': 'Santa Rosa', 'SANTIAGO DE SURCO': 'Santiago de Surco', 'SURQUILLO': 'Surquillo',
  'VILLA EL SALVADOR': 'Villa El Salvador', 'VILLA MARIA DEL TRIUNFO': 'Villa María del Triunfo',
}

const normDistrito = (dpto, prov, raw) => {
  const clean = String(raw).trim().toUpperCase().normalize('NFC')
  if (dpto === 'LIMA' && prov === 'LIMA' && LIMA_CANON[clean]) return LIMA_CANON[clean]
  return titleCase(raw)
}

async function main() {
  const filePath = path.resolve('../CALI.xlsx')
  console.log(`📖 Leyendo ${filePath} ...`)
  const wb = xlsx.readFile(filePath)
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: '' })
  console.log(`📊 ${rows.length} filas en el Excel`)

  const registros = rows.map((r) => {
    const dpto = String(r.DPTO).trim().toUpperCase()
    const prov = String(r.PROVINCIA).trim().toUpperCase()
    return {
      departamento: titleCase(r.DPTO),
      provincia: titleCase(r.PROVINCIA),
      distrito: normDistrito(dpto, prov, r.DISTRITO),
      nombre: String(r['NOMBRE DEL LOCAL']).trim(),
      direccion: String(r['DIRECCIÓN DEL LOCAL']).trim(),
      total_mesas: parseInt(r['MESAS'], 10) || 0,
      electores: parseInt(r['ELECTORES HÁBILES ELECCIONES REGIONALES'], 10) || 0,
    }
  }).filter((r) => r.nombre && r.distrito)

  const deps = [...new Set(registros.map((r) => r.departamento))]
  console.log(`✨ ${registros.length} locales listos · ${deps.length} departamentos`)

  // Seguridad: no borrar si hay mesas que referencian colegios
  const { count: mesasCount } = await supabase.from('mesas').select('*', { count: 'exact', head: true })
  if (mesasCount && mesasCount > 0) {
    console.error(`❌ Hay ${mesasCount} filas en 'mesas' que referencian colegios. Aborta para no romper la FK.`)
    process.exit(1)
  }

  console.log('🗑️  Vaciando tabla colegios ...')
  const { error: delErr } = await supabase.from('colegios').delete().not('id', 'is', null)
  if (delErr) { console.error('❌ Error al vaciar colegios:', delErr.message); process.exit(1) }
  // colegios tiene RLS: la anon key no puede borrar. Avisar si quedaron filas viejas.
  const { count: quedan } = await supabase.from('colegios').select('*', { count: 'exact', head: true })
  if (quedan && quedan > 0) {
    console.warn(`⚠️  Quedaron ${quedan} filas (RLS bloquea DELETE con anon key).`)
    console.warn('    Tras el import, corre en el SQL Editor:  DELETE FROM colegios WHERE departamento IS NULL;')
  }

  const BATCH = 500
  let ok = 0
  for (let i = 0; i < registros.length; i += BATCH) {
    const lote = registros.slice(i, i + BATCH)
    const { error } = await supabase.from('colegios').insert(lote)
    if (error) {
      console.error(`❌ Lote ${i}-${i + lote.length}:`, error.message)
      process.exit(1)
    }
    ok += lote.length
    console.log(`✅ ${ok}/${registros.length}`)
  }

  console.log('🎉 Carga nacional completada.')
}

main().catch((e) => { console.error(e); process.exit(1) })
