/**
 * Crea el primer Administrador General de una instancia nueva (proyecto
 * Supabase recién bootstrapeado, sin ningún perfil todavía). Crea la cuenta
 * de Auth (con email ya confirmado) y la fila en `profiles`.
 *
 * Uso, desde la raíz del repo:
 *   node scripts/crear_admin.mjs --env scripts/.instancias/.env.arequipa \
 *     --dni 72911110 --nombre "Carlos Valderrama" --password 72911110
 *
 * Requiere SUPABASE_SERVICE_ROLE en el .env indicado (bypassa RLS y permite
 * crear usuarios de Auth directamente).
 */
import { createClient } from '@supabase/supabase-js'
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

async function main() {
  const args = leerArgs()
  const { env: envPath, dni, nombre, password } = args
  if (!envPath || !dni || !nombre || !password) {
    console.error('❌ Uso: node scripts/crear_admin.mjs --env <ruta .env> --dni X --nombre "Y Z" --password W')
    process.exit(1)
  }

  const env = leerEnv(path.resolve(envPath))
  if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    console.error(`❌ Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE en ${envPath}`)
    process.exit(1)
  }
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE)

  const email = `${dni}@somosperu.com`
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { nombre_completo: nombre },
  })
  if (authErr) { console.error('❌ Error creando usuario de Auth:', authErr.message); process.exit(1) }

  const userId = authData.user.id
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    nombre_completo: nombre,
    dni,
    celular: '',
    correo: email,
    rol: 'Administrador General',
    clave_acceso: password,
    credencial_estado: 'Confirmado',
  })
  if (profileErr) { console.error('❌ Error creando perfil:', profileErr.message); process.exit(1) }

  console.log(`🎉 Administrador General creado: ${nombre} (DNI ${dni}), login con ${email} / contraseña ${password}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
