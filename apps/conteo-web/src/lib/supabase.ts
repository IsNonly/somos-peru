import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

// Ámbito operado por esta instancia (una por distrito — Cercado de Lima y Villa El
// Salvador son 2 instancias separadas, cada una con su propia base Supabase y sus
// propias env vars). Default de este deploy = Cercado de Lima (ubigeo: distrito "Lima").
export const AMBITO_DEPARTAMENTO = (import.meta.env.VITE_AMBITO_DEPARTAMENTO as string) || 'Lima'
export const AMBITO_PROVINCIAS = ((import.meta.env.VITE_AMBITO_PROVINCIAS as string) || 'Lima')
  .split(',').map(s => s.trim()).filter(Boolean)
// Distrito del ámbito (Lima = Cercado de Lima, por defecto): ámbito por defecto del Administrador.
export const AMBITO_DISTRITOS = ((import.meta.env.VITE_AMBITO_DISTRITOS as string) ||
  'Lima')
  .split(',').map(s => s.trim()).filter(Boolean)

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
