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

// Distritos de Tumbes (13, en sus 3 provincias)
export const DISTRITOS = [
  'Tumbes', 'Corrales', 'La Cruz', 'Pampas de Hospital', 'San Jacinto', 'San Juan de la Virgen',
  'Zorritos', 'Casitas', 'Canoas de Punta Sal',
  'Zarumilla', 'Matapalo', 'Papayal', 'Aguas Verdes',
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
