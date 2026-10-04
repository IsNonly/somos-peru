import { useEffect, useMemo, useState } from 'react'
import { X, Save, AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { VOTOS_ESPECIALES, slugPartido } from '../lib/candidatos'

export interface PersoneroVotos {
  id: string
  nombre_completo: string
  dni: string | null
  mesa_asignada: string | null
  local_asignado?: string | null
  local_votacion?: string | null
}

type Nivel = 'REGIONAL' | 'PROVINCIAL' | 'DISTRITAL'
const NIVELES: Nivel[] = ['REGIONAL', 'PROVINCIAL', 'DISTRITAL']
const NIVEL_LABEL: Record<Nivel, string> = {
  REGIONAL: 'Gobernador Regional',
  PROVINCIAL: 'Alcaldía Provincial',
  DISTRITAL: 'Alcaldía Distrital',
}

interface Renglon {
  partido: string
  candidato: string | null   // lo que se guarda en votos.candidato
  nombre: string             // lo que se muestra
  color: string
  votoId: string | null
  original: number
  valor: number
}
interface Bloque { nivel: Nivel; titulo: string; renglones: Renglon[] }
interface Acta {
  id: string; mesa_numero: string; colegio_nombre: string | null
  distrito: string | null; departamento: string | null; provincia: string | null
  estado: string | null; metodo: string | null; electores_habiles: number | null
}

const norm = (s?: string | null) =>
  (s ?? '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().trim()

// Iniciales de respaldo si la lista no trae sigla
function inicialesPartido(p: string): string {
  const stop = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'por', 'para'])
  const w = p.replace(/[()]/g, '').split(/\s+/).filter(x => !stop.has(x.toLowerCase()))
  return (w.slice(0, 3).map(x => x[0]).join('') || p.slice(0, 3)).toUpperCase()
}

