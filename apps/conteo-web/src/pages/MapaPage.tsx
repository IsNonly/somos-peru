import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase, DISTRITOS_META, colorPartido } from '../lib/supabase'
import { Search, RefreshCw, Download } from 'lucide-react'

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// GeoJSON de distritos Lima Metropolitana (polígonos simplificados)
// Fuente pública: github.com/jeanpaulomv/peru-geojson
const LIMA_GEOJSON_URL = 'https://raw.githubusercontent.com/jeanpaulomv/peru-geojson/main/distritos/Lima/lima_distritos.geojson'

interface DistritoStats {
  distrito: string
  mesas_aperturadas: number
  meta: number
  pct: number
  lider: string
  votos_lider: number
  partidos: { partido: string; votos: number }[]
}

// Componente interno que actualiza el estilo del GeoJSON
function GeoJSONLayer({ geojson, stats }: { geojson: any; stats: DistritoStats[] }) {
  const statsMap = Object.fromEntries(stats.map(s => [s.distrito.toLowerCase(), s]))

  const style = (feature: any) => {
    const name: string = feature?.properties?.distrito ?? feature?.properties?.DISTRITO ?? ''
    const s = statsMap[name.toLowerCase()]
    const color = s?.lider ? colorPartido(s.lider) : '#1e1e3a'
    const opacity = s?.pct ? Math.max(0.3, s.pct / 100) : 0.15
    return {
      fillColor: color,
      fillOpacity: opacity,
      color: '#ffffff',
      weight: 0.8,
      opacity: 0.4,
    }
  }

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const name: string = feature?.properties?.distrito ?? feature?.properties?.DISTRITO ?? ''
    const s = statsMap[name.toLowerCase()]
    if (s) {
      layer.bindPopup(`
        <div style="font-family:system-ui;min-width:160px">
          <strong style="font-size:13px">${s.distrito}</strong><br/>
          <span style="color:#aaa;font-size:11px">${s.mesas_aperturadas} / ${s.meta} mesas (${s.pct}%)</span>
          ${s.lider ? `<br/><span style="color:${colorPartido(s.lider)};font-weight:600;font-size:11px">${s.lider}</span>` : ''}
          ${s.votos_lider ? `<br/><span style="color:#888;font-size:11px">${s.votos_lider} votos</span>` : ''}
        </div>
      `)
    } else {
      layer.bindPopup(`<strong>${name}</strong><br/><span style="color:#aaa;font-size:11px">Sin datos aún</span>`)
    }
  }

  if (!geojson) return null
  return <GeoJSON key={JSON.stringify(stats.map(s => s.lider))} data={geojson} style={style} onEachFeature={onEachFeature} />
}

