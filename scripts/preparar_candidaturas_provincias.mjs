/**
 * Genera el Excel para `importar_candidaturas.mjs` con la cedula COMPLETA
 * (todas las organizaciones, no solo Somos Peru) de las provincias y regiones
 * del pais, a partir del registro de candidaturas ERM 2026.
 *
 * ── Fuente de datos ───────────────────────────────────────
 * `data/alcaldes.json` del proyecto https://github.com/deylg/elecciones-erm2026
 * (scrape del registro ONPE). NO es la data oficial: se detectaron huecos
 * (p. ej. Lima Metropolitana trae ~13 listas donde ONPE/prensa registran ~22).
 * Cada fila se marca "scrape ONPE (deylg) - VALIDAR" en la columna FUENTE_NOTA.
 * Antes de desplegar personeros en una region hay que cruzar sus ambitos
 * contra la cedula oficial de ONPE/JNE.
 *
 * ── Que genera ────────────────────────────────────────────
 *  - REGIONAL   : Gobernador Regional de cada region (incluye "Gobierno
 *                 Regional de Lima" = Lima Provincias; NO Lima Metropolitana).
 *  - PROVINCIAL : Alcalde Provincial de cada provincia.
 *  - DISTRITAL  : Alcalde Distrital de cada distrito.
 *  - EXCLUYE la region "Lima Metropolitana": esa cedula ya esta sembrada a
 *    mano desde prensa (supabase/seed_candidaturas.sql) y se dio por buena.
 *
 * Ubigeo: se normaliza al MISMO criterio que `colegios` (importar_cali_nacional.mjs):
 * Title Case, sin tildes en vocales, con enhe. Asi calza con
 * profiles.departamento_asignado / colegios y la conteo-app encuentra las
 * listas del personero.
 *
 * ── Uso ──────────────────────────────────────────────────
 *   node scripts/preparar_candidaturas_provincias.mjs               # baja el JSON
 *   node scripts/preparar_candidaturas_provincias.mjs --input a.json # JSON local
 *
 * Salida: scripts/out/candidaturas_provincias.xlsx  (+ .resumen.txt)
 * Luego:  SUPABASE_SERVICE_ROLE=... node scripts/importar_candidaturas.mjs scripts/out/candidaturas_provincias.xlsx
 */
import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

const args = process.argv.slice(2)
const INPUT = (args.find(a => a.startsWith('--input=')) || '').split('=')[1]
  || (args.includes('--input') ? args[args.indexOf('--input') + 1] : null)
const SRC_URL = 'https://raw.githubusercontent.com/deylg/elecciones-erm2026/main/data/alcaldes.json'
const OUT_DIR = path.resolve('./scripts/out')
const OUT_XLSX = path.join(OUT_DIR, 'candidaturas_provincias.xlsx')
const OUT_TXT = path.join(OUT_DIR, 'candidaturas_provincias.resumen.txt')

