import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

// Distritos de Tumbes (13, en sus 3 provincias): ámbito por defecto del Administrador.
export const DISTRITOS_TUMBES = [
  'Tumbes', 'Corrales', 'La Cruz', 'Pampas de Hospital', 'San Jacinto', 'San Juan de la Virgen',
  'Zorritos', 'Casitas', 'Canoas de Punta Sal',
  'Zarumilla', 'Matapalo', 'Papayal', 'Aguas Verdes',
]

export const PARTIDO_COLORES: Record<string, string> = {
  'Somos Perú': '#E8534A',
  'Alianza para el Progreso': '#F59E0B',
  'Acción Popular': '#10B981',
  'Partido Aprista Peruano': '#EF4444',
  'Partido Popular Cristiano': '#3B82F6',
  'Avanza País': '#8B5CF6',
  'Ahora Nación': '#06B6D4',
  'Partido Morado': '#7C3AED',
  'Partido Demócrata Verde': '#16A34A',
  'Alianza Regional por el Perú': '#D97706',
  'NULO': '#6B7280',
  'BLANCO': '#9CA3AF',
}

export const colorPartido = (p: string) =>
  PARTIDO_COLORES[p] ?? '#6366F1'
