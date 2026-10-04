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

// Llama a una Edge Function con la sesión al día. Si el panel estuvo abierto
// mucho tiempo, el token puede haber vencido ("Sesión inválida"): se renueva la
// sesión y se reintenta una vez antes de mostrar el error.
async function invocar(nombre: string, body: Record<string, unknown>) {
  const llamar = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return supabase.functions.invoke(nombre, {
      body,
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    })
  }
  let r = await llamar()
  const motivo = r.error ? await motivoReal(r.error) : (r.data?.error ?? '')
  if (/sesi[oó]n inv[aá]lida|no autorizado|jwt/i.test(String(motivo))) {
    const { error: refErr } = await supabase.auth.refreshSession()
    if (refErr) return { data: null, error: null, motivo: 'Tu sesión venció. Sal del panel y vuelve a iniciar sesión.' }
    r = await llamar()
  } else {
    return { ...r, motivo }
  }
  return { ...r, motivo: r.error ? await motivoReal(r.error) : (r.data?.error ?? '') }
}

// Elimina un personero por completo: su perfil Y su cuenta de Auth (vía la
// Edge Function 'eliminar-personero', que corre con permisos de administrador
// en el servidor). Borrar solo `profiles` deja la cuenta de Auth huérfana y
// bloquea un futuro registro con el mismo DNI ("User already registered").
export async function eliminarPersoneroCompleto(id: string): Promise<{ error: string | null }> {
  const { motivo } = await invocar('eliminar-personero', { id })
  return { error: motivo ? String(motivo) : null }
}

// Le pone una contraseña nueva a la cuenta de Auth de un personero (vía la
// Edge Function 'cambiar-password-personero', que corre con permisos de
// administrador en el servidor — el cliente con la clave anon no puede
// cambiar la contraseña de una cuenta ajena).
export async function cambiarPasswordPersonero(id: string, password: string): Promise<{ error: string | null }> {
  const { motivo } = await invocar('cambiar-password-personero', { id, password })
  return { error: motivo ? String(motivo) : null }
}
