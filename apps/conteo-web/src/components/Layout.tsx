import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Map, BarChart3, Users, LogOut, Menu, ShieldCheck, Radio } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Centro de Mando' },
  { to: '/mapa',          icon: Map,             label: 'Mapa Electoral' },
  { to: '/resultados',    icon: BarChart3,        label: 'Resultados y Actas' },
  { to: '/coordinadores', icon: Users,            label: 'Coordinadores' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  return (
    <div className="flex min-h-screen bg-[#0a0a14] text-white">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#111122]/95 backdrop-blur-xl border-r border-white/10 flex flex-col transition-transform duration-200 shadow-2xl
        ${open ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        
        {/* Header Sidebar */}
        <div className="flex items-center gap-3.5 px-5 py-5 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8534A] to-[#b92c24] flex items-center justify-center shadow-lg shadow-[#E8534A]/30 border border-white/20">
            <ShieldCheck size={22} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
              SOMOS PERÚ <span className="text-[#E8534A]">2026</span>
            </p>
            <p className="text-white/40 text-[11px] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Cómputo en Vivo
            </p>
          </div>
        </div>

        {/* Badge de estado en tiempo real */}
        <div className="mx-4 mt-4 p-3 rounded-2xl bg-gradient-to-r from-[#E8534A]/10 to-transparent border border-[#E8534A]/20 flex items-center gap-2.5">
          <Radio size={16} className="text-[#E8534A] animate-pulse" />
          <div className="text-xs">
            <span className="text-white/90 font-medium block">Transmisión Segura</span>
            <span className="text-white/40 text-[10px]">Mesas de Lima Metropolitana</span>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-1.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-[#E8534A] text-white font-semibold shadow-lg shadow-[#E8534A]/30 translate-x-1' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              <Icon size={18} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Botón Logout */}
        <div className="p-3 border-t border-white/5">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={18} strokeWidth={1.8} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm xl:hidden" onClick={() => setOpen(false)} />}

      {/* Contenido Principal */}
      <div className="flex-1 xl:ml-64 flex flex-col min-h-screen">
        <header className="xl:hidden flex items-center justify-between px-4 py-3 bg-[#111122]/95 border-b border-white/10 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="p-2 rounded-lg bg-white/5 text-white/80 hover:text-white">
              <Menu size={20} />
            </button>
            <span className="font-bold text-white text-sm">Somos Perú 2026</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            EN LÍNEA
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 xl:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
