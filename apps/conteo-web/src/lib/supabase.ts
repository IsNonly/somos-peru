import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

export const DISTRITOS_META: Record<string, number> = {
  'Ancón':164,'Ate':1671,'Barranco':149,'Breña':349,'Carabayllo':861,
  'Cercado de Lima':1015,'Chaclacayo':138,'Chorrillos':899,'Cieneguilla':105,
  'Comas':1499,'El Agustino':566,'Independencia':595,'Jesús María':427,
  'La Molina':574,'La Victoria':640,'Lince':290,'Los Olivos':984,
  'Lurigancho-Chosica':550,'Lurín':248,'Magdalena del Mar':256,'Miraflores':478,
  'Pachacámac':319,'Pucusana':44,'Pueblo Libre':337,'Puente Piedra':891,
  'Punta Hermosa':33,'Punta Negra':25,'Rímac':560,'San Bartolo':24,
  'San Borja':422,'San Isidro':282,'San Juan de Lurigancho':2731,
  'San Juan de Miraflores':1115,'San Luis':228,'San Martín de Porres':1786,
  'San Miguel':507,'Santa Anita':631,'Santa María del Mar':6,'Santa Rosa':68,
  'Santiago de Surco':1179,'Surquillo':338,'Villa El Salvador':1171,
  'Villa María del Triunfo':1234,
}

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
