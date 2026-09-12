import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { restablecerClavePersonero } from '../lib/personeroActions'
import EditarPersoneroModal from '../components/EditarPersoneroModal'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from 'chart.js'
import { Camera, MapPin, Pencil, KeyRound, MessageCircle } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

interface Perfil {
  id: string
  nombre_completo: string
  dni: string | null
  celular: string | null
  correo: string | null
  rol: string
  distrito_asignado: string | null
  distrito_vota: string | null
  local_asignado: string | null
  local_votacion: string | null
  mesa_asignada: string | null
  asistencia_local_at: string | null
}
interface Envio { manual: boolean; imagen: boolean }

const EMPTY_ENVIO: Envio = { manual: false, imagen: false }

export default function PersoneroMonitorPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [pers, setPers] = useState<Perfil[]>([])
  const [gpsUserIds, setGpsUserIds] = useState<Set<string>>(new Set())
  const [envios, setEnvios] = useState<Map<string, Envio>>(new Map())
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fAsis, setFAsis] = useState<'todos' | 'foto' | 'gps' | 'sin'>('todos')
  const [fEnv, setFEnv] = useState<'todos' | 'completo' | 'parcial' | 'sin'>('todos')
  const [editando, setEditando] = useState<Perfil | null>(null)

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      let pq = supabase.from('profiles')
        .select('id, nombre_completo, dni, celular, correo, rol, distrito_asignado, distrito_vota, local_asignado, local_votacion, mesa_asignada, asistencia_local_at')
        .ilike('rol', 'Personero%')
        .order('nombre_completo')
      if (distritosEfectivos) pq = pq.in('distrito_asignado', distritosEfectivos)

      const [{ data: p }, { data: asis }, { data: actas }] = await Promise.all([
        pq,
        supabase.from('asistencias').select('user_id').eq('tipo', 'LLEGADA'),
        supabase.from('actas').select('personero_id, personero_dni, metodo, estado'),
      ])
      if (!vivo) return

      // Estado de envío por personero: metodo MANUAL / IMAGEN (clave por id y por dni)
      const map = new Map<string, Envio>()
      for (const a of (actas ?? []) as any[]) {
        if (a.estado && a.estado !== 'TRANSMITIDA') continue
        const esImg = String(a.metodo).toUpperCase() === 'IMAGEN'
        for (const k of [a.personero_id, a.personero_dni].filter(Boolean)) {
          const cur = map.get(k) ?? { ...EMPTY_ENVIO }
          if (esImg) cur.imagen = true; else cur.manual = true
          map.set(k, cur)
        }
      }
      setPers((p ?? []) as Perfil[])
      setGpsUserIds(new Set((asis ?? []).map((a: any) => a.user_id)))
      setEnvios(map)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [scopeLoading, distritosEfectivos])

  const envioDe = (p: Perfil): Envio =>
    envios.get(p.id) ?? (p.dni ? envios.get(p.dni) : undefined) ?? EMPTY_ENVIO

  const filtrados = useMemo(() => {
    let r = pers
    if (f.colegio) r = r.filter(p => (p.local_asignado ?? p.local_votacion) === f.colegio)
    const s = q.trim().toLowerCase()
    if (s) r = r.filter(p =>
      p.nombre_completo?.toLowerCase().includes(s) || (p.dni ?? '').includes(s) || (p.mesa_asignada ?? '').includes(s))
    if (fAsis === 'foto') r = r.filter(p => p.asistencia_local_at)
    if (fAsis === 'gps')  r = r.filter(p => gpsUserIds.has(p.id))
    if (fAsis === 'sin')  r = r.filter(p => !p.asistencia_local_at && !gpsUserIds.has(p.id))
    if (fEnv !== 'todos') r = r.filter(p => {
      const e = envioDe(p); const n = (e.manual ? 1 : 0) + (e.imagen ? 1 : 0)
      return fEnv === 'completo' ? n === 2 : fEnv === 'parcial' ? n === 1 : n === 0
    })
    return r
  }, [pers, f.colegio, q, fAsis, fEnv, gpsUserIds, envios])

  const stats = useMemo(() => {
    const foto = pers.filter(p => p.asistencia_local_at).length
    const gps = pers.filter(p => gpsUserIds.has(p.id)).length
    const conEnvio = pers.filter(p => { const e = envioDe(p); return e.manual || e.imagen }).length
    const porDistFoto: Record<string, number> = {}
    const porDistGps: Record<string, number> = {}
    for (const p of pers) {
      const d = p.distrito_asignado
      if (!d) continue
      if (p.asistencia_local_at) porDistFoto[d] = (porDistFoto[d] ?? 0) + 1
      if (gpsUserIds.has(p.id))  porDistGps[d]  = (porDistGps[d] ?? 0) + 1
    }
    return { total: pers.length, foto, gps, conEnvio, porDistFoto, porDistGps }
  }, [pers, gpsUserIds, envios])

  const donut1 = {
    labels: ['Confirmados 1ª Asist.', 'Faltantes 1ª Asist.'],
    datasets: [{ data: [stats.foto, Math.max(0, stats.total - stats.foto)], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }],
  }
  const donut2 = {
    labels: ['Confirmados 2ª Asist.', 'Faltantes 2ª Asist.'],
    datasets: [{ data: [stats.gps, Math.max(0, stats.total - stats.gps)], backgroundColor: ['#3b82f6', '#f59e0b'], borderWidth: 0 }],
  }
  const barData = (por: Record<string, number>, color: string) => {
    const labels = Object.keys(por)
    return {
      labels: labels.length ? labels : ['—'],
      datasets: [{ data: labels.length ? labels.map(d => por[d]) : [0], backgroundColor: color, borderRadius: 4 }],
    }
  }
  const donutOpts: any = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } }, y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } } },
  }

  const onRestablecer = async (p: Perfil) => {
    if (!p.dni) return
    if (!window.confirm(`¿Restablecer la contraseña de ${p.nombre_completo} a su DNI (${p.dni})?`)) return
    try {
      await restablecerClavePersonero(p.dni)
      alert('Contraseña restablecida a su DNI.')
    } catch (e: any) {
      alert('No se pudo restablecer: ' + (e.message ?? 'error desconocido'))
    }
  }

  const avisar = (p: Perfil) => {
    const tel = (p.celular ?? '').replace(/\D/g, '')
    if (!tel) return
    const nom = (p.nombre_completo ?? '').split(' ')[0]
    const msg = `Hola ${nom}, te escribimos de Somos Perú. Por favor confirma tu asistencia y envía tu acta (conteo manual y/o foto) desde la app. ¡Gracias!`
    window.open(`https://wa.me/51${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">👥 Monitoreo de Personeros, Asistencia y Envíos de Actas</h1>
        <p className="text-sm text-slate-500">
          Control de 1ª/2ª Asistencia y estado de transmisión: Conteo Manual 📝 e Imagen / OCR 🖼️ ·{' '}
          <span className="text-sky-600 font-semibold">{ambitoLabel || 'Tumbes'}</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard icon={Camera} tint="#10b981" titulo="1ª Conf. Global" sub="Confirmación con Foto">
          <Doughnut data={donut1} options={donutOpts} />
        </ChartCard>
        <ChartCard icon={Camera} tint="#10b981" titulo="1ª por Distrito" sub="Fotos recibidas">
          {Object.keys(stats.porDistFoto).length
            ? <Bar data={barData(stats.porDistFoto, '#10b981')} options={chartOpts} />
            : <SinRegistros />}
        </ChartCard>
        <ChartCard icon={MapPin} tint="#f59e0b" titulo="2ª Conf. Global" sub="Llegada con GPS">
          <Doughnut data={donut2} options={donutOpts} />
        </ChartCard>
        <ChartCard icon={MapPin} tint="#f59e0b" titulo="2ª por Distrito" sub="Llegadas GPS por distrito">
          {Object.keys(stats.porDistGps).length
            ? <Bar data={barData(stats.porDistGps, '#3b82f6')} options={chartOpts} />
            : <SinRegistros />}
        </ChartCard>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-extrabold text-slate-900 text-sm">📋 Detalle de Personeros: Asistencia y Envíos de Actas ({filtrados.length})</p>
              <p className="text-xs text-slate-500">Seguimiento en vivo: Asistencia (Foto/GPS) + Envío Manual 📝 + Envío Imagen 🖼️</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, DNI, mesa…"
                className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-sky-500 w-56" />
              <select value={fAsis} onChange={e => setFAsis(e.target.value as any)}
                className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 outline-none">
                <option value="todos">Asistencia: Todos</option>
                <option value="foto">Con 1ª (Foto)</option>
                <option value="gps">Con 2ª (GPS)</option>
                <option value="sin">Sin asistencia</option>
              </select>
              <select value={fEnv} onChange={e => setFEnv(e.target.value as any)}
                className="text-sm rounded-lg border border-slate-300 px-2 py-1.5 outline-none">
                <option value="todos">Envíos: Todos</option>
                <option value="completo">Completos (2/2)</option>
                <option value="parcial">Parciales (1/2)</option>
                <option value="sin">Sin envío (0/2)</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                {['Personero', 'DNI / Celular', 'Distrito / Local', 'Mesa', '1ª Conf. (Foto)', '2ª Conf. (GPS)', 'Envío Manual 📝', 'Envío Imagen 🖼️', 'Estado Envíos', 'Contacto'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Cargando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Sin personeros con esos filtros.</td></tr>
              ) : filtrados.slice(0, 600).map(p => {
                const foto = !!p.asistencia_local_at
                const gps = gpsUserIds.has(p.id)
                const e = envioDe(p)
                const n = (e.manual ? 1 : 0) + (e.imagen ? 1 : 0)
                const tel = (p.celular ?? '').replace(/\D/g, '')
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{p.nombre_completo}</td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      <span className="font-mono font-semibold text-slate-700">{p.dni ?? '—'}</span>
                      {p.celular && <span className="block text-xs">{p.celular}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-semibold bg-sky-50 text-sky-700 rounded px-2 py-0.5">{p.distrito_asignado ?? p.distrito_vota ?? '—'}</span>
                      <span className="block text-xs text-slate-400 max-w-[220px] truncate mt-0.5">{p.local_asignado ?? p.local_votacion ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{p.mesa_asignada ?? 'No aplica'}</td>
                    <td className="px-4 py-2.5"><Badge ok={foto} /></td>
                    <td className="px-4 py-2.5"><Badge ok={gps} /></td>
                    <td className="px-4 py-2.5"><Badge ok={e.manual} okText="RECIBIDO" /></td>
                    <td className="px-4 py-2.5"><Badge ok={e.imagen} okText="RECIBIDO" /></td>
                    <td className="px-4 py-2.5"><EstadoEnvios n={n} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button onClick={() => avisar(p)} disabled={!tel} title={tel ? 'Avisar por WhatsApp' : 'Sin celular'}
                          className="flex items-center gap-1 text-xs font-bold rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-2.5 py-1.5">
                          <MessageCircle size={13} /> Avisar
                        </button>
                        <button onClick={() => setEditando(p)} title="Editar datos"
                          className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-300">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onRestablecer(p)} title="Restablecer contraseña a su DNI"
                          className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300">
                          <KeyRound size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <EditarPersoneroModal
          perfil={editando}
          onClose={() => setEditando(null)}
          onSaved={cambios => {
            setPers(prev => prev.map(p => p.id === editando.id ? { ...p, ...cambios } : p))
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

function Badge({ ok, okText = 'CONFIRMADO' }: { ok: boolean; okText?: string }) {
  return ok
    ? <span className="inline-block whitespace-nowrap text-xs font-bold bg-emerald-50 text-emerald-600 rounded-full px-2.5 py-1">{okText}</span>
    : <span className="inline-block whitespace-nowrap text-xs font-bold bg-amber-50 text-amber-600 rounded-full px-2.5 py-1">PENDIENTE</span>
}

function EstadoEnvios({ n }: { n: number }) {
  const cfg = n === 2
    ? { cls: 'bg-emerald-500 text-white', txt: 'Completo (2/2)' }
    : n === 1
      ? { cls: 'bg-amber-100 text-amber-700', txt: 'Parcial (1/2)' }
      : { cls: 'bg-rose-500 text-white', txt: 'Sin Envío (0/2)' }
  return <span className={`inline-block whitespace-nowrap text-xs font-bold rounded-full px-2.5 py-1 ${cfg.cls}`}>{cfg.txt}</span>
}

function ChartCard({ icon: Icon, tint, titulo, sub, children }: {
  icon: any; tint: string; titulo: string; sub: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
        <Icon size={14} style={{ color: tint }} /> {titulo}
      </p>
      <p className="text-xs text-slate-500 mb-3">{sub}</p>
      <div className="h-56">{children}</div>
    </div>
  )
}

function SinRegistros() {
  return <div className="h-full flex items-center justify-center text-sm text-slate-400">Sin registros</div>
}
