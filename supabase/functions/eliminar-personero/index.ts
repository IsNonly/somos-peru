// ============================================================
// Edge Function — Eliminar personero (perfil + cuenta de Auth)
//
// Contexto: el botón "Eliminar personero" del panel solo borraba la fila de
// `profiles` desde el navegador (con la clave anon, sin permisos de admin).
// Eso dejaba huérfana la cuenta de Supabase Auth (auth.users) de esa persona
// -Auth nunca se entera de que la "eliminamos"-, así que si el mismo DNI
// intentaba registrarse de nuevo, signUp() lo rechazaba con
// "User already registered" aunque su perfil ya no existiera en ningún lado.
//
// Esta función corre en el servidor (Supabase Edge Functions, Deno) con la
// service_role key -la única forma de borrar cuentas de Auth-, que NUNCA debe
// exponerse en el código del navegador. Verifica que quien llama tenga sesión
// válida Y rol con permiso de eliminar (mismo criterio que ya usa el panel en
// el cliente, pero aplicado también acá para no confiar solo en el frontend).
//
// Deploy: Supabase Dashboard > Edge Functions > Deploy new function
// (pegar este archivo como index.ts) — no requiere Supabase CLI.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ROLES_PUEDEN_ELIMINAR = new Set([
  'Administrador General',
  'Coordinador Provincial',
  'Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal', // nombres viejos del mismo rol
])

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Borra la cuenta de Auth de este personero. Intenta primero por el mismo id
// del perfil (cuentas creadas desde el registro web: profiles.id = auth
// users.id), y si no existe con ese id, busca por DNI -las cuentas
// importadas del padrón legado pueden tener ids distintos entre profiles y
// auth.users-.
async function borrarAuth(supabaseUrl: string, serviceKey: string, perfilId: string, dni: string | null) {
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }

  const del1 = await fetch(`${supabaseUrl}/auth/v1/admin/users/${perfilId}`, { method: 'DELETE', headers })
  if (del1.ok) return true
  if (!dni) return false

  const busq = await fetch(`${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(dni)}`, { headers })
  if (!busq.ok) return false
  const data = await busq.json().catch(() => null)
  const encontrado = (data?.users ?? []).find((u: any) => u.email === `${dni}@somosperu.com`)
  if (!encontrado) return false

  const del2 = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encontrado.id}`, { method: 'DELETE', headers })
  return del2.ok
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'No autorizado' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  // Cliente con el token de quien llama, solo para saber quién es.
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Sesión inválida' }, 401)

  // Cliente con permisos de administrador (service role) — nunca sale del servidor.
  const admin = createClient(supabaseUrl, serviceKey)

  // Resolver el perfil de quien llama para validar su rol. Se busca por DNI
  // (parte del email antes de la @) y se cae al id de auth si no aparece —
  // mismo patrón que el resto de la app, porque en cuentas importadas
  // profiles.id no siempre coincide con auth.users.id.
  const dniLlamante = (user.email ?? '').split('@')[0]
  let actor = (await admin.from('profiles').select('rol').eq('dni', dniLlamante).maybeSingle()).data
  if (!actor) actor = (await admin.from('profiles').select('rol').eq('id', user.id).maybeSingle()).data

  if (!actor || !ROLES_PUEDEN_ELIMINAR.has(actor.rol)) {
    return json({ error: 'No tienes permiso para eliminar personeros' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const id = body?.id as string | undefined
  if (!id) return json({ error: 'Falta el id del personero a eliminar' }, 400)

  const objetivo = (await admin.from('profiles').select('id, dni').eq('id', id).maybeSingle()).data

  const { error: delPerfilErr } = await admin.from('profiles').delete().eq('id', id)
  if (delPerfilErr) return json({ error: delPerfilErr.message }, 500)

  const authBorrado = await borrarAuth(supabaseUrl, serviceKey, id, objetivo?.dni ?? null)

  return json({ ok: true, authBorrado })
})
