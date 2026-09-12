import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, CheckCircle2, Building2, Menu, RotateCcw, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FiltrosProvider, useFiltros, type Filtros } from '../lib/filtros'

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/coordinadores', icon: Users,           label: 'Coordinador' },
  { to: '/personeros',    icon: CheckCircle2,    label: 'Personeros' },
  { to: '/centros',       icon: Building2,       label: 'Centros de Votación' },
]

function Reloj() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString('es-PE'))
  useEffect(() => {
    const i = setInterval(() => setT(new Date().toLocaleTimeString('es-PE')), 1000)
    return () => clearInterval(i)
  }, [])
  return <span className="text-emerald-400 font-medium">● En vivo · {t}</span>
}

const selCls =
  'text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-sky-500 ' +
  'disabled:bg-slate-100 disabled:text-slate-400 min-w-[9rem] max-w-[12rem]'

function BarraFiltros() {
  const { f, set, reset, departamentos, provincias, distritos, colegios, mesas, partidos, bloqueado } = useFiltros()

  const Campo = ({ k, label, opts, all }: { k: keyof Filtros; label: string; opts: string[]; all: string }) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <select className={selCls} value={f[k]} disabled={bloqueado(k)} onChange={e => set(k, e.target.value)}>
        <option value="">{all}</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-end gap-3">
      <Campo k="departamento" label="Departamento" opts={departamentos} all="Tumbes" />
      <Campo k="provincia"    label="Provincia"    opts={provincias}    all="Todas las provincias" />
      <Campo k="distrito"     label="Distrito"     opts={distritos}     all="Todos los distritos" />
      <Campo k="colegio"      label="Colegio"      opts={colegios}      all="Todos los colegios" />
      <Campo k="mesa"         label="Mesa"         opts={mesas}         all="Todas las mesas" />
      <Campo k="partido"      label="Partido"      opts={partidos}      all="Todos los partidos" />
      <label className="flex flex-col gap-0.5 ml-auto">
        <span className="text-[11px] font-semibold text-slate-500">Acciones</span>
        <button onClick={reset}
          className="text-xs font-bold rounded-md bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 flex items-center gap-1.5">
          <RotateCcw size={13} /> Reiniciar
        </button>
      </label>
    </div>
  )
}

function Shell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const logout = async () => { await supabase.auth.signOut(); navigate('/login') }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-[#0b1329] text-slate-400 flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white font-black">✓</div>
          <div className="leading-tight">
            <p className="text-white font-extrabold text-base">Voto Real</p>
            <p className="text-sky-400 text-[10px] font-bold tracking-widest">LIMA</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Principal</p>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all
                 ${isActive ? 'bg-white/10 text-sky-400 font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-white/10 text-[11px]">
          <Reloj />
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/50 xl:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 xl:ml-56 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <button onClick={() => setOpen(true)} className="xl:hidden p-1.5 rounded-md bg-slate-100"><Menu size={18} /></button>
            <span className="text-sky-600">lima</span>
            <span className="text-slate-300">/</span>
            <span className="text-sky-600">LIMA</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md px-2.5 py-1.5">
              <Download size={13} /> Exportar
            </button>
            <span className="flex items-center gap-1.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full px-2.5 py-1">
              <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">A</span>
              Administrador
            </span>
            <button onClick={logout}
              className="text-xs font-semibold text-slate-600 border border-slate-300 rounded-md px-3 py-1.5">
              Salir
            </button>
          </div>
        </header>

        <BarraFiltros />

        <main className="flex-1 p-4 sm:p-6 w-full min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <FiltrosProvider>
      <Shell />
    </FiltrosProvider>
  )
}
