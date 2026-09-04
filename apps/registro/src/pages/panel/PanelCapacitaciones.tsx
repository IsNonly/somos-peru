import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js'
import {
  Search, Download, Users, GraduationCap, PlayCircle, BookOpenCheck, ClipboardCheck,
  MessageCircle, PieChart, BarChart3, CheckCircle2, Pencil, Lock, Save, Trash2,
  User, Phone, ShieldCheck, MapPin, Building2, Hash, Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  usePanelData, rolNorm, ROL_MESA, ROL_LOCAL, ROL_ZONAL, ROL_COORD_DIST,
  type Perfil, type Colegio,
} from '../../lib/panel'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const wa = (tel?: string | null, msg?: string) =>
  tel ? `https://wa.me/51${String(tel).replace(/\D/g, '')}${msg ? `?text=${encodeURIComponent(msg)}` : ''}` : undefined

type Estado = 'completo' | 'proceso' | 'noiniciado'

function estadoDe(p: Perfil): Estado {
  const v = p.videos_vistos ?? 0
  const pdf = p.pdfs_vistos ?? 0
  if (v >= 2 && pdf >= 1 && p.quiz_estado === 'Aprobado') return 'completo'
  if (v === 0 && pdf === 0 && p.quiz_estado !== 'Aprobado' && p.quiz_estado !== 'Reprobado') return 'noiniciado'
  return 'proceso'
}

const recordatorio = (p: Perfil) => {
  const v = p.videos_vistos ?? 0
  const pdf = p.pdfs_vistos ?? 0
  const nombre = p.nombre_completo?.split(' ')[0] ?? ''
  return `Hola ${nombre}! Te recordamos completar tu capacitación de personero ERM 2026 (ingresa a tu cuenta → Capacítate). ` +
    `Llevas: Video ${v}/2, Cartilla ${pdf >= 1 ? 'lista ✓' : 'pendiente'}, Cuestionario ${p.quiz_estado === 'Aprobado' ? 'aprobado ✓' : 'pendiente'}. ` +
    `Sin estos 3 pasos tu cuenta no queda habilitada para el conteo. ¡Gracias por tu compromiso!`
}

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null

