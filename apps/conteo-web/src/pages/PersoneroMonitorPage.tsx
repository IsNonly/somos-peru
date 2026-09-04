import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js'
import { Users, Camera, MapPin, Landmark } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

interface Perfil {
  id: string
  nombre_completo: string
  dni: string | null
  celular: string | null
  rol: string
  distrito_asignado: string | null
  distrito_vota: string | null
  local_asignado: string | null
  local_votacion: string | null
  mesa_asignada: string | null
  asistencia_local_at: string | null
}

export default function PersoneroMonitorPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [pers, setPers] = useState<Perfil[]>([])
  const [gpsUserIds, setGpsUserIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'todos' | 'confirmados' | 'pendientes'>('todos')

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      let pq = supabase.from('profiles')
        .select('id, nombre_completo, dni, celular, rol, distrito_asignado, distrito_vota, local_asignado, local_votacion, mesa_asignada, asistencia_local_at')
        .eq('rol', 'Personero de Mesa')
        .order('nombre_completo')
      if (distritosEfectivos) pq = pq.in('distrito_asignado', distritosEfectivos)

      const [{ data: p }, { data: asis }] = await Promise.all([
        pq,
        supabase.from('asistencias').select('user_id, distrito').eq('tipo', 'LLEGADA'),
      ])
      if (!vivo) return
      setPers((p ?? []) as Perfil[])
      setGpsUserIds(new Set((asis ?? []).map((a: any) => a.user_id)))
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [scopeLoading, distritosEfectivos])

  const filtrados = useMemo(() => {
    let r = pers
    if (f.colegio) r = r.filter(p => (p.local_asignado ?? p.local_votacion) === f.colegio)
    const s = q.trim().toLowerCase()
    if (s) r = r.filter(p =>
      p.nombre_completo?.toLowerCase().includes(s) || (p.dni ?? '').includes(s) || (p.mesa_asignada ?? '').includes(s))
    if (estado === 'confirmados') r = r.filter(p => p.asistencia_local_at)
    if (estado === 'pendientes')  r = r.filter(p => !p.asistencia_local_at)
    return r
  }, [pers, f.colegio, q, estado])

  const stats = useMemo(() => {
    const foto = pers.filter(p => p.asistencia_local_at).length
    const gps = pers.filter(p => gpsUserIds.has(p.id)).length
    const dists = new Set(pers.filter(p => p.asistencia_local_at).map(p => p.distrito_asignado).filter(Boolean))
    // 1ª por distrito
    const porDist: Record<string, number> = {}
    for (const p of pers) if (p.asistencia_local_at && p.distrito_asignado)
      porDist[p.distrito_asignado] = (porDist[p.distrito_asignado] ?? 0) + 1
    return { total: pers.length, foto, gps, distritos: dists.size, porDist }
  }, [pers, gpsUserIds])

  const donut = {
    labels: ['Confirmados 1ª Asist.', 'Faltantes 1ª Asist.'],
    datasets: [{ data: [stats.foto, Math.max(0, stats.total - stats.foto)], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }],
  }
  const distLabels = Object.keys(stats.porDist)
  const barDist = {
    labels: distLabels.length ? distLabels : ['—'],
    datasets: [{ label: 'Fotos recibidas', data: distLabels.length ? distLabels.map(d => stats.porDist[d]) : [0], backgroundColor: '#10b981', borderRadius: 4 }],
  }
  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }, y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } } },
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">👥 Monitoreo de Personeros y Asistencia</h1>
        <p className="text-sm text-slate-500">1ª Asistencia (Confirmación y Foto) y 2ª Asistencia (Llegada con GPS) · <span className="text-sky-600 font-semibold">{ambitoLabel || 'Lima Metropolitana'}</span></p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users}     border="#3b82f6" bg="#eff6ff" value={stats.total.toLocaleString('es-PE')} label="Total de personeros" />
        <Kpi icon={Camera}    border="#10b981" bg="#ecfdf5" value={stats.foto.toLocaleString('es-PE')}  label="1ª Asistencia (Foto)" />
        <Kpi icon={MapPin}    border="#06b6d4" bg="#cffafe" value={stats.gps.toLocaleString('es-PE')}   label="2ª Asistencia (GPS)" />
        <Kpi icon={Landmark}  border="#8b5cf6" bg="#f5f3ff" value={String(stats.distritos)}             label="Distritos con reporte" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-extrabold text-slate-900 text-sm">1ª Conf. Global</p>
          <p className="text-xs text-slate-500 mb-3">Confirmación con Foto</p>
          <div className="h-56"><Doughnut data={donut} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} /></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="font-extrabold text-slate-900 text-sm">1ª por Distrito</p>
          <p className="text-xs text-slate-500 mb-3">Fotos recibidas</p>
          <div className="h-56"><Bar data={barDist} options={chartOpts} /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <p className="font-extrabold text-slate-900 text-sm">Detalle de Personeros y Estado de Confirmación ({filtrados.length})</p>
          <div className="flex gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, DNI o mesa…"
              className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-sky-500 w-56" />
            <select value={estado} onChange={e => setEstado(e.target.value as any)}
              className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 outline-none">
              <option value="todos">Todos los estados</option>
              <option value="confirmados">Confirmados</option>
              <option value="pendientes">Pendientes</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                {['Personero', 'DNI / Celular', 'Distrito', 'Local de Votación', 'Mesa', '1ª Conf. (Foto)', '2ª Conf. (GPS)'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Sin personeros con esos filtros.</td></tr>
              ) : filtrados.slice(0, 500).map(p => {
                const foto = !!p.asistencia_local_at
                const gps = gpsUserIds.has(p.id)
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{p.nombre_completo}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      <span className="font-mono font-semibold text-slate-700">{p.dni ?? '—'}</span>
                      {p.celular && <span className="block text-xs">{p.celular}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold bg-sky-50 text-sky-700 rounded px-2 py-0.5">{p.distrito_asignado ?? p.distrito_vota ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[240px] truncate">{p.local_asignado ?? p.local_votacion ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.mesa_asignada ?? 'No aplica'}</td>
                    <td className="px-4 py-2.5"><Badge ok={foto} /></td>
                    <td className="px-4 py-2.5"><Badge ok={gps} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Badge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-xs font-bold bg-emerald-50 text-emerald-600 rounded-full px-2.5 py-1">CONFIRMADO</span>
    : <span className="text-xs font-bold bg-amber-50 text-amber-600 rounded-full px-2.5 py-1">PENDIENTE</span>
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
