/**
 * Importa a `colegios` SOLO el/los distrito(s) de un ámbito puntual de CALI.xlsx,
 * contra el proyecto Supabase que se le indique (una instancia nueva por
 * provincia/distrito — ver DEPLOY.md). A diferencia de importar_cali_nacional.mjs:
 * - No borra nada (piensa en un proyecto recién creado, con `colegios` vacía).
 * - Lee las credenciales de un .env que se pasa por argumento, no el de conteo-web.
 * - Filtra a departamento/provincia/distrito indicados (comparación insensible a
 *   mayúsculas/tildes, igual que hace normDistrito con Lima).
 *
 * Uso, desde la raíz del repo:
 *   node scripts/importar_cali_ambito.mjs --env apps/conteo-web/.env.arequipa \
 *     --departamento Arequipa --provincia Arequipa --distrito "Mariano Melgar"
 *
 * Lee el Excel de ../CALI.xlsx (mismo que usan los demás scripts de importación).
 */
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

function leerEnv(archivo) {
  const env = {}
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function leerArgs() {
  const a = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--/, '')] = a[i + 1]
  return out
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en'])
const titleCase = (s) =>
  String(s).trim().toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && CONECTORES.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const normComp = (s) =>
  String(s).trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

async function main() {
  const args = leerArgs()
  const { env: envPath, departamento, provincia, distrito } = args
  if (!envPath || !departamento || !provincia || !distrito) {
    console.error('❌ Uso: node scripts/importar_cali_ambito.mjs --env <ruta .env> --departamento X --provincia Y --distrito Z')
    process.exit(1)
  }

  const env = leerEnv(path.resolve(envPath))
  const supabaseUrl = env.VITE_SUPABASE_URL
  // `colegios` solo acepta INSERT de `authenticated`/`service_role` (rls_seguridad.sql) —
  // se necesita la service_role key, la anon key no alcanza.
  const supabaseKey = env.SUPABASE_SERVICE_ROLE || env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !env.SUPABASE_SERVICE_ROLE) {
    console.error(`❌ Falta VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE en ${envPath}`)
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  const filePath = path.resolve('../CALI.xlsx')
  console.log(`📖 Leyendo ${filePath} ...`)
  const wb = xlsx.readFile(filePath)
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'], { defval: '' })
  console.log(`📊 ${rows.length} filas en el Excel`)

  const wantDep = normComp(departamento)
  const wantProv = normComp(provincia)
  const wantDist = normComp(distrito)

  const registros = rows
    .filter((r) =>
      normComp(r.DPTO) === wantDep &&
      normComp(r.PROVINCIA) === wantProv &&
      normComp(r.DISTRITO) === wantDist)
    .map((r) => ({
      departamento: titleCase(r.DPTO),
      provincia: titleCase(r.PROVINCIA),
      distrito: titleCase(r.DISTRITO),
      nombre: String(r['NOMBRE DEL LOCAL']).trim(),
      direccion: String(r['DIRECCIÓN DEL LOCAL']).trim(),
      total_mesas: parseInt(r['MESAS'], 10) || 0,
      electores: parseInt(r['ELECTORES HÁBILES ELECCIONES REGIONALES'], 10) || 0,
    }))
    .filter((r) => r.nombre)

  if (!registros.length) {
    console.error(`❌ No se encontró ningún local para ${departamento} / ${provincia} / ${distrito} en CALI.xlsx. Revisa la grafía exacta (prueba sin filtrar y mira qué trae la columna DISTRITO).`)
    process.exit(1)
  }
  console.log(`✨ ${registros.length} locales de "${registros[0].departamento} / ${registros[0].provincia} / ${registros[0].distrito}" listos para insertar`)

  const { error } = await supabase.from('colegios').insert(registros)
  if (error) { console.error('❌ Error al insertar:', error.message); process.exit(1) }

  console.log(`🎉 ${registros.length} locales insertados en 'colegios'.`)
  console.log('Siguiente paso: correr supabase/seed_candidaturas_cali.sql en el SQL Editor de este proyecto.')
}

main().catch((e) => { console.error(e); process.exit(1) })
