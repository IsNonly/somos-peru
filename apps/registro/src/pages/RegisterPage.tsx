import { useState, useEffect, useRef } from 'react'
import { supabase, generarToken, generarClave4 } from '../lib/supabase'
import type { Rol } from '../lib/supabase'
import {
  User, Phone, CreditCard, MapPin, Building2, Check,
  LogIn, Shield, CheckCircle2, ChevronDown, X, Send, Edit3,
  Layers, Landmark, Map as MapIcon
} from 'lucide-react'

type FormState = {
  nombres: string
  dni: string
  celular: string
  departamentoVota: string
  provinciaVota: string
  distritoDondeVota: string
  localVotacion: string
  rol: Rol
  departamentoAsignado: string
  provinciaAsignado: string
  distritoAsignado: string
  localesAsignados: string[]
  localAsignado: string
  tieneExperiencia: boolean
  cuentaMovilidad: boolean
  seCompromete: boolean
}

type ProvinciaRow = { departamento: string; provincia: string }

function ModalRevision({ form, onClose, onConfirm, loading }: {
  form: FormState; onClose: () => void; onConfirm: () => void; loading: boolean
}) {
  const esCoordProvincial = form.rol === 'Coordinador Provincial'
  const esCoordDistrital = form.rol === 'Coordinador Distrital'
  const esColegioMultiple = esCoordProvincial || esCoordDistrital
  const localMostrado = esColegioMultiple ? form.localesAsignados.join(', ') : form.localAsignado

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
              <div><p className="text-xs text-slate-400">Departamento</p><p className="font-semibold text-slate-800">{form.departamentoVota || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Provincia</p><p className="font-semibold text-slate-800">{form.provinciaVota || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Distrito</p><p className="font-semibold text-slate-800">{form.distritoDondeVota || '—'}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-50 px-4 py-2"><h3 className="text-xs font-extrabold text-[#00a3e8] uppercase tracking-wider">3. Asignación Electoral</h3></div>
            <div className="p-4 text-sm space-y-2">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <p className="text-xs text-slate-400">Rol Solicitado</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-bold rounded-full">{form.rol}</span>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Departamento</p>
                  <p className="font-semibold text-slate-800">{form.departamentoAsignado || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Provincia</p>
                  <p className="font-semibold text-slate-800">{form.provinciaAsignado || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Distrito Asignado</p>
                  <p className="font-semibold text-slate-800">{form.distritoAsignado || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">
                  {esCoordProvincial ? 'Colegios / Locales de la Provincia' : esCoordDistrital ? 'Colegios a Cargo' : 'Local Asignado'}
                </p>
                <p className="font-semibold text-slate-800">{localMostrado || '—'}</p>
              </div>
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

function PantallaExito({ done }: { done: { token: string; nombres: string; dni: string; clave: string; esMesa: boolean } }) {
  const [secs, setSecs] = useState(8)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          // Ya quedó logueado tras el registro -> directo a los pasos de capacitación.
          window.location.href = '/capacitate'
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const pasos = [
    'Ver el video de capacitación completo, 2 veces',
    'Leer la Cartilla del Personero (mín. 1 min)',
    'Aprobar la evaluación (4 de 5 preguntas)',
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#c9e6f8]">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl text-center space-y-5 border border-sky-100">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">¡Datos registrados!</h2>
        <p className="text-slate-500 text-sm">
          <strong>{done.nombres}</strong>, quedaste en el padrón. Tu cuenta está
          <span className="font-bold text-amber-600"> PENDIENTE</span> — falta un último paso.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
          <p className="text-sm font-bold text-amber-800 mb-2">Para habilitar tu cuenta debes completar la capacitación:</p>
          <ul className="space-y-1.5">
            {pasos.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                <span className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-700 mt-2">
            Sin estos pasos <strong>no podrás ingresar</strong> a la app de conteo el día de las elecciones.
          </p>
        </div>

        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-left space-y-3">
          <div>
            <p className="text-xs uppercase font-semibold text-sky-600">Token de Acreditación</p>
            <p className="text-2xl font-mono font-bold text-sky-700 tracking-wider">{done.token}</p>
          </div>
          <div>
            <p className="text-xs uppercase font-semibold text-sky-600">
              {done.esMesa ? 'Tu DNI es tu Clave de Acceso' : 'Tu Clave de Acceso (guárdala, la necesitas para ingresar)'}
            </p>
            <p className="text-lg font-mono font-bold text-slate-700">{done.clave}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Te llevamos a la capacitación en <span className="font-bold text-[#00a3e8]">{secs}s</span>…
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-[#00a3e8] h-1.5 rounded-full transition-all duration-1000" style={{ width: `${(secs / 8) * 100}%` }} />
          </div>
        </div>

        <a href="/capacitate" className="block w-full py-3.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all text-center text-sm">
          → Empezar la capacitación ahora
        </a>
        <a href="/login" className="block text-xs text-slate-400 hover:text-slate-600">
          Prefiero iniciar sesión más tarde
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

function GeoSelect({ label, icon, value, onChange, options, disabled, placeholder }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void
  options: string[]; disabled?: boolean; placeholder: string
}) {
  return (
    <div>
      <FieldLabel>{label} <Req /></FieldLabel>
      <SelectWrap icon={icon}>
        <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
          className={`${selectCls} disabled:bg-slate-50 disabled:text-slate-400`}>
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </SelectWrap>
    </div>
  )
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ token: string; nombres: string; dni: string; clave: string; esMesa: boolean } | null>(null)
  const [showModal, setShowModal] = useState(false)

  const [colegiosAsignado, setColegiosAsignado] = useState<{ nombre: string; checked: boolean }[]>([])
  const [cargandoAsignado, setCargandoAsignado] = useState(false)
  const [colegiosReservados, setColegiosReservados] = useState<Set<string>>(new Set())

  // Ubigeo nacional (CALI.xlsx) para la cascada Departamento → Provincia → Distrito
  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [provincias, setProvincias] = useState<ProvinciaRow[]>([])
  const [distritosVota, setDistritosVota] = useState<string[]>([])
  const [distritosAsignado, setDistritosAsignado] = useState<string[]>([])

  const [form, setForm] = useState<FormState>({
    nombres: '',
    dni: '',
    celular: '',
    departamentoVota: '',
    provinciaVota: '',
    distritoDondeVota: '',
    localVotacion: '',
    rol: 'Personero de Mesa',
    departamentoAsignado: '',
    provinciaAsignado: '',
    distritoAsignado: '',
    localesAsignados: [],
    localAsignado: '',
    tieneExperiencia: false,
    cuentaMovilidad: false,
    seCompromete: false,
  })

  const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }))

  const esPersonero = form.rol === 'Personero de Mesa' || form.rol === 'Personero de Centro de Votación'
  const esCoordProvincial = form.rol === 'Coordinador Provincial'
  const esCoordDistrital = form.rol === 'Coordinador Distrital'
  const esCoordRegional = form.rol === 'Coordinador Regional'
  const esColegioMultiple = esCoordProvincial || esCoordDistrital

  // Cascada "lugar de votación": al cambiar un nivel se limpian los inferiores
  const setDepVota = (v: string) => setForm(p => ({ ...p, departamentoVota: v, provinciaVota: '', distritoDondeVota: '', localVotacion: '' }))
  const setProvVota = (v: string) => setForm(p => ({ ...p, provinciaVota: v, distritoDondeVota: '', localVotacion: '' }))
  const setDistVota = (v: string) => setForm(p => ({ ...p, distritoDondeVota: v, localVotacion: '' }))

  // Cascada "asignación electoral"
  const setDepAsig = (v: string) => setForm(p => ({ ...p, departamentoAsignado: v, provinciaAsignado: '', distritoAsignado: '', localAsignado: '', localesAsignados: [] }))
  const setProvAsig = (v: string) => setForm(p => ({ ...p, provinciaAsignado: v, distritoAsignado: '', localAsignado: '', localesAsignados: [] }))
  const setDistAsig = (v: string) => setForm(p => ({ ...p, distritoAsignado: v, localAsignado: '', localesAsignados: [] }))

  const provinciasVota = provincias.filter(p => p.departamento === form.departamentoVota).map(p => p.provincia)
  const provinciasAsignado = provincias.filter(p => p.departamento === form.departamentoAsignado).map(p => p.provincia)

  const cascadaAsignado = (distLabel: string) => (
    <>
      <GeoSelect label="Departamento" icon={<Landmark size={18} />}
        value={form.departamentoAsignado} onChange={setDepAsig}
        options={departamentos} placeholder="Seleccione Departamento" />
      <GeoSelect label="Provincia" icon={<MapIcon size={18} />}
        value={form.provinciaAsignado} onChange={setProvAsig}
        options={provinciasAsignado} disabled={!form.departamentoAsignado}
        placeholder={form.departamentoAsignado ? 'Seleccione Provincia' : 'Primero el departamento'} />
      <GeoSelect label={distLabel} icon={<MapPin size={18} />}
        value={form.distritoAsignado} onChange={setDistAsig}
        options={distritosAsignado} disabled={!form.provinciaAsignado}
        placeholder={form.provinciaAsignado ? 'Seleccione Distrito' : 'Primero la provincia'} />
    </>
  )

  useEffect(() => {
    supabase.from('vista_departamentos').select('departamento')
      .then(({ data }) => setDepartamentos((data || []).map((d: any) => d.departamento)))
    supabase.from('vista_provincias').select('departamento, provincia')
      .then(({ data }) => setProvincias((data || []) as ProvinciaRow[]))
  }, [])

  useEffect(() => {
    if (!form.departamentoVota || !form.provinciaVota) { setDistritosVota([]); return }
    supabase.from('vista_ubigeo').select('distrito')
      .eq('departamento', form.departamentoVota).eq('provincia', form.provinciaVota).order('distrito')
      .then(({ data }) => setDistritosVota((data || []).map((d: any) => d.distrito)))
  }, [form.departamentoVota, form.provinciaVota])

  useEffect(() => {
    if (!form.departamentoAsignado || !form.provinciaAsignado) { setDistritosAsignado([]); return }
    supabase.from('vista_ubigeo').select('distrito')
      .eq('departamento', form.departamentoAsignado).eq('provincia', form.provinciaAsignado).order('distrito')
      .then(({ data }) => setDistritosAsignado((data || []).map((d: any) => d.distrito)))
  }, [form.departamentoAsignado, form.provinciaAsignado])

  useEffect(() => {
    if (!form.distritoAsignado) { setColegiosAsignado([]); return }
    setCargandoAsignado(true)
    supabase.from('colegios').select('nombre')
      .eq('departamento', form.departamentoAsignado).eq('provincia', form.provinciaAsignado).eq('distrito', form.distritoAsignado)
      .order('nombre')
      .then(({ data }) => { setColegiosAsignado((data || []).map(c => ({ nombre: c.nombre, checked: false }))); setCargandoAsignado(false) })
  }, [form.distritoAsignado])

  // Un colegio ya asignado a un Coordinador Distrital no debe aparecer para el siguiente registro
  // de ese mismo rol (solo aplica a "Coordinador Distrital", no a Personero ni Coordinador Provincial).
  // Se busca por los 3 nombres que puede tener guardado el rol en la base (ver lib/panel.ts rolNorm).
  useEffect(() => {
    if (!esCoordDistrital || !form.distritoAsignado) { setColegiosReservados(new Set()); return }
    supabase.from('profiles').select('local_asignado')
      .in('rol', ['Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal'])
      .eq('distrito_asignado', form.distritoAsignado)
      .then(({ data }) => {
        const set = new Set<string>()
        for (const row of data ?? []) {
          String((row as any).local_asignado ?? '').split(/[,|]/).map(s => s.trim()).filter(Boolean).forEach(n => set.add(n))
        }
        setColegiosReservados(set)
      })
  }, [esCoordDistrital, form.distritoAsignado])

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
      const email = `${cleanDni}@somosperu.com`
      // Personero de Mesa: su contraseña es el DNI. Los otros 3 roles (Personero de
      // Centro de Votación, Coordinador Provincial, Coordinador Distrital): una clave
      // numérica aleatoria de 4 dígitos, que también queda como contraseña real de login.
      const esMesa = form.rol === 'Personero de Mesa'
      const clave = esMesa ? cleanDni : generarClave4()
      const password = clave

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email, password,
        options: { data: { nombre_completo: form.nombres } },
      })
      if (authErr) throw authErr

      const userId = authData.user?.id
      if (!userId) throw new Error('No se pudo generar el identificador de usuario.')

      const localGuardado = esColegioMultiple ? form.localesAsignados.join(' | ') : form.localAsignado

      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        nombre_completo: form.nombres,
        dni: cleanDni,
        celular: form.celular,
        correo: email,
        departamento_vota: form.departamentoVota || null,
        provincia_vota: form.provinciaVota || null,
        distrito_vota: form.distritoDondeVota || null,
        local_votacion: form.localVotacion || null,
        rol: form.rol,
        departamento_asignado: form.departamentoAsignado || null,
        provincia_asignado: form.provinciaAsignado || null,
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
      setDone({ token, nombres: form.nombres, dni: cleanDni, clave, esMesa })
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
            <p className="text-xs font-semibold text-slate-600 mt-1">Partido Democrático Somos Perú • Elecciones Regionales y Municipales 2026</p>
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
              <GeoSelect label="Departamento" icon={<Landmark size={18} />}
                value={form.departamentoVota} onChange={setDepVota}
                options={departamentos} placeholder="Seleccione Departamento" />
              <GeoSelect label="Provincia" icon={<MapIcon size={18} />}
                value={form.provinciaVota} onChange={setProvVota}
                options={provinciasVota} disabled={!form.departamentoVota}
                placeholder={form.departamentoVota ? 'Seleccione Provincia' : 'Primero el departamento'} />
              <GeoSelect label="Distrito donde Vota" icon={<MapPin size={18} />}
                value={form.distritoDondeVota} onChange={setDistVota}
                options={distritosVota} disabled={!form.provinciaVota}
                placeholder={form.provinciaVota ? 'Seleccione Distrito' : 'Primero la provincia'} />
            </div>
          </div>

          {/* SECCIÓN 3 */}
          <div className="border border-sky-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <SectionHeader num="3" title="Rol Electoral" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { id: 'Coordinador Provincial', icon: Layers, title: 'Coordinador Provincial' },
                { id: 'Coordinador Distrital', icon: MapPin, title: 'Coordinador Distrital' },
                { id: 'Personero de Centro de Votación', icon: Building2, title: 'Personero de Centro de Votación' },
                { id: 'Personero de Mesa', icon: Shield, title: 'Personero de Mesa' },
                { id: 'Coordinador Regional', icon: Landmark, title: 'Coordinador Regional' },
              ] as const).map(item => {
                const Icon = item.icon
                const sel = form.rol === item.id
                return (
                  <button key={item.id} type="button"
                    onClick={() => setForm(p => ({ ...p, rol: item.id as Rol, departamentoAsignado: '', provinciaAsignado: '', distritoAsignado: '', localAsignado: '', localesAsignados: [] }))}
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
                {cascadaAsignado('Distrito Asignado')}
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

            {/* Coordinador Regional: solo elige el departamento a su cargo */}
            {esCoordRegional && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <GeoSelect label="Departamento" icon={<Landmark size={18} />}
                  value={form.departamentoAsignado} onChange={setDepAsig}
                  options={departamentos} placeholder="Seleccione Departamento" />
              </div>
            )}

            {/* Coordinador Provincial: multi-select de locales */}
            {esCoordProvincial && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {cascadaAsignado('Distrito de la Provincia')}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel>Colegios / Locales de la Provincia <Req /></FieldLabel>
                    <span className="text-xs text-slate-400">(Escoger de 1 a más colegios)</span>
                  </div>
                  {cargandoAsignado && <p className="text-xs text-slate-400 py-2">Cargando colegios...</p>}
                  {!cargandoAsignado && !form.distritoAsignado && <p className="text-xs text-slate-400 py-2">Primero seleccione un distrito</p>}
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

            {/* Coordinador Distrital: distrito + colegios a cargo (excluye los ya tomados por otro Coord. Distrital) */}
            {esCoordDistrital && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {cascadaAsignado('Distrito del que es Coordinador')}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <FieldLabel>Colegios a Cargo <Req /></FieldLabel>
                    <span className="text-xs text-slate-400">(Escoger de 1 a más colegios)</span>
                  </div>
                  {cargandoAsignado && <p className="text-xs text-slate-400 py-2">Cargando colegios...</p>}
                  {!cargandoAsignado && !form.distritoAsignado && <p className="text-xs text-slate-400 py-2">Primero seleccione un distrito</p>}
                  {!cargandoAsignado && form.distritoAsignado && colegiosAsignado.length === 0 && (
                    <p className="text-xs text-slate-400 py-2">No hay colegios registrados en este distrito.</p>
                  )}
                  {!cargandoAsignado && colegiosAsignado.length > 0 && (
                    <>
                      <SelectWrap icon={<Building2 size={18} />}>
                        <select className={selectCls} value="" onChange={e => { if (e.target.value) toggleColegio(e.target.value) }}>
                          <option value="">Agregar colegio al listado...</option>
                          {colegiosAsignado.filter(c => !c.checked && !colegiosReservados.has(c.nombre)).map(c => (
                            <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                          ))}
                        </select>
                      </SelectWrap>
                      {colegiosReservados.size > 0 && (
                        <p className="text-[11px] text-amber-600 mt-1.5">
                          {colegiosReservados.size} colegio{colegiosReservados.size === 1 ? '' : 's'} de este distrito ya tiene{colegiosReservados.size === 1 ? '' : 'n'} un Coordinador Distrital asignado y no aparece{colegiosReservados.size === 1 ? '' : 'n'} en la lista.
                        </p>
                      )}
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
