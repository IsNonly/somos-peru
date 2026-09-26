import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import ConteoPage from './pages/ConteoPage'
import HistorialPage from './pages/HistorialPage'
import GateCapacitacion, { type Pasos } from './components/GateCapacitacion'
import PersoneroLocalPage from './pages/PersoneroLocalPage'
import IrAlPanel from './components/IrAlPanel'
import type { User } from '@supabase/supabase-js'

// "Personero de Centro de Votación" es el nombre oficial actual del rol.
// "Personero de Local de Votación" y "Coordinador de Local" son nombres
// viejos; se mantienen por si la migración de BD aún no corrió.
const ROLES_LOCAL = ['Personero de Centro de Votación', 'Personero de Local de Votación', 'Coordinador de Local']
// Roles que ven el panel de supervisión (no cuentan votos).
// "Coordinador Distrital" tiene 2 nombres viejos guardados en la base
// (ver apps/registro/src/lib/panel.ts rolNorm): "Coordinador de Distritos" y "Coordinador Zonal".
const ROLES_COORD = [
  'Coordinador Provincial', 'Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal',
  'Administrador General',
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<any>(null)
  const [perfilLoading, setPerfilLoading] = useState(false)
  // El PCV puede abrir el conteo de uno de sus personeros de mesa desde su propio
  // panel (PersoneroLocalPage) para registrar el acta en su nombre.
  const [asistidoId, setAsistidoId] = useState<string | null>(null)

  useEffect(() => {
    // Supabase dispara onAuthStateChange no solo en login/logout, sino
    // también en cada refresco silencioso de token (típicamente al volver a
    // una pestaña en segundo plano). Como el efecto de abajo que carga el
    // perfil depende de `user`, actualizarlo en cada refresco reactivaba ese
    // efecto y tapaba la pantalla con el spinner -perdiendo un conteo en
    // progreso- aunque siguiera siendo el mismo usuario. Por eso solo
    // tocamos `user` cuando el id realmente cambia.
    let userIdAnterior: string | null = null

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      userIdAnterior = u?.id ?? null
      setUser(u)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      const u = s?.user ?? null
      const cambio = (u?.id ?? null) !== userIdAnterior
      userIdAnterior = u?.id ?? null
      if (event === 'SIGNED_OUT') {
        try { sessionStorage.removeItem('conteo_intro_ok') } catch { /* modo privado */ }
        setAsistidoId(null)
      }
      if (cambio) setUser(u)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Cargar el perfil para verificar que completó la capacitación antes de entrar.
  // Se resuelve por DNI: en la base importada profiles.id no siempre = auth.users.id.
  useEffect(() => {
    if (!user) { setPerfil(null); return }
    let vivo = true
    setPerfilLoading(true)
    const dni = (user.email ?? '').split('@')[0]
    const cols = 'rol, nombre_completo, videos_vistos, pdfs_vistos, quiz_estado, credencial_estado'
    ;(async () => {
      let { data } = await supabase.from('profiles').select(cols).eq('dni', dni).maybeSingle()
      if (!data) {
        const r = await supabase.from('profiles').select(cols).eq('id', user.id).maybeSingle()
        data = r.data
      }
      if (vivo) { setPerfil(data); setPerfilLoading(false) }
    })()
    return () => { vivo = false }
  }, [user])

  if (loading || (user && perfilLoading)) return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Gate: debe haber completado TODOS los pasos de la capacitación ────────
  if (user) {
    const rol: string = perfil?.rol ?? ''
    // Se exige solo a Personero de Mesa. Personero de Centro de Votación se
    // trata igual que un coordinador: entra sin capacitación obligatoria.
    // Sin perfil -> se exige (por seguridad, ante un rol aún no resuelto).
    const requiereCapacitacion =
      !rol || (/personero/i.test(rol) && !ROLES_LOCAL.includes(rol))
    const pasos: Pasos = {
      videos:   (perfil?.videos_vistos ?? 0) >= 1,
      cartilla: (perfil?.pdfs_vistos ?? 0) >= 1,
      quiz:     perfil?.quiz_estado === 'Aprobado',
    }
    const capacitacionOk = pasos.videos && pasos.cartilla && pasos.quiz

    if (requiereCapacitacion && !capacitacionOk) {
      return <GateCapacitacion perfil={perfil} pasos={pasos} />
    }

    // Personero de Centro de Votación -> panel de asistencia de su local, salvo
    // que haya elegido registrar el acta de uno de sus personeros de mesa.
    if (ROLES_LOCAL.includes(rol)) {
      if (asistidoId) return (
        <div className="fixed inset-0 flex flex-col overflow-hidden">
          <header className="flex items-center gap-2.5 px-4 py-3 bg-[#0b0f19] border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2 text-indigo-400">
              <div className="p-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10">
                <CheckSquare size={18} className="text-indigo-400" />
              </div>
              <span className="font-extrabold text-base tracking-tight text-white">VotoReal</span>
            </div>
            <span className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-full bg-[#161d31] text-indigo-400 border border-indigo-500/20">
              MÓVIL
            </span>
          </header>
          <div className="flex-1 overflow-y-auto">
            <ConteoPage asistidoPersoneroId={asistidoId} onSalirAsistido={() => setAsistidoId(null)} />
          </div>
        </div>
      )
      return <PersoneroLocalPage onAbrirConteo={setAsistidoId} />
    }

    // Coordinadores / Administrador -> su lugar es el panel web, no el conteo
    if (ROLES_COORD.includes(rol)) {
      return <IrAlPanel perfil={perfil} />
    }
  }

  return (
    <BrowserRouter>
      {user && <div className="fixed inset-0 flex flex-col overflow-hidden">
        <header className="flex items-center gap-2.5 px-4 py-3 bg-[#0b0f19] border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2 text-indigo-400">
            <div className="p-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10">
              <CheckSquare size={18} className="text-indigo-400" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">VotoReal</span>
          </div>
          <span className="text-[9px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-full bg-[#161d31] text-indigo-400 border border-indigo-500/20">
            MÓVIL
          </span>
        </header>
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/conteo" />} />
            <Route path="/conteo" element={<ConteoPage />} />
            <Route path="/historial" element={<HistorialPage />} />
            <Route path="*" element={<Navigate to="/conteo" />} />
          </Routes>
        </div>
      </div>}
      {!user && (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
