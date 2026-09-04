import { useEffect, useState } from 'react'
import { supabase, getMiPerfil } from '../lib/supabase'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface Acta {
  id: string
  mesa_numero: string
  distrito: string
  estado: string
  metodo: string
  transmitida_at: string | null
  votos?: { nivel: string; partido: string; cantidad: number }[]
}

export default function HistorialPage() {
  const [actas, setActas] = useState<Acta[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const p = await getMiPerfil<{ id: string }>('id')
      if (!p?.id) { setLoading(false); return }
      const { data } = await supabase
        .from('actas')
        .select('id, mesa_numero, distrito, estado, metodo, transmitida_at')
        .eq('personero_id', p.id)
        .order('transmitida_at', { ascending: false })
      setActas((data ?? []) as Acta[])
      setLoading(false)
    }
    load()
  }, [])

  const loadVotos = async (actaId: string) => {
    if (expanded === actaId) { setExpanded(null); return }
    const { data } = await supabase
      .from('votos')
      .select('nivel, partido, cantidad')
      .eq('acta_id', actaId)
      .gt('cantidad', 0)
      .order('nivel')
    setActas(prev => prev.map(a => a.id === actaId ? { ...a, votos: data ?? [] } : a))
    setExpanded(actaId)
  }

  const iconEstado = (e: string) => {
    if (e === 'TRANSMITIDA') return <CheckCircle size={16} className="text-green-400" />
    if (e === 'OBSERVADA')   return <AlertCircle size={16} className="text-yellow-400" />
    return <Clock size={16} className="text-white/30" />
  }

  return (
    <div className="p-5 space-y-4 fade-in">
      <div className="pt-4">
        <h1 className="text-white font-bold text-xl">Historial de Actas</h1>
        <p className="text-white/40 text-sm mt-1">Actas transmitidas en esta jornada</p>
      </div>

      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#14141f] border border-white/8 rounded-2xl p-5 animate-pulse h-20" />
        ))
      ) : actas.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          No hay actas transmitidas aún
        </div>
      ) : actas.map(a => (
        <div key={a.id} className="bg-[#14141f] border border-white/8 rounded-2xl overflow-hidden">
          <button onClick={() => loadVotos(a.id)} className="w-full px-4 py-4 flex items-center gap-3 text-left">
            {iconEstado(a.estado)}
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Mesa {a.mesa_numero}</p>
              <p className="text-white/40 text-xs">{a.distrito} · {a.metodo}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-semibold ${a.estado === 'TRANSMITIDA' ? 'text-green-400' : 'text-yellow-400'}`}>
                {a.estado}
              </p>
              {a.transmitida_at && (
                <p className="text-white/30 text-xs">
                  {new Date(a.transmitida_at).toLocaleString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </button>

          {expanded === a.id && a.votos && (
            <div className="border-t border-white/5 px-4 pb-4">
              {['PROVINCIAL', 'DISTRITAL'].map(nivel => {
                const rows = (a.votos ?? []).filter(v => v.nivel === nivel)
                if (!rows.length) return null
                return (
                  <div key={nivel} className="mt-3">
                    <p className="text-white/40 text-xs uppercase tracking-widest mb-2">{nivel}</p>
                    <div className="space-y-1">
                      {rows.map((v, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-white/60 truncate pr-2">{v.partido}</span>
                          <span className="text-white font-mono font-bold">{v.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
