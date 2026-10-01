import { useEffect, useState, useMemo } from 'react'
import { supabase, traerTodo, AMBITO_DEPARTAMENTO } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { restablecerClavePersonero } from '../lib/personeroActions'
import EditarPersoneroModal from '../components/EditarPersoneroModal'
import { Users, CheckCircle2, UserX, TrendingUp, School, AlertTriangle, Pencil, KeyRound, Camera, FileText, Clock } from 'lucide-react'
import { USA_SECTORES, sectorDe, norm } from '../lib/sectoresVES'

interface Perfil {
  id: string
  nombre_completo: string
  dni: string | null
  celular: string | null
  correo: string | null
  rol: string
  distrito_asignado: string | null
  local_asignado: string | null
  local_votacion?: string | null
  mesa_asignada?: string | null
  asistencia_local_at: string | null
  credencial_estado: string | null
}
// Cómo envió su acta un personero: foto (IMAGEN), conteo manual, o todavía no.
type Envio = 'Foto' | 'Manual' | null
interface Colegio { nombre: string; distrito: string; total_mesas: number }

// Nombre viejo del rol; los perfiles ya importados pueden seguir teniéndolo.
const ROLES_PCV = ['Personero de Centro de Votación', 'Personero de Local de Votación']
const esCoordinador = (rol: string) =>
  /coordinador/i.test(rol) || ROLES_PCV.includes(rol)

