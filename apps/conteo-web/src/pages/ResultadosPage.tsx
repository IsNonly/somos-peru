import { useEffect, useState, useCallback } from 'react'
import { supabase, colorPartido } from '../lib/supabase'
import { Download, RefreshCw, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Row {
  distrito: string
  nivel: string
  partido: string
  total_votos: number
  mesas_con_reporte: number
}

const DISTRITOS = [
  'Ancón','Ate','Barranco','Breña','Carabayllo','Cercado de Lima','Chaclacayo',
  'Chorrillos','Cieneguilla','Comas','El Agustino','Independencia','Jesús María',
  'La Molina','La Victoria','Lince','Los Olivos','Lurigancho-Chosica','Lurín',
  'Magdalena del Mar','Miraflores','Pachacámac','Pucusana','Pueblo Libre','Puente Piedra',
  'Punta Hermosa','Punta Negra','Rímac','San Bartolo','San Borja','San Isidro',
  'San Juan de Lurigancho','San Juan de Miraflores','San Luis','San Martín de Porres',
  'San Miguel','Santa Anita','Santa María del Mar','Santa Rosa','Santiago de Surco',
  'Surquillo','Villa El Salvador','Villa María del Triunfo',
]

export default function ResultadosPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [nivel, setNivel] = useState('PROVINCIAL')
  const [distrito, setDistrito] = useState('')
  const [filtroPartido, setFiltroPartido] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vista_resultados').select('*')
    setRows((data ?? []) as Row[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r =>
    r.nivel === nivel &&
    (!distrito || r.distrito === distrito) &&
    (!filtroPartido || r.partido === filtroPartido)
  )

  // Agrupar por partido
  const byPartido: Record<string, { total: number; distritos: number }> = {}
  filtered.forEach(r => {
    if (!byPartido[r.partido]) byPartido[r.partido] = { total: 0, distritos: 0 }
    byPartido[r.partido].total += r.total_votos
    byPartido[r.partido].distritos++
  })
  const partidosOrdenados = Object.entries(byPartido).sort((a, b) => b[1].total - a[1].total)
  const grandTotal = partidosOrdenados.reduce((a, [, v]) => a + v.total, 0)

  const exportar = () => {
    const data = filtered.map(r => ({
      'Distrito': r.distrito,
      'Nivel': r.nivel,
      'Partido / Candidato': r.partido,
      'Votos': r.total_votos,
      'Mesas con reporte': r.mesas_con_reporte,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
    XLSX.writeFile(wb, `Reporte_VotoReal_Lima_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Cómputo Electoral</p>
          <h1 className="text-white text-2xl font-bold">Resultados por Partido</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-[#16162a] border border-white/8 hover:bg-white/5 text-white/60 rounded-xl text-sm transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/30 hover:bg-green-600/30 text-green-400 rounded-xl text-sm font-medium transition-all">
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl overflow-hidden border border-white/8">
          {['PROVINCIAL', 'DISTRITAL'].map(n => (
            <button key={n} onClick={() => setNivel(n)}
              className={`px-4 py-2 text-sm font-medium transition-all
                ${nivel === n ? 'bg-brand-red text-white' : 'bg-[#16162a] text-white/50 hover:text-white'}`}>
              {n === 'PROVINCIAL' ? 'Lima Metropolitana' : 'Distrital'}
            </button>
          ))}
        </div>
        <select value={distrito} onChange={e => setDistrito(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los distritos</option>
          {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {filtroPartido && (
          <button onClick={() => setFiltroPartido('')}
            className="flex items-center gap-1 px-3 py-2 bg-brand-red/20 border border-brand-red/30 text-brand-red rounded-xl text-sm">
            <Filter size={12} /> {filtroPartido.slice(0, 20)} ×
          </button>
        )}
      </div>

      {/* Tabla resumen por partido */}
      <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-white font-semibold text-sm">Candidatos para {nivel === 'PROVINCIAL' ? 'Alcaldía Metropolitana' : distrito || 'Lima'}</p>
          <p className="text-white/30 text-xs">{grandTotal.toLocaleString()} votos totales</p>
        </div>
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : partidosOrdenados.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-12">Sin datos aún — esperando actas transmitidas</p>
        ) : (
          <div className="divide-y divide-white/5">
            {partidosOrdenados.map(([partido, data], i) => {
              const pct = grandTotal > 0 ? (data.total / grandTotal) * 100 : 0
              return (
                <div key={partido} className="px-5 py-3.5 hover:bg-white/3 transition-colors cursor-pointer"
                  onClick={() => setFiltroPartido(p => p === partido ? '' : partido)}>
                  <div className="flex items-center gap-3">
                    <span className="text-white/30 text-xs w-4 tabular-nums font-bold">{i + 1}</span>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colorPartido(partido) }} />
                    <p className="flex-1 text-white text-sm font-medium truncate">{partido}</p>
                    <p className="text-white font-bold tabular-nums text-sm">{data.total.toLocaleString()}</p>
                    <p className="text-white/40 text-xs w-12 text-right tabular-nums">{pct.toFixed(1)}%</p>
                  </div>
                  <div className="ml-10 mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, background: colorPartido(partido) }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detalle por distrito */}
      {filtroPartido && (
        <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-white font-semibold text-sm">Desglose de Votos de {filtroPartido}</p>
          </div>
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
            {filtered
              .filter(r => r.partido === filtroPartido)
              .sort((a, b) => b.total_votos - a.total_votos)
              .map(r => (
                <div key={r.distrito} className="flex items-center justify-between px-5 py-3">
                  <p className="text-white/70 text-sm">{r.distrito}</p>
                  <div className="text-right">
                    <p className="text-white font-bold tabular-nums text-sm">{r.total_votos.toLocaleString()}</p>
                    <p className="text-white/30 text-xs">{r.mesas_con_reporte} mesas</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
