import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Lock, User, Sun } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Permitir ingresar "admin" directo o correo
    let userEmail = email.trim()
    if (!userEmail.includes('@')) {
      userEmail = `${userEmail}@somosperu2026.pe`
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: pass,
    })

    if (err) {
      // Intentar también con correo crudo ingresado
      const { error: err2 } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      })
      if (err2) {
        setError('Credenciales incorrectas. Verifique su usuario y contraseña.')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden bg-gradient-to-br from-[#d4e9f7] via-[#ebf4f6] to-[#c7e5df]">
      {/* Botón superior derecho "Modo claro" */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/90 shadow-sm border border-slate-200/80 text-xs font-medium text-slate-700 hover:bg-white transition-all"
        >
          <span>☀️</span>
          <span>Modo claro</span>
        </button>
      </div>

      {/* Tarjeta Central Flotante */}
      <div className="w-full max-w-[420px] my-auto bg-white rounded-[28px] p-8 sm:p-10 shadow-2xl shadow-slate-400/20 border border-slate-100 fade-in text-center">
        
        {/* Icono central de Voto Real */}
        <div className="w-16 h-16 rounded-2xl bg-[#00838f] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00838f]/30">
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Voto Real</h1>
        <p className="text-slate-500 text-xs mt-1">Plataforma Electoral Profesional — LIMA • ONPE</p>

        <h2 className="text-sm font-bold text-slate-800 mt-6 mb-5">Acceso de Administrador</h2>

        <form onSubmit={login} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#00838f] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#00838f] transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-[#00838f] hover:bg-[#00737d] text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-[#00838f]/20 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Iniciar sesión</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-slate-500 text-xs pb-2">
        Sistema Electoral © 2026 • Solo acceso autorizado
      </p>
    </div>
  )
}
