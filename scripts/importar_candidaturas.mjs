/**
 * Importa las candidaturas OFICIALES (ONPE/JNE) a la tabla `candidaturas`.
 *
 * Reemplaza / completa lo que sembró supabase/seed_candidaturas.sql con la
 * data real por ámbito. La conteo-app lee esta tabla para pintar la cédula
 * de cada personero según su provincia/distrito.
 *
 * Requisito previo: correr supabase/candidaturas_multinivel.sql una vez.
 *
 * ── Formato del Excel ──────────────────────────────────────
 * Una fila por candidatura (lista). Columnas reconocidas (case-insensitive,
 * con o sin tildes). Alias entre paréntesis:
 *
 *   NIVEL           REGIONAL | PROVINCIAL | DISTRITAL   (o GOBERNADOR/ALCALDE PROV/ALCALDE DIST)
 *   DEPARTAMENTO    (REGION)
 *   PROVINCIA                                            (vacío si NIVEL=REGIONAL)
 *   DISTRITO                                             (vacío salvo NIVEL=DISTRITAL)
 *   PARTIDO         (ORGANIZACION POLITICA / ORGANIZACIÓN / LISTA)
 *   CANDIDATO       (NOMBRE / CABEZA DE LISTA)           opcional
 *   SIGLA                                                opcional
 *   COLOR           #rrggbb                              opcional
 *   ORDEN           posición en la cédula                opcional
 *   ACTIVO          Sí/No/1/0/true/false                 opcional (default Sí)
 *   FUENTE          (FUENTE_NOTA)                        opcional (default 'ONPE/JNE (import)')
 *
 * ── Uso ───────────────────────────────────────────────────
 *   # dry-run (no escribe, solo reporta):
 *   node scripts/importar_candidaturas.mjs "C:/ruta/candidaturas_oficiales.xlsx" --dry-run
 *
 *   # import real (upsert por ámbito+partido):
 *   node scripts/importar_candidaturas.mjs "C:/ruta/candidaturas_oficiales.xlsx"
 *
 *   # además, desactiva (activo=false) las filas del/los ámbito(s) del Excel
 *   # que ya NO aparezcan en él (para limpiar listas retiradas):
 *   node scripts/importar_candidaturas.mjs "…xlsx" --desactivar-faltantes
 *
 * Credenciales: usa SUPABASE_SERVICE_ROLE si está en el entorno (recomendado,
 * evita cualquier problema de RLS). Si no, cae a la anon key de
 * apps/conteo-web/.env (la policy candidaturas_write_auth exige sesión, así
 * que con anon key el insert fallará: para eso está el modo SQL Editor).
 */
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const DESACTIVAR_FALTANTES = args.includes('--desactivar-faltantes')
const XLSX_PATH = args.find(a => !a.startsWith('--'))

if (!XLSX_PATH) {
  console.error('❌ Uso: node scripts/importar_candidaturas.mjs <ruta-al-excel> [--dry-run] [--desactivar-faltantes]')
  process.exit(1)
}
if (!fs.existsSync(XLSX_PATH)) { console.error('❌ No existe el Excel:', XLSX_PATH); process.exit(1) }

function leerEnv(archivo) {
  const env = {}
  try {
    for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* opcional */ }
  return env
}

const envFile = leerEnv(path.resolve('./apps/conteo-web/.env'))
const SUPABASE_URL = process.env.SUPABASE_URL || envFile.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE || envFile.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('❌ Faltan credenciales: define SUPABASE_SERVICE_ROLE (o VITE_SUPABASE_* en apps/conteo-web/.env)')
  process.exit(1)
}
const usandoServiceRole = !!process.env.SUPABASE_SERVICE_ROLE
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

