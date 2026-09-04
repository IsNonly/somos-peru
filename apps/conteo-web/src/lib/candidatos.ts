// Candidatos a la Alcaldía Metropolitana de Lima (26 listas ERM 2026).
// Copia sincronizada con apps/conteo-app/src/lib/supabase.ts
export interface Candidato {
  id: string
  nombre: string
  partido: string
  color: string
  letra: string
}

export const CANDIDATOS_METROPOLITANA: Candidato[] = [
  { id: 'c_somos_peru',       nombre: 'Carlos Ricardo Bruce Montes de Oca',        partido: 'Somos Perú',                            color: '#e11d48', letra: 'SP'  },
  { id: 'c_renovacion',       nombre: 'Rafael López Aliaga',                       partido: 'Renovación Popular',                    color: '#1d4ed8', letra: 'RP'  },
  { id: 'c_alianza_nacion',   nombre: 'Susel Ana María Paredes Piqué',             partido: 'Ahora Nación',                          color: '#7c3aed', letra: 'AN'  },
  { id: 'c_avancemos',        nombre: 'Francis James Allison Oyague',              partido: 'Avanza País',                           color: '#0891b2', letra: 'AV'  },
  { id: 'c_podemos',          nombre: 'Daniel Belizario Urresti Elera',            partido: 'Podemos Perú',                          color: '#dc2626', letra: 'PP'  },
  { id: 'c_juntos',           nombre: 'Oswaldo Hernán Vargas Cuéllar',             partido: 'Juntos por el Perú',                    color: '#16a34a', letra: 'JP'  },
  { id: 'c_civico',           nombre: 'Ricardo Pablo Belmont Cassinelli',          partido: 'Partido Cívico Obras',                  color: '#b45309', letra: 'PC'  },
  { id: 'c_frepap',           nombre: 'Segundo Valdez Zavala',                     partido: 'FREPAP',                                color: '#059669', letra: 'FR'  },
  { id: 'c_accion_popular',   nombre: 'Carlos Alberto Tejada Noriega',             partido: 'Acción Popular',                        color: '#d97706', letra: 'AP'  },
  { id: 'c_fe_esperanza',     nombre: 'Elizabeth María del Rosario León Chinchay', partido: 'Frente de la Esperanza 2021',           color: '#65a30d', letra: 'FE'  },
  { id: 'c_venceremos',       nombre: 'Juan Carlos Alvarado Mestanza',             partido: 'Alianza Electoral Venceremos',          color: '#0284c7', letra: 'VE'  },
  { id: 'c_vision',           nombre: 'Santiago Rosendo Abarca León',              partido: 'Visión Perú',                           color: '#4f46e5', letra: 'VP'  },
  { id: 'c_aprista',          nombre: 'Mónica Yadira Yaya Luyo',                   partido: 'Partido Aprista Peruano',               color: '#b91c1c', letra: 'PA'  },
  { id: 'c_fuerza_popular',   nombre: 'Samuel Marcos Daza Taype',                  partido: 'Fuerza Popular',                        color: '#f59e0b', letra: 'FP'  },
  { id: 'c_ppc',              nombre: 'Edgardo Renán de Pomar Vizcarra',           partido: 'Partido Popular Cristiano (PPC)',       color: '#1e40af', letra: 'PPC' },
  { id: 'c_progresemos',      nombre: 'Luis Miguel Llanos Carrillo',               partido: 'Progresemos',                           color: '#047857', letra: 'PRG' },
  { id: 'c_morado',           nombre: 'Victoria Betzabé La Cruz Garcés',           partido: 'Partido Morado',                        color: '#7c3aed', letra: 'PM'  },
  { id: 'c_buen_gobierno',    nombre: 'Carlos Francisco Gallardo Neyra',           partido: 'Partido del Buen Gobierno',             color: '#0369a1', letra: 'BG'  },
  { id: 'c_dem_verde',        nombre: 'Flor de María Hurtado Valdez',              partido: 'Partido Demócrata Verde',               color: '#15803d', letra: 'DV'  },
  { id: 'c_peru_libre',       nombre: 'Rubén José Ramírez Mateo',                  partido: 'Perú Libre',                            color: '#ca8a04', letra: 'PL'  },
  { id: 'c_tierra_verde',     nombre: 'Yehude Simon Munaro',                       partido: 'Coalición Transformadora Tierra Verde', color: '#16a34a', letra: 'TV'  },
  { id: 'c_contigo',          nombre: 'Luis Alberto Huette Tolentino',             partido: 'Pueblo Consciente',                     color: '#6d28d9', letra: 'CT'  },
  { id: 'c_patriotico',       nombre: 'Sandro Caller Gutiérrez',                   partido: 'Partido Patriótico del Perú',           color: '#1e3a8a', letra: 'PTR' },
  { id: 'c_integracion',      nombre: 'Jessica Viviana Linares Romero',            partido: 'Integridad Democrática',                color: '#0f766e', letra: 'ID'  },
  { id: 'c_fuerza_ciudadana', nombre: 'Rubén Daniel Bonilla Espinoza',             partido: 'Fuerza Ciudadana',                      color: '#ea580c', letra: 'FC'  },
  { id: 'c_batuta',           nombre: 'Samir Frank Quispe Caballero',              partido: 'Batalla Perú',                          color: '#0891b2', letra: 'BAT' },
]

export const VOTOS_ESPECIALES = [
  { partido: 'NULO',      color: '#94a3b8' },
  { partido: 'BLANCO',    color: '#cbd5e1' },
  { partido: 'IMPUGNADO', color: '#f97316' },
]

// Ruta al logo del partido en /public/partidos/<slug>.png (fallback: badge de iniciales)
export function slugPartido(partido: string): string {
  return partido
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