export default function MapaPage() {
  const [stats, setStats]           = useState<DistritoStats[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [filtroPartido, setFiltroPartido] = useState('')
  const [geojson, setGeojson]       = useState<any>(null)
  const [exporting, setExporting]   = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  // Cargar GeoJSON de Lima
  useEffect(() => {
    fetch(LIMA_GEOJSON_URL)
      .then(r => r.json())
      .then(d => setGeojson(d))
      .catch(() => setGeojson(null))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vista_resultados').select('*')
    if (!data) { setLoading(false); return }

    const byDistrito: Record<string, DistritoStats> = {}
    data.forEach((r: any) => {
      if (!byDistrito[r.distrito]) {
        byDistrito[r.distrito] = {
          distrito: r.distrito,
          mesas_aperturadas: r.mesas_con_reporte,
          meta: DISTRITOS_META[r.distrito] ?? 0,
          pct: 0,
          lider: '',
          votos_lider: 0,
          partidos: [],
        }
      }
      if (r.nivel === 'PROVINCIAL') {
        const d = byDistrito[r.distrito]
        d.partidos.push({ partido: r.partido, votos: r.total_votos })
        if (r.total_votos > d.votos_lider) {
          d.lider = r.partido
          d.votos_lider = r.total_votos
        }
      }
    })

    Object.values(byDistrito).forEach(d => {
      d.pct = d.meta > 0 ? Math.round((d.mesas_aperturadas / d.meta) * 100) : 0
    })

    setStats(Object.values(byDistrito))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Exportar PNG del mapa usando canvas nativo de Leaflet
  const exportarPNG = async () => {
    setExporting(true)
    try {
      // Leaflet tiles son cross-origin; usamos html2canvas si está disponible,
      // si no, exportamos una tarjeta SVG con los datos
      const { default: html2canvas } = await import('html2canvas')
      const mapEl = document.querySelector('.leaflet-container') as HTMLElement
      if (!mapEl) throw new Error('Map not found')
      const canvas = await html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#0a0a14',
      })
      const link = document.createElement('a')
      link.download = `Mapa_Lima_SomosPerú_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // Fallback: generar imagen de resumen de distritos
      const canvas = document.createElement('canvas')
      canvas.width  = 1200
      canvas.height = 800
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, 1200, 800)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 28px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Resultados Lima Metropolitana — Somos Perú 2026', 600, 50)
      ctx.font = '16px system-ui'
      ctx.fillStyle = '#888888'
      ctx.fillText(`Generado: ${new Date().toLocaleString('es-PE')}`, 600, 80)

      let x = 80, y = 120
      stats.slice(0, 42).forEach((d, i) => {
        if (i > 0 && i % 6 === 0) { x = 80; y += 100 }
        ctx.fillStyle = d.lider ? colorPartido(d.lider) : '#1e1e3a'
        ctx.fillRect(x, y, 160, 80)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 11px system-ui'
        ctx.textAlign = 'center'
        const words = d.distrito.split(' ')
        ctx.fillText(words.slice(0, 2).join(' '), x + 80, y + 28)
        if (words.length > 2) ctx.fillText(words.slice(2).join(' '), x + 80, y + 42)
        ctx.font = '10px system-ui'
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText(`${d.pct}% — ${d.mesas_aperturadas} mesas`, x + 80, y + 60)
        x += 180
      })

      const link = document.createElement('a')
      link.download = `Resumen_Lima_SomosPerú_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    setExporting(false)
  }

  const filtrados = stats.filter(d =>
    (!search || d.distrito.toLowerCase().includes(search.toLowerCase())) &&
    (!filtroPartido || d.lider === filtroPartido)
  )

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Geografía Electoral</p>
          <h1 className="text-white text-2xl font-bold">Mapa de Lima</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarPNG} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-600/30 hover:bg-purple-600/30 text-purple-400 rounded-xl text-sm transition-all disabled:opacity-50">
            <Download size={14} /> {exporting ? 'Exportando…' : 'Exportar PNG'}
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#16162a] border border-white/8 hover:bg-white/5 text-white/60 rounded-xl text-sm transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
          <Search size={14} className="text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar distrito…"
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
        </div>
        <select value={filtroPartido} onChange={e => setFiltroPartido(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los partidos</option>
          {[...new Set(stats.map(s => s.lider).filter(Boolean))].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        {/* Mapa */}
        <div className="xl:col-span-2 bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden" style={{ height: '520px' }}>
          <MapContainer
            center={[-12.046374, -77.042793]}
            zoom={11}
            style={{ height: '100%', width: '100%', background: '#0a0a14' }}
            ref={mapRef as any}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
            />
            <GeoJSONLayer geojson={geojson} stats={stats} />
          </MapContainer>
        </div>

        {/* Lista distritos */}
        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {filtrados.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Sin datos aún</p>
          ) : filtrados.sort((a, b) => b.pct - a.pct).map(d => (
            <button key={d.distrito} onClick={() => setSelected(d.distrito === selected ? null : d.distrito)}
              className={`w-full text-left bg-[#16162a] border rounded-2xl p-4 transition-all
                ${selected === d.distrito ? 'border-brand-red/50' : 'border-white/8 hover:border-white/15'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold text-sm">{d.distrito}</p>
                <span className="text-white/50 text-xs tabular-nums">{d.pct}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${d.pct}%`, background: d.lider ? colorPartido(d.lider) : '#E8534A' }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/40">
                <span>{d.mesas_aperturadas} mesas</span>
                {d.lider && (
                  <span style={{ color: colorPartido(d.lider) }}>
                    {d.lider.replace('Alianza para el Progreso', 'APP').replace('Partido Aprista Peruano', 'APRA').replace('Somos Perú', 'SP')}
                  </span>
                )}
              </div>

              {selected === d.distrito && d.partidos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                  <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Desglose</p>
                  {d.partidos.sort((a, b) => b.votos - a.votos).slice(0, 6).map(p => {
                    const total = d.partidos.reduce((a, v) => a + v.votos, 0)
                    const pct = total > 0 ? Math.round((p.votos / total) * 100) : 0
                    return (
                      <div key={p.partido} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorPartido(p.partido) }} />
                        <span className="text-white/60 text-xs flex-1 truncate">
                          {p.partido.replace('Alianza para el Progreso', 'APP').replace('Partido Aprista Peruano', 'APRA')}
                        </span>
                        <span className="text-white text-xs font-mono font-bold">{p.votos}</span>
                        <span className="text-white/30 text-xs w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Leyenda de colores */}
      {stats.some(s => s.lider) && (
        <div className="bg-[#16162a] border border-white/8 rounded-2xl p-4">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Leyenda — Partido líder por distrito</p>
          <div className="flex flex-wrap gap-3">
            {[...new Set(stats.map(s => s.lider).filter(Boolean))].map(p => (
              <div key={p} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: colorPartido(p) }} />
                <span className="text-white/60 text-xs">
                  {p.replace('Alianza para el Progreso', 'APP').replace('Partido Aprista Peruano', 'APRA')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
