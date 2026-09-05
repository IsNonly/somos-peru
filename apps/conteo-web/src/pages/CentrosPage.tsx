import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { Building2, LayoutGrid, UserCheck, Vote, Download, Search } from 'lucide-react'
import * as XLSX from 'xlsx'

// Normaliza nombres de local para cruzar profiles.local_asignado con colegios.nombre
const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()

interface Colegio {
  id: string
  nombre: string
  distrito: string | null
  direccion: string | null
  total_mesas: number | null
  electores: number | null
}
interface Perfil {
  nombre_completo: string
  celular: string | null
  rol: string
  local_asignado: string | null
  local_votacion: string | null
  distrito_asignado: string | null
  distrito_vota: string | null
}

// Clave de cruce: distrito + nombre de local (los nombres de colegio se repiten entre distritos)
const claveLocal = (distrito: string | null | undefined, local: string | null | undefined) =>
  `${norm(distrito)}||${norm(local)}`
interface Fila extends Colegio {
  encargado: { nombre: string; celular: string | null } | null
  nPersoneros: number
}

const ROL_LOCAL = 'Personero de Centro de Votación'
// Nombre viejo del rol; los perfiles ya importados pueden seguir teniéndolo.
const ROLES_LOCAL = [ROL_LOCAL, 'Personero de Local de Votación']
const ROL_MESA = 'Personero de Mesa'

async function traerTodo<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const paso = 1000
  let out: T[] = []
  for (let from = 0; ; from += paso) {
    const { data, error } = await build(from, from + paso - 1)
    if (error) { console.error(error.message); break }
    out = out.concat(data as T[])
    if (!data || data.length < paso) break
  }
  return out
}