// ── Normalización ──────────────────────────────────────────
const s = (v) => (v == null ? '' : String(v).trim())
const noAccent = (t) => s(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const nn = (v) => { const t = s(v); return t === '' || t === '-' ? null : t }
const boolSi = (v, def = true) => {
  const t = noAccent(v)
  if (t === '') return def
  return /^(s[ií]|1|true|x|activo)$/.test(t)
}

// Title Case respetando conectores (igual criterio que importar_cali_nacional.mjs)
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en'])
const titleCase = (v) => s(v).toLowerCase().split(/\s+/)
  .map((w, i) => (i > 0 && CONECTORES.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ')

const NIVELES = {
  'regional': 'REGIONAL', 'gobernador': 'REGIONAL', 'gobernador regional': 'REGIONAL', 'region': 'REGIONAL',
  'provincial': 'PROVINCIAL', 'alcalde provincial': 'PROVINCIAL', 'municipal provincial': 'PROVINCIAL', 'alcaldia provincial': 'PROVINCIAL',
  'distrital': 'DISTRITAL', 'alcalde distrital': 'DISTRITAL', 'municipal distrital': 'DISTRITAL', 'alcaldia distrital': 'DISTRITAL',
}

// Busca una columna por cualquiera de sus alias (case/acento-insensitive)
function col(row, ...alias) {
  const keys = Object.keys(row)
  for (const a of alias) {
    const hit = keys.find(k => noAccent(k) === noAccent(a))
    if (hit != null && s(row[hit]) !== '') return row[hit]
  }
  return ''
}

async function main() {
  console.log(`\n📄 Excel: ${XLSX_PATH}`)
  console.log(`🌐 Supabase: ${SUPABASE_URL}  (${usandoServiceRole ? 'service_role' : 'anon key'})`)
  console.log(DRY_RUN ? '🧪 DRY-RUN (no escribe)\n' : '🚀 MODO REAL\n')

  const wb = xlsx.readFile(XLSX_PATH, { cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = xlsx.utils.sheet_to_json(ws, { defval: '', raw: false })
  console.log(`Filas en el Excel: ${raw.length}`)

  const filas = []
  const errores = []
  const ambitos = new Set()

  raw.forEach((row, i) => {
    const nivelRaw = noAccent(col(row, 'NIVEL', 'TIPO', 'ELECCION'))
    const nivel = NIVELES[nivelRaw]
    const departamento = titleCase(col(row, 'DEPARTAMENTO', 'REGION', 'DPTO'))
    const provincia = titleCase(col(row, 'PROVINCIA'))
    const distrito = titleCase(col(row, 'DISTRITO'))
    const partido = s(col(row, 'PARTIDO', 'ORGANIZACION POLITICA', 'ORGANIZACION', 'ORGANIZACIÓN', 'LISTA', 'AGRUPACION'))
    const candidato = nn(col(row, 'CANDIDATO', 'NOMBRE', 'CABEZA DE LISTA', 'NOMBRES Y APELLIDOS'))
    const sigla = nn(col(row, 'SIGLA'))
    const color = nn(col(row, 'COLOR')) || '#6B7280'
    const ordenRaw = s(col(row, 'ORDEN', 'POSICION', 'N', 'Nº'))
    const orden = /^\d+$/.test(ordenRaw) ? parseInt(ordenRaw, 10) : 0
    const activo = boolSi(col(row, 'ACTIVO', 'HABILITADO', 'VIGENTE'), true)
    const fuente = nn(col(row, 'FUENTE', 'FUENTE_NOTA', 'ORIGEN')) || 'ONPE/JNE (import)'

    const fila = i + 2 // +1 header, +1 base-1
    if (!nivel) { errores.push(`Fila ${fila}: NIVEL inválido ("${col(row, 'NIVEL', 'TIPO', 'ELECCION')}")`); return }
    if (!departamento) { errores.push(`Fila ${fila}: falta DEPARTAMENTO`); return }
    if (!partido) { errores.push(`Fila ${fila}: falta PARTIDO`); return }
    if (nivel === 'REGIONAL' && (provincia || distrito)) { errores.push(`Fila ${fila}: REGIONAL no lleva provincia/distrito`); return }
    if (nivel === 'PROVINCIAL' && (!provincia || distrito)) { errores.push(`Fila ${fila}: PROVINCIAL requiere provincia y NO distrito`); return }
    if (nivel === 'DISTRITAL' && (!provincia || !distrito)) { errores.push(`Fila ${fila}: DISTRITAL requiere provincia y distrito`); return }

    ambitos.add([nivel, departamento, provincia || '', distrito || ''].join('|'))
    filas.push({
      nivel, departamento,
      provincia: nivel === 'REGIONAL' ? null : provincia,
      distrito: nivel === 'DISTRITAL' ? distrito : null,
      partido, candidato, sigla, color, orden, activo, fuente,
    })
  })

  console.log(`\n── RESUMEN ──`)
  console.log(`  Candidaturas válidas : ${filas.length}`)
  console.log(`  Ámbitos distintos    : ${ambitos.size}`)
  console.log(`  Filas con error      : ${errores.length}`)
  for (const e of errores.slice(0, 25)) console.log(`     - ${e}`)
  if (errores.length > 25) console.log(`     … y ${errores.length - 25} más`)

  const porAmbito = {}
  for (const f of filas) {
    const k = `${f.nivel}  ${f.departamento}${f.provincia ? ' / ' + f.provincia : ''}${f.distrito ? ' / ' + f.distrito : ''}`
    porAmbito[k] = (porAmbito[k] || 0) + 1
  }
  console.log(`\n  Muestra por ámbito:`)
  for (const [k, n] of Object.entries(porAmbito).slice(0, 15)) console.log(`     ${n.toString().padStart(3)}  ${k}`)

  if (DRY_RUN) { console.log('\n🧪 Dry-run: no se escribió nada.\n'); return }
  if (!filas.length) { console.log('\nNada que importar.\n'); return }

  // ── Upsert por lotes (conflict = índice único de ámbito+partido) ──
  let ok = 0
  const BATCH = 400
  for (let i = 0; i < filas.length; i += BATCH) {
    const lote = filas.slice(i, i + BATCH)
    const { error } = await supabase
      .from('candidaturas')
      .upsert(lote, { onConflict: 'nivel,departamento,provincia,distrito,partido', ignoreDuplicates: false })
    if (error) {
      console.error(`❌ Lote ${i}-${i + lote.length}: ${error.message}`)
      console.error('   (si es por RLS, corre este import con SUPABASE_SERVICE_ROLE o carga el Excel vía SQL Editor)')
      process.exit(1)
    }
    ok += lote.length
    console.log(`  ✅ ${ok}/${filas.length}`)
  }

  if (DESACTIVAR_FALTANTES) {
    console.log(`\n🧹 Desactivando listas ausentes en los ${ambitos.size} ámbitos del Excel…`)
    for (const a of ambitos) {
      const [nivel, dep, prov, dist] = a.split('|')
      const partidosVivos = filas
        .filter(f => f.nivel === nivel && f.departamento === dep && (f.provincia || '') === prov && (f.distrito || '') === dist)
        .map(f => f.partido)
      let q = supabase.from('candidaturas').update({ activo: false }).eq('nivel', nivel).eq('departamento', dep)
      q = prov ? q.eq('provincia', prov) : q.is('provincia', null)
      q = dist ? q.eq('distrito', dist) : q.is('distrito', null)
      q = q.not('partido', 'in', `(${partidosVivos.map(p => `"${p.replace(/"/g, '')}"`).join(',')})`)
      const { error } = await q
      if (error) console.warn(`   ⚠️ ${a}: ${error.message}`)
    }
  }

  console.log(`\n🎉 Import de candidaturas completado: ${ok} filas.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
