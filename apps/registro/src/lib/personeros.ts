import { supabase } from './supabase'

// supabase-js devuelve para cualquier respuesta no-2xx el mensaje genérico
// "Edge Function returned a non-2xx status code"; el motivo real (sin permiso,
// otro distrito, error de base de datos…) viene en el cuerpo JSON de la respuesta.
async function motivoReal(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return String(body.error)
  } catch { /* cuerpo no-JSON: se usa el mensaje genérico */ }
  return error?.message ?? 'Error desconocido'
}

// Elimina un personero por completo: su perfil Y su cuenta de Auth (vía la
// Edge Function 'eliminar-personero', que corre con permisos de administrador
// en el servidor). Borrar solo `profiles` deja la cuenta de Auth huérfana y
// bloquea un futuro registro con el mismo DNI ("User already registered").
export async function eliminarPersoneroCompleto(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('eliminar-personero', { body: { id } })
  if (error) return { error: await motivoReal(error) }
  if (data?.error) return { error: data.error }
  return { error: null }
}

// Le pone una contraseña nueva a la cuenta de Auth de un personero (vía la
// Edge Function 'cambiar-password-personero', que corre con permisos de
// administrador en el servidor — el cliente con la clave anon no puede
// cambiar la contraseña de una cuenta ajena).
export async function cambiarPasswordPersonero(id: string, password: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('cambiar-password-personero', { body: { id, password } })
  if (error) return { error: await motivoReal(error) }
  if (data?.error) return { error: data.error }
  return { error: null }
}
