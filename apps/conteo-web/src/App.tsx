import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CoordinadoresPage from './pages/CoordinadoresPage'
import PersoneroMonitorPage from './pages/PersoneroMonitorPage'
import CentrosPage from './pages/CentrosPage'
import PadronPage from './pages/PadronPage'
import FotosPage from './pages/FotosPage'
import Layout from './components/Layout'
import type { User } from '@supabase/supabase-js'

// El PCV (Personero de Centro de Votación) puede entrar SOLO para ver las
// fotos de sus propios personeros de mesa -no el resto del dashboard-.
const ROLES_PCV = new Set(['Personero de Centro de Votación', 'Personero de Local de Votación', 'Coordinador de Local'])

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [esPCV, setEsPCV] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkRole = async (u: User | null) => {
    if (!u) {
      setUser(null)
      setIsAdmin(false)
      setEsPCV(false)
      setLoading(false)
      return
    }
    // El perfil se resuelve por DNI (parte antes del @ del email de login):
    // en la base importada profiles.id no siempre coincide con auth.users.id.
    const dni = (u.email ?? '').split('@')[0]
    let data: { rol: string } | null = null
    try {
      data = (await supabase.from('profiles').select('rol').eq('dni', dni).maybeSingle()).data
      if (!data) data = (await supabase.from('profiles').select('rol').eq('id', u.id).maybeSingle()).data
    } catch (e) {
      // Red caída o sesión inválida (cuenta eliminada): sin rol, pero sin colgarse.
      console.error('No se pudo resolver el rol:', e)
    }

    const rol = data?.rol || ''
    const esPcvRol = ROLES_PCV.has(rol)
    // Roles directivos entran a todo el dashboard; el PCV entra pero acotado
    // (solo la pestaña Fotos, ver rutas abajo).
    const permitido = rol.includes('Administrador') || rol.includes('Coordinador') || esPcvRol

    setUser(u)
    setIsAdmin(permitido)
    setEsPCV(esPcvRol)
    setLoading(false)
  }

  useEffect(() => {
    // Supabase dispara onAuthStateChange también en cada refresco silencioso
    // de token (p.ej. al volver a una pestaña en segundo plano), no solo en
    // login/logout. Sin este control se repetía la consulta del perfil y se
    // reescribía el estado del mismo usuario en cada refresco.
    let userIdAnterior: string | null = null

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      userIdAnterior = u?.id ?? null
      checkRole(u)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      const u = s?.user ?? null
      const cambio = (u?.id ?? null) !== userIdAnterior
      userIdAnterior = u?.id ?? null
      // Fuera del callback: consultar Supabase dentro de onAuthStateChange puede
      // dejar a la librería esperándose a sí misma (spinner infinito).
      if (cambio) setTimeout(() => checkRole(u), 0)
    })
    // Red de seguridad: nunca más de 10 s en "cargando"; en el peor caso se ve el login.
    const tope = setTimeout(() => setLoading(false), 10_000)
    return () => { clearTimeout(tope); subscription.unsubscribe() }
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f19]">
      <div className="w-8 h-8 border-2 border-[#00838f] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user || !isAdmin ? <LoginPage /> : <Navigate to={esPCV ? '/fotos' : '/dashboard'} />} />
        <Route path="/" element={user && isAdmin ? <Layout esPCV={esPCV} /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to={esPCV ? '/fotos' : '/dashboard'} />} />
          <Route path="fotos" element={<FotosPage />} />
          {/* El PCV solo ve "Fotos" — el resto del dashboard es de coordinadores/admin. */}
          <Route path="dashboard"     element={esPCV ? <Navigate to="/fotos" /> : <DashboardPage />} />
          <Route path="coordinadores" element={esPCV ? <Navigate to="/fotos" /> : <CoordinadoresPage />} />
          <Route path="personeros"    element={esPCV ? <Navigate to="/fotos" /> : <PersoneroMonitorPage />} />
          <Route path="centros"       element={esPCV ? <Navigate to="/fotos" /> : <CentrosPage />} />
          <Route path="padron"        element={esPCV ? <Navigate to="/fotos" /> : <PadronPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
