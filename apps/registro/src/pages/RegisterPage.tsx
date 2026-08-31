import { useState, useEffect } from 'react'
import { supabase, DISTRITOS, ROLES, generarToken, generarClave } from '../lib/supabase'
import type { Rol } from '../lib/supabase'
import { 
  User, Phone, CreditCard, MapPin, Building2, Check, 
  LogIn, Shield, CheckCircle2, ChevronDown 
} from 'lucide-react'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ token: string; clave: string } | null>(null)

  // Listas dinámicas de colegios según distrito seleccionado
  const [colegiosVota, setColegiosVota] = useState<string[]>([])
  const [colegiosAsignado, setColegiosAsignado] = useState<string[]>([])
  const [cargandoColegiosVota, setCargandoColegiosVota] = useState(false)
  const [cargandoColegiosAsignado, setCargandoColegiosAsignado] = useState(false)

  const [form, setForm] = useState({
    nombres: '',
    dni: '',
    celular: '',
    correo: '',
    distritoDondeVota: '',
    localVotacion: '',
    rol: 'Personero de Mesa' as Rol,
    distritoAsignado: '',
    localAsignado: '',
    tieneExperiencia: false,
    cuentaMovilidad: false,
    seCompromete: false,
  })

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  // Cargar colegios de donde vota
  useEffect(() => {
    if (!form.distritoDondeVota) {
      setColegiosVota([])
      return
    }
    setCargandoColegiosVota(true)
    supabase
      .from('colegios')
      .select('nombre')
      .eq('distrito', form.distritoDondeVota)
      .order('nombre')
      .then(({ data }) => {
        setColegiosVota((data || []).map(c => c.nombre))
        setCargandoColegiosVota(false)
      })
  }, [form.distritoDondeVota])

  // Cargar colegios del distrito asignado
  useEffect(() => {
    if (!form.distritoAsignado) {
      setColegiosAsignado([])
      return
    }
    setCargandoColegiosAsignado(true)
    supabase
      .from('colegios')
      .select('nombre')
      .eq('distrito', form.distritoAsignado)
      .order('nombre')
      .then(({ data }) => {
        setColegiosAsignado((data || []).map(c => c.nombre))
        setCargandoColegiosAsignado(false)
      })
  }, [form.distritoAsignado])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.seCompromete) {
      setError('Debe marcar la casilla de compromiso para continuar.')
      return
    }
    if (!form.nombres || !form.dni || !form.celular) {
      setError('Complete los datos personales obligatorios.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const cleanDni = form.dni.trim()
      const token = generarToken(cleanDni)
      const clave = generarClave()

      // Usar un dominio estándar válido para Supabase Auth (@somosperu.com)
      const email = `${cleanDni}@somosperu.com`
      // Supabase requiere contraseñas de al menos 6 caracteres (el DNI tiene 8)
      const password = cleanDni.length >= 6 ? cleanDni : `SP2026_${cleanDni}`

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre_completo: form.nombres } },
      })
      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo generar el identificador de usuario.')

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        nombre_completo: form.nombres,
        dni: cleanDni,
        celular: form.celular,
        correo: email,
        distrito_vota: form.distritoDondeVota || null,
        local_votacion: form.localVotacion || null,
        rol: form.rol,
        distrito_asignado: form.distritoAsignado || null,
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
    } catch (err: any) {
      setError(err.message || 'Error al procesar el registro.')
    }
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#c9e6f8]">
        <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl text-center space-y-6 fade-in border border-sky-100">
          <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">¡Registro Exitoso!</h2>
          <p className="text-slate-500 text-sm">
            Tus datos han sido registrados en el padrón oficial de Somos Perú.
          </p>

          <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-5 text-left space-y-3">
            <div>
              <p className="text-xs uppercase font-semibold text-sky-800">Token de Acreditación</p>
              <p className="text-xl font-mono font-bold text-sky-600">{done.token}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold text-sky-800">DNI / Clave de Acceso</p>
              <p className="text-lg font-mono font-bold text-slate-800">{form.dni}</p>
            </div>
          </div>

          <a
            href="/login"
            className="block w-full py-3.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all text-center"
          >
            Ir a Iniciar Sesión
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4 flex justify-center items-start bg-[#c9e6f8]">
      <div className="w-full max-w-2xl bg-white rounded-[28px] p-6 sm:p-9 shadow-2xl border border-sky-100 fade-in">
        
        {/* Cabecera idéntica */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Registro</h1>
            <p className="text-xs font-semibold text-slate-700 mt-1">
              Partido Democrático Somos Perú • Elecciones Municipales 2026
            </p>
          </div>
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rose-200 bg-rose-50/50 text-rose-500 hover:bg-rose-100/60 font-semibold text-xs transition-colors"
          >
            <LogIn size={14} />
            <span>Ingresar</span>
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECCIÓN 1: DATOS PERSONALES */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00a3e8] text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">
                Datos Personales
              </h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nombres y Apellidos <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={form.nombres}
                  onChange={e => set('nombres', e.target.value)}
                  placeholder="Ej. Juan Carlos Pérez Torres"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] focus:ring-1 focus:ring-[#00a3e8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  D.N.I. (8 dígitos) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <CreditCard size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={form.dni}
                    onChange={e => set('dni', e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 12345678"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] focus:ring-1 focus:ring-[#00a3e8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Celular (9 dígitos) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <Phone size={18} />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={9}
                    value={form.celular}
                    onChange={e => set('celular', e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 987654321"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] focus:ring-1 focus:ring-[#00a3e8]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: MI LUGAR DE VOTACIÓN */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00a3e8] text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">
                Mi Lugar de Votación
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Distrito donde Vota <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <MapPin size={18} />
                  </div>
                  <select
                    value={form.distritoDondeVota}
                    onChange={e => {
                      set('distritoDondeVota', e.target.value)
                      set('localVotacion', '')
                    }}
                    className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#00a3e8] appearance-none"
                  >
                    <option value="">Seleccione Distrito</option>
                    {DISTRITOS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Local / Colegio de Votación <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <Building2 size={18} />
                  </div>
                  {colegiosVota.length > 0 ? (
                    <select
                      value={form.localVotacion}
                      onChange={e => set('localVotacion', e.target.value)}
                      className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#00a3e8] appearance-none"
                    >
                      <option value="">Seleccione un local de votación ({colegiosVota.length})</option>
                      {colegiosVota.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled={!form.distritoDondeVota}
                      value={form.localVotacion}
                      onChange={e => set('localVotacion', e.target.value)}
                      placeholder={
                        cargandoColegiosVota
                          ? "Cargando colegios..."
                          : form.distritoDondeVota
                            ? "Escriba el nombre del local..."
                            : "Primero seleccione un distrito"
                      }
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] disabled:bg-slate-50"
                    />
                  )}
                  {colegiosVota.length > 0 && (
                    <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: ROL Y ASIGNACIÓN ELECTORAL */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00a3e8] text-white text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">
                Rol y Asignación Electoral
              </h2>
            </div>

            {/* Grid de 4 Roles seleccionables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'Personero de Mesa', icon: Shield, title: 'Personero de Mesa' },
                { id: 'Personero de Local de Votación', icon: Building2, title: 'Personero de Local de Votación' },
                { id: 'Coordinador Zonal', icon: Building2, title: 'Coordinador Zonal' },
                { id: 'Coordinador de Distritos', icon: MapPin, title: 'Coordinador Distrital' },
              ].map(item => {
                const isSelected = form.rol === item.id || (item.id === 'Coordinador de Distritos' && form.rol === 'Coordinador de Distritos')
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => set('rol', item.id as Rol)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#00a3e8] border-[#00a3e8] text-white shadow-md shadow-sky-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'
                    }`}
                  >
                    <div className={isSelected ? 'text-white' : 'text-slate-600'}>
                      <Icon size={20} />
                    </div>
                    <span className="text-xs font-bold leading-tight">{item.title}</span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Distrito Asignado <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <MapPin size={18} />
                  </div>
                  <select
                    value={form.distritoAsignado}
                    onChange={e => {
                      set('distritoAsignado', e.target.value)
                      set('localAsignado', '')
                    }}
                    className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#00a3e8] appearance-none"
                  >
                    <option value="">Seleccione Distrito</option>
                    {DISTRITOS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Local de Votación Asignado <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <Building2 size={18} />
                  </div>
                  {colegiosAsignado.length > 0 ? (
                    <select
                      value={form.localAsignado}
                      onChange={e => set('localAsignado', e.target.value)}
                      className="w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#00a3e8] appearance-none"
                    >
                      <option value="">Seleccione el local asignado ({colegiosAsignado.length})</option>
                      {colegiosAsignado.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled={!form.distritoAsignado}
                      value={form.localAsignado}
                      onChange={e => set('localAsignado', e.target.value)}
                      placeholder={
                        cargandoColegiosAsignado
                          ? "Cargando locales..."
                          : form.distritoAsignado
                            ? "Escriba el local asignado..."
                            : "Primero seleccione un distrito"
                      }
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] disabled:bg-slate-50"
                    />
                  )}
                  {colegiosAsignado.length > 0 && (
                    <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: COMPROMISO Y LOGÍSTICA */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00a3e8] text-white text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">
                Compromiso y Logística
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  ¿Tiene Experiencia como Personero? <span className="text-rose-500">*</span>
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => set('tieneExperiencia', true)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      form.tieneExperiencia ? 'bg-[#00a3e8] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => set('tieneExperiencia', false)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      !form.tieneExperiencia ? 'bg-[#00a3e8] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  ¿Cuenta con Movilidad Propia? <span className="text-rose-500">*</span>
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => set('cuentaMovilidad', true)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      form.cuentaMovilidad ? 'bg-[#00a3e8] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => set('cuentaMovilidad', false)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      !form.cuentaMovilidad ? 'bg-[#00a3e8] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* Checkbox de compromiso */}
            <div className="pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={form.seCompromete}
                  onChange={e => set('seCompromete', e.target.checked)}
                  className="w-4 h-4 rounded text-[#00a3e8] focus:ring-[#00a3e8] border-slate-300"
                />
                <span className="text-xs font-bold text-slate-800">
                  Sí, me comprometo a asistir el 4 de Octubre del 2026 <span className="text-rose-500">*</span>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Botón principal azul cyan */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-sky-500/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check size={18} strokeWidth={2.5} />
                <span>Revisar y Continuar Registro</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
