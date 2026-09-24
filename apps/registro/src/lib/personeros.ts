import { supabase } from './supabase'

// Elimina un personero por completo: su perfil Y su cuenta de Auth (vía la
// Edge Function 'eliminar-personero', que corre con permisos de administrador
// en el servidor). Borrar solo `profiles` deja la cuenta de Auth huérfana y
// bloquea un futuro registro con el mismo DNI ("User already registered").
export async function eliminarPersoneroCompleto(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('eliminar-personero', { body: { id } })
  if (error) return { error: error.message }
  if (data?.error) return { error: data.error }
  return { error: null }
}
