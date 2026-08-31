import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import ConteoPage from './pages/ConteoPage'
import HistorialPage from './pages/HistorialPage'
import BottomNav from './components/BottomNav'
import type { User } from '@supabase/supabase-js'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  )

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
