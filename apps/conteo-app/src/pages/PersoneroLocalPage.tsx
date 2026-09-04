import { useEffect, useState, useCallback } from 'react'
import { supabase, getMiPerfil } from '../lib/supabase'
import {
  Shield, School, MapPin, RefreshCw, LogOut, Search, Users,
  CheckCircle2, Clock, Loader,
} from 'lucide-react'

type Personero = {
  id: string
  nombre: string
  dni: string
  celular: string | null
  mesa: string | null
  marcadoAt: string | null
}

const horaPE = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

export default function PersoneroLocalPage() {
  const [perfil, setPerfil]       = useState<any>(null)
  const [personeros, setPersoneros] = useState<Personero[]>([])
  const [totalMesas, setTotalMesas] = useState(0)
  const [tab, setTab]             = useState<'todos' | 'marcados' | 'pendientes'>('todos')
  const [q, setQ]                 = useState('')
  const [loading, setLoading]     = useState(true)
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [lastSync, setLastSync]   = useState<Date>(new Date())

  const cargar = useCallback(async () => {
    setLoading(true)
    const p = await getMiPerfil<any>(
      'id, nombre_completo, dni, rol, distrito_asignado, distrito_vota, local_asignado, credencial_estado',
    )
    if (!p) { setLoading(false); return }
    setPerfil(p)

    const local: string | null = p?.local_asignado ?? null
    if (local) {
      const { data: pers } = await supabase
        .from('profiles')
        .select('id, nombre_completo, dni, celular, mesa_asignada, asistencia_local_at')
        .eq('local_asignado', local)
        .eq('rol', 'Personero de Mesa')
        .order('nombre_completo')

      setPersoneros((pers ?? []).map((x: any) => ({
        id: x.id,
        nombre: x.nombre_completo,
        dni: x.dni,
        celular: x.celular,
        mesa: x.mesa_asignada,
        marcadoAt: x.asistencia_local_at,
      })))

      const { data: col } = await supabase
        .from('colegios')
        .select('total_mesas')
        .eq('nombre', local)
        .limit(1)
        .maybeSingle()
      setTotalMesas(col?.total_mesas || (pers?.length ?? 0))
    }

    setLastSync(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const marcar = async (per: Personero) => {
    setSavingId(per.id)
    const nuevo = per.marcadoAt ? null : new Date().toISOString()
    const { error } = await supabase
      .from('profiles')
      .update({ asistencia_local_at: nuevo, asistencia_local_por: nuevo ? (perfil?.id ?? null) : null })
      .eq('id', per.id)
    if (!error) {
      setPersoneros(prev => prev.map(x => x.id === per.id ? { ...x, marcadoAt: nuevo } : x))
    }
    setSavingId(null)
  }

  const marcados   = personeros.filter(p => p.marcadoAt).length
  const pendientes = personeros.length - marcados
  const faltan     = Math.max(0, totalMesas - marcados)

  const filtrados = personeros.filter(p => {
    const okTab = tab === 'todos' ? true : tab === 'marcados' ? !!p.marcadoAt : !p.marcadoAt
    const s = q.trim().toLowerCase()
    const okQ = !s || p.nombre.toLowerCase().includes(s) || p.dni.includes(s) || (p.mesa ?? '').includes(s)
    return okTab && okQ
  })

  const distrito = perfil?.distrito_asignado ?? perfil?.distrito_vota ?? '—'

  if (loading) return (
    <div className="min-h-svh flex items-center justify-center bg-[#0b0f19]">
      <div className="text-center space-y-3">
        <Loader className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
        <p className="text-white/40 text-sm">Cargando datos del local…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-svh bg-[#0b0f19] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#0d1327] border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded border-2 border-sky-400 text-sky-400 text-xs font-black flex items-center justify-center">✓</span>
          <span className="font-extrabold">VotoReal</span>
          <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 rounded-full px-2 py-0.5">Móvil</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar}
            className="w-8 h-8 rounded-lg border border-white/10 text-white/50 flex items-center justify-center">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => supabase.auth.signOut()}
            className="px-3 h-8 rounded-lg bg-red-500/90 text-white text-xs font-semibold flex items-center gap-1.5">
            <LogOut size={13} /> Salir
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3.5">

        {/* Tarjeta personero de local */}
        <div className="bg-gradient-to-br from-sky-950/70 to-[#0d1327] border border-sky-500/40 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 flex items-center justify-center flex-shrink-0">
            <Shield size={20} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
              Personero de Local de Votación
              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">APROBADO</span>
            </p>
            <p className="font-extrabold text-sm mt-0.5 truncate">{perfil?.nombre_completo ?? '—'}</p>
            <p className="text-white/45 text-xs mt-0.5">
              DNI: <span className="text-white/80 font-medium">{perfil?.dni ?? '—'}</span>
              {' · '}Distrito: <span className="text-sky-400 font-medium">{distrito}</span>
            </p>
          </div>
        </div>

        {/* Local asignado + métricas */}
        <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 flex items-center justify-center flex-shrink-0">
              <School size={20} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Mi local asignado:</p>
              <p className="font-extrabold text-sm mt-0.5">{perfil?.local_asignado ?? 'Sin local asignado'}</p>
              <p className="text-white/45 text-xs mt-1 flex items-center gap-1">
                <MapPin size={12} className="text-sky-400" /> {distrito}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Metrica label="Total Mesas Oficiales" value={totalMesas} tone="plain" />
            <Metrica label="Asistencias Marcadas" value={marcados} tone="ok" />
            <Metrica label="Faltan por Marcar" value={faltan} tone="warn" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {([
            ['todos', `Todos (${personeros.length})`, 'sky'],
            ['marcados', `Marcados (${marcados})`, 'emerald'],
            ['pendientes', `Pendientes (${pendientes})`, 'amber'],
          ] as const).map(([k, label, tone]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                tab === k
                  ? tone === 'sky'     ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : tone === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  :                      'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-[#131a2e] border-white/8 text-white/45'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar personero por nombre, DNI o mesa…"
            className="w-full bg-[#131a2e] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-white/25 outline-none focus:border-sky-500/50" />
        </div>

        {/* Lista */}
        <div className="bg-[#131a2e] border border-white/8 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="flex items-center gap-2 text-sky-300 text-xs font-bold uppercase tracking-wider">
              <Users size={14} /> Mesas y personeros asignados ({filtrados.length})
            </span>
            <span className="text-amber-400 text-[11px] font-bold tracking-wide">
              FALTAN {faltan} MESAS POR MARCAR
            </span>
          </div>

          {filtrados.length === 0 ? (
            <div className="py-10 text-center text-white/30 text-sm">
              No hay personeros con esos filtros.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filtrados.map(p => (
                <div key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 ${p.marcadoAt ? 'bg-emerald-500/[0.05]' : ''}`}>
                  <div className={`w-14 h-8 rounded-md text-[10px] font-black flex items-center justify-center flex-shrink-0 border ${
                    p.marcadoAt ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' : 'bg-[#0b0f1d] border-white/10 text-white/40'
                  }`}>
                    {p.mesa || 'N/A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.nombre}</p>
                    <p className="text-white/40 text-[11px] mt-0.5 truncate">
                      DNI: {p.dni}{p.celular ? ` · ${p.celular}` : ''}
                    </p>
                    <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${p.marcadoAt ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {p.marcadoAt
                        ? <><CheckCircle2 size={11} /> Marcado {horaPE(p.marcadoAt)}</>
                        : <><Clock size={11} /> Pendiente de Asistencia</>}
                    </p>
                  </div>
                  <button onClick={() => marcar(p)} disabled={savingId === p.id}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 flex-shrink-0 transition-all disabled:opacity-50 ${
                      p.marcadoAt
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    }`}>
                    {savingId === p.id
                      ? <Loader size={13} className="animate-spin" />
                      : p.marcadoAt ? 'Quitar' : 'Marcar Asistencia'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-white/25 text-[11px]">
          Última actualización: {lastSync.toLocaleTimeString('es-PE')} · Sistema Electoral 2026
        </p>
      </div>
    </div>
  )
}

function Metrica({ label, value, tone }: {
  label: string; value: number; tone: 'plain' | 'ok' | 'warn'
}) {
  const cls =
    tone === 'ok'   ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-400' :
    tone === 'warn' ? 'bg-amber-500/8 border-amber-500/25 text-amber-400' :
                      'bg-[#0b0f1d] border-white/10 text-white'
  return (
    <div className={`rounded-xl border p-2.5 text-center ${cls}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wide leading-tight opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  )
}
