// ============================================================
// Edge Function — Cambiar contraseña de un personero
//
// Contexto: un coordinador/admin necesita poder ponerle una contraseña nueva
// a un personero (ej. si se le olvidó, o para dársela ya definida de una vez).
// El cliente (con la clave anon) NO puede cambiar la contraseña de OTRA
// cuenta -solo la propia-, así que esto corre en el servidor con la
// service_role key -la única forma de tocar contraseñas ajenas-, que NUNCA
// debe exponerse en el código del navegador.
//
// Deploy: Supabase Dashboard > Edge Functions > Deploy new function
// (pegar este archivo como index.ts) — no requiere Supabase CLI.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ROLES_PUEDEN_CAMBIAR = new Set([
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

// Resuelve el id de Auth de este personero. Intenta primero por el mismo id
// del perfil (cuentas creadas desde el registro web: profiles.id = auth
// users.id), y si no existe con ese id, busca por DNI -las cuentas
// importadas del padrón legado pueden tener ids distintos entre profiles y
// auth.users-.
async function resolverAuthId(supabaseUrl: string, serviceKey: string, perfilId: string, dni: string | null) {
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }

  const directo = await fetch(`${supabaseUrl}/auth/v1/admin/users/${perfilId}`, { headers })
  if (directo.ok) return perfilId
  if (!dni) return null

  const busq = await fetch(`${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(dni)}`, { headers })
  if (!busq.ok) return null
  const data = await busq.json().catch(() => null)
  const encontrado = (data?.users ?? []).find((u: any) => u.email === `${dni}@somosperu.com`)
  return encontrado?.id ?? null
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

  // Resolver el perfil de quien llama para validar su rol.
  const dniLlamante = (user.email ?? '').split('@')[0]
  let actor = (await admin.from('profiles').select('rol').eq('dni', dniLlamante).maybeSingle()).data
  if (!actor) actor = (await admin.from('profiles').select('rol').eq('id', user.id).maybeSingle()).data

  if (!actor || !ROLES_PUEDEN_CAMBIAR.has(actor.rol)) {
    return json({ error: 'No tienes permiso para cambiar contraseñas' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const id = body?.id as string | undefined
  const password = body?.password as string | undefined
  if (!id) return json({ error: 'Falta el id del personero' }, 400)
  if (!password || password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)

  const objetivo = (await admin.from('profiles').select('id, dni').eq('id', id).maybeSingle()).data
  if (!objetivo) return json({ error: 'No se encontró ese personero' }, 404)

  const authId = await resolverAuthId(supabaseUrl, serviceKey, id, objetivo.dni ?? null)
  if (!authId) return json({ error: 'Este personero no tiene una cuenta de acceso activa' }, 404)

  const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!resp.ok) {
    const detalle = await resp.json().catch(() => null)
    return json({ error: detalle?.msg ?? detalle?.message ?? 'No se pudo cambiar la contraseña' }, 500)
  }

  return json({ ok: true })
})
