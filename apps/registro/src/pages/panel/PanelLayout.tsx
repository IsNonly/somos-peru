import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutGrid, GraduationCap, Navigation, ChevronLeft, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const NAV = [
  { to: '/panel', end: true, icon: LayoutGrid, label: 'Panel General' },
  { to: '/panel/capacitaciones', end: false, icon: GraduationCap, label: 'Capacitaciones' },
  { to: '/panel/trayecto', end: false, icon: Navigation, label: 'Trayecto' },
]

function Reloj() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString('es-PE', { hour12: false }))
  useEffect(() => {
    const i = setInterval(() => setT(new Date().toLocaleTimeString('es-PE', { hour12: false })), 1000)
    return () => clearInterval(i)
  }, [])
  return <span className="font-mono">{t}</span>
}

export default function PanelLayout() {
  const nav = useNavigate()
  const [open, setOpen] = useState(true)
  const [nombre, setNombre] = useState('Coordinador')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const dni = (user.email ?? '').split('@')[0]
      const { data } = await supabase.from('profiles').select('nombre_completo').eq('dni', dni).maybeSingle()
      if (data?.nombre_completo) setNombre(data.nombre_completo.split(' ').slice(0, 2).join(' '))
    })()
  }, [])

  const salir = async () => { await supabase.auth.signOut(); nav('/login') }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      <aside className={`${open ? 'w-56' : 'w-16'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all`}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#e11d48] flex items-center justify-center text-white text-lg flex-shrink-0">❤️</div>
          {open && (
            <div className="leading-tight min-w-0">
              <p className="font-extrabold text-slate-900 text-sm truncate">ConteoLima</p>
              <p className="text-[10px] font-bold text-rose-500 tracking-wide">Somos Perú 2026</p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-2.5 space-y-1">
          {open && <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Panel de control</p>}
          {NAV.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
              <Icon size={17} /> {open && label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button onClick={() => setOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-100">
            <ChevronLeft size={14} className={open ? '' : 'rotate-180'} /> {open && 'Contraer'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 flex-shrink-0">
          <h1 className="text-base font-extrabold text-slate-900">Control Electoral y Monitoreo</h1>
          <div className="flex items-center gap-2.5 text-xs">
            <span className="flex items-center gap-1.5 bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> {nombre}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <Reloj />
            </span>
            <button onClick={salir}
              className="flex items-center gap-1.5 text-rose-600 border border-rose-200 bg-rose-50 rounded-lg px-3 py-1.5 font-bold hover:bg-rose-100">
              <LogOut size={12} /> Salir
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
