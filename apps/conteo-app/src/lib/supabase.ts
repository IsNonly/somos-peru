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

// Candidatos a Alcaldía Metropolitana de Lima (26 listas oficiales ERM 2026)
export const CANDIDATOS_METROPOLITANA: Candidato[] = [
  { id: 'c_somos_peru',       nombre: 'Carlos Ricardo Bruce Montes de Oca',       partido: 'Somos Perú',                             color: '#e11d48', letra: 'SP'  },
  { id: 'c_renovacion',       nombre: 'Rafael López Aliaga',                      partido: 'Renovación Popular',                     color: '#1d4ed8', letra: 'RP'  },
  { id: 'c_alianza_nacion',   nombre: 'Susel Ana María Paredes Piqué',            partido: 'Ahora Nación',                         color: '#7c3aed', letra: 'AN'  },
  { id: 'c_avancemos',        nombre: 'Francis James Allison Oyague',             partido: 'Avanza País',                         color: '#0891b2', letra: 'AV'  },
  { id: 'c_podemos',          nombre: 'Daniel Belizario Urresti Elera',           partido: 'Podemos Perú',                           color: '#dc2626', letra: 'PP'  },
  { id: 'c_juntos',           nombre: 'Oswaldo Hernán Vargas Cuéllar',            partido: 'Juntos por el Perú',                     color: '#16a34a', letra: 'JP'  },
  { id: 'c_civico',           nombre: 'Ricardo Pablo Belmont Cassinelli',         partido: 'Partido Cívico Obras',                   color: '#b45309', letra: 'PC'  },
  { id: 'c_frepap',           nombre: 'Segundo Valdez Zavala',                    partido: 'FREPAP',                                 color: '#059669', letra: 'FR'  },
  { id: 'c_accion_popular',   nombre: 'Carlos Alberto Tejada Noriega',            partido: 'Acción Popular',                         color: '#d97706', letra: 'AP'  },
  { id: 'c_fe_esperanza',     nombre: 'Elizabeth María del Rosario León Chinchay',partido: 'Frente de la Esperanza 2021',            color: '#65a30d', letra: 'FE'  },
  { id: 'c_venceremos',       nombre: 'Juan Carlos Alvarado Mestanza',            partido: 'Alianza Electoral Venceremos',           color: '#0284c7', letra: 'VE'  },
  { id: 'c_vision',           nombre: 'Santiago Rosendo Abarca León',             partido: 'Visión Perú',                            color: '#4f46e5', letra: 'VP'  },
  { id: 'c_aprista',          nombre: 'Mónica Yadira Yaya Luyo',                  partido: 'Partido Aprista Peruano',                color: '#b91c1c', letra: 'PA'  },
  { id: 'c_fuerza_popular',   nombre: 'Samuel Marcos Daza Taype',                 partido: 'Fuerza Popular',                         color: '#f59e0b', letra: 'FP'  },
  { id: 'c_ppc',              nombre: 'Edgardo Renán de Pomar Vizcarra',          partido: 'Partido Popular Cristiano (PPC)',        color: '#1e40af', letra: 'PPC' },
  { id: 'c_progresemos',      nombre: 'Luis Miguel Llanos Carrillo',              partido: 'Progresemos',                            color: '#047857', letra: 'PRG' },
  { id: 'c_morado',           nombre: 'Victoria Betzabé La Cruz Garcés',          partido: 'Partido Morado',                         color: '#7c3aed', letra: 'PM'  },
  { id: 'c_buen_gobierno',    nombre: 'Carlos Francisco Gallardo Neyra',          partido: 'Partido del Buen Gobierno',              color: '#0369a1', letra: 'BG'  },
  { id: 'c_dem_verde',        nombre: 'Flor de María Hurtado Valdez',             partido: 'Partido Demócrata Verde',                color: '#15803d', letra: 'DV'  },
  { id: 'c_peru_libre',       nombre: 'Rubén José Ramírez Mateo',                 partido: 'Perú Libre',                             color: '#ca8a04', letra: 'PL'  },
  { id: 'c_tierra_verde',     nombre: 'Yehude Simon Munaro',                      partido: 'Coalición Transformadora Tierra Verde',  color: '#16a34a', letra: 'TV'  },
  { id: 'c_contigo',          nombre: 'Luis Alberto Huette Tolentino',            partido: 'Pueblo Consciente',                        color: '#6d28d9', letra: 'CT'  },
  { id: 'c_patriotico',       nombre: 'Sandro Caller Gutiérrez',                  partido: 'Partido Patriótico del Perú',            color: '#1e3a8a', letra: 'PTR' },
  { id: 'c_integracion',      nombre: 'Jessica Viviana Linares Romero',           partido: 'Integridad Democrática',                color: '#0f766e', letra: 'ID'  },
  { id: 'c_fuerza_ciudadana', nombre: 'Rubén Daniel Bonilla Espinoza',            partido: 'Fuerza Ciudadana',                       color: '#ea580c', letra: 'FC'  },
  { id: 'c_batuta',           nombre: 'Samir Frank Quispe Caballero',             partido: 'Batalla Perú',                            color: '#0891b2', letra: 'BAT' },
]

