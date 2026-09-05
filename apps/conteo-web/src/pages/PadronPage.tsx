import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, DISTRITOS_META } from '../lib/supabase'
import { useScope, enAmbito } from '../lib/scope'
import { Download, RefreshCw, Search, Users, UserCheck, ShieldCheck, GraduationCap } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Perfil {
  id: string
  nombre_completo: string
  dni: string | null
  celular: string | null
  correo: string | null
  usa_whatsapp: string | null
  rol: string
  distrito_vota: string | null
  mesa_sufragio: string | null
  local_votacion: string | null
  distrito_asignado: string | null
  mesa_asignada: string | null
  local_asignado: string | null
  tiene_experiencia: boolean | null
  cuenta_movilidad: boolean | null
  se_compromete: boolean | null
  videos_vistos: number | null
  pdfs_vistos: number | null
  quiz_estado: string | null
  credencial_estado: string | null
  token_verificacion: string | null
  fecha_registro: string | null
}

const ROLES = [
  'Personero de Mesa',
  'Personero de Centro de Votación',
  'Coordinador Provincial',
  'Coordinador Distrital',
  'Administrador General',
]

// "Coordinador Distrital" tiene 2 nombres viejos guardados en la base
// (ver apps/registro/src/lib/panel.ts rolNorm): "Coordinador de Distritos" y "Coordinador Zonal".
// "Personero de Centro de Votación" tiene 1 nombre viejo: "Personero de Local de Votación".
const ROL_ALIASES: Record<string, string[]> = {
  'Coordinador Distrital': ['Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal'],
  'Personero de Centro de Votación': ['Personero de Centro de Votación', 'Personero de Local de Votación'],
}
const rolMatches = (rol: string, filtro: string) => (ROL_ALIASES[filtro] ?? [filtro]).includes(rol)

const DISTRITOS = Object.keys(DISTRITOS_META).sort((a, b) => a.localeCompare(b, 'es'))

const SI_NO = ['Todos', 'Sí', 'No'] as const
type SiNo = (typeof SI_NO)[number]

const matchBool = (filtro: SiNo, valor: boolean | null | undefined) =>
  filtro === 'Todos' ? true : filtro === 'Sí' ? !!valor : !valor

const rolColor = (rol: string) => {
  if (rol.includes('Administrador')) return 'bg-purple-500/20 text-purple-300'
  if (rol.includes('Distrit') || rol.includes('Zonal')) return 'bg-blue-500/20 text-blue-300'
  if (rol.includes('Provincial'))    return 'bg-cyan-500/20 text-cyan-300'
  if (rol.includes('Local'))         return 'bg-green-500/20 text-green-300'
  return 'bg-white/10 text-white/60'
}

const rolCorto = (rol: string) =>
  rol.replace('Coordinador de ', 'Coord. ').replace('Coordinador ', 'Coord. ').replace('Personero de ', 'Pers. ')

