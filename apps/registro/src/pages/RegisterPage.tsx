import { useState, useEffect, useRef } from 'react'
import { supabase, DISTRITOS, generarToken, generarClave } from '../lib/supabase'
import type { Rol } from '../lib/supabase'
import {
  User, Phone, CreditCard, MapPin, Building2, Check,
  LogIn, Shield, CheckCircle2, ChevronDown, X, Send, Edit3,
  Layers
} from 'lucide-react'

type FormState = {
  nombres: string
  dni: string
  celular: string
  distritoDondeVota: string
  localVotacion: string
  rol: Rol
  distritoAsignado: string
  localesAsignados: string[]
  localAsignado: string
  tieneExperiencia: boolean
  cuentaMovilidad: boolean
  seCompromete: boolean
}

function ModalRevision({ form, onClose, onConfirm, loading }: {
  form: FormState; onClose: () => void; onConfirm: () => void; loading: boolean
}) {
  const esCoordZonal = form.rol === 'Coordinador Zonal'
  const esCoordDistrital = form.rol === 'Coordinador de Distritos'
  const localMostrado = esCoordZonal ? form.localesAsignados.join(', ') : form.localAsignado

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Revisión de Datos</h2>
              <p className="text-xs text-slate-500">Revise sus datos antes de enviarlos. Puede modificarlos si lo desea.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-50 px-4 py-2"><h3 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">1. Datos Personales</h3></div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              <div><p className="text-xs text-slate-400">Nombres y Apellidos</p><p className="font-semibold text-slate-800">{form.nombres}</p></div>
              <div><p className="text-xs text-slate-400">D.N.I.</p><p className="font-semibold text-slate-800">{form.dni}</p></div>
              <div><p className="text-xs text-slate-400">Celular Principal</p><p className="font-semibold text-slate-800">{form.celular}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-50 px-4 py-2"><h3 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">2. Lugar Donde Vota</h3></div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              <div><p className="text-xs text-slate-400">Distrito</p><p className="font-semibold text-slate-800">{form.distritoDondeVota || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Local / Colegio</p><p className="font-semibold text-slate-800">{form.localVotacion || '—'}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-50 px-4 py-2"><h3 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">3. Asignación Electoral</h3></div>
            <div className="p-4 text-sm space-y-2">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-slate-400">Rol Solicitado</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full">{form.rol}</span>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Distrito Asignado</p>
                  <p className="font-semibold text-slate-800">{form.distritoAsignado || '—'}</p>
                </div>
              </div>
              {!esCoordDistrital && (
                <div>
                  <p className="text-xs text-slate-400">{esCoordZonal ? 'Colegios / Locales de la Zona' : 'Local Asignado'}</p>
                  <p className="font-semibold text-slate-800">{localMostrado || '—'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-50 px-4 py-2"><h3 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">4. Logística y Compromiso</h3></div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              <div><p className="text-xs text-slate-400">¿Experiencia Previa?</p><p className="font-semibold text-slate-800">{form.tieneExperiencia ? 'Sí' : 'No'}</p></div>
              <div><p className="text-xs text-slate-400">¿Movilidad Propia?</p><p className="font-semibold text-slate-800">{form.cuentaMovilidad ? 'Sí' : 'No'}</p></div>
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Compromiso</p>
                <p className={`font-semibold ${form.seCompromete ? 'text-green-600' : 'text-red-500'}`}>
                  {form.seCompromete ? 'Sí, me comprometo a asistir el 4 de Octubre del 2026' : 'No confirmado'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
            <Edit3 size={16} /> Modificar / Editar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold text-sm rounded-xl shadow-lg transition-all">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Send size={14} /> <Check size={13} /> Confirmar y Acreditar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-[#00a3e8] focus:ring-1 focus:ring-[#00a3e8]'
const selectCls = 'w-full pl-10 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#00a3e8] appearance-none'

function PantallaExito({ done }: { done: { token: string; nombres: string; dni: string } }) {
  const [secs, setSecs] = useState(5)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          window.location.href = '/login'
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#c9e6f8]">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl text-center space-y-5 border border-sky-100">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Registro Exitoso!</h2>
        <p className="text-slate-500 text-sm">
          <strong>{done.nombres}</strong>, tus datos fueron registrados en el padrón oficial de Somos Perú.
        </p>
        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-left space-y-3">
          <div>
            <p className="text-xs uppercase font-semibold text-sky-600">Token de Acreditación</p>
            <p className="text-2xl font-mono font-bold text-sky-700 tracking-wider">{done.token}</p>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-sky-600">Tu DNI es tu Clave de Acceso</p>
            <p className="text-lg font-mono font-bold text-slate-700">{done.dni}</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">Guarda este token. Lo necesitarás para ingresar a la App el día de las elecciones.</p>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Redirigiendo al inicio de sesión en <span className="font-bold text-[#00a3e8]">{secs}s</span>...</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-[#00a3e8] h-1.5 rounded-full transition-all duration-1000" style={{ width: `${(secs / 5) * 100}%` }} />
          </div>
        </div>
        <a href="/login" className="block w-full py-3.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all text-center text-sm">
          → Ir a Iniciar Sesión ahora
        </a>
      </div>
    </div>
  )
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-[#00a3e8] text-white text-xs font-bold flex items-center justify-center">{num}</span>
      <h2 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">{title}</h2>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-700 mb-1.5">{children}</label>
}

function Req() { return <span className="text-rose-500">*</span> }

function FieldWrap({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">{icon}</div>
      {children}
    </div>
  )
}

function SelectWrap({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">{icon}</div>
      {children}
      <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

function ToggleBtn({ yes, onChange }: { yes: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-slate-200 p-0.5 bg-slate-50">
      <button type="button" onClick={() => onChange(true)}
        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${yes ? 'bg-[#00a3e8] text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
        Sí
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!yes ? 'bg-[#00a3e8] text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
        No
      </button>
    </div>
  )
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ token: string; nombres: string; dni: string } | null>(null)
  const [showModal, setShowModal] = useState(false)

  const [colegiosVota, setColegiosVota] = useState<string[]>([])
  const [colegiosAsignado, setColegiosAsignado] = useState<{ nombre: string; checked: boolean }[]>([])
  const [cargandoVota, setCargandoVota] = useState(false)
  const [cargandoAsignado, setCargandoAsignado] = useState(false)

  const [form, setForm] = useState<FormState>({
    nombres: '',
    dni: '',
    celular: '',
    distritoDondeVota: '',
    localVotacion: '',
    rol: 'Personero de Mesa',
    distritoAsignado: '',
    localesAsignados: [],
    localAsignado: '',
    tieneExperiencia: false,
    cuentaMovilidad: false,
    seCompromete: false,
  })

  const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }))

  const esPersonero = form.rol === 'Personero de Mesa' || form.rol === 'Personero de Local de Votación'
  const esCoordZonal = form.rol === 'Coordinador Zonal'
  const esCoordDistrital = form.rol === 'Coordinador de Distritos'

  useEffect(() => {
    if (!form.distritoDondeVota) { setColegiosVota([]); return }
    setCargandoVota(true)
    supabase.from('colegios').select('nombre').eq('distrito', form.distritoDondeVota).order('nombre')
      .then(({ data }) => { setColegiosVota((data || []).map(c => c.nombre)); setCargandoVota(false) })
  }, [form.distritoDondeVota])

  useEffect(() => {
    if (!form.distritoAsignado) { setColegiosAsignado([]); return }
    setCargandoAsignado(true)
    supabase.from('colegios').select('nombre').eq('distrito', form.distritoAsignado).order('nombre')
      .then(({ data }) => { setColegiosAsignado((data || []).map(c => ({ nombre: c.nombre, checked: false }))); setCargandoAsignado(false) })
  }, [form.distritoAsignado])

  const toggleColegio = (nombre: string) => {
    setColegiosAsignado(prev => prev.map(c => c.nombre === nombre ? { ...c, checked: !c.checked } : c))
    const sel = form.localesAsignados
    if (sel.includes(nombre)) set('localesAsignados', sel.filter(n => n !== nombre))
    else set('localesAsignados', [...sel, nombre])
  }

  const handleRevisar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.seCompromete) { setError('Debe marcar la casilla de compromiso para continuar.'); return }
    if (!form.nombres || !form.dni || !form.celular) { setError('Complete los datos personales obligatorios.'); return }
    setError('')
    setShowModal(true)
  }

  const handleConfirmar = async () => {
    setLoading(true)
    try {
      const cleanDni = form.dni.trim()
      const token = generarToken(cleanDni)
      const clave = generarClave()
      const email = `${cleanDni}@somosperu.com`
      const password = cleanDni // El password es exactamente el DNI siempre

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { nombre_completo: form.nombres } },
      })
      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo generar el identificador de usuario.')

      const localGuardado = esCoordZonal ? form.localesAsignados.join(' | ') : form.localAsignado

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
        local_asignado: localGuardado || null,
        tiene_experiencia: form.tieneExperiencia,
        cuenta_movilidad: form.cuentaMovilidad,
        se_compromete: form.seCompromete,
        token_verificacion: token,
        clave_acceso: clave,
        credencial_estado: 'Pendiente',
      })
      if (profileErr) throw profileErr

      setShowModal(false)
      setDone({ token, nombres: form.nombres, dni: cleanDni })
    } catch (err: any) {
      setShowModal(false)
      setError(err.message || 'Error al procesar el registro.')
    }
    setLoading(false)
  }

  if (done) {
    return <PantallaExito done={done} />
  }

  return (
    <div className="min-h-screen py-8 px-4 flex justify-center items-start bg-[#c9e6f8]">
      {showModal && <ModalRevision form={form} onClose={() => setShowModal(false)} onConfirm={handleConfirmar} loading={loading} />}

      <div className="w-full max-w-2xl bg-white rounded-[28px] p-6 sm:p-9 shadow-2xl border border-sky-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Registro</h1>
            <p className="text-xs font-semibold text-slate-600 mt-1">Partido Democrático Somos Perú • Elecciones Municipales 2026</p>
          </div>
          <a href="/login" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rose-200 bg-rose-50/50 text-rose-500 hover:bg-rose-100/60 font-semibold text-xs transition-colors">
            <LogIn size={14} /><span>Ingresar</span>
          </a>
        </div>

        <form onSubmit={handleRevisar} className="space-y-6">

          {/* SECCIÓN 1 */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <SectionHeader num="1" title="Datos Personales" />
            <div>
              <FieldLabel>Nombres y Apellidos <Req /></FieldLabel>
              <FieldWrap icon={<User size={18} />}>
                <input type="text" required value={form.nombres} onChange={e => set('nombres', e.target.value)}
                  placeholder="Ej. Juan Carlos Pérez Torres" className={inputCls} />
              </FieldWrap>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>D.N.I. (8 dígitos) <Req /></FieldLabel>
                <FieldWrap icon={<CreditCard size={18} />}>
                  <input type="text" required maxLength={8} value={form.dni}
                    onChange={e => set('dni', e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 12345678" className={inputCls} />
                </FieldWrap>
              </div>
              <div>
                <FieldLabel>Celular (9 dígitos) <Req /></FieldLabel>
                <FieldWrap icon={<Phone size={18} />}>
                  <input type="tel" required maxLength={9} value={form.celular}
                    onChange={e => set('celular', e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 987654321" className={inputCls} />
                </FieldWrap>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <SectionHeader num="2" title="Mi Lugar de Votación" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Distrito donde Vota <Req /></FieldLabel>
                <SelectWrap icon={<MapPin size={18} />}>
                  <select value={form.distritoDondeVota}
                    onChange={e => { set('distritoDondeVota', e.target.value); set('localVotacion', '') }}
                    className={selectCls}>
                    <option value="">Seleccione Distrito</option>
                    {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </SelectWrap>
              </div>
              <div>
                <FieldLabel>Local / Colegio de Votación <Req /></FieldLabel>
                <SelectWrap icon={<Building2 size={18} />}>
                  {colegiosVota.length > 0 ? (
                    <select value={form.localVotacion} onChange={e => set('localVotacion', e.target.value)} className={selectCls}>
                      <option value="">Seleccione un local ({colegiosVota.length})</option>
                      {colegiosVota.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.localVotacion} disabled={!form.distritoDondeVota}
                      onChange={e => set('localVotacion', e.target.value)}
                      placeholder={cargandoVota ? 'Cargando...' : form.distritoDondeVota ? 'Escriba el local...' : 'Primero seleccione un distrito'}
                      className={`${inputCls} disabled:bg-slate-50`} />
                  )}
                </SelectWrap>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3 */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <SectionHeader num="3" title="Rol y Asignación Electoral" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { id: 'Personero de Mesa', icon: Shield, title: 'Personero de Mesa' },
                { id: 'Personero de Local de Votación', icon: Building2, title: 'Personero de Local de Votación' },
                { id: 'Coordinador Zonal', icon: Layers, title: 'Coordinador Zonal' },
                { id: 'Coordinador de Distritos', icon: MapPin, title: 'Coordinador Distrital' },
              ] as const).map(item => {
                const Icon = item.icon
                const sel = form.rol === item.id
                return (
                  <button key={item.id} type="button"
                    onClick={() => { set('rol', item.id as Rol); set('distritoAsignado', ''); set('localAsignado', ''); set('localesAsignados', []) }}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${sel ? 'bg-[#00a3e8] border-[#00a3e8] text-white shadow-md shadow-sky-500/20' : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'}`}>
                    <div className={sel ? 'text-white' : 'text-slate-500'}><Icon size={20} /></div>
                    <span className="text-xs font-bold leading-tight">{item.title}</span>
                  </button>
                )
              })}
            </div>

            {/* Personero de Mesa / Local */}
            {esPersonero && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <FieldLabel>Distrito Asignado <Req /></FieldLabel>
                  <SelectWrap icon={<MapPin size={18} />}>
                    <select value={form.distritoAsignado}
                      onChange={e => { set('distritoAsignado', e.target.value); set('localAsignado', '') }}
                      className={selectCls}>
                      <option value="">Seleccione Distrito</option>
                      {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </SelectWrap>
                </div>
                <div>
                  <FieldLabel>Local de Votación Asignado <Req /></FieldLabel>
                  <SelectWrap icon={<Building2 size={18} />}>
                    {colegiosAsignado.length > 0 ? (
                      <select value={form.localAsignado} onChange={e => set('localAsignado', e.target.value)} className={selectCls}>
                        <option value="">Seleccione el local ({colegiosAsignado.length})</option>
                        {colegiosAsignado.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={form.localAsignado} disabled={!form.distritoAsignado}
                        onChange={e => set('localAsignado', e.target.value)}
                        placeholder={cargandoAsignado ? 'Cargando...' : form.distritoAsignado ? 'Escriba el local...' : 'Primero seleccione un distrito'}
                        className={`${inputCls} disabled:bg-slate-50`} />
                    )}
                  </SelectWrap>
                </div>
              </div>
            )}

            {/* Coordinador Zonal: multi-select */}
            {esCoordZonal && (
              <div className="space-y-4 pt-2">
                <div>
                  <FieldLabel>Distrito Asignado (Seleccione Distrito de la Zona) <Req /></FieldLabel>
                  <SelectWrap icon={<MapPin size={18} />}>
                    <select value={form.distritoAsignado}
                      onChange={e => { set('distritoAsignado', e.target.value); set('localesAsignados', []) }}
                      className={selectCls}>
                      <option value="">Seleccione Distrito de la Zona</option>
                      {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </SelectWrap>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel>Colegios / Locales de la Zona <Req /></FieldLabel>
                    <span className="text-xs text-slate-400">(Escoger de 1 a más colegios)</span>
                  </div>
                  {cargandoAsignado && <p className="text-xs text-slate-400 py-2">Cargando colegios...</p>}
                  {!cargandoAsignado && !form.distritoAsignado && <p className="text-xs text-slate-400 py-2">Primero seleccione un distrito de la zona</p>}
                  {!cargandoAsignado && colegiosAsignado.length > 0 && (
                    <>
                      <SelectWrap icon={<Building2 size={18} />}>
                        <select className={selectCls} value="" onChange={e => { if (e.target.value) toggleColegio(e.target.value) }}>
                          <option value="">Agregar colegio al listado...</option>
                          {colegiosAsignado.filter(c => !c.checked).map(c => (
                            <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                          ))}
                        </select>
                      </SelectWrap>
                      {form.localesAsignados.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {form.localesAsignados.map(n => (
                            <span key={n} className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-sky-700 text-xs font-semibold rounded-full">
                              {n}
                              <button type="button" onClick={() => toggleColegio(n)} className="hover:text-red-500"><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Coordinador Distrital: solo distrito */}
            {esCoordDistrital && (
              <div className="pt-2">
                <FieldLabel>Distrito Asignado (Donde es Coordinador) <Req /></FieldLabel>
                <SelectWrap icon={<MapPin size={18} />}>
                  <select value={form.distritoAsignado} onChange={e => set('distritoAsignado', e.target.value)} className={selectCls}>
                    <option value="">Seleccione Distrito del que es Coordinador</option>
                    {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </SelectWrap>
              </div>
            )}
          </div>

          {/* SECCIÓN 4 */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <SectionHeader num="4" title="Compromiso y Logística" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>¿Tiene Experiencia como Personero? <Req /></FieldLabel>
                <ToggleBtn yes={form.tieneExperiencia} onChange={v => set('tieneExperiencia', v)} />
              </div>
              <div>
                <FieldLabel>¿Cuenta con Movilidad Propia? <Req /></FieldLabel>
                <ToggleBtn yes={form.cuentaMovilidad} onChange={v => set('cuentaMovilidad', v)} />
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/50 cursor-pointer transition-colors">
              <input type="checkbox" checked={form.seCompromete} onChange={e => set('seCompromete', e.target.checked)}
                className="w-4 h-4 rounded text-[#00a3e8] focus:ring-[#00a3e8] border-slate-300" />
              <span className="text-xs font-bold text-slate-800">
                Sí, me comprometo a asistir el 4 de Octubre del 2026 <span className="text-rose-500">*</span>
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">{error}</div>
          )}

          <button type="submit"
            className="w-full py-4 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2">
            <Check size={18} strokeWidth={2.5} />
            <span>Revisar y Continuar Registro</span>
          </button>
        </form>
      </div>
    </div>
  )
}
