import { NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, History, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TABS = [
  { to: '/conteo',   icon: ClipboardList, label: 'Conteo' },
  { to: '/historial', icon: History,       label: 'Historial' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-[#12121f] border-t border-white/8 flex items-center safe-area-pb">
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors
            ${isActive ? 'text-brand-red' : 'text-white/30'}`}>
          <Icon size={22} strokeWidth={1.8} />
          {label}
        </NavLink>
      ))}
      <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }}
        className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-white/30 hover:text-red-400 transition-colors">
        <LogOut size={22} strokeWidth={1.8} />
        Salir
      </button>
    </nav>
  )
}
