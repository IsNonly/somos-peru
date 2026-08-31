import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MapaPage from './pages/MapaPage'
import ResultadosPage from './pages/ResultadosPage'
import CoordinadoresPage from './pages/CoordinadoresPage'
import Layout from './components/Layout'
import type { User } from '@supabase/supabase-js'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkRole = async (u: User | null) => {
    if (!u) {
      setUser(null)
      setIsAdmin(false)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', u.id)
      .single()

    const rol = data?.rol || ''
    // Solo roles directivos pueden acceder al centro de cómputo / dashboard
    const permitido = rol.includes('Administrador') || rol.includes('Coordinador')
    
    setUser(u)
    setIsAdmin(permitido)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      checkRole(data.session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      checkRole(s?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f19]">
      <div className="w-8 h-8 border-2 border-[#00838f] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user || !isAdmin ? <LoginPage /> : <Navigate to="/dashboard" />} />
        <Route path="/" element={user && isAdmin ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard"     element={<DashboardPage />} />
          <Route path="mapa"          element={<MapaPage />} />
          <Route path="resultados"    element={<ResultadosPage />} />
          <Route path="coordinadores" element={<CoordinadoresPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
