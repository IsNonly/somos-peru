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

// Ámbito operado por esta instancia (una por distrito — Cercado de Lima y Villa El
// Salvador son 2 instancias separadas, cada una con su propia base Supabase y sus
// propias env vars). Default de este deploy = Cercado de Lima (ubigeo: distrito "Lima").
export const AMBITO_DEPARTAMENTO = (import.meta.env.VITE_AMBITO_DEPARTAMENTO as string) || 'Lima'
export const AMBITO_PROVINCIAS = ((import.meta.env.VITE_AMBITO_PROVINCIAS as string) || 'Lima')
  .split(',').map(s => s.trim()).filter(Boolean)
export const AMBITO_DISTRITOS = ((import.meta.env.VITE_AMBITO_DISTRITOS as string) ||
  'Lima')
  .split(',').map(s => s.trim()).filter(Boolean)
export const AMBITO_TOKEN_PREFIX = (import.meta.env.VITE_AMBITO_TOKEN_PREFIX as string) || 'CDL2026'

export const ROLES: Rol[] = [
  'Administrador General',
  'Coordinador Regional',
  'Coordinador Distrital',
  'Coordinador Provincial',
  'Personero de Mesa',
  'Personero de Centro de Votación',
]

// Genera token SP-{prefijo del ámbito}-{DNI}
export const generarToken = (dni: string) => `SP-${AMBITO_TOKEN_PREFIX}-${dni}`

// Genera clave acceso tipo SP + 4 dígitos aleatorios
export const generarClave = () => `SP${Math.floor(1000 + Math.random() * 9000)}`

// Clave de acceso numérica de 6 dígitos (contraseña real de login para roles
// que no son Personero de Mesa; ver RegisterPage.tsx). Antes eran 4 dígitos,
// pero Supabase Auth exige contraseñas de mínimo 6 caracteres y el signUp
// fallaba silenciosamente para estos roles.
export const generarClave4 = () => String(Math.floor(100000 + Math.random() * 900000))
