import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { UserCheck, MapPin, Clock, AlertTriangle, Search, RefreshCw } from 'lucide-react'

interface Asistencia {
  id: string
  user_id: string
  distrito: string
  colegio_nombre: string
  latitude: number
  longitude: number
  tipo: string
  confirmada: boolean
  created_at: string
  profiles?: { nombre_completo: string; dni: string; rol: string }
}

interface Coordinador {
  id: string
  nombre_completo: string
  dni: string
  rol: string
  distrito_asignado: string
  credencial_estado: string
  acta_transmitida: boolean
  fecha_registro: string
}

export default function CoordinadoresPage() {
  const [coordinadores, setCoordinadores] = useState<Coordinador[]>([])
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [distFilter, setDistFilter] = useState('')
  const [tab, setTab] = useState<'coordinadores' | 'asistencias'>('coordinadores')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: coords }, { data: asist }] = await Promise.all([
      supabase.from('profiles')
        .select('id, nombre_completo, dni, rol, distrito_asignado, credencial_estado, acta_transmitida, fecha_registro')
        .in('rol', ['Coordinador de Distritos', 'Coordinador Zonal', 'Coordinador de Local'])
        .order('distrito_asignado'),
      supabase.from('asistencias')
        .select('*, profiles(nombre_completo, dni, rol)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setCoordinadores((coords ?? []) as Coordinador[])
    setAsistencias((asist ?? []) as Asistencia[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const distritos = [...new Set(coordinadores.map(c => c.distrito_asignado).filter(Boolean))].sort()

  const filteredCoords = coordinadores.filter(c =>
    (!search || c.nombre_completo?.toLowerCase().includes(search.toLowerCase()) || c.dni?.includes(search)) &&
    (!distFilter || c.distrito_asignado === distFilter)
  )

  const filteredAsist = asistencias.filter(a =>
    (!search || a.profiles?.nombre_completo?.toLowerCase().includes(search.toLowerCase())) &&
    (!distFilter || a.distrito === distFilter)
  )

  const confirmarAsistencia = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('asistencias').update({ confirmada: true, confirmada_por: user!.id }).eq('id', id)
    setAsistencias(prev => prev.map(a => a.id === id ? { ...a, confirmada: true } : a))
  }

  const rolColor = (rol: string) => {
    if (rol.includes('Distritos')) return 'bg-blue-500/20 text-blue-300'
    if (rol.includes('Zonal'))    return 'bg-cyan-500/20 text-cyan-300'
    return 'bg-green-500/20 text-green-300'
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Control de Personal</p>
          <h1 className="text-white text-2xl font-bold">Coordinadores</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#16162a] border border-white/8 hover:bg-white/5 text-white/60 rounded-xl text-sm transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border border-white/8 rounded-xl overflow-hidden w-fit">
        {(['coordinadores', 'asistencias'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-all
              ${tab === t ? 'bg-brand-red text-white' : 'bg-[#16162a] text-white/50 hover:text-white'}`}>
            {t === 'coordinadores' ? `Coordinadores (${filteredCoords.length})` : `Llegadas GPS (${filteredAsist.length})`}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o DNI…"
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
        </div>
        <select value={distFilter} onChange={e => setDistFilter(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los distritos</option>
          {distritos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Resumen llegadas */}
      {tab === 'asistencias' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#16162a] border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-white text-2xl font-bold">{asistencias.length}</p>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Llegadas totales</p>
          </div>
          <div className="bg-[#16162a] border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-green-400 text-2xl font-bold">{asistencias.filter(a => a.confirmada).length}</p>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Confirmadas</p>
          </div>
          <div className="bg-[#16162a] border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-yellow-400 text-2xl font-bold">{asistencias.filter(a => !a.confirmada).length}</p>
            <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Pendientes</p>
          </div>
        </div>
      )}

      {/* Tabla coordinadores */}
      {tab === 'coordinadores' && (
        <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/30 text-white/40 text-xs uppercase tracking-wide">
                  {['Nombre','DNI','Rol','Distrito','Credencial','Acta'].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? Array.from({length:8}).map((_,i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-4"><div className="h-3 bg-white/5 rounded w-3/4"/></td>)}
                  </tr>
                )) : filteredCoords.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-white/30">Sin coordinadores</td></tr>
                ) : filteredCoords.map(c => (
                  <tr key={c.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{c.nombre_completo}</td>
                    <td className="px-4 py-3 text-white/60 font-mono">{c.dni}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rolColor(c.rol)}`}>
                        {c.rol.replace('Coordinador de ','').replace('Coordinador ','').trim()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">{c.distrito_asignado ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${c.credencial_estado === 'Confirmado' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {c.credencial_estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.acta_transmitida
                        ? <UserCheck size={15} className="text-green-400" />
                        : <Clock size={15} className="text-white/20" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de asistencias GPS */}
      {tab === 'asistencias' && (
        <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/30 text-white/40 text-xs uppercase tracking-wide">
                  {['Coordinador','Distrito','Colegio','Tipo','Hora','Estado','Acción'].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? Array.from({length:5}).map((_,i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({length:7}).map((_,j) => <td key={j} className="px-4 py-4"><div className="h-3 bg-white/5 rounded w-3/4"/></td>)}
                  </tr>
                )) : filteredAsist.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-white/30">Sin llegadas registradas</td></tr>
                ) : filteredAsist.map(a => (
                  <tr key={a.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{a.profiles?.nombre_completo ?? '—'}</td>
                    <td className="px-4 py-3 text-white/60">{a.distrito}</td>
                    <td className="px-4 py-3 text-white/60 max-w-[180px] truncate">{a.colegio_nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${a.tipo === 'LLEGADA' ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}`}>
                        {a.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 tabular-nums text-xs whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      {a.confirmada
                        ? <span className="text-green-400 text-xs font-semibold">Confirmada</span>
                        : <span className="text-yellow-400 text-xs">Pendiente</span>}
                    </td>
                    <td className="px-4 py-3">
                      {!a.confirmada && (
                        <button onClick={() => confirmarAsistencia(a.id)}
                          className="px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-xs font-medium transition-all">
                          Confirmar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
