import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('./apps/conteo-web/.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan credenciales de Supabase en apps/conteo-web/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Mapeo canónico de nombres de distritos para normalizar tildes y mayúsculas
const DISTRITOS_CANONICOS = [
  'Ancón','Ate','Barranco','Breña','Carabayllo','Cercado de Lima','Chaclacayo',
  'Chorrillos','Cieneguilla','Comas','El Agustino','Independencia','Jesús María',
  'La Molina','La Victoria','Lince','Los Olivos','Lurigancho-Chosica','Lurín',
  'Magdalena del Mar','Miraflores','Pachacámac','Pucusana','Pueblo Libre','Puente Piedra',
  'Punta Hermosa','Punta Negra','Rímac','San Bartolo','San Borja','San Isidro',
  'San Juan de Lurigancho','San Juan de Miraflores','San Luis','San Martín de Porres','San Miguel',
  'Santa Anita','Santa María del Mar','Santa Rosa','Santiago de Surco','Surquillo','Villa El Salvador',
  'Villa María del Triunfo'
]

function normalizarDistrito(d) {
  if (!d) return null
  const clean = d.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  if (clean === 'LIMA' || clean === 'CERCADO DE LIMA') return 'Cercado de Lima'
  if (clean === 'LURIGANCHO' || clean === 'CHOSICA' || clean === 'LURIGANCHO-CHOSICA') return 'Lurigancho-Chosica'
  if (clean === 'MAGDALENA' || clean === 'MAGDALENA DEL MAR') return 'Magdalena del Mar'
  if (clean === 'VILLA MARIA DEL TRIUNFO') return 'Villa María del Triunfo'
  if (clean === 'SAN JUAN DE LURIGANCHO') return 'San Juan de Lurigancho'
  if (clean === 'SAN JUAN DE MIRAFLORES') return 'San Juan de Miraflores'
  if (clean === 'SAN MARTIN DE PORRES') return 'San Martín de Porres'
  if (clean === 'VILLA EL SALVADOR') return 'Villa El Salvador'
  if (clean === 'SANTIAGO DE SURCO') return 'Santiago de Surco'
  if (clean === 'SANTA MARIA DEL MAR') return 'Santa María del Mar'
  if (clean === 'JESUS MARIA') return 'Jesús María'
  if (clean === 'PUEBLO LIBRE') return 'Pueblo Libre'
  if (clean === 'PUENTE PIEDRA') return 'Puente Piedra'
  if (clean === 'PUNTA HERMOSA') return 'Punta Hermosa'
  if (clean === 'PUNTA NEGRA') return 'Punta Negra'
  if (clean === 'SAN BARTOLO') return 'San Bartolo'
  if (clean === 'SAN BORJA') return 'San Borja'
  if (clean === 'SAN ISIDRO') return 'San Isidro'
  if (clean === 'SAN LUIS') return 'San Luis'
  if (clean === 'SAN MIGUEL') return 'San Miguel'
  if (clean === 'SANTA ANITA') return 'Santa Anita'
  if (clean === 'SANTA ROSA') return 'Santa Rosa'
  if (clean === 'EL AGUSTINO') return 'El Agustino'
  if (clean === 'LA MOLINA') return 'La Molina'
  if (clean === 'LA VICTORIA') return 'La Victoria'
  if (clean === 'LOS OLIVOS') return 'Los Olivos'
  if (clean === 'CHORRILLOS') return 'Chorrillos'
  if (clean === 'CIENEGUILLA') return 'Cieneguilla'
  if (clean === 'CHACLACAYO') return 'Chaclacayo'
  if (clean === 'CARABAYLLO') return 'Carabayllo'
  if (clean === 'BARRANCO') return 'Barranco'
  if (clean === 'ANCON') return 'Ancón'
  if (clean === 'BRENA' || clean === 'BREÑA') return 'Breña'
  if (clean === 'SURQUILLO') return 'Surquillo'
  if (clean === 'LURIN') return 'Lurín'
  if (clean === 'RIMAC') return 'Rímac'
  if (clean === 'LINCE') return 'Lince'
  if (clean === 'COMAS') return 'Comas'
  if (clean === 'PACHACAMAC') return 'Pachacámac'
  if (clean === 'PUCUSANA') return 'Pucusana'
  if (clean === 'ATE') return 'Ate'
  
  return DISTRITOS_CANONICOS.find(x => x.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === clean) || null
}

async function importarExcel() {
  console.log('📖 Leyendo CALI.xlsx...')
  const filePath = path.resolve('../CALI.xlsx')
  const wb = xlsx.readFile(filePath)
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Hoja1'])
  console.log(`📊 Total registros encontrados en Excel: ${rows.length}`)

  // Filtrar Lima Metropolitana
  const limaRows = rows.filter(r => {
    const dpto = (r.DPTO || '').toString().trim().toUpperCase()
    const prov = (r.PROVINCIA || '').toString().trim().toUpperCase()
    return dpto === 'LIMA' && prov === 'LIMA'
  })

  console.log(`🏙️ Locales identificados en Lima Metropolitana: ${limaRows.length}`)

  const colegiosAInsertar = []
  let noMapeados = 0

  for (const r of limaRows) {
    const nombre = (r['NOMBRE DEL LOCAL'] || '').toString().trim()
    const direccion = (r['DIRECCIÓN DEL LOCAL'] || '').toString().trim()
    const rawDistrito = (r['DISTRITO'] || '').toString().trim()
    const distrito = normalizarDistrito(rawDistrito)
    const totalMesas = parseInt(r['MESAS'] || 0, 10)

    if (!distrito) {
      noMapeados++
      continue
    }

    if (nombre) {
      colegiosAInsertar.push({
        nombre,
        distrito,
        direccion,
        total_mesas: totalMesas,
      })
    }
  }

  console.log(`✨ Total colegios listos para registrar: ${colegiosAInsertar.length} (no mapeados: ${noMapeados})`)

  // Inserción en lotes de 200 en Supabase
  const BATCH_SIZE = 200
  let totalInsertados = 0

  for (let i = 0; i < colegiosAInsertar.length; i += BATCH_SIZE) {
    const batch = colegiosAInsertar.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('colegios').insert(batch)
    if (error) {
      console.error(`❌ Error en lote ${i} - ${i + batch.length}:`, error.message)
    } else {
      totalInsertados += batch.length
      console.log(`✅ Insertados ${totalInsertados}/${colegiosAInsertar.length} locales de votación...`)
    }
  }

  console.log('🎉 ¡Carga masiva completada con éxito!')
}

importarExcel().catch(console.error)
