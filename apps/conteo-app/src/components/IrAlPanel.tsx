import { supabase } from '../lib/supabase'
import { LayoutDashboard, ArrowRight, LogOut } from 'lucide-react'

const PANEL_URL =
  (import.meta.env.VITE_PANEL_URL as string) || 'http://localhost:5175'

// Los coordinadores / administrador no cuentan votos: su lugar es el panel web.
export default function IrAlPanel({ perfil }: { perfil: any }) {
  const nombre = perfil?.nombre_completo?.split(' ')?.[0] ?? ''
  return (
    <div className="min-h-svh flex items-center justify-center bg-[#0b0f19] p-5">
      <div className="w-full max-w-sm bg-[#121829] border border-white/10 rounded-3xl p-7 space-y-5 text-center shadow-2xl shadow-black/50">
        <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
          <LayoutDashboard size={26} className="text-sky-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-white font-extrabold text-lg">Panel de coordinación</h2>
          <p className="text-white/50 text-xs leading-relaxed">
            {nombre ? `${nombre}, tu` : 'Tu'} rol es <span className="text-white font-semibold">{perfil?.rol ?? 'Coordinador'}</span>.
            Esta app es para el conteo de los personeros. Ingresa al panel web para ver el avance de tu ámbito.
          </p>
        </div>
        <a href={PANEL_URL}
          className="w-full py-3.5 bg-gradient-to-r from-[#3b82f6] to-[#0ea5e9] hover:opacity-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">
          Ir al panel web <ArrowRight size={16} />
        </a>
        <button onClick={() => supabase.auth.signOut()}
          className="w-full py-2.5 border border-white/10 text-white/50 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
