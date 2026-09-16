/**
 * Corre, en orden, el set de migraciones SQL necesario para dejar un proyecto
 * Supabase NUEVO (vacío) listo para operar una instancia de Somos Perú
 * (una por provincia/distrito — ver DEPLOY.md).
 *
 * No sirve para "poner al día" el proyecto de Tumbes ya existente: ese ya
 * corrió estas migraciones una por una a lo largo del tiempo. Es solo para
 * el primer bootstrap de un proyecto Supabase en blanco.
 *
 * Uso, desde la raíz del repo:
 *   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/bootstrap_db.mjs
 *
 * DATABASE_URL sale de Supabase > Project Settings > Database > Connection string (URI).
 */
import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

// Orden correcto para un proyecto vacío. Se excluyen a propósito:
// - seed_candidaturas.sql / seed_candidaturas_tumbes.sql (datos reales de Lima/Tumbes)
// - backfill_ambito_coordinadores.sql (solo corrige filas de un padrón importado que no existe aquí)
// - seed_candidaturas_cali.sql (se corre aparte, después de importar `colegios`)
const ARCHIVOS = [
  'schema.sql',
  'migracion_ubigeo_nacional.sql',
  'migracion_personero_local.sql',
  'renombrar_personero_centro_votacion.sql',
  'renombrar_coordinador_distrital.sql',
  'fix_colegios_rls.sql',
  'fix_profiles_rls.sql',
  'rls_seguridad.sql',
  'candidaturas_multinivel.sql',
  'foto_instalacion_mesa.sql',
  'auditoria_edicion_perfiles.sql',
  'reset_clave_personero.sql',
]

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ Falta DATABASE_URL (connection string de Postgres del proyecto Supabase nuevo).')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('🔌 Conectado.')

  try {
    for (const archivo of ARCHIVOS) {
      const filePath = path.resolve('supabase', archivo)
      const sql = fs.readFileSync(filePath, 'utf8')
      process.stdout.write(`▶️  ${archivo} ... `)
      await client.query(sql)
      console.log('✅')
    }
    console.log('🎉 Bootstrap completo. Siguiente paso: importar `colegios` del distrito (scripts/importar_cali_ambito.mjs) y luego correr supabase/seed_candidaturas_cali.sql.')
  } catch (e) {
    console.error(`\n❌ Falló en la migración anterior:`, e.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
