import { useEffect, useMemo, useState } from 'react'
import { supabase, DISTRITOS } from '../lib/supabase'
import { Search, Download, Building2, LayoutGrid, UserCheck, Users, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
const claveLocal = (d: string | null | undefined, l: string | null | undefined) => `${norm(d)}||${norm(l)}`

const ROL_LOCAL = 'Personero de Local de Votación'
const ROL_MESA = 'Personero de Mesa'

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
  nPersoneros: number
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
  const [cols, setCols] = useState<Colegio[]>([])
  const [pers, setPers] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dist, setDist] = useState('')
  const [orden, setOrden] = useState<'distrito' | 'mesas' | 'personeros'>('distrito')
  const [soloSinEnc, setSoloSinEnc] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setLoading(true)
      const [colsData, persData] = await Promise.all([
        traerTodo<Colegio>((from, to) =>
          supabase.from('colegios')
            .select('id, nombre, distrito, direccion, total_mesas, electores')
            .eq('provincia', 'Lima').eq('departamento', 'Lima')
            .order('distrito').order('nombre').range(from, to)),
        traerTodo<Perfil>((from, to) =>
          supabase.from('profiles')
            .select('nombre_completo, celular, rol, local_asignado, local_votacion, distrito_asignado, distrito_vota')
            .in('rol', [ROL_LOCAL, ROL_MESA])
            .order('nombre_completo').range(from, to)),
      ])
      if (!vivo) return
      setCols(colsData); setPers(persData); setLoading(false)
    })()
    return () => { vivo = false }
  }, [])

  const { encPorLocal, mesasPorLocal } = useMemo(() => {
    const enc = new Map<string, { nombre: string; celular: string | null }>()
    const mesas = new Map<string, number>()
    for (const p of pers) {
      const key = claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion)
      if (key.endsWith('||')) continue
      if (p.rol === ROL_LOCAL) { if (!enc.has(key)) enc.set(key, { nombre: p.nombre_completo, celular: p.celular }) }
      else mesas.set(key, (mesas.get(key) ?? 0) + 1)
    }
    return { encPorLocal: enc, mesasPorLocal: mesas }
  }, [pers])

  const filas = useMemo<Fila[]>(() => {
    let r: Fila[] = cols
      .filter(c => !dist || c.distrito === dist)
      .map(c => {
        const key = claveLocal(c.distrito, c.nombre)
        return { ...c, encargado: encPorLocal.get(key) ?? null, nPersoneros: mesasPorLocal.get(key) ?? 0 }
      })
    const s = q.trim().toLowerCase()
    if (s) r = r.filter(c =>
      c.nombre.toLowerCase().includes(s) ||
      (c.distrito ?? '').toLowerCase().includes(s) ||
      (c.direccion ?? '').toLowerCase().includes(s) ||
      (c.encargado?.nombre ?? '').toLowerCase().includes(s))
    if (soloSinEnc) r = r.filter(c => !c.encargado)
    r = [...r].sort((a, b) => {
      if (orden === 'mesas') return (b.total_mesas ?? 0) - (a.total_mesas ?? 0)
      if (orden === 'personeros') return b.nPersoneros - a.nPersoneros
      return (a.distrito ?? '').localeCompare(b.distrito ?? '', 'es') || a.nombre.localeCompare(b.nombre, 'es')
    })
    return r
  }, [cols, encPorLocal, mesasPorLocal, q, dist, orden, soloSinEnc])

  const stats = useMemo(() => {
    const centros = filas.length
    const mesas = filas.reduce((s, c) => s + (c.total_mesas ?? 0), 0)
    const conEnc = filas.filter(c => c.encargado).length
    const persTot = filas.reduce((s, c) => s + c.nPersoneros, 0)
    return { centros, mesas, conEnc, persTot }
  }, [filas])

  const noCruzan = useMemo(() => {
    const llaves = new Set(cols.map(c => claveLocal(c.distrito, c.nombre)))
    return pers.filter(p => p.rol === ROL_MESA &&
      (p.local_asignado || p.local_votacion) &&
      !llaves.has(claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion))).length
  }, [pers, cols])

  const exportar = () => {
    const rows = filas.map(c => ({
      Distrito: c.distrito ?? '',
      Colegio: c.nombre,
      Dirección: c.direccion ?? '',
      Mesas: c.total_mesas ?? 0,
      Electores: c.electores ?? 0,
      'Personero de Local': c.encargado?.nombre ?? '',
      'Celular': c.encargado?.celular ?? '',
      'Personeros de Mesa inscritos': c.nPersoneros,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Centros')
    XLSX.writeFile(wb, `SomosPerú_Centros_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Administración</p>
          <h1 className="text-white text-2xl font-bold">Centros de Votación</h1>
          <p className="text-white/40 text-sm">Mesas por colegio · Personero de Local a cargo · personeros de mesa inscritos</p>
        </div>
        <button onClick={exportar}
          className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/30 hover:bg-green-600/30 text-green-400 rounded-xl text-sm font-medium transition-all">
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2}  color="text-blue-300"   value={stats.centros.toLocaleString('es-PE')} label="Centros de votación" />
        <Kpi icon={LayoutGrid} color="text-indigo-300" value={stats.mesas.toLocaleString('es-PE')}   label="Mesas de sufragio" />
        <Kpi icon={UserCheck}  color="text-green-300"  value={`${stats.conEnc}/${stats.centros}`}     label="Con Personero de Local" />
        <Kpi icon={Users}      color="text-orange-300" value={stats.persTot.toLocaleString('es-PE')}  label="Personeros de mesa inscritos" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-[220px]">
          <Search size={14} className="text-white/30" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar colegio, distrito, encargado…"
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
          {q && <button onClick={() => setQ('')}><X size={12} className="text-white/30" /></button>}
        </div>
        <select value={dist} onChange={e => setDist(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los distritos</option>
          {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={orden} onChange={e => setOrden(e.target.value as any)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="distrito">Orden: Distrito</option>
          <option value="mesas">Orden: Más mesas</option>
          <option value="personeros">Orden: Más personeros</option>
        </select>
        <label className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/60">
          <input type="checkbox" checked={soloSinEnc} onChange={e => setSoloSinEnc(e.target.checked)} />
          Solo sin encargado
        </label>
      </div>

      <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 text-sm text-white/60">
          {loading ? 'Cargando…' : `${filas.length} centros`}
          {noCruzan > 0 && <span className="ml-2 text-amber-400">· {noCruzan} personero(s) con local no reconocido</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase tracking-wide bg-white/[0.02]">
                {['Colegio', 'Distrito', 'Dirección', 'Mesas', 'Electores', 'Personero de Local (a cargo)', 'Personeros de Mesa'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-white/30">Cargando…</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-white/30">Sin centros con esos filtros.</td></tr>
              ) : filas.slice(0, 800).map(c => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03] align-top">
                  <td className="px-4 py-2.5 text-white/90 font-medium max-w-[260px]">{c.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold bg-blue-500/15 text-blue-300 rounded px-2 py-0.5">{c.distrito ?? '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-white/40 max-w-[220px] truncate">{c.direccion || '—'}</td>
                  <td className="px-4 py-2.5 text-white/90 font-bold">{c.total_mesas ?? 0}</td>
                  <td className="px-4 py-2.5 text-white/40">{(c.electores ?? 0).toLocaleString('es-PE')}</td>
                  <td className="px-4 py-2.5">
                    {c.encargado ? (
                      <div>
                        <p className="text-white/90 font-medium">{c.encargado.nombre}</p>
                        <p className="text-xs text-white/40 font-mono">{c.encargado.celular || 'sin celular'}</p>
                      </div>
                    ) : (
                      <span className="text-xs font-bold bg-amber-500/15 text-amber-400 rounded-full px-2.5 py-1">SIN PERSONERO DE LOCAL</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                      c.nPersoneros > 0 ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/30'}`}>
                      {c.nPersoneros}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length > 800 && (
            <p className="px-4 py-3 text-xs text-white/30">Mostrando 800 de {filas.length}. Filtra o exporta a Excel para ver todo.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, color, value, label }: { icon: any; color: string; value: string; label: string }) {
  return (
    <div className="bg-[#16162a] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-white text-xl font-bold leading-none">{value}</p>
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide mt-1 leading-tight">{label}</p>
      </div>
    </div>
  )
}
