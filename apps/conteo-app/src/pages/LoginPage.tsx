import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, User, CreditCard, ArrowRight, CheckSquare } from 'lucide-react'

export default function LoginPage() {
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanDni = dni.trim()
    const email = cleanDni.includes('@') ? cleanDni : `${cleanDni}@somosperu.com`
    const dniDigits = cleanDni.replace(/\D/g, '')

    // 1) Probar con lo ingresado como contraseña (normalmente el DNI)
    let { error: err } = await supabase.auth.signInWithPassword({
      email,
      password: cleanDni,
    })

    // 2) Si falla y lo ingresado parece el DNI, probar con la clave_acceso
    //    autogenerada. Se pide por RPC (no lectura directa de profiles, que
    //    con RLS solo es visible para usuarios ya autenticados).
    if (err && dniDigits.length >= 6) {
      const { data: clave } = await supabase.rpc('clave_acceso_por_dni', { p_dni: dniDigits })
      if (clave && clave !== cleanDni) {
        const { error: errFallback } = await supabase.auth.signInWithPassword({ email, password: clave })
        err = errFallback
      }
    }

    if (err) {
      setError('Acceso Denegado: Tus credenciales no se encuentran confirmadas o están bloqueadas.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0b0f19] text-white p-5 sm:p-8">
      {/* Top Navbar */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 text-indigo-400">
          <div className="p-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10">
            <CheckSquare size={22} className="text-indigo-400" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">VotoReal</span>
        </div>
        <span className="text-[10px] font-bold font-mono tracking-wider px-2 py-0.5 rounded-full bg-[#161d31] text-indigo-400 border border-indigo-500/20">
          MÓVIL
        </span>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-[#121829] border border-white/5 rounded-3xl p-7 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-white">Acceso al Sistema</h1>
            <p className="text-slate-400 text-xs">Registra tus datos de control electoral</p>
          </div>

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Nombre y Apellido
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Primer nombre y primer apellido"
                  className="w-full pl-10 pr-4 py-3.5 bg-[#0e1322] border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                DNI / Clave de Acceso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <CreditCard size={18} />
                </div>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={dni}
                  onChange={e => setDni(e.target.value)}
                  placeholder="Ingresa tu DNI de 8 dígitos"
                  className="w-full pl-10 pr-12 py-3.5 bg-[#0e1322] border border-white/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-4 bg-gradient-to-r from-[#6366f1] via-[#3b82f6] to-[#0ea5e9] hover:opacity-95 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight size={17} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-slate-500 text-xs py-2">
        Elecciones de Alcaldía — Control de Actas
      </p>
    </div>
  )
}