export default function CentrosPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [cols, setCols] = useState<Colegio[]>([])
  const [pers, setPers] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [orden, setOrden] = useState<'distrito' | 'mesas' | 'personeros'>('distrito')
  const [soloSinEncargado, setSoloSinEncargado] = useState(false)

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      const dists = distritosEfectivos // null = sin límite
      const colsData = await traerTodo<Colegio>((from, to) => {
        let cq = supabase.from('colegios')
          .select('id, nombre, distrito, direccion, total_mesas, electores')
          .eq('provincia', 'Lima').eq('departamento', 'Lima')
          .order('distrito').order('nombre').range(from, to)
        if (dists) cq = cq.in('distrito', dists)
        return cq
      })
      const persData = await traerTodo<Perfil>((from, to) =>
        supabase.from('profiles')
          .select('nombre_completo, celular, rol, local_asignado, local_votacion, distrito_asignado, distrito_vota')
          .in('rol', [...ROLES_LOCAL, ROL_MESA])
          .order('nombre_completo').range(from, to))
      if (!vivo) return
      setCols(colsData)
      setPers(persData)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [scopeLoading, distritosEfectivos])

  // Índices por (distrito + local): los nombres de colegio se repiten entre distritos
  const { encargadoPorLocal, mesasPorLocal } = useMemo(() => {
    const enc = new Map<string, { nombre: string; celular: string | null }>()
    const mesas = new Map<string, number>()
    for (const p of pers) {
      const dist = p.distrito_asignado || p.distrito_vota
      const key = claveLocal(dist, p.local_asignado || p.local_votacion)
      if (key.endsWith('||')) continue // sin local
      if (ROLES_LOCAL.includes(p.rol)) {
        if (!enc.has(key)) enc.set(key, { nombre: p.nombre_completo, celular: p.celular })
      } else {
        mesas.set(key, (mesas.get(key) ?? 0) + 1)
      }
    }
    return { encargadoPorLocal: enc, mesasPorLocal: mesas }
  }, [pers])

  const filas = useMemo<Fila[]>(() => {
    let r: Fila[] = cols
      .filter(c => !f.colegio || c.nombre === f.colegio)
      .map(c => {
        const key = claveLocal(c.distrito, c.nombre)
        return { ...c, encargado: encargadoPorLocal.get(key) ?? null, nPersoneros: mesasPorLocal.get(key) ?? 0 }
      })
    const s = q.trim().toLowerCase()
    if (s) r = r.filter(c =>
      c.nombre.toLowerCase().includes(s) ||
      (c.distrito ?? '').toLowerCase().includes(s) ||
      (c.direccion ?? '').toLowerCase().includes(s) ||
      (c.encargado?.nombre ?? '').toLowerCase().includes(s))
    if (soloSinEncargado) r = r.filter(c => !c.encargado)
    r = [...r].sort((a, b) => {
      if (orden === 'mesas') return (b.total_mesas ?? 0) - (a.total_mesas ?? 0)
      if (orden === 'personeros') return b.nPersoneros - a.nPersoneros
      return (a.distrito ?? '').localeCompare(b.distrito ?? '', 'es') || a.nombre.localeCompare(b.nombre, 'es')
    })
    return r
  }, [cols, encargadoPorLocal, mesasPorLocal, q, orden, soloSinEncargado, f.colegio])

  const stats = useMemo(() => {
    const centros = filas.length
    const mesas = filas.reduce((s, c) => s + (c.total_mesas ?? 0), 0)
    const conEnc = filas.filter(c => c.encargado).length
    const conPers = filas.filter(c => c.nPersoneros > 0).length
    const persTot = filas.reduce((s, c) => s + c.nPersoneros, 0)
    return { centros, mesas, conEnc, conPers, persTot, covPers: mesas ? Math.round((persTot / mesas) * 100) : 0 }
  }, [filas])

  // Personeros de Mesa cuyo (distrito + local) no cruzó con ningún colegio del ámbito
  const noCruzan = useMemo(() => {
    const llaves = new Set(cols.map(c => claveLocal(c.distrito, c.nombre)))
    return pers.filter(p => p.rol === ROL_MESA &&
      (p.local_asignado || p.local_votacion) &&
      !llaves.has(claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion))).length
  }, [pers, cols])

  const exportar = () => {
    const data = filas.map(c => ({
      Distrito: c.distrito ?? '',
      Colegio: c.nombre,
      Dirección: c.direccion ?? '',
      Mesas: c.total_mesas ?? 0,
      Electores: c.electores ?? 0,
      'Personero de Local': c.encargado?.nombre ?? '',
      'Celular encargado': c.encargado?.celular ?? '',
      'Personeros de Mesa inscritos': c.nPersoneros,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Centros')
    XLSX.writeFile(wb, `Centros_Votacion_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">🏫 Centros de Votación</h1>
        <p className="text-sm text-slate-500">
          Mesas por colegio, Personero de Local a cargo y personeros de mesa inscritos ·{' '}
          <span className="text-sky-600 font-semibold">{ambitoLabel || 'Lima Metropolitana'}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={Building2}  border="#3b82f6" bg="#eff6ff" value={stats.centros.toLocaleString('es-PE')} label="Centros de votación" />
        <Kpi icon={LayoutGrid} border="#6366f1" bg="#eef2ff" value={stats.mesas.toLocaleString('es-PE')}   label="Mesas de sufragio" />
        <Kpi icon={UserCheck}  border="#10b981" bg="#ecfdf5" value={`${stats.conEnc}/${stats.centros}`}     label="Con Personero de Local" />
        <Kpi icon={Vote}       border="#f59e0b" bg="#fffbeb" value={`${stats.conPers}/${stats.centros}`}    label="Con personeros de mesa" />
        <Kpi icon={Vote}       border="#06b6d4" bg="#cffafe" value={stats.persTot.toLocaleString('es-PE')}  label="Personeros de mesa inscritos" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <p className="font-extrabold text-slate-900 text-sm">
            Detalle por colegio ({filas.length})
            {noCruzan > 0 && (
              <span className="ml-2 text-[11px] font-semibold text-amber-600">
                · {noCruzan} personero(s) con local no reconocido
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar colegio, distrito, encargado…"
                className="text-sm rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 outline-none focus:border-sky-500 w-64" />
            </div>
            <select value={orden} onChange={e => setOrden(e.target.value as any)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 outline-none">
              <option value="distrito">Orden: Distrito</option>
              <option value="mesas">Orden: Más mesas</option>
              <option value="personeros">Orden: Más personeros</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg px-2.5">
              <input type="checkbox" checked={soloSinEncargado} onChange={e => setSoloSinEncargado(e.target.checked)} />
              Solo sin encargado
            </label>
            <button onClick={exportar}
              className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 flex items-center gap-1.5">
              <Download size={13} /> Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                {['Colegio', 'Distrito', 'Dirección', 'Mesas', 'Electores', 'Personero de Local (a cargo)', 'Personeros de Mesa'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Sin centros con esos filtros.</td></tr>
              ) : filas.slice(0, 800).map(c => (
                <tr key={c.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[260px]">{c.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold bg-sky-50 text-sky-700 rounded px-2 py-0.5">{c.distrito ?? '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[220px] truncate">{c.direccion || '—'}</td>
                  <td className="px-4 py-2.5 font-bold text-slate-800">{c.total_mesas ?? 0}</td>
                  <td className="px-4 py-2.5 text-slate-500">{(c.electores ?? 0).toLocaleString('es-PE')}</td>
                  <td className="px-4 py-2.5">
                    {c.encargado ? (
                      <div>
                        <p className="font-medium text-slate-800">{c.encargado.nombre}</p>
                        <p className="text-xs text-slate-500 font-mono">{c.encargado.celular || 'sin celular'}</p>
                      </div>
                    ) : (
                      <span className="text-xs font-bold bg-amber-50 text-amber-600 rounded-full px-2.5 py-1">SIN PERSONERO DE LOCAL</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                      c.nPersoneros > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {c.nPersoneros}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length > 800 && (
            <p className="px-4 py-3 text-xs text-slate-400">Mostrando 800 de {filas.length}. Filtra o exporta a Excel para ver todo.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, border, bg, value, label }: {
  icon: any; border: string; bg: string; value: string; label: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3" style={{ borderLeft: `4px solid ${border}` }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <Icon size={18} style={{ color: border }} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-black text-slate-900 leading-none">{value}</p>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1 leading-tight">{label}</p>
      </div>
    </div>
  )
}
