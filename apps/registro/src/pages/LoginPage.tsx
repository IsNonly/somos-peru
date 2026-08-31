import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Shield } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] p-4">
      {/* BG decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-red/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-red/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-red mb-4">
            <Shield size={32} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="font-cinzel font-bold text-3xl text-white tracking-wide">SOMOS PERÚ</h1>
          <p className="text-white/40 text-sm mt-1 font-outfit">Sistema de Registro y Control Electoral 2026</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#16162a] border border-white/8 rounded-2xl p-8 space-y-5 shadow-2xl">
          <div>
            <label className="block text-white/60 text-xs font-medium uppercase tracking-widest mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="coordinador@somosperu.pe"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-brand-red/60 focus:bg-white/8 transition-all"
            />
          </div>

          <div>
            <label className="block text-white/60 text-xs font-medium uppercase tracking-widest mb-2">
              Contraseña o DNI
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-white/20 focus:outline-none focus:border-brand-red/60 focus:bg-white/8 transition-all"
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-red hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide">
            {loading ? 'Verificando...' : 'Ingresar al Sistema'}
          </button>
        </form>

        <p className="text-center text-white/20 text-xs mt-6">
          ¿Eres un personero nuevo?{' '}
          <a href="/registro" className="text-brand-red hover:underline">Regístrate aquí</a>
        </p>
      </div>
    </div>
  )
}
