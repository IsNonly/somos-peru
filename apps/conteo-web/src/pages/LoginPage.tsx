import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, ShieldCheck, Vote, Sparkles } from 'lucide-react'

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
    if (err) setError('Credenciales incorrectas. Verifique su usuario y contraseña.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a14] p-4 relative overflow-hidden">
      {/* Luces de fondo y atmósfera */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-[#E8534A]/20 via-[#E8534A]/5 to-transparent rounded-full blur-[130px]" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md fade-in">
        {/* Encabezado con Logo y Branding */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-semibold uppercase tracking-wider mb-4 shadow-lg backdrop-blur-md">
            <Vote size={14} className="text-[#E8534A]" />
            <span>Centro de Cómputo Oficial 2026</span>
          </div>
          
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#E8534A] to-[#b92c24] flex items-center justify-center shadow-2xl shadow-[#E8534A]/30 border border-white/20">
                <ShieldCheck size={36} className="text-white" strokeWidth={1.8} />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-[#0a0a14] rounded-full">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-[#0a0a14] animate-pulse" />
              </div>
            </div>
          </div>

          <h1 className="text-white font-extrabold text-2xl tracking-tight">
            SOMOS PERÚ <span className="text-[#E8534A]">2026</span>
          </h1>
          <p className="text-white/50 text-xs mt-1">Sistema Integrado de Escrutinio y Conteo Rápido</p>
        </div>

        {/* Tarjeta de Formulario Glassmorphism */}
        <div className="bg-[#121224]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-8 shadow-2xl relative">
          <div className="mb-5 pb-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-base">Acceso al Centro de Mando</h2>
              <p className="text-white/40 text-xs">Ingrese sus credenciales autorizadas</p>
            </div>
            <span className="text-[10px] font-mono font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              EN VIVO
            </span>
          </div>

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="ejemplo@somosperu.pe"
                className="w-full bg-[#0a0a14]/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 outline-none focus:border-[#E8534A] focus:ring-2 focus:ring-[#E8534A]/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-[#0a0a14]/80 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-white/25 outline-none focus:border-[#E8534A] focus:ring-2 focus:ring-[#E8534A]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#E8534A] to-[#d4382f] hover:from-[#f05c54] hover:to-[#E8534A] text-white font-bold rounded-xl text-sm shadow-lg shadow-[#E8534A]/25 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando acceso...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer institucional */}
        <p className="text-center text-white/25 text-xs mt-6">
          Partido Democrático Somos Perú • Elecciones Regionales y Municipales 2026
        </p>
      </div>
    </div>
  )
}
