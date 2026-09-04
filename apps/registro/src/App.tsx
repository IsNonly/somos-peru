import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CapacitarPage from './pages/CapacitarPage'
import DashboardPage from './pages/DashboardPage'
import PersonerosPage from './pages/PersonerosPage'
import CapacitacionPage from './pages/CapacitacionPage'
import CredencialesPage from './pages/CredencialesPage'
import CentrosPage from './pages/CentrosPage'
import Layout from './components/Layout'
import type { User } from '@supabase/supabase-js'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  // Hasta que no se resuelva el rol del usuario logueado NO renderizamos las
  // rutas (si no, el redirect de /login se evalúa con esAdmin viejo y manda
  // al admin a /capacitate).
  const [rolListo, setRolListo] = useState(false)

  useEffect(() => {
    let vivo = true

    // El perfil se busca por DNI: en cuentas importadas profiles.id != auth.users.id.
    const resolver = async (u: User | null) => {
      setRolListo(false)
      setUser(u)
      if (!u) { if (vivo) { setEsAdmin(false); setRolListo(true) } ; return }
      const dni = (u.email ?? '').split('@')[0]
      let { data } = await supabase.from('profiles').select('rol').eq('dni', dni).maybeSingle()
      if (!data) {
        const r = await supabase.from('profiles').select('rol').eq('id', u.id).maybeSingle()
        data = r.data
      }
      if (!vivo) return
      const rol = data?.rol || ''
      setEsAdmin(rol.includes('Administrador') || rol.includes('Coordinador'))
      setRolListo(true)
    }

    supabase.auth.getSession().then(({ data }) => resolver(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => resolver(s?.user ?? null))
    return () => { vivo = false; subscription.unsubscribe() }
  }, [])

  if (!rolListo) return (
    <div className="min-h-screen flex items-center justify-center bg-[#c9e6f8]">
      <div className="w-8 h-8 border-2 border-[#00a3e8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<RegisterPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={esAdmin ? '/admin' : '/capacitate'} />} />

        {/* Página de capacitación para personeros registrados */}
        <Route path="/capacitate" element={user ? <CapacitarPage /> : <Navigate to="/login" />} />

        {/* Panel admin: solo Administrador / Coordinador */}
        <Route path="/admin" element={!user ? <Navigate to="/login" /> : esAdmin ? <Layout /> : <Navigate to="/capacitate" />}>
          <Route index element={<Navigate to="/admin/dashboard" />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="centros"      element={<CentrosPage />} />
          <Route path="personeros"   element={<PersonerosPage />} />
          <Route path="capacitacion" element={<CapacitacionPage />} />
          <Route path="credenciales" element={<CredencialesPage />} />
        </Route>

        {/* dashboard legacy redirect */}
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