// Candidatos a Alcaldía Distrital, por distrito. "default" se usa mientras no
// se cargue la lista real del distrito asignado al personero.
export const CANDIDATOS_DISTRITALES: Record<string, Candidato[]> = {
  'La Victoria': [
    { id: 'd01', nombre: 'Alberto Fernando Moreno Mejía',      partido: 'Somos Perú',                  color: '#e11d48', letra: 'SP'  },
    { id: 'd02', nombre: 'Aldo Horacio Rosales Pacheco',       partido: 'Política Perú Primero',       color: '#0284c7', letra: 'PPP' },
    { id: 'd03', nombre: 'Alejandro Nilo Pérez Moreno',        partido: 'Partido Cívico Obras',        color: '#b45309', letra: 'PC'  },
    { id: 'd04', nombre: 'César Rafael Ibarra Nureña',         partido: 'Partido Popular Cristiano (PPC)', color: '#1e40af', letra: 'PPC' },
    { id: 'd05', nombre: 'Florencio Frailán Fierro Flores',    partido: 'Partido País para Todos',     color: '#7c3aed', letra: 'PAI' },
    { id: 'd06', nombre: 'Joaquín Reynaldo Albarracín Ramos',  partido: 'Alianza para el Progreso',    color: '#16a34a', letra: 'APP' },
    { id: 'd07', nombre: 'Joe Zanobria Soberón',                partido: 'Avanza País',                 color: '#0891b2', letra: 'AVP' },
    { id: 'd08', nombre: 'Luis Álvaro Pletikosic Guzmán',      partido: 'Acción Popular',               color: '#d97706', letra: 'AP'  },
    { id: 'd09', nombre: 'María Teresa Rosas García',          partido: 'Frente de la Esperanza 2021', color: '#65a30d', letra: 'FE'  },
    { id: 'd10', nombre: 'Mesías Máximo Gonzales Sánchez',     partido: 'Podemos Perú',                 color: '#dc2626', letra: 'PP'  },
    { id: 'd11', nombre: 'Nilda Esperanza Carranza Rodríguez', partido: 'Ahora Nación',                 color: '#ca8a04', letra: 'AN'  },
    { id: 'd12', nombre: 'Susana Liliana Saldaña Ramos',       partido: 'Renovación Popular',           color: '#1d4ed8', letra: 'RP'  },
    { id: 'd13', nombre: 'Walter Ciro Pérez Noreña',           partido: 'Batalla Perú',                  color: '#0f766e', letra: 'BAT' },
    // Sin data real confirmada aún — se muestra solo el partido, sin nombre inventado
    { id: 'd14', nombre: '', partido: 'Fuerza Popular',            color: '#f59e0b', letra: 'FP'  },
    { id: 'd15', nombre: '', partido: 'Juntos por el Perú',        color: '#15803d', letra: 'JP'  },
    { id: 'd16', nombre: '', partido: 'FREPAP',                    color: '#059669', letra: 'FR'  },
    { id: 'd17', nombre: '', partido: 'Partido Morado',            color: '#7c3aed', letra: 'PM'  },
    { id: 'd18', nombre: '', partido: 'Partido Aprista Peruano',   color: '#b91c1c', letra: 'PA'  },
    { id: 'd19', nombre: '', partido: 'Partido Político PRIN',     color: '#374151', letra: 'PRI' },
    { id: 'd20', nombre: '', partido: 'Partido del Buen Gobierno', color: '#0369a1', letra: 'BG'  },
    { id: 'd21', nombre: '', partido: 'Partido Demócrata Verde',   color: '#15803d', letra: 'DV'  },
    { id: 'd22', nombre: '', partido: 'Perú Libre',                color: '#ca8a04', letra: 'PL'  },
    { id: 'd23', nombre: '', partido: 'Perú Moderno',              color: '#1d4ed8', letra: 'PM'  },
    { id: 'd24', nombre: '', partido: 'Libertad Popular',          color: '#6d28d9', letra: 'LIB' },
    { id: 'd25', nombre: '', partido: 'Progresemos',               color: '#047857', letra: 'PRG' },
    { id: 'd26', nombre: '', partido: 'Visión Perú',                color: '#4f46e5', letra: 'VP'  },
  ],
  // Distritos sin data real cargada aún: se listan todos los partidos habilitados,
  // solo con el nombre del partido (sin nombre de candidato inventado). Cuando el
  // JNE/ONPE publique los candidatos por distrito se agrega un bloque propio arriba.
  default: [
    { id: 'd01', nombre: '', partido: 'Somos Perú',                 color: '#e11d48', letra: 'SP'  },
    { id: 'd02', nombre: '', partido: 'Política Perú Primero',      color: '#0284c7', letra: 'PPP' },
    { id: 'd03', nombre: '', partido: 'Partido Cívico Obras',       color: '#b45309', letra: 'PC'  },
    { id: 'd04', nombre: '', partido: 'Partido Popular Cristiano (PPC)', color: '#1e40af', letra: 'PPC' },
    { id: 'd05', nombre: '', partido: 'Partido País para Todos',    color: '#7c3aed', letra: 'PAI' },
    { id: 'd06', nombre: '', partido: 'Alianza para el Progreso',   color: '#16a34a', letra: 'APP' },
    { id: 'd07', nombre: '', partido: 'Avanza País',                color: '#0891b2', letra: 'AVP' },
    { id: 'd08', nombre: '', partido: 'Acción Popular',             color: '#d97706', letra: 'AP'  },
    { id: 'd09', nombre: '', partido: 'Frente de la Esperanza 2021',color: '#65a30d', letra: 'FE'  },
    { id: 'd10', nombre: '', partido: 'Podemos Perú',               color: '#dc2626', letra: 'PP'  },
    { id: 'd11', nombre: '', partido: 'Ahora Nación',               color: '#ca8a04', letra: 'AN'  },
    { id: 'd12', nombre: '', partido: 'Renovación Popular',         color: '#1d4ed8', letra: 'RP'  },
    { id: 'd13', nombre: '', partido: 'Batalla Perú',               color: '#0f766e', letra: 'BAT' },
    { id: 'd14', nombre: '', partido: 'Fuerza Popular',             color: '#f59e0b', letra: 'FP'  },
    { id: 'd15', nombre: '', partido: 'Juntos por el Perú',         color: '#15803d', letra: 'JP'  },
    { id: 'd16', nombre: '', partido: 'FREPAP',                     color: '#059669', letra: 'FR'  },
    { id: 'd17', nombre: '', partido: 'Partido Morado',             color: '#7c3aed', letra: 'PM'  },
    { id: 'd18', nombre: '', partido: 'Partido Aprista Peruano',    color: '#b91c1c', letra: 'PA'  },
    { id: 'd19', nombre: '', partido: 'Partido Político PRIN',      color: '#374151', letra: 'PRI' },
    { id: 'd20', nombre: '', partido: 'Partido del Buen Gobierno',  color: '#0369a1', letra: 'BG'  },
    { id: 'd21', nombre: '', partido: 'Partido Demócrata Verde',    color: '#15803d', letra: 'DV'  },
    { id: 'd22', nombre: '', partido: 'Perú Libre',                 color: '#ca8a04', letra: 'PL'  },
    { id: 'd23', nombre: '', partido: 'Perú Moderno',               color: '#1d4ed8', letra: 'PMO' },
    { id: 'd24', nombre: '', partido: 'Libertad Popular',           color: '#6d28d9', letra: 'LIB' },
    { id: 'd25', nombre: '', partido: 'Progresemos',                color: '#047857', letra: 'PRG' },
    { id: 'd26', nombre: '', partido: 'Visión Perú',                color: '#4f46e5', letra: 'VP'  },
  ],
}

export function getCandidatosDistrital(distrito?: string | null): Candidato[] {
  return (distrito && CANDIDATOS_DISTRITALES[distrito]) || CANDIDATOS_DISTRITALES.default
}

// Votos especiales aplicables a ambos niveles (metropolitano y distrital)
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
