/**
 * Importa inscritos NUEVOS desde el Excel del padrón a Supabase.
 *
 * - Solo inserta DNIs que NO existen ya en `profiles` (los existentes no se tocan).
 * - Crea la cuenta de Auth (email `<dni>@somosperu.com`, password = DNI, correo
 *   confirmado) usando la Admin API -> esas cuentas SÍ pueden loguear.
 * - Deduce departamento/provincia (vota y asignado) del distrito vía vista_ubigeo
 *   (Lima Metropolitana + Callao).
 *
 * Requiere la SERVICE ROLE key (Supabase > Project Settings > API). NUNCA la
 * pongas en un archivo del repo; pásala por variable de entorno:
 *
 *   # dry-run (no escribe nada, solo reporta):
 *   SUPABASE_SERVICE_ROLE=eyJ... node scripts/importar_padron.mjs "C:/Users/ALONSO/Downloads/PADRON_SOMOSPERU.xlsx" --dry-run
 *
 *   # import real:
 *   SUPABASE_SERVICE_ROLE=eyJ... node scripts/importar_padron.mjs "C:/Users/ALONSO/Downloads/PADRON_SOMOSPERU.xlsx"
 *
 * La URL de Supabase se lee de apps/conteo-web/.env (VITE_SUPABASE_URL) o de
 * la env var SUPABASE_URL.
 */
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import path from 'path'
import fs from 'fs'

// ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity
const XLSX_PATH = args.find(a => !a.startsWith('--')) ||
  'C:/Users/ALONSO/Downloads/PADRON_SOMOSPERU.xlsx'

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
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL) { console.error('❌ Falta SUPABASE_URL (o VITE_SUPABASE_URL en apps/conteo-web/.env)'); process.exit(1) }
if (!SERVICE_ROLE) { console.error('❌ Falta la env var SUPABASE_SERVICE_ROLE'); process.exit(1) }
if (!fs.existsSync(XLSX_PATH)) { console.error('❌ No existe el Excel:', XLSX_PATH); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })

