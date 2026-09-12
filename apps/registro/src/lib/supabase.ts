import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Rol =
  | 'Administrador General'
  | 'Coordinador Regional'
  | 'Coordinador Distrital'
  | 'Coordinador Provincial'
  | 'Personero de Mesa'
  | 'Personero de Centro de Votación'

export interface Profile {
  id: string
  nombre_completo: string
  dni: string
  celular: string
  correo?: string
  usa_whatsapp?: string
  whatsapp_alterno?: string
  distrito_vota?: string
  mesa_sufragio?: string
  local_votacion?: string
  rol: Rol
  distrito_asignado?: string
  mesa_asignada?: string
  local_asignado?: string
  tiene_experiencia: boolean
  cuenta_movilidad: boolean
  se_compromete: boolean
  videos_vistos: number
  pdfs_vistos: number
  quiz_estado: string
  token_verificacion?: string
  clave_acceso?: string
  credencial_estado: string
  acta_transmitida: boolean
  fecha_registro: string
}

export const DISTRITOS = [
  'Ancón','Ate','Barranco','Breña','Carabayllo','Cercado de Lima',
  'Chaclacayo','Chorrillos','Cieneguilla','Comas','El Agustino',
  'Independencia','Jesús María','La Molina','La Victoria','Lince',
  'Los Olivos','Lurigancho-Chosica','Lurín','Magdalena del Mar',
  'Miraflores','Pachacámac','Pucusana','Pueblo Libre','Puente Piedra',
  'Punta Hermosa','Punta Negra','Rímac','San Bartolo','San Borja',
  'San Isidro','San Juan de Lurigancho','San Juan de Miraflores',
  'San Luis','San Martín de Porres','San Miguel','Santa Anita',
  'Santa María del Mar','Santa Rosa','Santiago de Surco','Surquillo',
  'Villa El Salvador','Villa María del Triunfo',
]

export const ROLES: Rol[] = [
  'Administrador General',
  'Coordinador Regional',
  'Coordinador Distrital',
  'Coordinador Provincial',
  'Personero de Mesa',
  'Personero de Centro de Votación',
]

// Genera token SP-LM2026-{DNI}
export const generarToken = (dni: string) => `SP-LM2026-${dni}`

// Genera clave acceso tipo SP + 4 dígitos aleatorios
export const generarClave = () => `SP${Math.floor(1000 + Math.random() * 9000)}`

// Clave de acceso numérica de 4 dígitos (contraseña real de login para roles
// que no son Personero de Mesa; ver RegisterPage.tsx)
export const generarClave4 = () => String(Math.floor(1000 + Math.random() * 9000))
