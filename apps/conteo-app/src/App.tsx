import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import ConteoPage from './pages/ConteoPage'
import HistorialPage from './pages/HistorialPage'
import BottomNav from './components/BottomNav'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setUser(s?.user ?? null)
      if (event === 'SIGNED_OUT') {
        try { sessionStorage.removeItem('conteo_intro_ok') } catch { /* modo privado */ }
      }
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
    // Se exige a personeros (de mesa y de local). Coordinador Provincial /
    // de Distritos / Administrador entran sin capacitación. Sin perfil -> se exige.
    const requiereCapacitacion =
      !rol || /personero/i.test(rol) || ROLES_LOCAL.includes(rol)
    const pasos: Pasos = {
      videos:   (perfil?.videos_vistos ?? 0) >= 2,
      cartilla: (perfil?.pdfs_vistos ?? 0) >= 1,
      quiz:     perfil?.quiz_estado === 'Aprobado',
    }
    const capacitacionOk = pasos.videos && pasos.cartilla && pasos.quiz

    if (requiereCapacitacion && !capacitacionOk) {
      return <GateCapacitacion perfil={perfil} pasos={pasos} />
    }

    // Personero de Centro de Votación -> panel de asistencia de su local
    if (ROLES_LOCAL.includes(rol)) {
      return <PersoneroLocalPage />
    }

    // Coordinadores / Administrador -> su lugar es el panel web, no el conteo
    if (ROLES_COORD.includes(rol)) {
      return <IrAlPanel perfil={perfil} />
    }
  }

  return (
    <BrowserRouter>
      {user && <div className="fixed inset-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20">
          <Routes>
            <Route path="/" element={<Navigate to="/conteo" />} />
            <Route path="/conteo" element={<ConteoPage />} />
            <Route path="/historial" element={<HistorialPage />} />
            <Route path="*" element={<Navigate to="/conteo" />} />
          </Routes>
        </div>
        <BottomNav />
      </div>}
      {!user && (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
