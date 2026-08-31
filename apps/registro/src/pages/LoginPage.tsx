import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Lock, LogIn, UserPlus } from 'lucide-react'

export default function LoginPage() {
  const [dni, setDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanDni = dni.trim().replace(/\D/g, '')
    
    if (cleanDni.length < 8) {
      setError('El DNI debe tener 8 dígitos.')
      setLoading(false)
      return
    }

    const email = `${cleanDni}@somosperu.com`

    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password: cleanDni,
    })

    if (err) {
      setError('Credenciales incorrectas. Verifique su DNI e inténtelo de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#c9e6f8] p-4">
      <div className="w-full max-w-sm bg-white border border-sky-100 rounded-[24px] p-8 shadow-xl text-center">

        {/* Logo Somos Perú */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 mb-3 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-20 h-20" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Corazón rojo */}
              <path d="M50 80 C50 80 15 55 15 32 C15 20 24 12 35 12 C42 12 48 16 50 20 C52 16 58 12 65 12 C76 12 85 20 85 32 C85 55 50 80 50 80Z"
                fill="#e53e3e" stroke="#c53030" strokeWidth="2"/>
              {/* Texto SOMOS dentro del corazón */}
              <text x="50" y="36" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="Arial">SOMOS</text>
              {/* Franja bandera peruana */}
              <rect x="22" y="42" width="14" height="16" fill="#e53e3e" rx="1"/>
              <rect x="36" y="42" width="14" height="16" fill="white" rx="1"/>
              <rect x="50" y="42" width="14" height="16" fill="#e53e3e" rx="1"/>
              {/* PERÚ */}
              <text x="50" y="68" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">PERÚ</text>
            </svg>
          </div>

          <h1 className="text-base font-extrabold text-slate-800 uppercase tracking-wide leading-tight">
            Elecciones Regionales y<br />Municipales 2026
          </h1>
          <p className="text-[11px] font-bold text-[#00a3e8] uppercase tracking-widest mt-1 border-b-2 border-[#e53e3e] pb-1">
            Plataforma de Capacitación y Seguimiento
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Número de DNI / Usuario <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={17} />
              </div>
              <input
                type="text"
                value={dni}
                onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                required
                placeholder="Ingrese su DNI de 8 dígitos"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] focus:ring-1 focus:ring-[#00a3e8] transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-rose-600 text-xs bg-rose-50 border border-rose-100 rounded-xl p-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-xl shadow-md shadow-sky-500/20 transition-all active:scale-[0.99] disabled:opacity-60 text-sm flex items-center justify-center gap-2 mt-1"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={16} />
                <span>Ingresar al Sistema</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sky-500 hover:text-sky-700 text-xs font-bold transition-colors"
          >
            <UserPlus size={14} />
            <span>¿Aún no estás inscrito? Regístrate aquí</span>
          </a>
        </div>
      </div>
    </div>
  )
}

