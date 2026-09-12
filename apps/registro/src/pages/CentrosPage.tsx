import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase, DISTRITOS } from '../lib/supabase'
import type { AdminCtx } from '../components/Layout'
import { Search, Download, Building2, LayoutGrid, ShieldCheck, MapPin, Users, Phone, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'

const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
const claveLocal = (d: string | null | undefined, l: string | null | undefined) => `${norm(d)}||${norm(l)}`

const ROL_LOCAL = 'Personero de Centro de Votación'
// Nombre viejo del rol; los perfiles ya importados pueden seguir teniéndolo.
const ROLES_LOCAL = [ROL_LOCAL, 'Personero de Local de Votación']
const ROL_MESA = 'Personero de Mesa'
// "Coordinador Distrital" tiene 2 nombres viejos guardados en la base (ver lib/panel.ts rolNorm).
const ROLES_COORD_DIST = ['Coordinador Distrital', 'Coordinador de Distritos', 'Coordinador Zonal']
const esCoordDist = (rol: string) => ROLES_COORD_DIST.includes(rol)

interface Colegio {
  id: string; nombre: string; distrito: string | null
  direccion: string | null; total_mesas: number | null; electores: number | null
}
interface Perfil {
  nombre_completo: string; celular: string | null; rol: string
  local_asignado: string | null; local_votacion: string | null
  distrito_asignado: string | null; distrito_vota: string | null
}
interface Fila extends Colegio {
  encargado: { nombre: string; celular: string | null } | null
  zonal: { nombre: string; celular: string | null } | null
  nPersoneros: number
  cobertura: number
}

async function traerTodo<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const paso = 1000
  let out: T[] = []
  for (let from = 0; ; from += paso) {
    const { data, error } = await build(from, from + paso - 1)
    if (error) { console.error(error.message); break }
    out = out.concat((data ?? []) as T[])
    if (!data || data.length < paso) break
  }
  return out
}

