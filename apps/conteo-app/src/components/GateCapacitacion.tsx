import { supabase } from '../lib/supabase'
import { CheckCircle, Circle, Lock, ArrowRight, LogOut } from 'lucide-react'

export type Pasos = { videos: boolean; cartilla: boolean; quiz: boolean }

const CAPACITACION_URL =
  (import.meta.env.VITE_CAPACITACION_URL as string) || 'http://localhost:5173/capacitate'

// Pantalla que bloquea el acceso al conteo hasta que el usuario
// termine TODOS los pasos de la capacitación.
export default function GateCapacitacion({ perfil, pasos }: {
  perfil: any; pasos: Pasos
}) {
  const nombre = perfil?.nombre_completo?.split(' ')?.[0] ?? ''
  const items = [
    { ok: pasos.videos,   label: 'Ver el video de capacitación (2 veces)' },
    { ok: pasos.cartilla, label: 'Leer la Cartilla del Personero' },
    { ok: pasos.quiz,     label: 'Aprobar la evaluación (4/5)' },
  ]

  return (
    <div className="min-h-svh flex items-center justify-center bg-[#0b0f19] p-5">
      <div className="w-full max-w-sm bg-[#121829] border border-white/10 rounded-3xl p-7 space-y-5 shadow-2xl shadow-black/50">
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center border bg-amber-500/15 border-amber-500/40">
          <Lock size={26} className="text-amber-400" />
        </div>

        <div className="text-center space-y-1.5">
          <h2 className="text-white font-extrabold text-lg">Completa tu capacitación</h2>
          <p className="text-white/50 text-xs leading-relaxed">
            {nombre ? `${nombre}, antes` : 'Antes'} de ingresar al conteo debes terminar
            <span className="text-white font-semibold"> todos los pasos</span> de la capacitación.
          </p>
        </div>

        <ul className="bg-[#0e1322] border border-white/8 rounded-2xl p-4 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2.5 text-xs">
              {it.ok
                ? <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                : <Circle size={16} className="text-white/25 flex-shrink-0" />}
              <span className={it.ok ? 'text-white/70 line-through' : 'text-white/80'}>{it.label}</span>
            </li>
          ))}
        </ul>

        <a href={CAPACITACION_URL}
          className="w-full py-3.5 bg-gradient-to-r from-[#3b82f6] to-[#0ea5e9] hover:opacity-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">
          Ir a completar mi capacitación <ArrowRight size={16} />
        </a>

        <button onClick={() => supabase.auth.signOut()}
          className="w-full py-2.5 border border-white/10 text-white/50 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
