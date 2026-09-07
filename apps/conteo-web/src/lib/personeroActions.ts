import { supabase } from './supabase'

// Restablece la clave de acceso de un personero de vuelta a su DNI.
// El chequeo de ámbito (que el que llama sea coordinador/admin del personero)
// vive en el RPC (supabase/reset_clave_personero.sql), no aquí.
export async function restablecerClavePersonero(dni: string) {
  const { error } = await supabase.rpc('resetear_clave_personero', { p_dni: dni })
  if (error) throw error
}
