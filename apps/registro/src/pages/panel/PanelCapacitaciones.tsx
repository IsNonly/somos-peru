import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
} from 'chart.js'
import {
  Search, Download, Users, GraduationCap, PlayCircle, BookOpenCheck, ClipboardCheck,
  MessageCircle, PieChart, CheckCircle2, Pencil, Lock, Save, Trash2,
  User, Phone, ShieldCheck, MapPin, Building2, Hash, Sparkles, Filter, KeyRound,
} from 'lucide-react'
import { supabase, AMBITO_DEPARTAMENTO } from '../../lib/supabase'
import {
  usePanelData, rolNorm, norm, ROL_MESA, ROL_LOCAL, ROL_ZONAL, ROL_COORD_DIST, fetchTodasLasMesas,
  type Perfil, type Colegio,
} from '../../lib/panel'
import { eliminarPersoneroCompleto, cambiarPasswordPersonero } from '../../lib/personeros'

ChartJS.register(ArcElement, Tooltip, Legend)

const wa = (tel?: string | null, msg?: string) =>
  tel ? `https://wa.me/51${String(tel).replace(/\D/g, '')}${msg ? `?text=${encodeURIComponent(msg)}` : ''}` : undefined

interface MesaOpt { numero: string; colegio_nombre: string | null }
const normTexto = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

type Estado = 'completo' | 'proceso' | 'noiniciado'

function estadoDe(p: Perfil): Estado {
  const v = p.videos_vistos ?? 0
  const pdf = p.pdfs_vistos ?? 0
  if (v >= 1 && pdf >= 1 && p.quiz_estado === 'Aprobado') return 'completo'
  if (v === 0 && pdf === 0 && p.quiz_estado !== 'Aprobado' && p.quiz_estado !== 'Reprobado') return 'noiniciado'
  return 'proceso'
}

const LOGIN_SAN_ISIDRO = 'https://somosperu-sanisidro-registro.vercel.app/login'

// Se arma al momento de presionar "Recordatorio", con el avance actual del personero.
const recordatorio = (p: Perfil) => {
  const nombre = p.nombre_completo?.trim().split(/\s+/)[0] ?? ''
  const paso = (listo: boolean, texto: string) => `- ${texto} (${listo ? 'listo' : 'pendiente'})`
  const lineas = [
    `Hola ${nombre}! Te recordamos completar tu capacitación de personero ERM 2026 (ingresa a tu cuenta → Capacítate).`,
    '',
    'Tu avance:',
    paso((p.videos_vistos ?? 0) >= 1, `Video ${Math.min(p.videos_vistos ?? 0, 1)}/1`),
    paso((p.pdfs_vistos ?? 0) >= 1, `Cartilla ${Math.min(p.pdfs_vistos ?? 0, 1)}/1`),
    paso(p.quiz_estado === 'Aprobado', `Evaluación ${p.quiz_estado === 'Aprobado' ? '1' : '0'}/1`),
    '',
    'Sin estos 3 pasos tu cuenta no queda habilitada para el conteo.',
  ]
  if (norm(p.distrito_asignado ?? '') === norm('San Isidro')) {
    lineas.push(
      '',
      'Tus datos para ingresar:',
      `Usuario: ${p.nombre_completo?.trim() ?? ''}`,
      `Contraseña: ${p.dni ?? ''}`,
      `Link: ${LOGIN_SAN_ISIDRO}`,
    )
  }
  lineas.push('', '¡Gracias por tu compromiso!')
  return lineas.join('\n')
}

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null