export default function CoordinadoresPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [colegios, setColegios] = useState<Colegio[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editando, setEditando] = useState<Perfil | null>(null)
  const [envios, setEnvios] = useState<Map<string, Envio>>(new Map())
  const [fSector, setFSector] = useState('')

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      // '' es válido a propósito ("todas las provincias" del depto elegido); solo se cae
      // al ámbito de la instancia cuando tampoco se eligió un departamento distinto.
      const dep = f.departamento || AMBITO_DEPARTAMENTO
      const prov = f.provincia || ''
      const c = await traerTodo<any>((a, b) => {
        let cq = supabase.from('colegios').select('id, nombre, distrito, total_mesas').eq('departamento', dep)
        if (prov) cq = cq.eq('provincia', prov)
        if (distritosEfectivos) cq = cq.in('distrito', distritosEfectivos)
        return cq.order('id').range(a, b)
      }).catch(e => { console.error(e); return [] as any[] })
      if (!vivo) return

      // Los perfiles se acotan a los distritos del ámbito (explícito, o derivado de los
      // colegios ya filtrados por depto/provincia) — evita mezclar personas de otro
      // departamento cuando no se restringe a un distrito puntual.
      const distritosAmbito = distritosEfectivos ?? [...new Set((c ?? []).map((x: any) => x.distrito).filter(Boolean))]
      // Paginado: VES ya supera las 1000 filas.
      const p = await traerTodo<any>((a, b) => {
        let pq = supabase.from('profiles')
          .select('id, nombre_completo, dni, celular, correo, rol, distrito_asignado, local_asignado, local_votacion, mesa_asignada, asistencia_local_at, credencial_estado')
          .order('nombre_completo').order('id')
        if (distritosAmbito.length) pq = pq.in('distrito_asignado', distritosAmbito)
        return pq.range(a, b)
      }).catch(e => { console.error(e); return [] as any[] })
      // Actas transmitidas -> quién envió y cómo (mismo criterio que la página Personeros).
      const actas = USA_SECTORES
        ? await traerTodo<any>((a, b) => supabase.from('actas').select('id, personero_id, personero_dni, metodo, estado').order('id').range(a, b))
            .catch(e => { console.error(e); return [] as any[] })
        : []
      if (!vivo) return
      const env = new Map<string, Envio>()
      for (const a of actas) {
        if (a.estado && a.estado !== 'TRANSMITIDA') continue
        const m: Envio = String(a.metodo).toUpperCase() === 'IMAGEN' ? 'Foto' : 'Manual'
        for (const k of [a.personero_id, a.personero_dni].filter(Boolean)) env.set(k, m)
      }
      setEnvios(env)
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
        id: p.id, nombre: p.nombre_completo, distrito: p.distrito_asignado ?? AMBITO_DEPARTAMENTO.toUpperCase(),
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

  // ── VES: coordinadores agrupados por Sector, cada uno con SUS personeros ──
  // Un coordinador con varios colegios ("A | B") aparece una vez por colegio,
  // dentro del sector de ese colegio, con los personeros de mesa de ese colegio.
  const sectores = useMemo(() => {
    if (!USA_SECTORES) return []
    const envioDe = (p: Perfil): Envio => envios.get(p.id) ?? (p.dni ? envios.get(p.dni) ?? null : null)
    const persPorLocal = new Map<string, Perfil[]>()
    for (const p of perfiles) {
      if (p.rol !== 'Personero de Mesa') continue
      const k = norm(p.local_asignado || p.local_votacion)
      if (!k) continue
      persPorLocal.set(k, [...(persPorLocal.get(k) ?? []), p])
    }
    const s = q.trim().toLowerCase()
    const grupos = new Map<number, FilaCoord[]>()
    for (const c of perfiles.filter(p => esCoordinador(p.rol))) {
      const locales = String(c.local_asignado ?? '').split(/[,|]/).map(x => x.trim()).filter(Boolean)
      for (const colegio of (locales.length ? locales : ['Sin colegio asignado'])) {
        if (f.colegio && colegio !== f.colegio) continue
        if (s && !c.nombre_completo.toLowerCase().includes(s) && !colegio.toLowerCase().includes(s)) continue
        const sector = sectorDe(c.distrito_asignado, colegio) ?? 0
        if (fSector && String(sector) !== fSector) continue
        const personeros = (persPorLocal.get(norm(colegio)) ?? []).map(p => ({ p, envio: envioDe(p) }))
          // primero los que faltan enviar, luego por mesa
          .sort((a, b) => (a.envio ? 1 : 0) - (b.envio ? 1 : 0) || String(a.p.mesa_asignada ?? '').localeCompare(String(b.p.mesa_asignada ?? '')))
        const fila: FilaCoord = {
          key: c.id + '|' + colegio, coord: c, colegio, sector, personeros,
          enviaron: personeros.filter(x => x.envio).length,
          fotos: personeros.filter(x => x.envio === 'Foto').length,
          asistieron: personeros.filter(x => x.p.asistencia_local_at).length,
        }
        grupos.set(sector, [...(grupos.get(sector) ?? []), fila])
      }
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => (a || 99) - (b || 99))   // "sin sector" al final
      .map(([sector, filas]) => ({ sector, filas: filas.sort((a, b) => a.colegio.localeCompare(b.colegio, 'es')) }))
  }, [perfiles, envios, q, f.colegio, fSector])

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
        <p className="text-sm text-slate-500">Resumen de asistencia y control de apertura de mesas · <span className="text-sky-600 font-semibold">{ambitoLabel || AMBITO_DEPARTAMENTO}</span></p>
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

        <div className="flex flex-wrap gap-2 mb-4">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar coordinador o colegio…"
            className="w-full sm:w-80 text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" />
          {USA_SECTORES && (
            <select value={fSector} onChange={e => setFSector(e.target.value)}
              className="text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500">
              <option value="">🧭 Todos los sectores</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={String(n)}>Sector {n}</option>)}
              <option value="0">Sin sector</option>
            </select>
          )}
        </div>

        {loading ? (
          <p className="py-10 text-center text-slate-400 text-sm">Cargando…</p>
        ) : USA_SECTORES ? (
          sectores.length === 0
            ? <p className="py-10 text-center text-slate-400 text-sm">Sin coordinadores con esos filtros.</p>
            : <div className="space-y-3">
                {sectores.map(g => (
                  <BloqueSector key={g.sector} sector={g.sector} filas={g.filas} abierto={!!fSector || !!q.trim() || !!f.colegio}
                    onEditar={setEditando} onClave={onRestablecer} />
                ))}
              </div>
        ) : loading ? (
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
                {(ROLES_PCV.includes(c.perfil.rol) || esCoordinador(c.perfil.rol)) && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 mt-1">
                    {ROLES_PCV.includes(c.perfil.rol) && (
                      <button onClick={() => setEditando(c.perfil)} title="Editar datos"
                        className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-300 text-[11px] font-semibold">
                        <Pencil size={13} /> Editar
                      </button>
                    )}
                    {/* El chequeo real de quién puede resetear a quién vive en el RPC
                        (supabase/reset_clave_coordinadores.sql), no acá: el botón se
                        muestra siempre que el rol lo permita en general, y el servidor
                        rechaza si el que llama no tiene permiso sobre ESTE objetivo. */}
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

interface FilaCoord {
  key: string
  coord: Perfil
  colegio: string
  sector: number
  personeros: { p: Perfil; envio: Envio }[]
  enviaron: number
  fotos: number
  asistieron: number
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const colorPct = (n: number) => (n >= 100 ? '#16a34a' : n >= 40 ? '#d97706' : '#dc2626')

// Un sector de VES: resumen (coordinadores, personeros, actas enviadas) y,
// desplegable, la tarjeta de cada coordinador con sus personeros.
function BloqueSector({ sector, filas, abierto, onEditar, onClave }: {
  sector: number; filas: FilaCoord[]; abierto: boolean
  onEditar: (p: Perfil) => void; onClave: (p: Perfil) => void
}) {
  const pers = filas.reduce((s, f) => s + f.personeros.length, 0)
  const env = filas.reduce((s, f) => s + f.enviaron, 0)
  const coordsUnicos = new Set(filas.map(f => f.coord.id)).size
  const pc = pct(env, pers)
  return (
    <details open={abierto} className="group border border-slate-200 rounded-2xl overflow-hidden">
      <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <p className="text-sm font-extrabold text-indigo-800 flex items-center gap-2">
          <span className="text-indigo-400 group-open:rotate-90 transition-transform">▶</span>
          {sector ? `Sector ${sector}` : 'Sin sector'}
          <span className="text-xs font-semibold text-indigo-500">({coordsUnicos} coordinador{coordsUnicos === 1 ? '' : 'es'})</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span><strong className="text-slate-900">{pers}</strong> personeros</span>
          <span><strong className="text-slate-900">{env}/{pers}</strong> actas enviadas</span>
          <span className="font-bold" style={{ color: colorPct(pc) }}>{pc}%</span>
        </div>
      </summary>
      <div className="p-3 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 bg-white">
        {filas.map(f => <TarjetaCoord key={f.key} f={f} onEditar={onEditar} onClave={onClave} />)}
      </div>
    </details>
  )
}

function TarjetaCoord({ f, onEditar, onClave }: { f: FilaCoord; onEditar: (p: Perfil) => void; onClave: (p: Perfil) => void }) {
  const total = f.personeros.length
  const pc = pct(f.enviaron, total)
  const esPCV = ROLES_PCV.includes(f.coord.rol)
  return (
    <div className="border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2" style={{ borderLeft: `4px solid ${colorPct(pc)}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-extrabold text-[13px] text-slate-900 uppercase leading-tight">{f.coord.nombre_completo}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{esPCV ? 'Personero de Centro de Votación' : f.coord.rol}</p>
        </div>
        {f.sector > 0 && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5 flex-shrink-0">Sector {f.sector}</span>}
      </div>
      <p className="text-[11px] text-slate-600 font-semibold flex items-center gap-1"><School size={12} className="text-slate-400" /> {f.colegio}</p>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
        <span className="bg-emerald-50 text-emerald-700 rounded py-1">{f.enviaron}/{total} enviaron</span>
        <span className="bg-sky-50 text-sky-700 rounded py-1">📷 {f.fotos} · 📝 {f.enviaron - f.fotos}</span>
        <span className="bg-slate-50 text-slate-600 rounded py-1">{f.asistieron} asist.</span>
      </div>

      <details className="group/p">
        <summary className="cursor-pointer list-none text-[11px] font-bold text-sky-700 hover:underline">
          <span className="inline-block group-open/p:rotate-90 transition-transform">▸</span> Ver personeros ({total})
        </summary>
        {total === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Ningún personero de mesa inscrito en este colegio.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-72 overflow-y-auto">
            {f.personeros.map(({ p, envio }) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{p.nombre_completo}</p>
                  <p className="text-slate-400">Mesa {p.mesa_asignada || '—'}{p.celular ? ` · ${p.celular}` : ''}</p>
                </div>
                {envio === 'Foto' ? (
                  <span className="flex-shrink-0 flex items-center gap-1 font-bold text-sky-700 bg-sky-50 rounded px-1.5 py-0.5"><Camera size={11} /> Foto</span>
                ) : envio === 'Manual' ? (
                  <span className="flex-shrink-0 flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5"><FileText size={11} /> Manual</span>
                ) : (
                  <span className="flex-shrink-0 flex items-center gap-1 font-bold text-rose-600 bg-rose-50 rounded px-1.5 py-0.5"><Clock size={11} /> Sin envío</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </details>

      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
        {esPCV && (
          <button onClick={() => onEditar(f.coord)} title="Editar datos"
            className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-300 text-[11px] font-semibold">
            <Pencil size={13} /> Editar
          </button>
        )}
        <button onClick={() => onClave(f.coord)} title="Restablecer contraseña a su DNI"
          className="flex-1 flex items-center justify-center gap-1 p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 text-[11px] font-semibold">
          <KeyRound size={13} /> Clave
        </button>
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
