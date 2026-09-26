import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { Search, Camera, ImageOff, X, Building2 } from 'lucide-react'

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
      let pq = supabase.from('profiles')
        .select('id, nombre_completo, dni, rol, distrito_asignado, distrito_vota, local_asignado, local_votacion, mesa_asignada')
        .eq('rol', 'Personero de Mesa')
        .order('nombre_completo')
      if (distritosEfectivos) pq = pq.in('distrito_asignado', distritosEfectivos)

      const [{ data: p }, { data: actasData }] = await Promise.all([
        pq,
        supabase.from('actas').select('mesa_numero, metodo, foto_instalacion_url, imagen_url, imagenes_url'),
      ])
      if (!vivo) return

      const map = new Map<string, ActaFotos>()
      for (const a of (actasData ?? []) as any[]) map.set(a.mesa_numero, a)

      setPers((p ?? []) as Perfil[])
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
      p.nombre_completo?.toLowerCase().includes(s) || (p.dni ?? '').includes(s) || (p.mesa_asignada ?? '').includes(s))
    return r
  }, [pers, esPCV, miLocal, f.colegio, q])

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
        <div className="flex items-center justify-between text-xs">
          <span className="bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1 flex items-center gap-1.5">
            <Camera size={12} /> {conFotos.length} con foto · {sinFotos.length} sin foto
          </span>
          {esPCV && miLocal && (
            <span className="text-slate-400 flex items-center gap-1.5">
              <Building2 size={12} /> Solo tus personeros — {miLocal}
            </span>
          )}
        </div>
      </section>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-400 py-16 text-center">Sin personeros con esos filtros.</p>
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
  return !!(a.foto_instalacion_url || a.imagen_url || (a.imagenes_url && Object.keys(a.imagenes_url).length))
}

function TarjetaFotos({ p, acta, onVer }: {
  p: Perfil; acta?: ActaFotos; onVer: (v: { url: string; titulo: string }) => void
}) {
  const fotos: { label: string; url: string }[] = []
  if (acta?.foto_instalacion_url) fotos.push({ label: 'Instalación de mesa', url: acta.foto_instalacion_url })
  if (acta?.imagenes_url) {
    for (const [nivel, url] of Object.entries(acta.imagenes_url)) if (url) fotos.push({ label: `Acta ${nivel}`, url })
  } else if (acta?.imagen_url) {
    fotos.push({ label: 'Acta', url: acta.imagen_url })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
      <div>
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
              <img src={fo.url} alt={fo.label} className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">{fo.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 py-3">
          <ImageOff size={13} /> Aún no envió ninguna foto.
        </p>
      )}
    </div>
  )
}