export default function PanelCapacitaciones() {
  const { rol: actorRol, nombreCompleto: actorNombre, dni: actorDni, local: actorLocal } =
    useOutletContext<{ rol: string; nombreCompleto: string; dni: string; local: string }>()
  const actorNorm = rolNorm(actorRol)
  const esSuperadmin = actorNorm === 'Administrador General'
  const esPCV = actorNorm === ROL_LOCAL
  const puedeModificar = esSuperadmin || actorNorm === ROL_ZONAL || actorNorm === ROL_COORD_DIST

  const editadoPor = actorNombre ? `${actorNombre} (DNI ${actorDni})` : `DNI ${actorDni}`

  const d = usePanelData()
  const [q, setQ] = useState('')
  const [fDist, setFDist] = useState('')
  const [fRol, setFRol] = useState('')
  const [fCol, setFCol] = useState('')
  const [chip, setChip] = useState<'todos' | Estado>('todos')
  const [editPerfil, setEditPerfil] = useState<Perfil | null>(null)

  // El PCV solo ve la capacitación de SUS propios personeros de mesa (los del
  // centro de votación que tiene asignado) — no la del distrito completo.
  const cohorte = useMemo(
    () => d.perfiles.filter(p => {
      if (esPCV) {
        return rolNorm(p.rol) === ROL_MESA &&
          norm(p.local_asignado || p.local_votacion) === norm(actorLocal)
      }
      return rolNorm(p.rol) === ROL_MESA || rolNorm(p.rol) === ROL_LOCAL || rolNorm(p.rol) === ROL_COORD_DIST
    }),
    [d.perfiles, esPCV, actorLocal],
  )

  const distritos = useMemo(() =>
    [...new Set(cohorte.map(p => p.distrito_asignado || p.distrito_vota).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, 'es')), [cohorte])

  // Colegios del filtro: los que tienen personeros, acotados al distrito elegido.
  const localDe = (p: Perfil) => (p.local_asignado || p.local_votacion || '').trim()
  const colegiosFiltro = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of cohorte) {
      if (fDist && p.distrito_asignado !== fDist && p.distrito_vota !== fDist) continue
      const l = localDe(p)
      if (l && !m.has(norm(l))) m.set(norm(l), l)
    }
    // También los colegios del padrón que aún no tienen a nadie inscrito.
    for (const c of d.colegios) {
      if (fDist && c.distrito !== fDist) continue
      if (c.nombre && !m.has(norm(c.nombre))) m.set(norm(c.nombre), c.nombre.trim())
    }
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'es'))
  }, [cohorte, fDist, d.colegios])

  useEffect(() => {
    if (fCol && !colegiosFiltro.some(c => norm(c) === norm(fCol))) setFCol('')
  }, [colegiosFiltro, fCol])

  const distritosModal = useMemo(() =>
    [...new Set([...d.colegios.map(c => c.distrito), ...distritos].filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, 'es')), [d.colegios, distritos])

  const conEstado = useMemo(() => cohorte.map(p => ({ p, estado: estadoDe(p) })), [cohorte])

  const kpis = useMemo(() => {
    const total = cohorte.length || 1
    const videoOk = cohorte.filter(p => (p.videos_vistos ?? 0) >= 1).length
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

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase()
    return conEstado.filter(({ p, estado }) => {
      if (s && !(
        p.nombre_completo?.toLowerCase().includes(s) ||
        (p.dni ?? '').includes(s) ||
        (p.local_asignado ?? '').toLowerCase().includes(s))) return false
      if (fDist && p.distrito_asignado !== fDist && p.distrito_vota !== fDist) return false
      if (fRol && rolNorm(p.rol) !== fRol) return false
      if (fCol && norm(localDe(p)) !== norm(fCol)) return false
      if (chip !== 'todos' && estado !== chip) return false
      return true
    }).sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'noiniciado' ? -1 : b.estado === 'noiniciado' ? 1 : a.estado === 'proceso' ? -1 : 1))
  }, [conEstado, q, fDist, fRol, fCol, chip])

  const exportar = () => {
    const rows = filtrados.map(({ p, estado }) => ({
      DNI: p.dni ?? '', Nombre: p.nombre_completo, Rol: rolNorm(p.rol), Distrito: p.distrito_asignado ?? p.distrito_vota ?? '',
      'Local / Colegio': p.local_asignado ?? p.local_votacion ?? '',
      'Mesa Designada': p.mesa_asignada ?? '',
      Celular: p.celular ?? '', 'Videos vistos': p.videos_vistos ?? 0, 'Cartilla leída': (p.pdfs_vistos ?? 0) >= 1 ? 'Sí' : 'No',
      Cuestionario: p.quiz_estado ?? 'Pendiente', Capacitación: estado === 'completo' ? 'Capacitado' : 'Sin capacitar',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Capacitaciones')
    // El PCV descarga solo SU centro de votación (la lista ya viene acotada a él);
    // el archivo lleva el nombre del colegio para que no se confunda.
    // Con un colegio elegido en el filtro, el archivo también lleva su nombre.
    const colArchivo = esPCV ? actorLocal : fCol
    const ambitoArchivo = colArchivo ? colArchivo.replace(/[^\p{L}\p{N}]+/gu, '_') : AMBITO_DEPARTAMENTO
    XLSX.writeFile(wb, `SomosPeru_${ambitoArchivo}_Capacitaciones_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (d.loading) return <div className="py-20 text-center text-slate-400 text-sm">Cargando panel…</div>

  return (
    <div className="space-y-4 w-full">
      <section>
        <p className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <GraduationCap size={15} /> Progreso de Capacitaciones · {esPCV
            ? `Personeros de Mesa de ${actorLocal || 'tu Centro de Votación'}`
            : 'Personeros de Mesa, de Local y Coordinador Distrital'}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi color="#3b82f6" icon={Users} value={kpis.total} label="Sujetos a Capacitación" sub="Mesa + Local + Coord. Distrital" />
          <Kpi color="#0ea5e9" icon={PlayCircle} value={`${kpis.videoPct}%`} label="Video" sub={`${kpis.videoOk} de ${kpis.total}`} />
          <Kpi color="#a855f7" icon={BookOpenCheck} value={`${kpis.pdfPct}%`} label="Cartilla" sub={`${kpis.pdfOk} de ${kpis.total}`} />
          <Kpi color="#f59e0b" icon={ClipboardCheck} value={`${kpis.quizPct}%`} label="Cuestionario Aprobado" sub={`${kpis.quizOk} de ${kpis.total}`} />
          <Kpi color="#16a34a" icon={CheckCircle2} value={`${kpis.completoPct}%`} label="Capacitación Completa" sub={`${kpis.completo} de ${kpis.total}`} />
        </div>
      </section>

      <section className="max-w-md bg-white border border-slate-200 rounded-2xl p-4">
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

      <section className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar personero por Nombre, DNI, Local…"
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500" />
          </div>
          <select value={chip} onChange={e => setChip(e.target.value as 'todos' | Estado)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none">
            <option value="todos">Todos los Estados</option>
            <option value="completo">Completo</option>
            <option value="proceso">En proceso</option>
            <option value="noiniciado">Sin iniciar</option>
          </select>
          {!esPCV && (
            <select value={fDist} onChange={e => setFDist(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none max-w-[12rem]">
              <option value="">📍 Todos los Distritos</option>
              {distritos.map(dist => <option key={dist} value={dist}>{dist}</option>)}
            </select>
          )}
          {!esPCV && (
            <select value={fCol} onChange={e => setFCol(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none max-w-[16rem]">
              <option value="">🏫 Todos los Colegios</option>
              {colegiosFiltro.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {!esPCV && (
            <select value={fRol} onChange={e => setFRol(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none max-w-[14rem]">
              <option value="">🛡️ Todos los Roles</option>
              <option value={ROL_MESA}>{ROL_MESA}</option>
              <option value={ROL_LOCAL}>{ROL_LOCAL}</option>
              <option value={ROL_COORD_DIST}>{ROL_COORD_DIST}</option>
            </select>
          )}
          <button onClick={exportar}
            className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
            <Download size={13} /> Descargar Excel
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1 flex items-center gap-1.5">
            <Filter size={12} /> {filtrados.length.toLocaleString('es-PE')} personeros encontrados
          </span>
          <div className="flex items-center gap-3">
            {!puedeModificar && (
              <span className="text-slate-400 flex items-center gap-1.5">
                <Lock size={11} /> Modo solo lectura — tu rol no puede modificar registros
              </span>
            )}
            <span className="text-slate-400">
              Total capacitaciones: <strong className="text-slate-700">{conEstado.length.toLocaleString('es-PE')}</strong>
            </span>
          </div>
        </div>
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-500">{filtrados.length} personeros</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                {['#', 'Personero / DNI', 'Rol', 'Distrito Asignado', 'Local / Colegio', 'Mesa', 'Progreso Video', 'Progreso PDF', 'Capacitación', 'WhatsApp Recordatorio', 'Acciones'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(({ p, estado }, i) => (
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
                  <td className="px-4 py-2.5 text-slate-600 max-w-[220px] truncate">{p.local_asignado ?? p.local_votacion ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {p.mesa_asignada || <span className="font-sans font-normal text-amber-600 text-xs">Sin mesa</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <ProgresoBar value={p.videos_vistos ?? 0} total={1} color="#0ea5e9" />
                  </td>
                  <td className="px-4 py-2.5">
                    <ProgresoBar value={Math.min(p.pdfs_vistos ?? 0, 1)} total={1} color="#a855f7" />
                  </td>
                  <td className="px-4 py-2.5">
                    <CapacitacionBadge estado={estado} />
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
          {filtrados.length === 0 && <p className="px-4 py-10 text-sm text-slate-400 text-center">Sin personeros con esos filtros.</p>}
        </div>
      </div>

      {editPerfil && puedeModificar && (
        <ModalEditar
          perfil={editPerfil}
          actorEsSuperadmin={esSuperadmin}
          puedeEliminar={puedeModificar}
          editadoPor={editadoPor}
          colegios={d.colegios}
          distritosOpts={distritosModal}
          mesasOcupadas={new Set(
            d.perfiles
              .filter(p => p.id !== editPerfil.id && rolNorm(p.rol) === ROL_MESA && p.mesa_asignada)
              .map(p => p.mesa_asignada as string),
          )}
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

function CapacitacionBadge({ estado }: { estado: Estado }) {
  const capacitado = estado === 'completo'
  const cls = capacitado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
  return <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${cls}`}>{capacitado ? 'Capacitado' : 'Sin capacitar'}</span>
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

function ModalEditar({ perfil, actorEsSuperadmin, puedeEliminar, editadoPor, colegios, distritosOpts, mesasOcupadas, onClose, onSaved }: {
  perfil: Perfil; actorEsSuperadmin: boolean; puedeEliminar: boolean; editadoPor: string; colegios: Colegio[]; distritosOpts: string[]
  mesasOcupadas: Set<string>
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

  // Padrón oficial de mesas (tabla `mesas`): permite buscar y asignar una mesa
  // real del centro elegido, en vez de escribir el número a mano.
  const [mesasDisponibles, setMesasDisponibles] = useState<MesaOpt[] | null>(null)
  useEffect(() => {
    fetchTodasLasMesas().then(setMesasDisponibles)
  }, [])

  const [qMesa, setQMesa] = useState('')
  const [abiertoMesa, setAbiertoMesa] = useState(false)
  const hayPadronMesas = (mesasDisponibles?.length ?? 0) > 0
  const filtradasMesa = (mesasDisponibles ?? []).filter(m =>
    normTexto(m.colegio_nombre ?? '') === normTexto(centro) &&
    (m.numero === mesa || !mesasOcupadas.has(m.numero)) &&
    (!qMesa.trim() || m.numero.includes(qMesa.trim())))

  const elegirMesa = (m: MesaOpt) => {
    setMesa(m.numero)
    setQMesa('')
    setAbiertoMesa(false)
  }

  const [nuevaClave, setNuevaClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [claveOk, setClaveOk] = useState(false)

  const centrosDelDistrito = useMemo(
    () => [...new Set(colegios.filter(c => c.distrito === distrito).map(c => c.nombre))],
    [colegios, distrito],
  )

  const [qCentro, setQCentro] = useState('')
  const [abiertoCentro, setAbiertoCentro] = useState(false)
  const centrosFiltrados = centrosDelDistrito.filter(c => !qCentro.trim() || normTexto(c).includes(normTexto(qCentro)))
  const elegirCentro = (c: string) => {
    setCentro(c); setMesa(''); setQCentro(''); setAbiertoCentro(false)
  }

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
    if (error) { alert('No se pudo guardar: ' + (/row-level security/i.test(error.message) ? 'No tienes permiso para este cambio. Mover a un personero a otro colegio (o cambiarle el rol) lo hace un Coordinador o el Administrador.' : error.message)); return }
    onSaved()
    onClose()
  }

  const cambiarClave = async () => {
    setCambiandoClave(true); setClaveOk(false)
    const { error } = await cambiarPasswordPersonero(perfil.id, nuevaClave)
    setCambiandoClave(false)
    if (error) { alert('No se pudo cambiar la contraseña: ' + error); return }
    setClaveOk(true)
    setNuevaClave('')
  }

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar definitivamente a ${perfil.nombre_completo}? Esta acción no se puede deshacer.`)) return
    setEliminando(true)
    const { error } = await eliminarPersoneroCompleto(perfil.id)
    setEliminando(false)
    if (error) { alert('No se pudo eliminar: ' + error); return }
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
              {/* Solo roles de personero: promover a Coordinador/Administrador
                  no es algo que deba hacerse desde este editor rápido. */}
              <select value={rolSel} onChange={e => setRolSel(e.target.value)} className={inputCls}>
                {[ROL_MESA, ROL_LOCAL].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            <Campo label="Estado de Credencial" icon={ShieldCheck}>
              <select value={credEstado ?? ''} onChange={e => setCredEstado(e.target.value)} className={inputCls}>
                {['Pendiente', 'Confirmado', 'Bloqueado', 'Reprobado'].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Distrito Asignado" icon={MapPin}>
            <select value={distrito} onChange={e => { setDistrito(e.target.value); setCentro(''); setMesa('') }} className={inputCls}>
              <option value="">— Sin asignar —</option>
              {distritosOpts.map(dist => <option key={dist} value={dist}>{dist}</option>)}
            </select>
          </Campo>
          <Campo label="Centro de Votación Asignado" icon={Building2}>
            <div className="relative">
              <input
                value={abiertoCentro ? qCentro : centro}
                onChange={e => { setQCentro(e.target.value); setAbiertoCentro(true) }}
                onFocus={() => { setQCentro(''); setAbiertoCentro(true) }}
                onBlur={() => setTimeout(() => setAbiertoCentro(false), 150)}
                placeholder="Buscar colegio... (vacío = No aplica)"
                className={inputCls} />
              {abiertoCentro && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => elegirCentro('')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-50 transition-colors">
                    — No aplica —
                  </button>
                  {centrosFiltrados.length > 0 ? centrosFiltrados.map(c => (
                    <button key={c} type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => elegirCentro(c)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 transition-colors">
                      {c}
                    </button>
                  )) : (
                    <p className="px-3 py-2.5 text-xs text-slate-400">Sin coincidencias.</p>
                  )}
                </div>
              )}
            </div>
          </Campo>
          <Campo label="Mesa Asignada" icon={Hash}>
            {hayPadronMesas && centro ? (
              <div className="relative">
                <input
                  value={abiertoMesa ? qMesa : mesa}
                  onChange={e => { setQMesa(e.target.value); setAbiertoMesa(true) }}
                  onFocus={() => { setQMesa(''); setAbiertoMesa(true) }}
                  onBlur={() => setTimeout(() => setAbiertoMesa(false), 150)}
                  placeholder="Buscar por N° de mesa..."
                  className={inputCls} />
                {abiertoMesa && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                    {filtradasMesa.length > 0 ? filtradasMesa.slice(0, 100).map(m => (
                      <button key={m.numero} type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => elegirMesa(m)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-sky-50 transition-colors">
                        <span className="font-mono font-semibold">{m.numero}</span>
                      </button>
                    )) : (
                      <p className="px-3 py-2.5 text-xs text-slate-400">Sin coincidencias, o ya están todas asignadas.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <input value={mesa} onChange={e => setMesa(e.target.value)} placeholder="Ej. 064321 (6 dígitos de la mesa)" className={inputCls} />
            )}
          </Campo>
          <p className="text-[11px] text-amber-700 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            💡 {centro
              ? 'Elige la mesa entre las del centro de votación seleccionado (ya no aparecen las que otro personero ya tiene asignadas).'
              : 'Primero elige el Centro de Votación Asignado para poder buscar su mesa.'}
          </p>
          {puedeEliminar && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound size={12} /> Cambiar Contraseña de Acceso
              </span>
              <div className="flex gap-2">
                <input type={mostrarClave ? 'text' : 'password'} value={nuevaClave}
                  onChange={e => { setNuevaClave(e.target.value); setClaveOk(false) }}
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  className="flex-1 text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" />
                <button type="button" onClick={() => setMostrarClave(v => !v)}
                  className="text-[11px] font-semibold text-slate-500 border border-slate-300 rounded-lg px-2.5">
                  {mostrarClave ? 'Ocultar' : 'Ver'}
                </button>
                <button type="button" onClick={cambiarClave} disabled={cambiandoClave || nuevaClave.trim().length < 6}
                  className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40 rounded-lg px-3 py-2 whitespace-nowrap">
                  {cambiandoClave ? 'Cambiando…' : 'Cambiar'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">No distingue mayúsculas de minúsculas al iniciar sesión.</p>
              {claveOk && <p className="text-[11px] text-emerald-600">Contraseña actualizada. Avísale al personero su nueva clave.</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-100">
          {puedeEliminar && (
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
