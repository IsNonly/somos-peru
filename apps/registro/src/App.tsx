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
import Layout from './components/Layout'
import type { User } from '@supabase/supabase-js'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setUser(s?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
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
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/capacitate" />} />

        {/* Página de capacitación para personeros registrados */}
        <Route path="/capacitate" element={user ? <CapacitarPage /> : <Navigate to="/login" />} />

        {/* Panel admin (solo coordinadores/admins que acceden directamente) */}
        <Route path="/admin" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/admin/dashboard" />} />
          <Route path="dashboard"    element={<DashboardPage />} />
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
