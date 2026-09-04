import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, BookOpen, Award, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/centros',      icon: Building2,        label: 'Centros de Votación' },
  { to: '/admin/personeros',   icon: Users,            label: 'Personeros' },
  { to: '/admin/capacitacion', icon: BookOpen,         label: 'Capacitaciones' },
  { to: '/admin/credenciales', icon: Award,            label: 'Credenciales' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#0f0f1a]">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#16162a] border-r border-white/5 flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-brand-red flex items-center justify-center font-cinzel font-bold text-white text-sm">SP</div>
          <div>
            <p className="font-cinzel font-bold text-white text-sm leading-tight">Somos Perú</p>
            <p className="text-white/40 text-xs">ERM 2026</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? 'bg-brand-red/15 text-brand-red'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}`
              }>
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut size={18} strokeWidth={1.8} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#16162a] border-b border-white/5">
          <button onClick={() => setOpen(true)} className="p-2 text-white/60 hover:text-white">
            <Menu size={20} />
          </button>
          <span className="font-cinzel font-bold text-white text-sm">Somos Perú 2026</span>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
