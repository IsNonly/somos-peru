import { useEffect, useMemo, useState } from 'react'
import { supabase, traerTodo } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { Search, Camera, ImageOff, X, Building2, ChevronDown, ChevronRight, MapPinned } from 'lucide-react'
import { USA_SECTORES, sectorDe, norm } from '../lib/sectoresVES'
import { AMBITO_DISTRITOS } from '../lib/supabase'

// SAN ISIDRO: el PCV envía el acta tocando el N° de mesa, así que Fotos se
// organiza por MESA (cada mesa oficial con su foto), no por personero.
const POR_MESA = AMBITO_DISTRITOS.some(d => norm(d) === 'SAN ISIDRO')

interface Perfil {
  id: string
  nombre_completo: string
  dni: string | null
  rol: string
  distrito_asignado: string | null
  distrito_vota: string | null
  local_asignado: string | null
  local_votacion: string | null
  mesa_asignada: string | null
  // Mesa sin personero cuyo conteo lo envió el PCV (nombre del PCV).
  enviadaPorPCV?: string
  // San Isidro (POR_MESA): tarjeta de una mesa oficial.
  porMesa?: { asignado: string | null; enviadoPor: string | null }
}
interface ActaFotos {
  mesa_numero: string
  metodo: string | null
  foto_instalacion_url: string | null
  imagen_url: string | null
  imagenes_url: Record<string, string> | null
}

// PCV: solo ve las fotos de los personeros de mesa de su propio colegio -no
// las de todo el distrito, que es lo que ve un coordinador-.
const ROLES_PCV = new Set(['Personero de Centro de Votación', 'Personero de Local de Votación', 'Coordinador de Local'])