// ── Normalizacion de ubigeo (igual criterio que colegios) ──────────────────
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en'])
// Quita tildes de vocales; deja la enhe intacta. Sin NFD ni sentinelas.
function sinTilde(s) {
  return String(s)
    .replace(/[áàäâã]/g, 'a').replace(/[ÁÀÄÂÃ]/g, 'A')
    .replace(/[éèëê]/g, 'e').replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[íìïî]/g, 'i').replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[óòöôõ]/g, 'o').replace(/[ÓÒÖÔÕ]/g, 'O')
    .replace(/[úùüû]/g, 'u').replace(/[ÚÙÜÛ]/g, 'U')
}
function titleUbigeo(s) {
  return sinTilde(s).trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map((w, i) => (i > 0 && CONECTORES.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Catalogo de organizaciones nacionales -> nombre / sigla / color ────────
const CAT = {
  'PARTIDO DEMOCRATICO SOMOS PERU':                 ['Somos Perú', 'SP', '#e11d48'],
  'ALIANZA PARA EL PROGRESO':                       ['Alianza para el Progreso', 'APP', '#16a34a'],
  'PARTIDO POLITICO PERU PRIMERO':                  ['Perú Primero', 'PPR', '#0284c7'],
  'PODEMOS PERU':                                   ['Podemos Perú', 'PP', '#dc2626'],
  'AHORA NACION - AN':                              ['Ahora Nación', 'AN', '#7c3aed'],
  'ACCION POPULAR':                                 ['Acción Popular', 'AP', '#d97706'],
  'RENOVACION POPULAR PERU':                        ['Renovación Popular', 'RP', '#1d4ed8'],
  'PROGRESEMOS':                                    ['Progresemos', 'PRG', '#047857'],
  'PARTIDO PAIS PARA TODOS':                        ['Partido País para Todos', 'PAI', '#a21caf'],
  'ALIANZA ELECTORAL VENCEREMOS':                   ['Alianza Electoral Venceremos', 'VE', '#0284c7'],
  'FUERZA POPULAR':                                 ['Fuerza Popular', 'FP', '#f59e0b'],
  'AVANZA PAIS - PARTIDO DE INTEGRACION SOCIAL':    ['Avanza País', 'AV', '#0891b2'],
  'LIBERTAD POPULAR':                               ['Libertad Popular', 'LP', '#6d28d9'],
  'JUNTOS POR EL PERU':                             ['Juntos por el Perú', 'JP', '#16a34a'],
  'PARTIDO DEMOCRATA VERDE':                        ['Partido Demócrata Verde', 'DV', '#15803d'],
  'PARTIDO APRISTA PERUANO':                        ['Partido Aprista Peruano', 'PA', '#b91c1c'],
  'PARTIDO FRENTE DE LA ESPERANZA 2021':            ['Frente de la Esperanza 2021', 'FE', '#65a30d'],
  'BATALLA PERU':                                   ['Batalla Perú', 'BAT', '#0891b2'],
  'PARTIDO POLITICO PRIN':                          ['PRIN', 'PRIN', '#374151'],
  'PARTIDO CIVICO OBRAS':                           ['Partido Cívico Obras', 'PC', '#b45309'],
  'PARTIDO POPULAR CRISTIANO - PPC':                ['Partido Popular Cristiano (PPC)', 'PPC', '#1e40af'],
  'FRENTE POPULAR AGRICOLA FIA DEL PERU':           ['FREPAP', 'FR', '#059669'],
  'PARTIDO POLITICO NACIONAL PERU LIBRE':           ['Perú Libre', 'PL', '#ca8a04'],
  'FE EN EL PERU':                                  ['Fe en el Perú', 'FEP', '#0d9488'],
  'PERU MODERNO':                                   ['Perú Moderno', 'PMO', '#1d4ed8'],
  'PARTIDO POLITICO PUEBLO CONSCIENTE':             ['Pueblo Consciente', 'CT', '#6d28d9'],
  'VISION PERU':                                    ['Visión Perú', 'VP', '#4f46e5'],
  'PARTIDO MORADO':                                 ['Partido Morado', 'PM', '#7c3aed'],
  'PARTIDO DEL BUEN GOBIERNO':                      ['Partido del Buen Gobierno', 'BG', '#0369a1'],
  'COALICION TRANSFORMADORA TIERRA VERDE':          ['Coalición Transformadora Tierra Verde', 'TV', '#16a34a'],
  'PARTIDO PATRIOTICO DEL PERU':                    ['Partido Patriótico del Perú', 'PTR', '#1e3a8a'],
  'PARTIDO POLITICO INTEGRIDAD DEMOCRATICA':        ['Integridad Democrática', 'ID', '#0f766e'],
  'SALVEMOS AL PERU':                               ['Salvemos al Perú', 'SAP', '#64748b'],
  'ALIANZA REGIONAL POR EL PERU':                   ['Alianza Regional por el Perú', 'ARP', '#d97706'],
  'PARTIDO POLITICO TODO CON EL PUEBLO':            ['Todo con el Pueblo', 'TCP', '#9333ea'],
  'PARTIDO POLITICO PERU ACCION':                   ['Perú Acción', 'PAC', '#0ea5e9'],
  'PARTIDO SICREO':                                 ['Sí Creo', 'SIC', '#f43f5e'],
  'PARTIDO DEMOCRATA UNIDO PERU':                   ['Demócrata Unido Perú', 'DUP', '#14b8a6'],
  'PARTIDO DE LOS TRABAJADORES Y EMPRENDEDORES PTE PERU - COMUNIDAD POLITICA INKA PERU':
                                                   ['PTE Perú - Inka Perú', 'PTE', '#0f766e'],
  'PRIMERO LA GENTE - COMUNIDAD, ECOLOGIA, LIBERTAD Y PROGRESO':
                                                   ['Primero la Gente', 'PLG', '#65a30d'],
  'ASI - JUNTOS POR EL PERU':                       ['ASÍ - Juntos por el Perú', 'ASI', '#16a34a'],
  'FUERZA CIUDADANA':                               ['Fuerza Ciudadana', 'FC', '#ea580c'],
  'PARTIDO POLITICO ADP':                           ['ADP', 'ADP', '#334155'],
  'PARTIDO UNIDAD Y PAZ':                           ['Unidad y Paz', 'UYP', '#334155'],
}
// Tokens que quedan en mayuscula (siglas) al titular movimientos regionales
const KEEP_UPPER = new Set(['app', 'ppc', 'udh', 'prin', 'an', 'adp', 'asi', 'pte', 'fia'])
function titleOrg(raw) {
  return String(raw).trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map(w => {
      const bare = w.replace(/[^a-záéíóúñ]/g, '')
      if (KEEP_UPPER.has(bare)) return w.toUpperCase()
      if (CONECTORES.has(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

const NIVEL = { 'Gobernador': 'REGIONAL', 'Alcalde Provincial': 'PROVINCIAL', 'Alcalde Distrital': 'DISTRITAL' }
function departamentoDe(region) {
  const r = String(region).trim().toUpperCase()
  if (r === 'LIMA METROPOLITANA' || r === 'LIMA PROVINCIAS') return 'Lima'
  return titleUbigeo(region)
}

async function cargarJson() {
  if (INPUT) {
    console.log(`Leyendo ${INPUT}`)
    return JSON.parse(fs.readFileSync(path.resolve(INPUT), 'utf8'))
  }
  console.log(`Descargando ${SRC_URL}`)
  const res = await fetch(SRC_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar el JSON`)
  return res.json()
}

async function main() {
  const data = await cargarJson()
  console.log(`   ${data.length} candidaturas en el origen`)

  const rows = []
  let skipLimaMetro = 0, skipSinNivel = 0
  const catFaltante = new Map()

  for (const r of data) {
    const nivel = NIVEL[r.cargo]
    if (!nivel) { skipSinNivel++; continue }
    if (String(r.region).trim().toUpperCase() === 'LIMA METROPOLITANA') { skipLimaMetro++; continue }
    if (!r.organizacion) continue

    const cat = CAT[String(r.organizacion).trim().toUpperCase()]
    if (!cat) catFaltante.set(r.organizacion, (catFaltante.get(r.organizacion) || 0) + 1)

    rows.push({
      NIVEL: nivel,
      DEPARTAMENTO: departamentoDe(r.region),
      PROVINCIA: nivel === 'REGIONAL' ? '' : titleUbigeo(r.provincia),
      DISTRITO: nivel === 'DISTRITAL' ? titleUbigeo(r.distrito) : '',
      PARTIDO: cat ? cat[0] : titleOrg(r.organizacion),
      CANDIDATO: r.nombre ? titleOrg(r.nombre) : '',
      SIGLA: cat ? cat[1] : '',
      COLOR: cat ? cat[2] : '',
      ORDEN: Number.isFinite(r.n) ? r.n : 0,
      ACTIVO: 'Si',
      FUENTE_NOTA: 'scrape ONPE (deylg) - VALIDAR',
    })
  }

  // dedupe por (nivel, depto, prov, dist, partido)
  const seen = new Set()
  const dedup = rows.filter(x => {
    const k = [x.NIVEL, x.DEPARTAMENTO, x.PROVINCIA, x.DISTRITO, x.PARTIDO.toLowerCase()].join('|')
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const ws = xlsx.utils.json_to_sheet(dedup)
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, 'candidaturas')
  xlsx.writeFile(wb, OUT_XLSX)

  const cont = (f) => dedup.filter(f).length
  const deptos = [...new Set(dedup.map(x => x.DEPARTAMENTO))].sort()
  const provPorDepto = {}
  for (const x of dedup) if (x.NIVEL === 'PROVINCIAL') (provPorDepto[x.DEPARTAMENTO] ??= new Set()).add(x.PROVINCIA)

  let txt = ''
  txt += `Generado: ${new Date().toISOString()}\n`
  txt += `Origen: ${INPUT || SRC_URL}\n`
  txt += `Fuente: scrape ONPE (deylg/elecciones-erm2026) - NO OFICIAL, validar por region.\n\n`
  txt += `Filas escritas: ${dedup.length}  (dup. eliminadas: ${rows.length - dedup.length})\n`
  txt += `  REGIONAL   : ${cont(x => x.NIVEL === 'REGIONAL')}\n`
  txt += `  PROVINCIAL : ${cont(x => x.NIVEL === 'PROVINCIAL')}\n`
  txt += `  DISTRITAL  : ${cont(x => x.NIVEL === 'DISTRITAL')}\n`
  txt += `Excluidas Lima Metropolitana: ${skipLimaMetro}\n`
  txt += `Sin nivel reconocido: ${skipSinNivel}\n\n`
  txt += `Departamentos (${deptos.length}): ${deptos.join(', ')}\n\n`
  txt += `Provincias por departamento:\n`
  for (const d of Object.keys(provPorDepto).sort()) txt += `  ${d} (${provPorDepto[d].size})\n`
  if (catFaltante.size) {
    txt += `\nOrganizaciones sin entrada en el catalogo (Title Case, sin sigla/color):\n`
    for (const [k, v] of [...catFaltante].sort((a, b) => b[1] - a[1])) txt += `  ${String(v).padStart(4)}  ${k}\n`
  }
  fs.writeFileSync(OUT_TXT, txt)

  console.log(`\nOK  ${OUT_XLSX}`)
  console.log(`   ${dedup.length} filas | REGIONAL ${cont(x => x.NIVEL === 'REGIONAL')} | PROVINCIAL ${cont(x => x.NIVEL === 'PROVINCIAL')} | DISTRITAL ${cont(x => x.NIVEL === 'DISTRITAL')}`)
  console.log(`   resumen -> ${OUT_TXT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