// ── Helpers de normalización ────────────────────────────────
const s = (v) => (v == null ? '' : String(v).trim())
const nn = (v) => { const t = s(v); return (t === '' || t === '-' || /^no aplica$/i.test(t)) ? null : t }
const boolSi = (v) => /^s[ií]\b/i.test(s(v))
const intOr0 = (v) => { const n = parseInt(s(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const noAccent = (t) => s(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// "3/9/2026, 9:45:53 p. m." -> ISO, o null si no parsea
function parseFecha(v) {
  const t = s(v)
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*([ap])\.?\s*m/i)
  if (!m) return null
  let [, d, mo, y, h, mi, se, ap] = m
  h = parseInt(h, 10)
  if (/p/i.test(ap) && h < 12) h += 12
  if (/a/i.test(ap) && h === 12) h = 0
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, h - (-5), +mi, +se)) // -05:00 Lima -> UTC
  return isNaN(dt) ? null : dt.toISOString()
}

// "Coordinador Distrital" = "Coordinador de Distritos" = "Coordinador Zonal": supervisa los
// colegios asignados dentro de UN distrito. "Coordinador Provincial" es un rol aparte (ve
// TODA la provincia) — NO es sinónimo de "zonal", pese al nombre parecido.
const ROLES_VALIDOS = new Set([
  'Administrador General', 'Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Provincial',
  'Personero de Mesa', 'Personero de Centro de Votación',
])
const ROL_ALIAS = {
  'coordinador zonal': 'Coordinador Distrital',
  'coordinador de local': 'Personero de Centro de Votación',
  'personero de local de votacion': 'Personero de Centro de Votación',
  // "Coordinador Regional" (encargado de todo un departamento) no tiene tier propio
  // en la app todavía; se mapea al rol más alto que ya existe (ve toda su provincia/
  // departamento vía departamento_asignado + provincia_asignado vacía).
  'coordinador regional': 'Coordinador Provincial',
}

// "Distrito Asignado" a veces no es un distrito sino el ámbito completo de un
// coordinador provincial/regional, ej. "Provincia de Contralmirante Villar" o
// "Región Tumbes". Se separa para no guardar eso como si fuera un distrito real.
function parseAsignado(raw) {
  const t = s(raw)
  let m
  if ((m = t.match(/^provincia\s+de\s+(.+)$/i))) return { distrito: null, provincia: m[1].trim(), departamento: null }
  if ((m = t.match(/^regi[oó]n\s+(?:de\s+)?(.+)$/i))) return { distrito: null, provincia: null, departamento: m[1].trim() }
  return { distrito: nn(t), provincia: null, departamento: null }
}
// Alias de distritos mal escritos en el Excel -> nombre canónico (por clave sin acentos/minúsculas)
const DISTRITO_ALIAS = {
  'l victoria': 'La Victoria',
  'vmt': 'Villa María del Triunfo',
  'v.m.t': 'Villa María del Triunfo',
  'vmt.': 'Villa María del Triunfo',
  'ves': 'Villa El Salvador',
  'v.e.s': 'Villa El Salvador',
  'sjl': 'San Juan de Lurigancho',
  's.j.l': 'San Juan de Lurigancho',
  'sjm': 'San Juan de Miraflores',
  's.j.m': 'San Juan de Miraflores',
  'smp': 'San Martín de Porres',
  's.m.p': 'San Martín de Porres',
  'mdp': 'Magdalena del Mar',
  'san isidro reina de lapaz': 'San Isidro',
  'san isidrosan an de miraflores': 'San Isidro', // DNI 08218689: campo corrupto; vota en San Isidro, local "Reina de la paz"
}
const canonDistrito = (d) => {
  const k = noAccent(d)
  if (DISTRITO_ALIAS[k]) return DISTRITO_ALIAS[k]
  return s(d)
}

async function main() {
  console.log(`\n📄 Excel: ${XLSX_PATH}`)
  console.log(`🌐 Supabase: ${SUPABASE_URL}`)
  console.log(DRY_RUN ? '🧪 MODO DRY-RUN (no escribe nada)\n' : '🚀 MODO REAL\n')

  const wb = xlsx.readFile(XLSX_PATH, { cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = xlsx.utils.sheet_to_json(ws, { defval: null, raw: false })
  console.log(`Filas en el Excel: ${raw.length}`)

  // ── DNIs ya existentes en profiles ────────────────────────
  const existentes = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('profiles').select('dni').range(from, from + 999)
    if (error) { console.error('❌ leyendo profiles:', error.message); process.exit(1) }
    for (const r of data) if (r.dni) existentes.add(s(r.dni))
    if (data.length < 1000) break
  }
  console.log(`DNIs ya en la base: ${existentes.size}`)

  // ── Mapa distrito -> {dep, prov} (ubigeo nacional, vista_ubigeo = distinct de `colegios`) ─
  const ubigeo = new Map()
  const porProvincia = new Map() // provincia -> {dep, prov} (para coordinadores con solo "Provincia de X")
  {
    // vista_ubigeo tiene ~1900 filas a nivel nacional: paginar (el límite por
    // defecto del cliente es 1000, si no se trunca silenciosamente).
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('vista_ubigeo')
        .select('departamento, provincia, distrito').range(from, from + 999)
      if (error) { console.error('❌ leyendo vista_ubigeo:', error.message); process.exit(1) }
      for (const r of data) {
        const key = noAccent(r.distrito)
        const prev = ubigeo.get(key)
        // Preferir provincia de Lima (Lima Metropolitana) si hay ambigüedad entre departamentos
        if (!prev || (r.departamento === 'Lima' && r.provincia === 'Lima')) {
          ubigeo.set(key, { dep: r.departamento, prov: r.provincia })
        }
        if (!porProvincia.has(noAccent(r.provincia))) {
          porProvincia.set(noAccent(r.provincia), { dep: r.departamento, prov: r.provincia })
        }
      }
      if (data.length < 1000) break
    }
  }
  const geo = (distrito) => ubigeo.get(noAccent(distrito)) || null
  const geoPorProvincia = (provincia) => porProvincia.get(noAccent(provincia)) || null

  // ── Construir filas nuevas ───────────────────────────────
  const nuevos = []
  const enArchivo = new Set()
  const distSinMatch = new Map()
  let sinDni = 0, dupArchivo = 0, yaExiste = 0, rolRaro = new Set()

  for (const row of raw) {
    const dni = s(row['DNI']).replace(/\D/g, '')
    if (!dni) { sinDni++; continue }
    if (existentes.has(dni)) { yaExiste++; continue }
    if (enArchivo.has(dni)) { dupArchivo++; continue }
    enArchivo.add(dni)

    const nombre = s(row['Nombres y Apellidos'])
    if (!nombre) { sinDni++; continue } // nombre_completo es NOT NULL

    let rol = s(row['Rol a Desempeñar']) || 'Personero de Mesa'
    if (ROL_ALIAS[noAccent(rol)]) rol = ROL_ALIAS[noAccent(rol)]
    if (!ROLES_VALIDOS.has(rol)) rolRaro.add(rol)

    const distVota = nn(row['Distrito donde Vota']) ? canonDistrito(nn(row['Distrito donde Vota'])) : null
    const gVota = distVota ? geo(distVota) : null
    if (distVota && !gVota) distSinMatch.set(distVota, (distSinMatch.get(distVota) || 0) + 1)

    // "Distrito Asignado": puede ser un distrito real, o el ámbito completo de un
    // coordinador provincial/regional ("Provincia de X" / "Región Y").
    const asig = parseAsignado(row['Distrito Asignado'])
    let distAsig = null, depAsig = null, provAsig = null
    if (asig.distrito) {
      distAsig = canonDistrito(asig.distrito)
      const gAsig = geo(distAsig)
      if (!gAsig) distSinMatch.set(distAsig, (distSinMatch.get(distAsig) || 0) + 1)
      depAsig = gAsig?.dep ?? null
      provAsig = gAsig?.prov ?? null
    } else if (asig.provincia) {
      const gProv = geoPorProvincia(asig.provincia)
      if (!gProv) distSinMatch.set(`Provincia de ${asig.provincia}`, (distSinMatch.get(`Provincia de ${asig.provincia}`) || 0) + 1)
      depAsig = gProv?.dep ?? null
      provAsig = gProv?.prov ?? asig.provincia
    } else if (asig.departamento) {
      depAsig = asig.departamento
    }

    const claveExcel = s(row['Clave de Acceso'])
    const clave_acceso = (!claveExcel || /ingreso con dni/i.test(claveExcel)) ? dni : claveExcel

    nuevos.push({
      dni,
      _email: `${dni}@somosperu.com`,
      _password: dni,
      perfil: {
        nombre_completo: nombre,
        dni,
        celular: nn(row['Celular']),
        correo: nn(row['Correo Electrónico']),
        usa_whatsapp: nn(row['Usa WhatsApp en Celular']),
        whatsapp_alterno: nn(row['Número WhatsApp Alterno']),
        departamento_vota: gVota?.dep ?? null,
        provincia_vota: gVota?.prov ?? null,
        distrito_vota: distVota,
        mesa_sufragio: nn(row['Mesa de Sufragio']),
        local_votacion: nn(row['Local de Votación']),
        rol,
        departamento_asignado: depAsig,
        provincia_asignado: provAsig,
        distrito_asignado: distAsig,
        mesa_asignada: nn(row['Mesa Asignada']),
        local_asignado: nn(row['Local de Votación Asignado']),
        tiene_experiencia: boolSi(row['¿Tiene Experiencia?']),
        cuenta_movilidad: boolSi(row['¿Movilidad Propia?']),
        se_compromete: boolSi(row['Compromiso 4 Octubre 2026']),
        videos_vistos: intOr0(row['Videos Vistos (de 2)']),
        pdfs_vistos: intOr0(row['PDFs Leídos (de 2)']),
        quiz_estado: /aprobad/i.test(s(row['Evaluación'])) ? 'Aprobado' : 'Pendiente',
        token_verificacion: nn(row['Código Verificación']),
        clave_acceso,
        credencial_estado: s(row['Estado Credencial']) || 'Pendiente',
        fecha_registro: parseFecha(row['Fecha de Registro']) || undefined,
      },
    })
  }

  console.log(`\n── RESUMEN ──`)
  console.log(`  Nuevos a insertar : ${nuevos.length}`)
  console.log(`  Ya existían       : ${yaExiste}`)
  console.log(`  Sin DNI o sin nombre: ${sinDni}`)
  console.log(`  DNI duplicado en el Excel: ${dupArchivo}`)
  if (rolRaro.size) console.log(`  ⚠️ Roles no reconocidos: ${[...rolRaro].join(' | ')}`)
  if (distSinMatch.size) {
    console.log(`  ⚠️ Distritos sin match en vista_ubigeo (quedan dep/prov en null):`)
    for (const [d, c] of [...distSinMatch].sort((a, b) => b[1] - a[1])) console.log(`       - "${d}"  (${c} fila/s)`)
  }
  console.log(`\n  Muestra (hasta 15) de nuevos:`)
  for (const n of nuevos.slice(0, 15)) {
    console.log(`   ${n.dni}  ${n.perfil.nombre_completo}  [${n.perfil.rol}]  vota:${n.perfil.distrito_vota}/${n.perfil.provincia_vota}  asig:${n.perfil.distrito_asignado || '(sin distrito)'}/${n.perfil.provincia_asignado}/${n.perfil.departamento_asignado}`)
  }

  if (DRY_RUN) { console.log('\n🧪 Dry-run: no se escribió nada.\n'); return }
  if (!nuevos.length) { console.log('\nNada que insertar.\n'); return }

  // ── Mapa email -> id de auth.users (para reusar huérfanos) ─
  const authByEmail = new Map()
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error('❌ listUsers:', error.message); process.exit(1) }
    for (const u of data.users) if (u.email) authByEmail.set(u.email.toLowerCase(), u.id)
    if (data.users.length < 1000) break
  }
  console.log(`\nCuentas de Auth existentes: ${authByEmail.size}`)

  // ── Crear/asegurar cuenta de Auth + juntar filas de profile ─
  const errores = []
  const filasProfile = []
  let creadas = 0, reusadas = 0, procesadas = 0
  for (const n of nuevos) {
    if (procesadas >= LIMIT) break
    procesadas++
    try {
      let id = authByEmail.get(n._email.toLowerCase())
      if (id) {
        await supabase.auth.admin.updateUserById(id, { password: n._password, email_confirm: true })
        reusadas++
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: n._email, password: n._password, email_confirm: true,
          user_metadata: { nombre_completo: n.perfil.nombre_completo },
        })
        if (error) throw error
        id = data.user.id
        creadas++
      }
      filasProfile.push({ id, ...n.perfil })
    } catch (e) {
      errores.push({ dni: n.dni, paso: 'auth', error: e.message || String(e) })
    }
    if (procesadas % 50 === 0) console.log(`  ...${procesadas}/${Math.min(nuevos.length, LIMIT)} cuentas`)
  }
  console.log(`Auth -> creadas: ${creadas}, reusadas: ${reusadas}, fallos: ${errores.length}`)

  // ── Insertar profiles en lotes ───────────────────────────
  let insertadas = 0
  for (let i = 0; i < filasProfile.length; i += 100) {
    const lote = filasProfile.slice(i, i + 100)
    const { error } = await supabase.from('profiles').insert(lote)
    if (!error) { insertadas += lote.length; continue }
    // Reintento fila por fila para aislar el problema
    for (const fila of lote) {
      let { error: e1 } = await supabase.from('profiles').insert(fila)
      if (e1 && /token_verificacion/.test(e1.message)) {
        ;({ error: e1 } = await supabase.from('profiles').insert({ ...fila, token_verificacion: null }))
      }
      if (e1) errores.push({ dni: fila.dni, paso: 'profile', error: e1.message })
      else insertadas++
    }
  }

  console.log(`\n── FIN ──`)
  console.log(`  Profiles insertados: ${insertadas}`)
  console.log(`  Errores: ${errores.length}`)
  if (errores.length) {
    const out = path.resolve('./scripts/importar_padron_errores.json')
    fs.writeFileSync(out, JSON.stringify(errores, null, 2))
    console.log(`  Detalle en: ${out}`)
  }
  console.log()
}

main().catch(e => { console.error(e); process.exit(1) })
