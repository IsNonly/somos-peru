import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutGrid, GraduationCap, Navigation, ChevronLeft, LogOut, Menu, X } from 'lucide-react'
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

function SidebarContent({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-[#e11d48] flex items-center justify-center text-white text-lg flex-shrink-0">❤️</div>
        {open && (
          <div className="leading-tight min-w-0">
            <p className="font-extrabold text-slate-900 text-sm leading-tight">Registro y Monitoreo de Personeros</p>
            <p className="text-[10px] font-bold text-rose-500 tracking-wide">Somos Perú 2026</p>
          </div>
        )}
      </div>
      <nav className="flex-1 p-2.5 space-y-1">
        {open && <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Panel de control</p>}
        {NAV.map(({ to, end, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
            <Icon size={17} /> {open && label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export default function PanelLayout() {
  const nav = useNavigate()
  const [open, setOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [nombre, setNombre] = useState('Coordinador')
  const [rol, setRol] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [dni, setDni] = useState('')
  const [ambito, setAmbito] = useState({ departamento: '', provincia: '', distrito: '' })
  const [ambitoListo, setAmbitoListo] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAmbitoListo(true); return }
      const miDni = (user.email ?? '').split('@')[0]
      const { data } = await supabase.from('profiles')
        .select('nombre_completo, rol, departamento_asignado, provincia_asignado, distrito_asignado')
        .eq('dni', miDni).maybeSingle()
      if (data?.nombre_completo) { setNombre(data.nombre_completo.split(' ').slice(0, 2).join(' ')); setNombreCompleto(data.nombre_completo) }
      if (data?.rol) setRol(data.rol)
      setAmbito({
        departamento: (data?.departamento_asignado ?? '').trim(),
        provincia: (data?.provincia_asignado ?? '').trim(),
        distrito: (data?.distrito_asignado ?? '').trim(),
      })
      setDni(miDni)
      setAmbitoListo(true)
    })()
  }, [])

  const salir = async () => { await supabase.auth.signOut(); nav('/login') }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      {/* Sidebar de escritorio */}
      <aside className={`hidden lg:flex ${open ? 'w-56' : 'w-16'} flex-shrink-0 bg-white border-r border-slate-200 flex-col transition-all`}>
        <SidebarContent open={open} />
        <div className="p-3 border-t border-slate-100">
          <button onClick={() => setOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-100">
            <ChevronLeft size={14} className={open ? '' : 'rotate-180'} /> {open && 'Contraer'}
          </button>
        </div>
      </aside>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-end px-2 pt-2">
          <button onClick={() => setMobileOpen(false)} className="p-2 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <SidebarContent open onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between gap-2 px-3 sm:px-5 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 flex-shrink-0">
              <Menu size={20} />
            </button>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
              <span className="sm:hidden">Panel Electoral</span>
              <span className="hidden sm:inline">Control Electoral y Monitoreo</span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> {nombre}
            </span>
            <span className="hidden md:flex items-center gap-1.5 text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <Reloj />
            </span>
            <button onClick={salir}
              className="flex items-center gap-1.5 text-rose-600 border border-rose-200 bg-rose-50 rounded-lg px-2.5 sm:px-3 py-1.5 font-bold hover:bg-rose-100">
              <LogOut size={12} /> <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet context={{ rol, nombreCompleto, dni, ambito, ambitoListo }} />
        </main>
      </div>
    </div>
  )
}
