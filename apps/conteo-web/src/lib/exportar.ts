import * as XLSX from 'xlsx'
import { supabase, AMBITO_DISTRITOS } from './supabase'

// Excel del botón "Exportar" de la cabecera: una fila por personero / coordinador
// del ámbito, con su centro de votación, mesa designada, asistencia y si ya
// transmitió su acta (Manual o Imagen). Respeta el distrito y el centro de
// votación elegidos en la barra de filtros.
export async function exportarPersoneros(distritos: string[] | null, colegio: string) {
  const PAGINA = 1000
  const perfiles: any[] = []
  for (let desde = 0; ; desde += PAGINA) {
    let q = supabase.from('profiles')
      .select('id, nombre_completo, dni, celular, rol, distrito_asignado, local_asignado, local_votacion, mesa_asignada, asistencia_local_at, credencial_estado')
      .or('rol.ilike.Personero%,rol.ilike.Coordinador%')
      .order('nombre_completo').range(desde, desde + PAGINA - 1)
    q = q.in('distrito_asignado', distritos ?? AMBITO_DISTRITOS)
    const { data, error } = await q
    if (error) throw error
    perfiles.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }

  const { data: actas } = await supabase.from('actas').select('personero_id, personero_dni, metodo, estado')
  // Mismo criterio que la página de Personeros: acta transmitida, por id o por DNI.
  const envio = new Map<string, string>()
  for (const a of (actas ?? []) as any[]) {
    if (a.estado && a.estado !== 'TRANSMITIDA') continue
    const metodo = String(a.metodo).toUpperCase() === 'IMAGEN' ? 'Imagen' : 'Manual'
    for (const k of [a.personero_id, a.personero_dni].filter(Boolean)) envio.set(k, metodo)
  }

  const centroDe = (p: any) => (p.local_asignado || p.local_votacion || '').trim()
  const filas = perfiles
    .filter(p => !colegio || centroDe(p) === colegio)
    .sort((a, b) => centroDe(a).localeCompare(centroDe(b), 'es') || String(a.mesa_asignada ?? '').localeCompare(String(b.mesa_asignada ?? '')))
    .map(p => ({
      'Centro de Votación': centroDe(p),
      'Mesa Designada': p.mesa_asignada ?? '',
      Nombre: p.nombre_completo,
      DNI: p.dni ?? '',
      Celular: p.celular ?? '',
      Rol: p.rol,
      Distrito: p.distrito_asignado ?? '',
      Asistencia: p.asistencia_local_at
        ? new Date(p.asistencia_local_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })
        : 'Sin marcar',
      'Acta enviada': envio.get(p.id) || (p.dni && envio.get(p.dni)) || 'Sin envío',
      Credencial: p.credencial_estado ?? 'Pendiente',
    }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Personeros')
  const ambito = (distritos?.length === 1 ? distritos[0] : AMBITO_DISTRITOS.join('_')).replace(/\s+/g, '_')
  XLSX.writeFile(wb, `Personeros_${ambito}_${new Date().toISOString().split('T')[0]}.xlsx`)
}
