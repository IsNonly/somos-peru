import { useState } from 'react'
import { supabase, DISTRITOS, ROLES, generarToken, generarClave } from '../lib/supabase'
import type { Rol } from '../lib/supabase'
import { Shield, CheckCircle } from 'lucide-react'

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-white/60 text-xs font-medium uppercase tracking-widest mb-1.5">{label}</label>
    {children}
  </div>
)

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props}
    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-brand-red/60 transition-all" />
)

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...props}
    className="w-full bg-[#1a1a30] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-red/60 transition-all">
    {props.children}
  </select>
)

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ token: string; clave: string } | null>(null)

  const [form, setForm] = useState({
    nombres: '', dni: '', celular: '', correo: '',
    usaWhatsApp: 'Sí, mismo número', whatsappAlterno: '',
    distritoDondeVota: '', mesaSufragio: '', localVotacion: '',
    rol: 'Personero de Mesa' as Rol,
    distritoAsignado: '', mesaAsignada: '', localAsignado: '',
    tieneExperiencia: false, cuentaMovilidad: false, seCompromete: false,
    password: '',
  })

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.seCompromete) { setError('Debe confirmar su compromiso para el 4 de Octubre.'); return }
    setLoading(true); setError('')
    try {
      const token = generarToken(form.dni)
      const clave  = generarClave()

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.correo || `${form.dni}@somosperu2026.pe`,
        password: form.password || form.dni,
        options: { data: { nombre_completo: form.nombres } },
      })
      if (authErr) throw authErr

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user!.id,
        nombre_completo: form.nombres,
        dni: form.dni,
        celular: form.celular,
        correo: form.correo,
        usa_whatsapp: form.usaWhatsApp,
        whatsapp_alterno: form.whatsappAlterno,
        distrito_vota: form.distritoDondeVota,
        mesa_sufragio: form.mesaSufragio,
        local_votacion: form.localVotacion,
        rol: form.rol,
        distrito_asignado: form.distritoAsignado || null,
        mesa_asignada: form.mesaAsignada || null,
        local_asignado: form.localAsignado || null,
        tiene_experiencia: form.tieneExperiencia,
        cuenta_movilidad: form.cuentaMovilidad,
        se_compromete: form.seCompromete,
        token_verificacion: token,
        clave_acceso: clave,
        credencial_estado: 'Pendiente',
      })
      if (profileErr) throw profileErr
      setDone({ token, clave })
    } catch (e: any) {
      setError(e.message || 'Error al registrar. Intente de nuevo.')
    }
    setLoading(false)
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] p-4">
      <div className="w-full max-w-md bg-[#16162a] border border-white/8 rounded-2xl p-8 text-center space-y-5 fade-in">
        <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-green-500/20 border border-green-500/30">
          <CheckCircle className="text-green-400" size={32} />
        </div>
        <h2 className="font-cinzel font-bold text-white text-xl">¡Registro exitoso!</h2>
        <p className="text-white/50 text-sm">Guarda tus credenciales de acceso:</p>
        <div className="bg-black/30 rounded-xl p-5 text-left space-y-3">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest">Token de verificación</p>
            <p className="text-brand-red font-mono font-bold text-lg">{done.token}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest">Clave de acceso</p>
            <p className="text-white font-mono font-bold text-lg">{done.clave}</p>
          </div>
        </div>
        <p className="text-white/30 text-xs">Recibirás confirmación de tu credencial por parte del coordinador de tu distrito.</p>
        <a href="/login" className="block w-full bg-brand-red text-white font-semibold py-3 rounded-xl text-sm text-center">
          Ir al inicio de sesión
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0f1a] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-red mb-3">
            <Shield size={24} className="text-white" />
          </div>
          <h1 className="font-cinzel font-bold text-2xl text-white">Registro de Personero</h1>
          <p className="text-white/40 text-sm mt-1">Somos Perú — Elecciones Regionales y Municipales 2026</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${step >= s ? 'bg-brand-red border-brand-red text-white' : 'border-white/20 text-white/30'}`}>
                {s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 transition-all ${step > s ? 'bg-brand-red' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-[#16162a] border border-white/8 rounded-2xl p-6 space-y-5 fade-in">
          {step === 1 && (
            <>
              <h3 className="text-white font-semibold">Datos personales</h3>
              <Field label="Nombres y Apellidos">
                <Input value={form.nombres} onChange={e => set('nombres', e.target.value)} placeholder="Juan Pérez García" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="DNI">
                  <Input value={form.dni} onChange={e => set('dni', e.target.value)} maxLength={8} placeholder="12345678" />
                </Field>
                <Field label="Celular">
                  <Input value={form.celular} onChange={e => set('celular', e.target.value)} placeholder="999888777" />
                </Field>
              </div>
              <Field label="Correo electrónico">
                <Input type="email" value={form.correo} onChange={e => set('correo', e.target.value)} placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Contraseña de acceso">
                <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
              </Field>
              <Field label="¿Usa WhatsApp?">
                <Select value={form.usaWhatsApp} onChange={e => set('usaWhatsApp', e.target.value)}>
                  <option>Sí, mismo número</option>
                  <option>Sí, número alterno</option>
                  <option>No</option>
                </Select>
              </Field>
              {form.usaWhatsApp === 'Sí, número alterno' && (
                <Field label="Número WhatsApp alterno">
                  <Input value={form.whatsappAlterno} onChange={e => set('whatsappAlterno', e.target.value)} placeholder="999888777" />
                </Field>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h3 className="text-white font-semibold">Información electoral</h3>
              <Field label="Distrito donde Vota">
                <Select value={form.distritoDondeVota} onChange={e => set('distritoDondeVota', e.target.value)}>
                  <option value="">Seleccionar distrito…</option>
                  {DISTRITOS.map(d => <option key={d}>{d}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mesa de Sufragio">
                  <Input value={form.mesaSufragio} onChange={e => set('mesaSufragio', e.target.value)} placeholder="Ej. 064321" />
                </Field>
                <Field label="Local de Votación">
                  <Input value={form.localVotacion} onChange={e => set('localVotacion', e.target.value)} placeholder="IE 7106..." />
                </Field>
              </div>
              <Field label="Rol a Desempeñar">
                <Select value={form.rol} onChange={e => set('rol', e.target.value as Rol)}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Distrito Asignado">
                <Select value={form.distritoAsignado} onChange={e => set('distritoAsignado', e.target.value)}>
                  <option value="">No aplica / Seleccionar…</option>
                  {DISTRITOS.map(d => <option key={d}>{d}</option>)}
                </Select>
              </Field>
              {form.rol === 'Personero de Mesa' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Mesa Asignada">
                    <Input value={form.mesaAsignada} onChange={e => set('mesaAsignada', e.target.value)} placeholder="Ej. 064321" />
                  </Field>
                  <Field label="Local Asignado">
                    <Input value={form.localAsignado} onChange={e => set('localAsignado', e.target.value)} placeholder="IE..." />
                  </Field>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="text-white font-semibold">Compromiso y confirmación</h3>
              <div className="space-y-4">
                {([
                  ['tieneExperiencia', '¿Tiene experiencia como Personero?'],
                  ['cuentaMovilidad', '¿Cuenta con movilidad propia?'],
                  ['seCompromete', 'Me comprometo a colaborar el 4 de Octubre del 2026 en las Elecciones'],
                ] as [string, string][]).map(([k, lbl]) => (
                  <label key={k} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={!!form[k as keyof typeof form]}
                      onChange={e => set(k, e.target.checked)}
                      className="mt-0.5 w-5 h-5 accent-brand-red" />
                    <span className="text-white/70 text-sm group-hover:text-white transition-colors">{lbl}</span>
                  </label>
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
              )}

              <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4">
                <p className="text-white/70 text-xs leading-relaxed">
                  Al registrarte confirmas que la información proporcionada es verídica y que tu acreditación como personero de Somos Perú 2026 está sujeta a verificación por parte de la coordinación electoral.
                </p>
              </div>
            </>
          )}

          {/* Navegación */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 text-sm transition-all">
                Atrás
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-600 text-white font-semibold text-sm transition-all">
                Continuar
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-600 text-white font-semibold text-sm transition-all disabled:opacity-50">
                {loading ? 'Registrando...' : 'Completar Registro'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