export default function PadronPage() {
  const scope = useScope()
  const [perfilesRaw, setPerfiles] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)

  // Acotar el padrón al ámbito del usuario
  const perfiles = useMemo(
    () => perfilesRaw.filter(p => enAmbito(scope.distritos, p.distrito_asignado, p.distrito_vota)),
    [perfilesRaw, scope.distritos],
  )

  const [search, setSearch] = useState('')
  const [distFilter, setDistFilter] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [expFilter, setExpFilter] = useState<SiNo>('Todos')
  const [movFilter, setMovFilter] = useState<SiNo>('Todos')
  const [compFilter, setCompFilter] = useState<SiNo>('Todos')

  const load = useCallback(async () => {
    setLoading(true)
    // Supabase limita a 1000 filas por respuesta: paginamos hasta traer todo el padrón.
    const todos: Perfil[] = []
    const lote = 1000
    for (let desde = 0; ; desde += lote) {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, nombre_completo, dni, celular, correo, usa_whatsapp, rol, distrito_vota, mesa_sufragio, local_votacion, distrito_asignado, mesa_asignada, local_asignado, tiene_experiencia, cuenta_movilidad, se_compromete, videos_vistos, pdfs_vistos, quiz_estado, credencial_estado, token_verificacion, fecha_registro',
        )
        .order('fecha_registro', { ascending: false })
        .range(desde, desde + lote - 1)
      if (error || !data || data.length === 0) break
      todos.push(...(data as Perfil[]))
      if (data.length < lote) break
    }
    setPerfiles(todos)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return perfiles.filter(p => {
      const texto =
        !q ||
        p.nombre_completo?.toLowerCase().includes(q) ||
        p.dni?.toLowerCase().includes(q) ||
        p.local_asignado?.toLowerCase().includes(q) ||
        p.local_votacion?.toLowerCase().includes(q) ||
        p.distrito_asignado?.toLowerCase().includes(q) ||
        p.distrito_vota?.toLowerCase().includes(q)
      const dist =
        !distFilter || p.distrito_asignado === distFilter || p.distrito_vota === distFilter
      const rol = !rolFilter || rolMatches(p.rol, rolFilter)
      return (
        texto && dist && rol &&
        matchBool(expFilter, p.tiene_experiencia) &&
        matchBool(movFilter, p.cuenta_movilidad) &&
        matchBool(compFilter, p.se_compromete)
      )
    })
  }, [perfiles, search, distFilter, rolFilter, expFilter, movFilter, compFilter])

  const stats = useMemo(() => ({
    total: perfiles.length,
    personeros: perfiles.filter(p => p.rol === 'Personero de Mesa').length,
    coordinadores: perfiles.filter(p => p.rol.includes('Coordinador')).length,
    confirmados: perfiles.filter(p => p.credencial_estado === 'Confirmado').length,
  }), [perfiles])

  const exportar = () => {
    const data = filtered.map((p, i) => ({
      'Nº': i + 1,
      'Nombres y Apellidos': p.nombre_completo,
      'DNI': p.dni ?? '',
      'Celular': p.celular ?? '',
      'Correo': p.correo ?? '',
      'WhatsApp': p.usa_whatsapp ?? '',
      'Rol': p.rol,
      'Distrito donde vota': p.distrito_vota ?? '',
      'Mesa de sufragio': p.mesa_sufragio ?? '',
      'Local de votación': p.local_votacion ?? '',
      'Distrito asignado': p.distrito_asignado ?? '',
      'Local asignado': p.local_asignado ?? '',
      'Mesa asignada': p.mesa_asignada ?? '',
      'Tiene experiencia': p.tiene_experiencia ? 'Sí' : 'No',
      'Cuenta con movilidad': p.cuenta_movilidad ? 'Sí' : 'No',
      'Se compromete': p.se_compromete ? 'Sí' : 'No',
      'Videos vistos': p.videos_vistos ?? 0,
      'PDFs vistos': p.pdfs_vistos ?? 0,
      'Evaluación': p.quiz_estado ?? 'Pendiente',
      'Credencial': p.credencial_estado ?? 'Pendiente',
      'Token verificación': p.token_verificacion ?? '',
      'Fecha de registro': p.fecha_registro
        ? new Date(p.fecha_registro).toLocaleString('es-PE', { timeZone: 'America/Lima' })
        : '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Padrón Somos Perú 2026')
    XLSX.writeFile(wb, `Padron_SomosPeru_2026_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const STAT = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-[#16162a] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 flex-shrink-0"
        style={{ background: `${color}15` }}>
        <Icon size={18} style={{ color }} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-white text-xl font-bold tabular-nums leading-none">{value.toLocaleString()}</p>
        <p className="text-white/40 text-[11px] uppercase tracking-wider mt-1 truncate">{label}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Control de Personal</p>
          <h1 className="text-white text-2xl font-bold">Padrón de Personeros</h1>
          {scope.ambitoLabel && <p className="text-sky-400 text-xs font-semibold mt-1">{scope.ambitoLabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-[#16162a] border border-white/8 hover:bg-white/5 text-white/60 rounded-xl text-sm transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportar} disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/30 hover:bg-green-600/30 disabled:opacity-40 text-green-400 rounded-xl text-sm font-medium transition-all">
            <Download size={14} /> Descargar Excel
          </button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <STAT icon={Users}        label="Total padrón"        value={stats.total}         color="#E8534A" />
        <STAT icon={UserCheck}    label="Personeros de mesa"  value={stats.personeros}    color="#10B981" />
        <STAT icon={ShieldCheck}  label="Coordinadores"       value={stats.coordinadores} color="#3B82F6" />
        <STAT icon={GraduationCap} label="Credencial confirmada" value={stats.confirmados}  color="#F59E0B" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-[220px]">
          <Search size={14} className="text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI o local…"
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
        </div>
        <select value={distFilter} onChange={e => setDistFilter(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">{scope.distritos ? 'Todo mi ámbito' : 'Todos los distritos'}</option>
          {(scope.esAdmin || !scope.distritos ? DISTRITOS : scope.distritos).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={rolFilter} onChange={e => setRolFilter(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={expFilter} onChange={e => setExpFilter(e.target.value as SiNo)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          {SI_NO.map(v => <option key={v} value={v}>Experiencia: {v}</option>)}
        </select>
        <select value={movFilter} onChange={e => setMovFilter(e.target.value as SiNo)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          {SI_NO.map(v => <option key={v} value={v}>Movilidad: {v}</option>)}
        </select>
        <select value={compFilter} onChange={e => setCompFilter(e.target.value as SiNo)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          {SI_NO.map(v => <option key={v} value={v}>Compromiso: {v}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
        <span className="bg-brand-red/15 text-brand-red px-2.5 py-1 rounded-full font-semibold">
          {filtered.length.toLocaleString()} personeros encontrados
        </span>
        <span className="text-white/30">Total en padrón: {stats.total.toLocaleString()}</span>
      </div>

      {/* Tabla */}
      <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/30 text-white/40 text-xs uppercase tracking-wide">
                {['DNI', 'Nombres y Apellidos', 'Celular', 'Rol', 'Distrito', 'Local asignado', 'Mesa', 'Capacitación', 'Credencial'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="h-3 bg-white/5 rounded w-3/4" /></td>
                  ))}
                </tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-white/30">Sin resultados con los filtros actuales</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-brand-red font-mono font-semibold whitespace-nowrap">{p.dni ?? '—'}</td>
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{p.nombre_completo}</td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">{p.celular ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${rolColor(p.rol)}`}>
                      {rolCorto(p.rol)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60 whitespace-nowrap">{p.distrito_asignado ?? p.distrito_vota ?? '—'}</td>
                  <td className="px-4 py-3 text-white/60 max-w-[220px] truncate">{p.local_asignado ?? p.local_votacion ?? '—'}</td>
                  <td className="px-4 py-3 text-white/50 font-mono whitespace-nowrap">{p.mesa_asignada ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-white/50 text-xs tabular-nums">{p.videos_vistos ?? 0}v · {p.pdfs_vistos ?? 0}p</span>
                    <span className={`ml-2 text-xs font-semibold ${p.quiz_estado === 'Aprobado' ? 'text-green-400' : 'text-white/30'}`}>
                      {p.quiz_estado === 'Aprobado' ? 'Quiz ✓' : 'Quiz —'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${
                      p.credencial_estado === 'Confirmado' ? 'text-green-400'
                        : p.credencial_estado === 'Bloqueado' ? 'text-red-400'
                        : 'text-yellow-400'}`}>
                      {p.credencial_estado ?? 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