export default function CentrosPage() {
  const { esCoordRegional, departamento } = useOutletContext<AdminCtx>()
  const dep = esCoordRegional && departamento ? departamento : 'Tumbes'
  const prov = ''
  const [cols, setCols] = useState<Colegio[]>([])
  const [pers, setPers] = useState<Perfil[]>([])
  const [coords, setCoords] = useState<Perfil[]>([])
  const [distritosDepto, setDistritosDepto] = useState<string[]>(DISTRITOS)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dist, setDist] = useState('')
  const [orden, setOrden] = useState<'personeros' | 'mesas' | 'distrito'>('personeros')
  const [tipo, setTipo] = useState<'asignados' | 'todos' | 'sinpcv'>('asignados')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setLoading(true)
      let cq = supabase.from('colegios')
        .select('id, nombre, distrito, direccion, total_mesas, electores')
        .eq('departamento', dep)
      if (prov) cq = cq.eq('provincia', prov)
      const colsData = await traerTodo<Colegio>((from, to) => cq.order('distrito').order('nombre').range(from, to))
      if (!vivo) return

      const distritosAmbito = new Set(colsData.map(c => c.distrito).filter(Boolean) as string[])
      setDistritosDepto([...distritosAmbito].sort((a, b) => a.localeCompare(b, 'es')))

      const [persRaw, coordRaw] = await Promise.all([
        traerTodo<Perfil>((from, to) =>
          supabase.from('profiles')
            .select('nombre_completo, celular, rol, local_asignado, local_votacion, distrito_asignado, distrito_vota')
            .in('rol', [...ROLES_LOCAL, ROL_MESA]).order('nombre_completo').range(from, to)),
        traerTodo<Perfil>((from, to) =>
          supabase.from('profiles')
            .select('nombre_completo, celular, rol, local_asignado, local_votacion, distrito_asignado, distrito_vota')
            .in('rol', [...ROLES_COORD_DIST, 'Coordinador Provincial']).range(from, to)),
      ])
      if (!vivo) return
      const enAmbito = (p: Perfil) => {
        const d = p.distrito_asignado || p.distrito_vota
        return !!d && distritosAmbito.has(d)
      }
      setCols(colsData)
      setPers(persRaw.filter(enAmbito))
      setCoords(coordRaw.filter(enAmbito))
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [dep, prov])

  const { encPorLocal, mesasPorLocal, zonalPorDistrito } = useMemo(() => {
    const enc = new Map<string, { nombre: string; celular: string | null }>()
    const mesas = new Map<string, number>()
    for (const p of pers) {
      const key = claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion)
      if (key.endsWith('||')) continue
      if (ROLES_LOCAL.includes(p.rol)) { if (!enc.has(key)) enc.set(key, { nombre: p.nombre_completo, celular: p.celular }) }
      else mesas.set(key, (mesas.get(key) ?? 0) + 1)
    }
    // "Zonal" del colegio = Coordinador Distrital de ese distrito (fallback: Provincial)
    const zonal = new Map<string, { nombre: string; celular: string | null }>()
    for (const c of coords) {
      const d = norm(c.distrito_asignado || c.distrito_vota)
      if (!d) continue
      const cur = zonal.get(d)
      if (!cur || esCoordDist(c.rol)) zonal.set(d, { nombre: c.nombre_completo, celular: c.celular })
    }
    return { encPorLocal: enc, mesasPorLocal: mesas, zonalPorDistrito: zonal }
  }, [pers, coords])

  const filas = useMemo<Fila[]>(() => {
    let r: Fila[] = cols.map(c => {
      const key = claveLocal(c.distrito, c.nombre)
      const nP = mesasPorLocal.get(key) ?? 0
      const tm = c.total_mesas ?? 0
      return {
        ...c,
        encargado: encPorLocal.get(key) ?? null,
        zonal: zonalPorDistrito.get(norm(c.distrito)) ?? null,
        nPersoneros: nP,
        cobertura: tm ? Math.round((nP / tm) * 100) : 0,
      }
    })
    if (tipo === 'asignados') r = r.filter(c => c.encargado || c.nPersoneros > 0)
    if (tipo === 'sinpcv') r = r.filter(c => !c.encargado && c.nPersoneros > 0)
    if (dist) r = r.filter(c => c.distrito === dist)
    const s = q.trim().toLowerCase()
    if (s) r = r.filter(c =>
      c.nombre.toLowerCase().includes(s) ||
      (c.distrito ?? '').toLowerCase().includes(s) ||
      (c.encargado?.nombre ?? '').toLowerCase().includes(s))
    r = [...r].sort((a, b) => {
      if (orden === 'mesas') return (b.total_mesas ?? 0) - (a.total_mesas ?? 0)
      if (orden === 'distrito') return (a.distrito ?? '').localeCompare(b.distrito ?? '', 'es') || a.nombre.localeCompare(b.nombre, 'es')
      return b.nPersoneros - a.nPersoneros
    })
    return r
  }, [cols, encPorLocal, mesasPorLocal, zonalPorDistrito, q, dist, orden, tipo])

  const kpis = useMemo(() => {
    const persMesa = pers.filter(p => p.rol === ROL_MESA).length
    const conPCV = new Set<string>()
    for (const p of pers) if (ROLES_LOCAL.includes(p.rol)) {
      const k = claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion)
      if (!k.endsWith('||')) conPCV.add(k)
    }
    const centrosAsignados = new Set<string>()
    for (const c of cols) {
      const k = claveLocal(c.distrito, c.nombre)
      if (encPorLocal.get(k) || (mesasPorLocal.get(k) ?? 0) > 0) centrosAsignados.add(k)
    }
    return {
      persMesa,
      centros: centrosAsignados.size,
      conPCV: conPCV.size,
      coordDist: coords.filter(c => esCoordDist(c.rol)).length,
      zonales: coords.filter(c => c.rol === 'Coordinador Provincial').length,
    }
  }, [pers, cols, coords, encPorLocal, mesasPorLocal])

  const exportar = () => {
    const rows = filas.map(c => ({
      Distrito: c.distrito ?? '', Colegio: c.nombre, Dirección: c.direccion ?? '',
      Mesas: c.total_mesas ?? 0, Electores: c.electores ?? 0,
      'Personero de Centro (PCV)': c.encargado?.nombre ?? '', 'Celular PCV': c.encargado?.celular ?? '',
      'Personeros de Mesa inscritos': c.nPersoneros, 'Cobertura Mesas %': c.cobertura,
      'Coordinador Distrital': c.zonal?.nombre ?? '', 'Celular Coordinador': c.zonal?.celular ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Centros')
    XLSX.writeFile(wb, `SomosPerú_Centros_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    // Rompe el fondo oscuro del Layout admin para pintar claro como el panel de referencia
    <div className="-m-4 lg:-m-8 min-h-screen bg-slate-50 text-slate-800 p-4 lg:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Building2 size={20} className="text-sky-600" />
        <h1 className="text-lg font-extrabold text-slate-900">Control Electoral y Monitoreo</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, distrito, PCV…"
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500" />
        </div>
        <select value={dist} onChange={e => setDist(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none">
          <option value="">📍 Todos los distritos</option>
          {distritosDepto.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={orden} onChange={e => setOrden(e.target.value as any)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none">
          <option value="personeros">Ordenar: Más personeros</option>
          <option value="mesas">Ordenar: Más mesas</option>
          <option value="distrito">Ordenar: Distrito</option>
        </select>
        <span className="ml-auto text-xs bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1">
          {loading ? '…' : `${filas.length} centros`}
        </span>
      </div>

      {/* Indicadores */}
      <div>
        <p className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <LayoutGrid size={16} /> Indicadores Electorales · {dep}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi color="#3b82f6" icon={Users}      value={kpis.persMesa.toLocaleString('es-PE')}  label="Personeros de Mesa" sub={`Inscritos en ${dep}`} />
          <Kpi color="#06b6d4" icon={Building2}   value={kpis.centros.toLocaleString('es-PE')}   label="Centros de Votación" sub="Con personal asignado" />
          <Kpi color="#f59e0b" icon={ShieldCheck} value={kpis.conPCV.toLocaleString('es-PE')}    label="Centros con PCV" sub="Personero de Local asignado" />
          <Kpi color="#22c55e" icon={ShieldCheck} value={String(kpis.coordDist)}                 label="Coord. Distritales" sub="Distritos activos" />
          <Kpi color="#8b5cf6" icon={MapPin}      value={String(kpis.zonales)}                   label="Zonales" sub="Coordinadores Provinciales" />
        </div>
      </div>

      {/* Tabs / chips + Excel */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {([['asignados', 'Con asignación'], ['todos', 'Todos'], ['sinpcv', 'Sin PCV (con personeros)']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTipo(k)}
              className={`text-xs font-bold rounded-lg px-3 py-2 border transition-colors ${
                tipo === k ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={exportar}
          className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 flex items-center gap-1.5">
          <Download size={13} /> Descargar Excel
        </button>
      </div>

      {/* Grid de tarjetas */}
      {loading ? (
        <p className="text-slate-400 text-sm py-10 text-center">Cargando centros…</p>
      ) : filas.length === 0 ? (
        <p className="text-slate-400 text-sm py-10 text-center">Sin centros con esos filtros.</p>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filas.slice(0, 600).map(c => {
            const covColor = c.cobertura >= 100 ? '#16a34a' : c.cobertura >= 40 ? '#d97706' : '#dc2626'
            return (
              <div key={c.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3"
                style={{ borderLeft: `4px solid ${c.encargado ? '#16a34a' : '#f59e0b'}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-sky-700 bg-sky-50 rounded px-2 py-0.5 flex items-center gap-1">
                    <MapPin size={11} /> {c.distrito ?? '—'}
                  </span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-1 ${
                    c.encargado ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {c.encargado ? '✓ Con Personero de Centro' : '⚠ Sin Personero de Centro'}
                  </span>
                </div>

                <div>
                  <p className="font-extrabold text-slate-900 text-sm flex items-start gap-1.5">
                    <Building2 size={15} className="mt-0.5 flex-shrink-0 text-slate-400" /> {c.nombre}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} /> {c.direccion || 'Dirección no registrada'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2.5 text-center">
                  <Metric v={c.total_mesas ?? 0} l="Mesas" />
                  <Metric v={c.nPersoneros} l="Personeros" />
                  <Metric v={(c.electores ?? 0).toLocaleString('es-PE')} l="Electores" />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span>Cobertura de mesas</span>
                    <span style={{ color: covColor }}>{c.nPersoneros} de {c.total_mesas ?? 0} ({c.cobertura}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.cobertura)}%`, background: covColor }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <Linea tag="PCV" tagCls="bg-emerald-100 text-emerald-700"
                    nombre={c.encargado?.nombre} tel={c.encargado?.celular} vacio="Sin Personero de Centro" />
                  <Linea tag="Zonal" tagCls="bg-blue-100 text-blue-700"
                    nombre={c.zonal?.nombre} tel={c.zonal?.celular} vacio="Por designar" />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!loading && filas.length > 600 && (
        <p className="text-xs text-slate-400">Mostrando 600 de {filas.length}. Filtra o descarga el Excel para ver todo.</p>
      )}
    </div>
  )
}

function Kpi({ color, icon: Icon, value, label, sub }: { color: string; icon: any; value: string; label: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
        <Icon size={13} style={{ color }} /> {label}
      </div>
      <p className="text-2xl font-black text-slate-900 mt-1 leading-none">{value}</p>
      <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
    </div>
  )
}
function Metric({ v, l }: { v: string | number; l: string }) {
  return (
    <div>
      <p className="text-base font-black text-slate-900 leading-none">{v}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1">{l}</p>
    </div>
  )
}
function Linea({ tag, tagCls, nombre, tel, vacio }: {
  tag: string; tagCls: string; nombre?: string | null; tel?: string | null; vacio: string
}) {
  return (
    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${tagCls}`}>{tag}</span>
        <span className={`truncate font-medium ${nombre ? 'text-slate-700' : 'text-slate-400'}`}>
          {nombre || vacio}
        </span>
      </div>
      {tel
        ? <span className="text-emerald-600 font-bold flex items-center gap-1 flex-shrink-0"><Phone size={11} /> {tel}</span>
        : !nombre && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
    </div>
  )
}
