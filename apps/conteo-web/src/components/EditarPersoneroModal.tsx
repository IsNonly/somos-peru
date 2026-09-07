import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export interface PersoneroEditable {
  id: string
  nombre_completo: string
  celular: string | null
  correo: string | null
  local_asignado: string | null
  mesa_asignada?: string | null
  rol: string
}

export default function EditarPersoneroModal({ perfil, onClose, onSaved }: {
  perfil: PersoneroEditable
  onClose: () => void
  onSaved: (cambios: Partial<PersoneroEditable>) => void
}) {
  const [nombre, setNombre] = useState(perfil.nombre_completo ?? '')
  const [celular, setCelular] = useState(perfil.celular ?? '')
  const [correo, setCorreo] = useState(perfil.correo ?? '')
  const [local, setLocal] = useState(perfil.local_asignado ?? '')
  const [mesa, setMesa] = useState(perfil.mesa_asignada ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const esMesa = perfil.rol === 'Personero de Mesa'

  const guardar = async () => {
    setGuardando(true); setError('')
    const cambios: Partial<PersoneroEditable> = {
      nombre_completo: nombre.trim(),
      celular: celular.trim() || null,
      correo: correo.trim() || null,
      local_asignado: local.trim() || null,
    }
    if (esMesa) cambios.mesa_asignada = mesa.trim() || null
    const { error: err } = await supabase.from('profiles').update(cambios).eq('id', perfil.id)
    setGuardando(false)
    if (err) { setError(err.message); return }
    onSaved(cambios)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900">Editar personero</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <Campo label="Nombre completo" value={nombre} onChange={setNombre} />
        <Campo label="Celular" value={celular} onChange={setCelular} />
        <Campo label="Correo" value={correo} onChange={setCorreo} />
        <Campo label="Local / Centro de votación" value={local} onChange={setLocal} />
        {esMesa && <Campo label="Mesa asignada" value={mesa} onChange={setMesa} />}
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-xs font-semibold text-slate-600 border border-slate-300 rounded-md px-3 py-1.5">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-md px-3 py-1.5">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
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
