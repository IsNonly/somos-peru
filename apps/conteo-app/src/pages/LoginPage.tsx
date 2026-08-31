import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (err) setError('Acceso Denegado: Tus credenciales no se encuentran confirmadas o están bloqueadas.')
    setLoading(false)
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center p-5 bg-[#0a0a14]">
      <div className="w-full max-w-sm space-y-7 fade-in">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-brand-red mb-4">
            <ShieldCheck size={32} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-white text-xl font-bold">Conteo de Votos</h1>
          <p className="text-white/40 text-sm mt-1">Somos Perú — ERM 2026</p>
        </div>

        <form onSubmit={login} className="space-y-4">
          <div className="bg-[#14141f] border border-white/8 rounded-2xl p-1 space-y-1">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              required
              className="w-full px-4 py-3.5 bg-transparent text-white text-sm placeholder-white/25 outline-none"
            />
            <div className="h-px bg-white/5" />
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="Contraseña"
                required
                className="w-full px-4 py-3.5 bg-transparent text-white text-sm placeholder-white/25 outline-none pr-12"
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-brand-red hover:bg-red-600 text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-50 active:scale-[0.98]">
            {loading ? 'Verificando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