export default function FotosPage() {
  const { distritosEfectivos, f, loading: scopeLoading } = useFiltros()
  const [miRol, setMiRol] = useState('')
  const [miLocal, setMiLocal] = useState('')
  const [perfilListo, setPerfilListo] = useState(false)
  const [pers, setPers] = useState<Perfil[]>([])
  const [actas, setActas] = useState<Map<string, ActaFotos>>(new Map())
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [verFoto, setVerFoto] = useState<{ url: string; titulo: string } | null>(null)
  // VES: filtro y sectores desplegados (cerrados por defecto: así no se cargan
  // las fotos de todo el distrito de golpe).
  const [fSector, setFSector] = useState('')
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())
  const [colsAbiertos, setColsAbiertos] = useState<Set<string>>(new Set())

  const esPCV = ROLES_PCV.has(miRol)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPerfilListo(true); return }
      const dni = (user.email ?? '').split('@')[0]
      let { data } = await supabase.from('profiles').select('rol, local_asignado, local_votacion').eq('dni', dni).maybeSingle()
      if (!data) {
        const r = await supabase.from('profiles').select('rol, local_asignado, local_votacion').eq('id', user.id).maybeSingle()
        data = r.data
      }
      setMiRol(data?.rol ?? '')
      setMiLocal((data?.local_asignado || data?.local_votacion || '').trim())
      setPerfilListo(true)
    })()
  }, [])

  useEffect(() => {
    if (scopeLoading || !perfilListo) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      // Paginado: Supabase corta en 1000 filas y VES ya las supera.
      const [p, actasData] = await Promise.all([
        traerTodo<any>((a, b) => {
          let pq = supabase.from('profiles')
            .select('id, nombre_completo, dni, rol, distrito_asignado, distrito_vota, local_asignado, local_votacion, mesa_asignada')
            .eq('rol', 'Personero de Mesa')
            .order('nombre_completo').order('id')
          if (distritosEfectivos) pq = pq.in('distrito_asignado', distritosEfectivos)
          return pq.range(a, b)
        }).catch(e => { console.error(e); return [] as any[] }),
        traerTodo<any>((a, b) => supabase.from('actas').select('id, mesa_numero, metodo, imagen_url, imagenes_url, colegio_nombre, distrito, personero_dni').order('id').range(a, b))
          .catch(e => { console.error(e); return [] as any[] }),
      ])
      if (!vivo) return

      const map = new Map<string, ActaFotos>()
      for (const a of (actasData ?? []) as any[]) map.set(a.mesa_numero, a)

      // Mesas que ningún personero de mesa tiene asignadas pero cuya acta sí se
      // envió: las registró el PCV (ver "Mesas sin personero" en la app de
      // conteo). Se agregan como una tarjeta más, a nombre del PCV.
      const cubiertas = new Set(((p ?? []) as Perfil[]).map(x => x.mesa_asignada).filter(Boolean))
      const huerfanas = ((actasData ?? []) as any[]).filter(a =>
        a.mesa_numero && !cubiertas.has(a.mesa_numero) &&
        (!distritosEfectivos || distritosEfectivos.includes(a.distrito)))
      const dnis = [...new Set(huerfanas.map(a => a.personero_dni).filter(Boolean))] as string[]
      const nombrePorDni = new Map<string, string>()
      if (dnis.length) {
        const { data: quienes } = await supabase.from('profiles').select('dni, nombre_completo').in('dni', dnis)
        for (const x of quienes ?? []) nombrePorDni.set(x.dni, x.nombre_completo)
      }
      if (!vivo) return
      const extra: Perfil[] = huerfanas.map(a => {
        const quien = nombrePorDni.get(a.personero_dni) ?? (a.personero_dni ? `DNI ${a.personero_dni}` : 'PCV')
        return {
          id: 'acta-' + a.mesa_numero, nombre_completo: quien, dni: a.personero_dni ?? null,
          rol: 'Personero de Centro de Votación', distrito_asignado: a.distrito ?? null, distrito_vota: null,
          local_asignado: a.colegio_nombre ?? null, local_votacion: null, mesa_asignada: a.mesa_numero,
          enviadaPorPCV: quien,
        }
      })

      if (POR_MESA) {
        // Una tarjeta por cada mesa oficial del padrón, con quién la tiene
        // asignada y quién envió su acta.
        const mesasPadron = await traerTodo<any>((a, b) =>
          supabase.from('mesas').select('numero, colegio_nombre').order('numero').range(a, b)).catch(() => [] as any[])
        const enviadores = [...new Set(((actasData ?? []) as any[]).map(a => a.personero_dni).filter(Boolean))] as string[]
        const nombres = new Map<string, string>()
        for (const x of (p ?? []) as Perfil[]) if (x.dni) nombres.set(x.dni, x.nombre_completo)
        const faltan = enviadores.filter(d => !nombres.has(d))
        if (faltan.length) {
          const { data: quienes } = await supabase.from('profiles').select('dni, nombre_completo').in('dni', faltan)
          for (const x of quienes ?? []) nombres.set(x.dni, x.nombre_completo)
        }
        if (!vivo) return
        const asignadoPorMesa = new Map<string, string>()
        for (const x of (p ?? []) as Perfil[]) if (x.mesa_asignada) asignadoPorMesa.set(x.mesa_asignada, x.nombre_completo)
        const filas: Perfil[] = mesasPadron.map((m: any) => {
          const acta = map.get(m.numero) as any
          const enviadoPor = acta ? (nombres.get(acta.personero_dni) ?? (acta.personero_dni ? `DNI ${acta.personero_dni}` : null)) : null
          const asignado = asignadoPorMesa.get(m.numero) ?? null
          return {
            id: 'mesa-' + m.numero, nombre_completo: enviadoPor ?? asignado ?? '', dni: null,
            rol: 'Mesa', distrito_asignado: null, distrito_vota: null,
            local_asignado: m.colegio_nombre ?? null, local_votacion: null, mesa_asignada: m.numero,
            porMesa: { asignado, enviadoPor },
          }
        })
        setPers(filas)
      } else {
        setPers([...((p ?? []) as Perfil[]), ...extra])
      }
      setActas(map)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [scopeLoading, perfilListo, distritosEfectivos])

  const filtrados = useMemo(() => {
    let r = pers
    if (esPCV) r = r.filter(p => (p.local_asignado ?? p.local_votacion) === miLocal)
    else if (f.colegio) r = r.filter(p => (p.local_asignado ?? p.local_votacion) === f.colegio)
    const s = q.trim().toLowerCase()
    if (s) r = r.filter(p =>
      p.nombre_completo?.toLowerCase().includes(s) || (p.dni ?? '').includes(s) || (p.mesa_asignada ?? '').includes(s)
      || (p.porMesa?.asignado ?? '').toLowerCase().includes(s))
    return r
  }, [pers, esPCV, miLocal, f.colegio, q])

  // VES: Sector → Colegio → personeros (ordenados por mesa).
  const sectores = useMemo(() => {
    if (esPCV) return []
    const grupos = new Map<number, Map<string, Perfil[]>>()
    for (const p of filtrados) {
      const colegio = (p.local_asignado ?? p.local_votacion ?? '').trim() || 'Sin colegio asignado'
      // VES: por sector; San Isidro y Cercado: un solo grupo (-1), solo por colegio.
      const sector = USA_SECTORES ? (sectorDe(p.distrito_asignado ?? p.distrito_vota, colegio) ?? 0) : -1
      if (fSector && String(sector) !== fSector) continue
      if (!grupos.has(sector)) grupos.set(sector, new Map())
      const cols = grupos.get(sector)!
      cols.set(colegio, [...(cols.get(colegio) ?? []), p])
    }
    return [...grupos.entries()]
      .sort(([a], [b]) => (a || 99) - (b || 99))
      .map(([sector, cols]) => {
        const colegios = [...cols.entries()]
          .sort(([a], [b]) => a.localeCompare(b, 'es'))
          .map(([colegio, ps]) => ({
            colegio,
            personeros: ps.sort((a, b) => (a.mesa_asignada ?? '999999').localeCompare(b.mesa_asignada ?? '999999')),
            conFoto: ps.filter(p => tieneFotos(actas.get(p.mesa_asignada ?? ''))).length,
          }))
        const total = colegios.reduce((n, c) => n + c.personeros.length, 0)
        const conFoto = colegios.reduce((n, c) => n + c.conFoto, 0)
        return { sector, colegios, total, conFoto }
      })
  }, [filtrados, esPCV, fSector, actas])
  const sectorAbierto = (n: number) => abiertos.has(n) || !!fSector || !!q.trim() || !!f.colegio
  const colAbierto = (k: string) => colsAbiertos.has(k) || !!q.trim() || !!f.colegio
  const toggleCol = (k: string) => setColsAbiertos(prev => {
    const x = new Set(prev); if (x.has(k)) x.delete(k); else x.add(k); return x
  })
  const toggleSector = (n: number) => setAbiertos(prev => {
    const x = new Set(prev); if (x.has(n)) x.delete(n); else x.add(n); return x
  })


  // Colegios desplegables (cerrados por defecto) con sus personeros y fotos.
  const listaColegios = (g: { sector: number; colegios: { colegio: string; personeros: Perfil[]; conFoto: number }[] }) =>
    g.colegios.map(c => {
                      const k = g.sector + '|' + c.colegio
                      const ab = colAbierto(k)
                      return (
                      <div key={c.colegio} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button onClick={() => toggleCol(k)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 min-w-0">
                            {ab ? <ChevronDown size={14} className="flex-shrink-0" /> : <ChevronRight size={14} className="flex-shrink-0" />}
                            <Building2 size={14} className="text-slate-400 flex-shrink-0" />
                            <span className="truncate">{c.colegio}</span>
                          </span>
                          <span className={`text-[11px] font-bold whitespace-nowrap rounded-full px-2 py-0.5 ${
                            c.conFoto === c.personeros.length ? 'bg-emerald-50 text-emerald-700'
                            : c.conFoto ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}`}>
                            {c.conFoto} / {c.personeros.length} con foto
                          </span>
                        </button>
                        {ab && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                            {c.personeros.map(p => (
                              <TarjetaFotos key={p.id} p={p} acta={actas.get(p.mesa_asignada ?? '')} onVer={setVerFoto} />
                            ))}
                          </div>
                        )}
                      </div>
                      )
                    })

  const conFotos = filtrados.filter(p => tieneFotos(actas.get(p.mesa_asignada ?? '')))
  const sinFotos = filtrados.filter(p => !tieneFotos(actas.get(p.mesa_asignada ?? '')))

  if (loading) return <div className="py-20 text-center text-slate-400 text-sm">Cargando fotos…</div>

  return (
    <div className="space-y-4 w-full">
      <section className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar personero por nombre, DNI o mesa…"
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500" />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <span className="bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1 flex items-center gap-1.5">
            <Camera size={12} /> {conFotos.length} con foto · {sinFotos.length} sin foto
          </span>
          {USA_SECTORES && !esPCV && (
            <select value={fSector} onChange={e => setFSector(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-sky-500">
              <option value="">Todos los sectores</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>Sector {n}</option>)}
              <option value="0">Sin sector</option>
            </select>
          )}
          {esPCV && miLocal && (
            <span className="text-slate-400 flex items-center gap-1.5">
              <Building2 size={12} /> Solo tus personeros — {miLocal}
            </span>
          )}
        </div>
      </section>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-400 py-16 text-center">Sin personeros con esos filtros.</p>
      ) : USA_SECTORES && !esPCV ? (
        <div className="space-y-3">
          {sectores.map(g => {
            const abierto = sectorAbierto(g.sector)
            return (
              <section key={g.sector} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => toggleSector(g.sector)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <span className="flex items-center gap-2 font-extrabold text-slate-800">
                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <MapPinned size={16} className="text-sky-600" />
                    {g.sector ? `Sector ${g.sector}` : 'Sin sector'}
                    <span className="text-xs font-semibold text-slate-400">· {g.colegios.length} colegios · {g.total} personeros</span>
                  </span>
                  <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${g.conFoto ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Camera size={11} className="inline -mt-0.5 mr-1" />{g.conFoto} / {g.total} con foto
                  </span>
                </button>
                {abierto && (
                  <div className="border-t border-slate-100 p-3 space-y-2">
                    {listaColegios(g)}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : !esPCV ? (
        <div className="space-y-2">
          {sectores.map(g => <div key={g.sector} className="space-y-2">{listaColegios(g)}</div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[...conFotos, ...sinFotos].map(p => (
            <TarjetaFotos key={p.id} p={p} acta={actas.get(p.mesa_asignada ?? '')} onVer={setVerFoto} />
          ))}
        </div>
      )}

      {verFoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setVerFoto(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white text-sm font-bold">{verFoto.titulo}</p>
              <button onClick={() => setVerFoto(null)} className="text-white/70 hover:text-white"><X size={22} /></button>
            </div>
            <img src={verFoto.url} alt={verFoto.titulo} className="w-full max-h-[80vh] object-contain rounded-xl bg-black" />
          </div>
        </div>
      )}
    </div>
  )
}

function tieneFotos(a?: ActaFotos): boolean {
  if (!a) return false
  // Solo cuenta la foto del acta (la de instalación de mesa ya no se muestra).
  return !!(a.imagen_url || (a.imagenes_url && Object.values(a.imagenes_url).some(Boolean)))
}

function TarjetaFotos({ p, acta, onVer }: {
  p: Perfil; acta?: ActaFotos; onVer: (v: { url: string; titulo: string }) => void
}) {
  const fotos: { label: string; url: string }[] = []
  // El acta es UNA sola foto (Provincial + Distrital juntos): imagenes_url
  // repite la misma URL por nivel, así que se muestra una sola vez.
  const urlActa = acta?.imagen_url || Object.values(acta?.imagenes_url ?? {}).find(Boolean)
  if (urlActa) fotos.push({ label: 'Acta', url: urlActa })
  for (const [nivel, url] of Object.entries(acta?.imagenes_url ?? {})) {
    if (url && !fotos.some(fo => fo.url === url)) fotos.push({ label: `Acta ${nivel}`, url })
  }

  if (p.porMesa) {
    const fo = fotos.find(x => x.label !== 'Instalación de mesa')
    return (
      <div className={`bg-white rounded-2xl border p-3.5 space-y-2.5 ${fo ? 'border-emerald-300' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono font-black text-lg text-slate-900 leading-none">Mesa {p.mesa_asignada}</p>
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${fo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {fo ? 'Acta enviada' : 'Sin acta'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate">
          {p.porMesa.enviadoPor
            ? <>Enviada por: <b className="text-slate-700">{p.porMesa.enviadoPor}</b></>
            : p.porMesa.asignado ? <>Personero: {p.porMesa.asignado}</> : 'Sin personero asignado'}
        </p>
        {fo ? (
          <button onClick={() => onVer({ url: fo.url, titulo: `Mesa ${p.mesa_asignada} — Acta` })}
            className="block w-full h-44 rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity bg-slate-50">
            <img src={fo.url} alt={`Acta mesa ${p.mesa_asignada}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-slate-400 py-3">
            <ImageOff size={13} /> Aún no se envió la foto del acta.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
      <div>
        {p.enviadaPorPCV && (
          <span className="inline-block mb-1 text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            Mesa sin personero · enviada por PCV
          </span>
        )}
        <p className="font-bold text-slate-800 text-sm truncate">{p.nombre_completo}</p>
        <p className="text-xs text-slate-400">
          DNI: {p.dni ?? '—'} · Mesa: <span className="font-mono">{p.mesa_asignada ?? '—'}</span>
        </p>
      </div>
      {fotos.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {fotos.map(fo => (
            <button key={fo.label} onClick={() => onVer({ url: fo.url, titulo: `${p.nombre_completo} — ${fo.label}` })}
              className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity relative group">
              <img src={fo.url} alt={fo.label} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{fo.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 py-3">
          <ImageOff size={13} /> Aún no envió la foto del acta.
        </p>
      )}
    </div>
  )
}