export default function PanelCapacitaciones() {
  const { rol: actorRol, nombreCompleto: actorNombre, dni: actorDni } = useOutletContext<{ rol: string; nombreCompleto: string; dni: string }>()
  const actorNorm = rolNorm(actorRol)
  const esSuperadmin = actorNorm === 'Administrador General'
  const puedeModificar = esSuperadmin || actorNorm === ROL_ZONAL
  const editadoPor = actorNombre ? `${actorNombre} (DNI ${actorDni})` : `DNI ${actorDni}`

  const d = usePanelData()
  const [q, setQ] = useState('')
  const [fDist, setFDist] = useState('')
  const [chip, setChip] = useState<'todos' | Estado>('todos')
  const [editPerfil, setEditPerfil] = useState<Perfil | null>(null)

  const cohorte = useMemo(
    () => d.perfiles.filter(p => rolNorm(p.rol) === ROL_MESA || rolNorm(p.rol) === ROL_LOCAL),
    [d.perfiles],
  )

  const distritos = useMemo(() =>
    [...new Set(cohorte.map(p => p.distrito_asignado || p.distrito_vota).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, 'es')), [cohorte])

  const distritosModal = useMemo(() =>
    [...new Set([...d.colegios.map(c => c.distrito), ...distritos].filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, 'es')), [d.colegios, distritos])

  const conEstado = useMemo(() => cohorte.map(p => ({ p, estado: estadoDe(p) })), [cohorte])

  const kpis = useMemo(() => {
    const total = cohorte.length || 1
    const videoOk = cohorte.filter(p => (p.videos_vistos ?? 0) >= 2).length
    const pdfOk = cohorte.filter(p => (p.pdfs_vistos ?? 0) >= 1).length
    const quizOk = cohorte.filter(p => p.quiz_estado === 'Aprobado').length
    const completo = conEstado.filter(x => x.estado === 'completo').length
    const noiniciado = conEstado.filter(x => x.estado === 'noiniciado').length
    return {
      total: cohorte.length, videoOk, pdfOk, quizOk, completo, noiniciado,
      videoPct: Math.round((videoOk / total) * 100),
      pdfPct: Math.round((pdfOk / total) * 100),
      quizPct: Math.round((quizOk / total) * 100),
      completoPct: Math.round((completo / total) * 100),
    }
  }, [cohorte, conEstado])

  const donutData = {
    labels: ['Capacitación completa', 'En proceso', 'Sin iniciar'],
    datasets: [{
      data: [
        conEstado.filter(x => x.estado === 'completo').length,
        conEstado.filter(x => x.estado === 'proceso').length,
        conEstado.filter(x => x.estado === 'noiniciado').length,
      ],
      backgroundColor: ['#16a34a', '#d97706', '#dc2626'],
      borderWidth: 0,
    }],
  }

  const porDistrito = useMemo(() => {
    const map = new Map<string, { total: number; video: number; pdf: number }>()
    for (const p of cohorte) {
      const dist = p.distrito_asignado || p.distrito_vota || 'Sin distrito'
      const e = map.get(dist) ?? { total: 0, video: 0, pdf: 0 }
      e.total++
      if ((p.videos_vistos ?? 0) >= 2) e.video++
      if ((p.pdfs_vistos ?? 0) >= 1) e.pdf++
      map.set(dist, e)
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10)
  }, [cohorte])

  const barData = {
    labels: porDistrito.map(([dist]) => dist),
    datasets: [
      { label: 'Video completo (2/2)', data: porDistrito.map(([, v]) => v.video), backgroundColor: '#0ea5e9', borderRadius: 5 },
      { label: 'Cartilla leída', data: porDistrito.map(([, v]) => v.pdf), backgroundColor: '#a855f7', borderRadius: 5 },
    ],
  }

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase()
    return conEstado.filter(({ p, estado }) => {
      if (s && !(
        p.nombre_completo?.toLowerCase().includes(s) ||
        (p.dni ?? '').includes(s) ||
        (p.distrito_asignado ?? '').toLowerCase().includes(s))) return false
      if (fDist && p.distrito_asignado !== fDist && p.distrito_vota !== fDist) return false
      if (chip !== 'todos' && estado !== chip) return false
      return true
    }).sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'noiniciado' ? -1 : b.estado === 'noiniciado' ? 1 : a.estado === 'proceso' ? -1 : 1))
  }, [conEstado, q, fDist, chip])

  const exportar = () => {
    const rows = filtrados.map(({ p }) => ({
      DNI: p.dni ?? '', Nombre: p.nombre_completo, Rol: rolNorm(p.rol), Distrito: p.distrito_asignado ?? p.distrito_vota ?? '',
      Celular: p.celular ?? '', 'Videos vistos': p.videos_vistos ?? 0, 'Cartilla leída': (p.pdfs_vistos ?? 0) >= 1 ? 'Sí' : 'No',
      Cuestionario: p.quiz_estado ?? 'Pendiente', 'Estado Credencial': p.credencial_estado ?? 'Pendiente',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Capacitaciones')
    XLSX.writeFile(wb, `ConteoLima_Capacitaciones_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (d.loading) return <div className="py-20 text-center text-slate-400 text-sm">Cargando panel…</div>

  return (
    <div className="space-y-4 w-full">
      <section>
        <p className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <GraduationCap size={15} /> Progreso de Capacitaciones · Personeros de Mesa y de Local
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi color="#3b82f6" icon={Users} value={kpis.total} label="Sujetos a Capacitación" sub="Mesa + Local de Votación" />
          <Kpi color="#0ea5e9" icon={PlayCircle} value={`${kpis.videoPct}%`} label="Video Completo" sub={`${kpis.videoOk} de ${kpis.total}`} />
          <Kpi color="#a855f7" icon={BookOpenCheck} value={`${kpis.pdfPct}%`} label="Cartilla Leída" sub={`${kpis.pdfOk} de ${kpis.total}`} />
          <Kpi color="#f59e0b" icon={ClipboardCheck} value={`${kpis.quizPct}%`} label="Cuestionario Aprobado" sub={`${kpis.quizOk} de ${kpis.total}`} />
          <Kpi color="#16a34a" icon={CheckCircle2} value={`${kpis.completoPct}%`} label="Capacitación Completa" sub={`${kpis.completo} de ${kpis.total}`} />
        </div>
      </section>

      <div className="grid lg:grid-cols-5 gap-4">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <PieChart size={15} /> Estado de Capacitación
          </p>
          {kpis.total === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Sin personeros registrados todavía.</p>
          ) : (
            <>
              <div className="max-w-[220px] mx-auto">
                <Doughnut data={donutData} options={{ plugins: { legend: { display: false } }, cutout: '68%' }} />
              </div>
              <div className="mt-4 space-y-1.5 text-xs">
                <Leyenda color="#16a34a" label="Capacitación completa" n={kpis.completo} />
                <Leyenda color="#d97706" label="En proceso" n={cohorte.length - kpis.completo - kpis.noiniciado} />
                <Leyenda color="#dc2626" label="Sin iniciar" n={kpis.noiniciado} />
              </div>
            </>
          )}
        </section>

        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
            <BarChart3 size={15} /> Video vs. Cartilla por Distrito (top 10)
          </p>
          {porDistrito.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Sin datos por distrito.</p>
          ) : (
            <Bar data={barData} options={{
              responsive: true,
              plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
              scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            }} />
          )}
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, DNI, distrito…"
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500" />
          </div>
          <select value={fDist} onChange={e => setFDist(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none max-w-[12rem]">
            <option value="">📍 Todos los distritos</option>
            {distritos.map(dist => <option key={dist} value={dist}>{dist}</option>)}
          </select>
          <button onClick={exportar}
            className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 flex items-center gap-1.5">
            <Download size={13} /> Descargar Excel
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <ChipBtn active={chip === 'todos'} onClick={() => setChip('todos')} label="Todos" n={conEstado.length} />
            <ChipBtn active={chip === 'completo'} onClick={() => setChip('completo')} label="Completo" n={kpis.completo} />
            <ChipBtn active={chip === 'proceso'} onClick={() => setChip('proceso')} label="En proceso" n={cohorte.length - kpis.completo - kpis.noiniciado} />
            <ChipBtn active={chip === 'noiniciado'} onClick={() => setChip('noiniciado')} label="Sin iniciar" n={kpis.noiniciado} />
          </div>
          {!puedeModificar && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Lock size={11} /> Modo solo lectura — tu rol no puede modificar registros
            </span>
          )}
        </div>
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-500">{filtrados.length} personeros</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                {['#', 'Personero / DNI', 'Rol', 'Distrito Asignado', 'Progreso Video', 'Progreso PDF', 'Estado Credencial', 'WhatsApp Recordatorio', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.slice(0, 800).map(({ p }, i) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-400 font-semibold">#{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-slate-800">{p.nombre_completo}</p>
                    <p className="text-xs text-slate-400">DNI: {p.dni ?? '—'}</p>
                    {p.modificado_por && (
                      <p className="text-[10px] text-sky-500 mt-0.5 flex items-center gap-1">
                        <Pencil size={9} /> Editado por {p.modificado_por} · {fechaCorta(p.modificado_at)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-bold bg-sky-50 text-sky-700 rounded-full px-2.5 py-1">{rolNorm(p.rol)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.distrito_asignado ?? p.distrito_vota ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <ProgresoBar value={p.videos_vistos ?? 0} total={2} color="#0ea5e9" />
                  </td>
                  <td className="px-4 py-2.5">
                    <ProgresoBar value={Math.min(p.pdfs_vistos ?? 0, 1)} total={1} color="#a855f7" />
                  </td>
                  <td className="px-4 py-2.5">
                    <CredencialBadge estado={p.credencial_estado} />
                  </td>
                  <td className="px-4 py-2.5">
                    {p.celular ? (
                      <a href={wa(p.celular, recordatorio(p))} target="_blank" rel="noreferrer"
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 whitespace-nowrap">
                        <MessageCircle size={13} /> Recordatorio
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">s/celular</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {puedeModificar ? (
                      <button onClick={() => setEditPerfil(p)}
                        className="text-xs font-bold rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50 px-2.5 py-1.5 flex items-center gap-1.5 whitespace-nowrap">
                        <Pencil size={12} /> Modificar
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-300 flex items-center gap-1"><Lock size={11} /> Solo lectura</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 800 && <p className="px-4 py-3 text-xs text-slate-400">Mostrando 800 de {filtrados.length}.</p>}
          {filtrados.length === 0 && <p className="px-4 py-10 text-sm text-slate-400 text-center">Sin personeros con esos filtros.</p>}
        </div>
      </div>

      {editPerfil && puedeModificar && (
        <ModalEditar
          perfil={editPerfil}
          actorEsSuperadmin={esSuperadmin}
          editadoPor={editadoPor}
          colegios={d.colegios}
          distritosOpts={distritosModal}
          onClose={() => setEditPerfil(null)}
          onSaved={() => d.refetch()}
        />
      )}
    </div>
  )
}

function Kpi({ color, icon: Icon, value, label, sub }: {
  color: string; icon: any; value: number | string; label: string; sub: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
        <Icon size={13} style={{ color }} /> {label}
      </div>
      <p className="text-2xl font-black text-slate-900 mt-1 leading-none">{typeof value === 'number' ? value.toLocaleString('es-PE') : value}</p>
      <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

function Leyenda({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-600 font-medium">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /> {label}
      </span>
      <span className="font-bold text-slate-800">{n}</span>
    </div>
  )
}

function ChipBtn({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 font-bold border transition-colors flex items-center gap-1.5 ${
        active ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
      {label} <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
    </button>
  )
}

function ProgresoBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold text-slate-500 tabular-nums flex-shrink-0">{value}/{total}</span>
    </div>
  )
}

function CredencialBadge({ estado }: { estado: string | null }) {
  const e = estado ?? 'Pendiente'
  const cls = e === 'Confirmado' ? 'bg-emerald-100 text-emerald-700'
    : e === 'Bloqueado' ? 'bg-rose-100 text-rose-700'
    : e === 'Reprobado' ? 'bg-rose-100 text-rose-700'
    : 'bg-amber-100 text-amber-700'
  return <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${cls}`}>{e}</span>
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500'

function Campo({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1">
        <Icon size={12} /> {label}
      </span>
      {children}
    </label>
  )
}

function ModalEditar({ perfil, actorEsSuperadmin, editadoPor, colegios, distritosOpts, onClose, onSaved }: {
  perfil: Perfil; actorEsSuperadmin: boolean; editadoPor: string; colegios: Colegio[]; distritosOpts: string[]
  onClose: () => void; onSaved: () => void
}) {
  const [nombre, setNombre] = useState(perfil.nombre_completo ?? '')
  const [celular, setCelular] = useState(perfil.celular ?? '')
  const [rolSel, setRolSel] = useState(rolNorm(perfil.rol) || ROL_MESA)
  const [credEstado, setCredEstado] = useState(perfil.credencial_estado ?? 'Pendiente')
  const [distrito, setDistrito] = useState(perfil.distrito_asignado ?? perfil.distrito_vota ?? '')
  const [centro, setCentro] = useState(perfil.local_asignado ?? perfil.local_votacion ?? '')
  const [mesa, setMesa] = useState(perfil.mesa_asignada ?? '')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const centrosDelDistrito = useMemo(
    () => [...new Set(colegios.filter(c => c.distrito === distrito).map(c => c.nombre))],
    [colegios, distrito],
  )

  const guardar = async () => {
    if (!nombre.trim()) { alert('El nombre no puede estar vacío.'); return }
    setGuardando(true)
    const { error } = await supabase.from('profiles').update({
      nombre_completo: nombre.trim(),
      celular: celular.trim() || null,
      rol: rolSel,
      credencial_estado: credEstado,
      distrito_asignado: distrito || null,
      local_asignado: centro || null,
      mesa_asignada: mesa.trim() || null,
      modificado_por: editadoPor,
      modificado_at: new Date().toISOString(),
    }).eq('id', perfil.id)
    setGuardando(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    onSaved()
    onClose()
  }

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar definitivamente a ${perfil.nombre_completo}? Esta acción no se puede deshacer.`)) return
    setEliminando(true)
    const { error } = await supabase.from('profiles').delete().eq('id', perfil.id)
    setEliminando(false)
    if (error) { alert('No se pudo eliminar: ' + error.message); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mt-16 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <Sparkles size={15} className="text-sky-500" /> Modificar Registro y Asignación{actorEsSuperadmin ? ' (Superadmin)' : ''}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {actorEsSuperadmin ? 'Control total y eliminación de registros' : 'Editar datos y asignación'} · DNI: {perfil.dni ?? '—'}
            </p>
            {perfil.modificado_por && (
              <p className="text-[11px] text-sky-600 mt-1 flex items-center gap-1">
                <Pencil size={10} /> Última edición: {perfil.modificado_por} · {fechaCorta(perfil.modificado_at)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>

        <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombres y Apellidos" icon={User}>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Celular" icon={Phone}>
              <input value={celular} onChange={e => setCelular(e.target.value)} className={inputCls} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Rol a Desempeñar" icon={ShieldCheck}>
              <select value={rolSel} onChange={e => setRolSel(e.target.value)} className={inputCls}>
                {[ROL_MESA, ROL_LOCAL, ROL_ZONAL, ROL_COORD_DIST, 'Administrador General'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            <Campo label="Estado de Credencial" icon={ShieldCheck}>
              <select value={credEstado ?? ''} onChange={e => setCredEstado(e.target.value)} className={inputCls}>
                {['Pendiente', 'Confirmado', 'Bloqueado', 'Reprobado'].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Distrito Asignado" icon={MapPin}>
            <select value={distrito} onChange={e => { setDistrito(e.target.value); setCentro('') }} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {distritosOpts.map(dist => <option key={dist} value={dist}>{dist}</option>)}
            </select>
          </Campo>
          <Campo label="Centro de Votación Asignado" icon={Building2}>
            <select value={centro} onChange={e => setCentro(e.target.value)} className={inputCls}>
              <option value="">No aplica</option>
              {centrosDelDistrito.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Mesa Asignada" icon={Hash}>
            <input value={mesa} onChange={e => setMesa(e.target.value)} placeholder="Ej. 064321 (6 dígitos de la mesa)" className={inputCls} />
          </Campo>
          <p className="text-[11px] text-amber-700 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            💡 Ingresa el número de mesa de 6 dígitos asignada al personero en este centro de votación.
          </p>
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-100">
          {actorEsSuperadmin && (
            <button onClick={eliminar} disabled={eliminando}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 disabled:opacity-50">
              <Trash2 size={14} /> {eliminando ? 'Eliminando…' : 'Eliminar Personero'}
            </button>
          )}
          <button onClick={guardar} disabled={guardando}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 disabled:opacity-50">
            <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
