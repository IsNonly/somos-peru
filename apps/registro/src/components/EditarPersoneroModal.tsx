import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { eliminarPersoneroCompleto } from '../lib/personeros'

interface MesaOpt { numero: string; colegio_nombre: string | null }
const normTexto = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export interface PersoneroEditable {
  id: string
  nombre: string
  celular: string | null
  correo: string | null
  mesa_asignada: string | null
  local_asignado: string | null
}

export interface CambiosPersonero {
  nombre_completo: string
  celular: string | null
  correo: string | null
  local_asignado: string | null
  mesa_asignada?: string | null
}

export default function EditarPersoneroModal({ perfil, esMesa, puedeEliminar, soloMesa, mesasOcupadas, onClose, onSaved, onEliminado }: {
  perfil: PersoneroEditable
  esMesa: boolean
  puedeEliminar: boolean
  // El PCV solo puede asignar la mesa de sus propios personeros desde este modal —
  // no puede tocar nombre/celular/correo/local ni eliminar a nadie.
  soloMesa?: boolean
  // Mesas ya asignadas a OTROS personeros de este mismo colegio: se ocultan del
  // buscador para no poder asignar por error una mesa que ya tiene dueño.
  mesasOcupadas?: Set<string>
  onClose: () => void
  onSaved: (id: string, cambios: CambiosPersonero) => void
  onEliminado: (id: string) => void
}) {
  const [nombre, setNombre] = useState(perfil.nombre ?? '')
  const [celular, setCelular] = useState(perfil.celular ?? '')
  const [correo, setCorreo] = useState(perfil.correo ?? '')
  const [local, setLocal] = useState(perfil.local_asignado ?? '')
  const [mesa, setMesa] = useState(perfil.mesa_asignada ?? '')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')

  // Padrón oficial de mesas (tabla `mesas`, importada de ONPE): permite buscar y
  // asignar una mesa real en vez de escribir el número a mano. null = cargando;
  // [] = esta instancia no tiene padrón importado, se cae al texto libre de siempre.
  const [mesasDisponibles, setMesasDisponibles] = useState<MesaOpt[] | null>(null)
  useEffect(() => {
    if (!esMesa) return
    supabase.from('mesas').select('numero, colegio_nombre').order('numero').then(({ data }) => {
      setMesasDisponibles(data ?? [])
    })
  }, [esMesa])

  const [qMesa, setQMesa] = useState('')
  const [abiertoMesa, setAbiertoMesa] = useState(false)
  const hayPadronMesas = (mesasDisponibles?.length ?? 0) > 0
  const filtradasMesa = (mesasDisponibles ?? []).filter(m =>
    !mesasOcupadas?.has(m.numero) &&
    (!qMesa.trim() || m.numero.includes(qMesa.trim()) || normTexto(m.colegio_nombre ?? '').includes(normTexto(qMesa))))

  const elegirMesa = (m: MesaOpt) => {
    setMesa(m.numero)
    setQMesa('')
    setAbiertoMesa(false)
    if (m.colegio_nombre && !local.trim()) setLocal(m.colegio_nombre)
  }

  const guardar = async () => {
    setGuardando(true); setError('')
    if (soloMesa) {
      const cambios: CambiosPersonero = { nombre_completo: perfil.nombre, celular: perfil.celular, correo: perfil.correo, local_asignado: perfil.local_asignado, mesa_asignada: mesa.trim() || null }
      const { error: err } = await supabase.from('profiles').update({ mesa_asignada: cambios.mesa_asignada }).eq('id', perfil.id)
      setGuardando(false)
      if (err) { setError(err.message); return }
      onSaved(perfil.id, cambios)
      return
    }
    const cambios: CambiosPersonero = {
      nombre_completo: nombre.trim(),
      celular: celular.trim() || null,
      correo: correo.trim() || null,
      local_asignado: local.trim() || null,
    }
    if (esMesa) cambios.mesa_asignada = mesa.trim() || null
    const { error: err } = await supabase.from('profiles').update(cambios).eq('id', perfil.id)
    setGuardando(false)
    if (err) { setError(err.message); return }
    onSaved(perfil.id, cambios)
  }

  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar definitivamente a ${perfil.nombre || 'este personero'}? Esta acción no se puede deshacer — úsala solo si de verdad no va a participar.`)) return
    setEliminando(true); setError('')
    const { error: err } = await eliminarPersoneroCompleto(perfil.id)
    setEliminando(false)
    if (err) { setError(err); return }
    onEliminado(perfil.id)
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900">{soloMesa ? 'Asignar mesa' : 'Editar personero'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {soloMesa ? (
          <div>
            <p className="font-bold text-slate-800 text-sm">{perfil.nombre}</p>
            <p className="text-xs text-slate-500">Personero de Mesa</p>
          </div>
        ) : (
          <>
            <Campo label="Nombre completo" value={nombre} onChange={setNombre} />
            <Campo label="Celular" value={celular} onChange={setCelular} />
            <Campo label="Correo" value={correo} onChange={setCorreo} />
            <Campo label="Local de Votación Asignado" value={local} onChange={setLocal} />
          </>
        )}
        {esMesa && (
          hayPadronMesas ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">Mesa asignada</span>
              <div className="relative">
                <input
                  value={abiertoMesa ? qMesa : mesa}
                  onChange={e => { setQMesa(e.target.value); setAbiertoMesa(true) }}
                  onFocus={() => { setQMesa(''); setAbiertoMesa(true) }}
                  onBlur={() => setTimeout(() => setAbiertoMesa(false), 150)}
                  placeholder="Buscar por N° de mesa o colegio..."
                  className="text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500 w-full" />
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
                      <p className="px-3 py-2.5 text-xs text-slate-400">Sin coincidencias.</p>
                    )}
                  </div>
                )}
              </div>
            </label>
          ) : (
            <Campo label="Mesa asignada" value={mesa} onChange={setMesa} />
          )
        )}
        {local.trim() !== (perfil.local_asignado ?? '').trim() && (
          <p className="text-[11px] text-amber-600">
            Al cambiar el local, este personero se moverá a la tarjeta de su nuevo centro de votación.
          </p>
        )}
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {puedeEliminar && !soloMesa ? (
            <button onClick={eliminar} disabled={eliminando || guardando}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50 px-1">
              <Trash2 size={13} /> {eliminando ? 'Eliminando…' : 'Eliminar personero'}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs font-semibold text-slate-600 border border-slate-300 rounded-md px-3 py-1.5">
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando || eliminando}
              className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-md px-3 py-1.5">
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" />
    </label>
  )
}
