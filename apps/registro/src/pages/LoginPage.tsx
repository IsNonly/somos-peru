import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Shield, ArrowLeft, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError('Credenciales incorrectas. Verifique su correo y contraseña.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#c9e6f8] p-4">
      <div className="w-full max-w-md bg-white border border-sky-100 rounded-[28px] p-8 sm:p-9 shadow-2xl fade-in text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00a3e8] mb-4 shadow-lg shadow-sky-500/25">
          <Shield size={32} className="text-white" strokeWidth={2} />
        </div>
        
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Acceso a Registro</h1>
        <p className="text-slate-500 text-xs mt-1 font-medium">Panel de Coordinación • Somos Perú 2026</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="coordinador@somosperu.pe"
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#00a3e8] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Contraseña o DNI
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 pr-12 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#00a3e8] transition-all"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-rose-600 text-xs bg-rose-50 border border-rose-100 rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-xl shadow-md shadow-sky-500/25 transition-all active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
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

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 text-xs font-bold transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver al formulario de registro</span>
          </a>
        </div>
      </div>
    </div>
  )
}