export default function EditarVotosModal({ personero, onClose, onSaved, onAnulado }: {
  personero: PersoneroVotos
  onClose: () => void
  onSaved?: () => void
  // Se dispara tras anular el envío -a diferencia de onSaved, el padre debe
  // reflejar que este personero YA NO tiene acta transmitida (vuelve a "Sin envío").
  onAnulado?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [anulado, setAnulado] = useState(false)
  const [acta, setActa] = useState<Acta | null>(null)
  const [bloques, setBloques] = useState<Bloque[]>([])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setLoading(true); setError('')
      const mesa = (personero.mesa_asignada ?? '').trim()
      const cols = 'id, mesa_numero, colegio_nombre, distrito, departamento, provincia, estado, metodo, electores_habiles'

      // Se busca el acta que ESTE personero envió (por su id o DNI) -igual que
      // el monitor, que lo marca como "Enviado"-; si no aparece, por su mesa.
      // Antes solo se buscaba por mesa_asignada: si el acta quedó con otro
      // número de mesa (ej. escrito distinto), decía "aún no ha transmitido".
      let actaRow: any = null
      const filtroPersonero = [`personero_id.eq.${personero.id}`, personero.dni ? `personero_dni.eq.${personero.dni}` : null]
        .filter(Boolean).join(',')
      const { data: propias } = await supabase.from('actas').select(cols).or(filtroPersonero)
        .order('transmitida_at', { ascending: false, nullsFirst: false }).limit(5)
      actaRow = (propias ?? []).find((a: any) => a.mesa_numero === mesa) ?? (propias ?? [])[0] ?? null
      if (!actaRow && mesa) {
        const r = await supabase.from('actas').select(cols).eq('mesa_numero', mesa).maybeSingle()
        actaRow = r.data
      }
      if (!vivo) return
      if (!actaRow && !mesa) {
        setError('Este personero no tiene mesa asignada.')
        setLoading(false)
        return
      }
      if (!actaRow) {
        setError('Este personero aún no ha transmitido su acta — todavía no hay votos que corregir.')
        setLoading(false)
        return
      }
      setActa(actaRow as Acta)

      const [{ data: votosRows }, { data: candRows }] = await Promise.all([
        supabase.from('votos').select('id, nivel, partido, candidato, cantidad').eq('acta_id', actaRow.id),
        actaRow.departamento
          ? supabase.from('candidaturas')
              .select('nivel, partido, candidato, sigla, color, orden, provincia, distrito')
              .eq('activo', true).eq('departamento', actaRow.departamento)
              .order('orden', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
      ])
      if (!vivo) return

      const votos = (votosRows ?? []) as { id: string; nivel: Nivel; partido: string; candidato: string | null; cantidad: number }[]
      const votoPorClave = new Map(votos.map(v => [`${v.nivel}::${v.partido}`, v]))

      const cand = (candRows ?? []) as any[]
      const provOK = (r: any) => !actaRow.provincia || norm(r.provincia) === norm(actaRow.provincia)
      const distOK = (r: any) => !actaRow.distrito || norm(r.distrito) === norm(actaRow.distrito)
      const predPorNivel: Record<Nivel, (r: any) => boolean> = {
        REGIONAL: () => true,
        PROVINCIAL: provOK,
        DISTRITAL: r => provOK(r) && distOK(r),
      }

      const nuevosBloques: Bloque[] = []
      for (const nivel of NIVELES) {
        const filas = cand.filter(r => r.nivel === nivel && predPorNivel[nivel](r))
        const votosNivel = votos.filter(v => v.nivel === nivel)
        if (filas.length === 0 && votosNivel.length === 0) continue // este nivel no aplica a esta mesa

        const renglones: Renglon[] = []
        const vistos = new Set<string>()
        for (const f of filas) {
          vistos.add(f.partido)
          const v = votoPorClave.get(`${nivel}::${f.partido}`)
          renglones.push({
            partido: f.partido,
            candidato: f.candidato || null,
            nombre: f.partido,
            color: f.color || '#6B7280',
            votoId: v?.id ?? null,
            original: v?.cantidad ?? 0,
            valor: v?.cantidad ?? 0,
          })
        }
        // Defensivo: un voto ya guardado cuyo partido ya no está en `candidaturas`
        // (lista dada de baja, cambio de nombre, etc.) no debe desaparecer/perderse.
        for (const v of votosNivel) {
          if (vistos.has(v.partido) || VOTOS_ESPECIALES.some(e => e.partido === v.partido)) continue
          vistos.add(v.partido)
          renglones.push({
            partido: v.partido, candidato: v.candidato, nombre: v.partido,
            color: '#94a3b8', votoId: v.id, original: v.cantidad, valor: v.cantidad,
          })
        }
        for (const e of VOTOS_ESPECIALES) {
          const v = votoPorClave.get(`${nivel}::${e.partido}`)
          renglones.push({
            partido: e.partido, candidato: e.nombre, nombre: e.nombre, color: e.color,
            votoId: v?.id ?? null, original: v?.cantidad ?? 0, valor: v?.cantidad ?? 0,
          })
        }
        nuevosBloques.push({ nivel, titulo: NIVEL_LABEL[nivel], renglones })
      }
      setBloques(nuevosBloques)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [personero.mesa_asignada])

  const setValor = (nivel: Nivel, partido: string, valor: number) => {
    setOk(false)
    setBloques(prev => prev.map(b => b.nivel !== nivel ? b : {
      ...b,
      renglones: b.renglones.map(r => r.partido !== partido ? r : { ...r, valor: Math.max(0, valor) }),
    }))
  }

  const hayCambios = useMemo(() => bloques.some(b => b.renglones.some(r => r.valor !== r.original)), [bloques])

  const guardar = async () => {
    if (!acta) return
    setGuardando(true); setError(''); setOk(false)
    try {
      for (const b of bloques) {
        for (const r of b.renglones) {
          if (r.valor === r.original) continue
          if (r.votoId && r.valor > 0) {
            const { error: err } = await supabase.from('votos').update({ cantidad: r.valor }).eq('id', r.votoId)
            if (err) throw err
          } else if (r.votoId && r.valor === 0) {
            const { error: err } = await supabase.from('votos').delete().eq('id', r.votoId)
            if (err) throw err
          } else if (!r.votoId && r.valor > 0) {
            const { error: err } = await supabase.from('votos').insert({
              acta_id: acta.id, mesa_numero: acta.mesa_numero, distrito: acta.distrito,
              departamento: acta.departamento, provincia: acta.provincia,
              nivel: b.nivel, partido: r.partido, candidato: r.candidato, cantidad: r.valor,
            })
            if (err) throw err
          }
        }
      }
      // Refleja lo guardado como el nuevo "original" (por si se sigue editando sin cerrar).
      setBloques(prev => prev.map(b => ({ ...b, renglones: b.renglones.map(r => ({ ...r, original: r.valor })) })))
      setOk(true)
      onSaved?.()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo guardar la corrección.')
    }
    setGuardando(false)
  }

  // Borra el acta y sus votos por completo -no solo pone la cantidad en 0- y
  // reabilita al personero para transmitir de nuevo (foto o manual) desde cero.
  // Útil cuando la foto/OCR salió mal desde el inicio y conviene rehacer el
  // envío entero, no solo corregir números.
  const anularEnvio = async () => {
    if (!acta) return
    if (!window.confirm(
      `¿Anular el envío de la mesa ${acta.mesa_numero}? Se borrarán todos los votos guardados y el acta, y ${personero.nombre_completo} podrá volver a transmitir desde cero (foto o manual). Esta acción no se puede deshacer.`
    )) return
    setAnulando(true); setError(''); setOk(false)
    try {
      const { error: errVotos } = await supabase.from('votos').delete().eq('acta_id', acta.id)
      if (errVotos) throw errVotos
      const { error: errActa } = await supabase.from('actas').delete().eq('id', acta.id)
      if (errActa) throw errActa
      const { error: errPerfil } = await supabase.from('profiles').update({ acta_transmitida: false }).eq('id', personero.id)
      if (errPerfil) throw errPerfil
      setActa(null)
      setBloques([])
      setAnulado(true)
      onAnulado?.()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo anular el envío.')
    }
    setAnulando(false)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl mt-10 mb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900">Corregir votos digitados</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {personero.nombre_completo} · Mesa {personero.mesa_asignada ?? '—'}
              {acta?.colegio_nombre && <> · {acta.colegio_nombre}</>}
            </p>
            {acta && personero.mesa_asignada && acta.mesa_numero !== personero.mesa_asignada.trim() && (
              <p className="text-[11px] font-semibold text-amber-600 mt-1">
                Ojo: el acta se envió con la mesa {acta.mesa_numero}, distinta a su mesa asignada ({personero.mesa_asignada}).
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading && <p className="text-sm text-slate-400 text-center py-10">Cargando acta…</p>}

          {!loading && error && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /> {error}
            </p>
          )}

          {!loading && anulado && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
              <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
              Envío anulado. {personero.nombre_completo} ya puede volver a transmitir su acta desde cero.
            </p>
          )}

          {!loading && acta && bloques.length === 0 && !error && (
            <p className="text-sm text-slate-400 text-center py-10">No hay listas de candidatos cargadas para esta mesa.</p>
          )}

          {!loading && acta && bloques.map(b => {
            const total = b.renglones.reduce((s, r) => s + (r.valor || 0), 0)
            const excede = acta.electores_habiles != null && total > acta.electores_habiles
            return (
              <div key={b.nivel} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">{b.titulo}</span>
                  <span className={`text-xs font-bold ${excede ? 'text-rose-600' : 'text-slate-500'}`}>
                    Total: {total.toLocaleString('es-PE')}
                    {acta.electores_habiles != null && ` de ${acta.electores_habiles.toLocaleString('es-PE')} electores hábiles`}
                  </span>
                </div>
                {excede && (
                  <p className="text-[11px] text-rose-600 bg-rose-50 px-3.5 py-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> El total supera los electores hábiles de la mesa — revisa los números.
                  </p>
                )}
                <div className="divide-y divide-slate-100">
                  {b.renglones.map(r => {
                    const editado = r.valor !== r.original
                    return (
                      <div key={r.partido} className={`flex items-center gap-3 px-3.5 py-2 ${editado ? 'bg-sky-50/60' : ''}`}>
                        <img src={`/partidos/${slugPartido(r.partido)}.png`} alt="" loading="lazy"
                          className="w-6 h-6 rounded object-contain bg-white border border-slate-200 flex-shrink-0"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
                        <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{r.nombre}</span>
                        {editado && <span className="text-[10px] font-bold text-sky-600 flex-shrink-0">antes: {r.original}</span>}
                        <input type="number" min={0} value={r.valor}
                          onChange={e => setValor(b.nivel, r.partido, parseInt(e.target.value || '0', 10))}
                          className="w-20 text-right text-sm font-bold rounded-lg border border-slate-300 px-2 py-1.5 outline-none focus:border-sky-500 tabular-nums" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-slate-100">
          {!loading && acta ? (
            <button onClick={anularEnvio} disabled={anulando || guardando}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50 px-1">
              <Undo2 size={13} /> {anulando ? 'Anulando…' : 'Anular envío'}
            </button>
          ) : <span />}
          <div className="flex items-center gap-3">
            {ok && !hayCambios && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Corrección guardada.
              </span>
            )}
            <button onClick={onClose} className="text-xs font-semibold text-slate-600 border border-slate-300 rounded-md px-3 py-1.5">
              Cerrar
            </button>
            {!loading && acta && bloques.length > 0 && (
              <button onClick={guardar} disabled={guardando || anulando || !hayCambios}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-40 rounded-md px-3.5 py-1.5">
                <Save size={13} /> {guardando ? 'Guardando…' : 'Guardar corrección'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
