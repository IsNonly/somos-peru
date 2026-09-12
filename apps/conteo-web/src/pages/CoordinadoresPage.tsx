import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { restablecerClavePersonero } from '../lib/personeroActions'
import EditarPersoneroModal from '../components/EditarPersoneroModal'
import { Users, CheckCircle2, UserX, TrendingUp, School, AlertTriangle, Pencil, KeyRound } from 'lucide-react'

interface Perfil {
  id: string
  nombre_completo: string
  dni: string | null
  celular: string | null
  correo: string | null
  rol: string
  distrito_asignado: string | null
  local_asignado: string | null
  asistencia_local_at: string | null
  credencial_estado: string | null
}
interface Colegio { nombre: string; distrito: string; total_mesas: number }

const esCoordinador = (rol: string) =>
  /coordinador/i.test(rol) || rol === 'Personero de Centro de Votación' || rol === 'Personero de Local de Votación'

export default function CoordinadoresPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [colegios, setColegios] = useState<Colegio[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<Perfil | null>(null)

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      // '' es válido a propósito ("todas las provincias" del depto elegido); solo se cae
      // a 'Lima' cuando tampoco se eligió un departamento distinto.
      const dep = f.departamento || 'Lima'
      const prov = f.provincia || (dep === 'Lima' ? 'Lima' : '')
      let cq = supabase.from('colegios').select('nombre, distrito, total_mesas').eq('departamento', dep)
      if (prov) cq = cq.eq('provincia', prov)
      if (distritosEfectivos) cq = cq.in('distrito', distritosEfectivos)
      const { data: c } = await cq
      if (!vivo) return

      // Los perfiles se acotan a los distritos del ámbito (explícito, o derivado de los
      // colegios ya filtrados por depto/provincia) — evita mezclar personas de otro
      // departamento cuando no se restringe a un distrito puntual.
      const distritosAmbito = distritosEfectivos ?? [...new Set((c ?? []).map((x: any) => x.distrito).filter(Boolean))]
      let pq = supabase.from('profiles')
        .select('id, nombre_completo, dni, celular, correo, rol, distrito_asignado, local_asignado, asistencia_local_at, credencial_estado')
        .order('nombre_completo')
      if (distritosAmbito.length) pq = pq.in('distrito_asignado', distritosAmbito)
      const { data: p } = await pq
      if (!vivo) return
      setPerfiles((p ?? []) as Perfil[])
      setColegios((c ?? []) as Colegio[])
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [scopeLoading, distritosEfectivos, f.departamento, f.provincia])

  const { coords, kpi, resumen } = useMemo(() => {
    const persMesa = perfiles.filter(p => p.rol === 'Personero de Mesa')
    const asisPorLocal = new Map<string, number>()
    for (const p of persMesa) {
      if (p.asistencia_local_at && p.local_asignado)
        asisPorLocal.set(p.local_asignado, (asisPorLocal.get(p.local_asignado) ?? 0) + 1)
    }
    const mesasPorLocal = new Map<string, number>()
    let totalMesas = 0
    for (const c of colegios) { mesasPorLocal.set(c.nombre, c.total_mesas || 0); totalMesas += c.total_mesas || 0 }

    let filtC = perfiles.filter(p => esCoordinador(p.rol))
    if (f.colegio) filtC = filtC.filter(p => p.local_asignado === f.colegio)
    const coords = filtC.map(p => {
      const local = p.local_asignado ?? 'Sin local'
      const mesas = mesasPorLocal.get(local) ?? 0
      const asist = asisPorLocal.get(local) ?? 0
      return {
        id: p.id, nombre: p.nombre_completo, distrito: p.distrito_asignado ?? 'LIMA',
        colegio: local, mesas, asist, falt: Math.max(0, mesas - asist),
        perfil: p,
      }
    })

    const confirmadas = coords.reduce((a, c) => a + c.asist, 0)
    const kpi = {
      totalMesas,
      asistieron: confirmadas,
      faltantes: coords.filter(c => c.asist === 0).length,
      pctAsist: totalMesas > 0 ? ((confirmadas / totalMesas) * 100).toFixed(1) : '0.0',
    }
    const resumen = {
      total: totalMesas,
      conf: confirmadas,
      pctConf: totalMesas > 0 ? ((confirmadas / totalMesas) * 100).toFixed(1) : '0.0',
      porConf: Math.max(0, totalMesas - confirmadas),
      pctPor: totalMesas > 0 ? (((totalMesas - confirmadas) / totalMesas) * 100).toFixed(1) : '0.0',
    }
    return { coords, kpi, resumen }
  }, [perfiles, colegios, f.colegio])

  const coordsFiltrados = coords.filter(c =>
    !q || c.nombre.toLowerCase().includes(q.toLowerCase()) || c.colegio.toLowerCase().includes(q.toLowerCase()),
  )

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">👤 Monitoreo de Coordinadores</h1>
        <p className="text-sm text-slate-500">Resumen de asistencia y control de apertura de mesas · <span className="text-sky-600 font-semibold">{ambitoLabel || 'Lima Metropolitana'}</span></p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Users} border="#3b82f6" bg="#eff6ff" value={kpi.totalMesas.toLocaleString('es-PE')} label="Total de mesas por coordinador" />
        <Kpi icon={CheckCircle2} border="#10b981" bg="#ecfdf5" value={kpi.asistieron.toLocaleString('es-PE')} label="Personas que asistieron" />
        <Kpi icon={UserX} border="#f59e0b" bg="#fffbeb" value={kpi.faltantes.toLocaleString('es-PE')} label="Coordinadores faltantes" />
        <Kpi icon={TrendingUp} border="#8b5cf6" bg="#f5f3ff" value={`${kpi.pctAsist}%`} label="% Asistencia" />
      </div>

      <div className="bg-white rounded-2xl border border-rose-200 p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <p className="font-extrabold text-slate-900 flex items-center gap-2"><AlertTriangle size={17} className="text-rose-500" /> Control de Apertura de Mesas</p>
          <span className="text-[11px] font-bold text-rose-500 bg-rose-50 rounded-md px-2.5 py-1">ALERTA: Pasadas las 07:00 AM</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm mb-5">
          <span className="text-slate-600 font-bold">Resumen General de Mesas:</span>
          <span>Total Mesas: <strong>{resumen.total.toLocaleString('es-PE')}</strong></span>
          <span className="text-emerald-600">Confirmadas: <strong>{resumen.conf.toLocaleString('es-PE')} ({resumen.pctConf}%)</strong></span>
          <span className="text-rose-500">Por confirmar: <strong>{resumen.porConf.toLocaleString('es-PE')} ({resumen.pctPor}%)</strong></span>
        </div>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar coordinador o colegio…"
          className="w-full sm:w-80 mb-4 text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" />

        {loading ? (
          <p className="py-10 text-center text-slate-400 text-sm">Cargando…</p>
        ) : coordsFiltrados.length === 0 ? (
          <p className="py-10 text-center text-slate-400 text-sm">Sin coordinadores en este ámbito.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {coordsFiltrados.map(c => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-extrabold text-[13px] text-slate-900 uppercase leading-tight">{c.nombre}</p>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 flex-shrink-0">{c.distrito}</span>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1"><School size={12} /> {c.colegio}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="bg-emerald-50 text-emerald-600 text-center rounded py-1 text-[11px] font-bold">{c.asist} ASIST.</span>
                  <span className="bg-rose-50 text-rose-500 text-center rounded py-1 text-[11px] font-bold">{c.falt} FALT.</span>
                </div>
                {c.perfil.rol === 'Personero de Centro de Votación' && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 mt-1">
                    <button onClick={() => setEditando(c.perfil)} title="Editar datos"
                      className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-300 text-[11px] font-semibold">
                      <Pencil size={13} /> Editar
                    </button>
                    <button onClick={() => onRestablecer(c.perfil)} title="Restablecer contraseña a su DNI"
                      className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 text-[11px] font-semibold">
                      <KeyRound size={13} /> Clave
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <EditarPersoneroModal
          perfil={editando}
          onClose={() => setEditando(null)}
          onSaved={cambios => {
            setPerfiles(prev => prev.map(p => p.id === editando.id ? { ...p, ...cambios } : p))
            setEditando(null)
          }}
        />
      )}
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
