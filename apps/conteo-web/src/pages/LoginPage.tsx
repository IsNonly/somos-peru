import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Lock, User, Sun, Moon } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('vr_theme') === 'dark'
  })

  const toggleTheme = () => {
    setDarkMode(prev => {
      const next = !prev
      localStorage.setItem('vr_theme', next ? 'dark' : 'light')
      return next
    })
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    let userEmail = email.trim()
    if (!userEmail.includes('@')) {
      userEmail = `${userEmail}@somosperu.com`
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: pass,
    })

    if (err) {
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
    <div className={`min-h-screen flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-300 ${
      darkMode 
        ? 'bg-[#0b0f19] text-white' 
        : 'bg-gradient-to-br from-[#d4e9f7] via-[#ebf4f6] to-[#c7e5df] text-slate-800'
    }`}>
      {/* Botón superior derecho "Modo claro / Modo oscuro" */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={toggleTheme}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl shadow-sm border text-xs font-semibold transition-all ${
            darkMode
              ? 'bg-[#161d31] border-white/10 text-slate-200 hover:bg-[#1e2742]'
              : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-white hover:shadow'
          }`}
        >
          {darkMode ? (
            <>
              <Moon size={14} className="text-indigo-400" />
              <span>Modo oscuro</span>
            </>
          ) : (
            <>
              <span>☀️</span>
              <span>Modo claro</span>
            </>
          )}
        </button>
      </div>

      {/* Tarjeta Central Flotante */}
      <div className={`w-full max-w-[420px] my-auto rounded-[28px] p-8 sm:p-10 shadow-2xl transition-all duration-300 border text-center ${
        darkMode
          ? 'bg-[#121829] border-white/10 shadow-black/50 text-white'
          : 'bg-white border-slate-100 shadow-slate-400/20 text-slate-800'
      }`}>
        
        {/* Icono central de Voto Real */}
        <div className="w-16 h-16 rounded-2xl bg-[#00838f] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00838f]/30">
          <Check size={36} className="text-white" strokeWidth={3} />
        </div>

        <h1 className={`text-2xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
          Voto Real
        </h1>
        <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Plataforma Electoral Profesional — LIMA • ONPE
        </p>

        <h2 className={`text-sm font-bold mt-6 mb-5 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
          Acceso de Administrador
        </h2>

        <form onSubmit={login} className="space-y-4 text-left">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Usuario o Nombres <span className="text-red-500">*</span>
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
                className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-[#00838f] transition-all ${
                  darkMode
                    ? 'bg-[#0e1322] border-white/10 text-white focus:bg-[#121829]'
                    : 'bg-[#f8fafc] border-slate-200 text-slate-800 focus:bg-white'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
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
                className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-[#00838f] transition-all ${
                  darkMode
                    ? 'bg-[#0e1322] border-white/10 text-white focus:bg-[#121829]'
                    : 'bg-[#f8fafc] border-slate-200 text-slate-800 focus:bg-white'
                }`}
              />
            </div>
          </div>

          {error && (
            <p className={`text-xs p-2.5 rounded-lg border ${
              darkMode 
                ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                : 'text-red-500 bg-red-50 border-red-100'
            }`}>
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
      <p className={`text-center text-xs pb-2 ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
        Sistema Electoral © 2026 • Solo acceso autorizado
      </p>
    </div>
  )
}
