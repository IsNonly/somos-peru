import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

// Devuelve el perfil del usuario logueado. Resuelve por DNI (parte antes del @
// del email de login) porque en la base importada `profiles.id` no siempre
// coincide con `auth.users.id`; cae a búsqueda por id como respaldo.
export async function getMiPerfil<T = any>(cols = '*'): Promise<T | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const dni = (user.email ?? '').split('@')[0]
  let { data } = await supabase.from('profiles').select(cols).eq('dni', dni).maybeSingle()
  if (!data) {
    const r = await supabase.from('profiles').select(cols).eq('id', user.id).maybeSingle()
    data = r.data
  }
  return (data as T) ?? null
}

export interface Candidato {
  id: string
  nombre: string
  partido: string
  color: string
  letra: string
}

// Las listas de candidatos ya NO se hardcodean aquí: viven en la tabla
// `candidaturas` de Supabase y se cargan por ámbito en ./candidaturas.ts
// (getCandidaturas). Ver supabase/candidaturas_multinivel.sql.

// Votos especiales aplicables a los 3 niveles (regional / provincial / distrital)
export const VOTOS_ESPECIALES: Candidato[] = [
  { id: 'nulos',      nombre: 'Votos Nulos',     partido: 'NULO',      color: '#ef4444', letra: 'NULO'   },
  { id: 'blancos',    nombre: 'Votos en Blanco', partido: 'BLANCO',    color: '#94a3b8', letra: 'BLANCO' },
  { id: 'impugnados', nombre: 'Votos Impugnados',partido: 'IMPUGNADO', color: '#f97316', letra: 'IMP'    },
]

// Función Haversine para distancia GPS
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
