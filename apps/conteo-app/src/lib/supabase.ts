import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

// Candidatos provinciales (Alcaldía Metropolitana de Lima)
export const CANDIDATOS_PROVINCIALES = [
  'Alfredo Reynaga Ramírez (Somos Perú)',
  'Alan Carrasco Bobadilla (APP)',
  'Alberto Fernando Moreno Mejía (Acción Popular)',
  'Adolfo Israel Mattos Piaggio (APRA)',
  'Alexander Von Ehren Campos (Avanza País)',
  'Ahora Nación',
  'Alejandro Ramos Rivera (Partido Morado)',
  'Partido Demócrata Verde',
  'Integridad Democrática',
  'Partido Popular Cristiano',
  'Alianza Regional por el Perú',
  'Partido Cívico Obras',
  'Partido del Buen Gobierno',
  'Partido Patriótico del Perú',
  'NULO',
  'BLANCO',
  'IMPUGNADO',
]

// Función Haversine para distancia GPS
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
