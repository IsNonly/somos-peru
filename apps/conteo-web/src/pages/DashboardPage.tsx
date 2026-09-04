import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { CANDIDATOS_METROPOLITANA, VOTOS_ESPECIALES, slugPartido } from '../lib/candidatos'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface Voto { nivel: string; partido: string; cantidad: number; metodo: string }

const ORDEN = [
  ...CANDIDATOS_METROPOLITANA.map(c => ({ partido: c.partido, letra: c.letra, color: c.color })),
  ...VOTOS_ESPECIALES.map(v => ({ partido: v.partido, letra: v.partido.slice(0, 4), color: v.color })),
]

const chartOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9, weight: 'bold' } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
}

function agrupar(votos: Voto[], nivel: string, metodo?: string) {
  const acc: Record<string, number> = {}
  for (const v of votos) {
    if (v.nivel !== nivel) continue
    if (metodo && v.metodo !== metodo) continue
    acc[v.partido] = (acc[v.partido] ?? 0) + (v.cantidad || 0)
  }
  return acc
}
const dataset = (acc: Record<string, number>) => ({
  labels: ORDEN.map(o => o.letra),
  datasets: [{ data: ORDEN.map(o => acc[o.partido] ?? 0), backgroundColor: ORDEN.map(o => o.color), borderRadius: 4 }],
})
const total = (acc: Record<string, number>) => Object.values(acc).reduce((a, b) => a + b, 0)

export default function DashboardPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [votos, setVotos] = useState<Voto[]>([])
  const [mesas, setMesas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      setLoading(true)
      let aq = supabase.from('actas').select('id, metodo, distrito, colegio_nombre, mesa_numero').eq('estado', 'TRANSMITIDA')
      if (distritosEfectivos) aq = aq.in('distrito', distritosEfectivos)
      if (f.colegio) aq = aq.eq('colegio_nombre', f.colegio)
      if (f.mesa)    aq = aq.eq('mesa_numero', f.mesa)
      const { data: actas } = await aq
      const ids = (actas ?? []).map((a: any) => a.id)
      const metodoPorActa = new Map((actas ?? []).map((a: any) => [a.id, a.metodo]))
      setMesas(ids.length)

      let rows: Voto[] = []
      if (ids.length) {
        const { data: vs } = await supabase.from('votos').select('acta_id, nivel, partido, cantidad').in('acta_id', ids)
        rows = (vs ?? []).map((v: any) => ({
          nivel: v.nivel, partido: v.partido, cantidad: v.cantidad,
          metodo: metodoPorActa.get(v.acta_id) ?? 'MANUAL',
        }))
      }
      if (!vivo) return
      setVotos(rows)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [scopeLoading, distritosEfectivos, f.colegio, f.mesa])

  const g = useMemo(() => ({
    provManual: agrupar(votos, 'PROVINCIAL', 'MANUAL'),
    distManual: agrupar(votos, 'DISTRITAL', 'MANUAL'),
    provOcr:    agrupar(votos, 'PROVINCIAL', 'IMAGEN'),
    distOcr:    agrupar(votos, 'DISTRITAL', 'IMAGEN'),
    prov:       agrupar(votos, 'PROVINCIAL'),
    dist:       agrupar(votos, 'DISTRITAL'),
  }), [votos])

  const consolidado = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const o of ORDEN) acc[o.partido] = (g.prov[o.partido] ?? 0) + (g.dist[o.partido] ?? 0)
    return acc
  }, [g])
  const granTotal = total(consolidado)

  const chips = useMemo(() => {
    return CANDIDATOS_METROPOLITANA
      .map(c => ({ letra: c.letra, color: c.color, pct: granTotal > 0 ? ((g.prov[c.partido] ?? 0) / granTotal) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct).slice(0, 6)
  }, [g, granTotal])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">📊 Dashboard de Resultados Electorales</h1>
          <p className="text-sm text-slate-500">Ámbito: <strong className="text-sky-600">{ambitoLabel || 'Lima Metropolitana'}</strong></p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map(c => (
            <span key={c.letra} className="text-xs font-bold rounded-full px-2.5 py-1"
              style={{ background: c.color + '22', color: c.color }}>
              {c.letra} {c.pct.toFixed(1)}%
            </span>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel titulo="Alcaldía Metropolitana (Manual)" sub="Votos provinciales digitados" total={total(g.provManual)} data={dataset(g.provManual)} />
        <Panel titulo="Alcaldía Distrital (Manual)" sub="Votos distritales digitados" total={total(g.distManual)} data={dataset(g.distManual)} />
        <Panel titulo="Alcaldía Metropolitana (OCR / Foto)" sub="Votos procesados por imagen" total={total(g.provOcr)} data={dataset(g.provOcr)} />
        <Panel titulo="Alcaldía Distrital (OCR / Foto)" sub="Votos procesados por imagen" total={total(g.distOcr)} data={dataset(g.distOcr)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-extrabold text-slate-900">Consolidado {ambitoLabel || 'Lima Metropolitana'}</h3>
            <span className="text-xs text-slate-500">Total consolidado (Manual + OCR)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-50 text-emerald-600 font-bold rounded-full px-2.5 py-1">Total: {granTotal.toLocaleString('es-PE')}</span>
            <span className="bg-slate-100 text-slate-500 font-semibold rounded px-2 py-1">Mesas: {mesas}</span>
          </div>
        </div>
        <div className="h-60"><Bar data={dataset(consolidado)} options={chartOpts} /></div>
      </div>

      {/* Tabla de candidatos */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-sm">Detalle de Partidos y Candidatos</h3>
          <p className="text-xs text-slate-500">Candidatos para {ambitoLabel || 'Lima Metropolitana'} con sus símbolos oficiales</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                {['Símbolo', 'Partido / Tipo', 'Candidato Provincial', 'Candidato Distrital', 'Votos Prov.', 'Votos Dist.', 'Total Votos', '% Participación'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...CANDIDATOS_METROPOLITANA]
                .filter(c => !f.partido || c.partido === f.partido)
                .map(c => {
                  const vp = g.prov[c.partido] ?? 0
                  const vd = g.dist[c.partido] ?? 0
                  return { c, vp, vd, tot: vp + vd }
                })
                .sort((a, b) => b.tot - a.tot)
                .map(({ c, vp, vd, tot }) => {
                  const pct = granTotal > 0 ? (tot / granTotal) * 100 : 0
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="relative w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                          <span className="text-[0.5rem] font-black" style={{ color: c.color }}>{c.letra}</span>
                          <img src={`/partidos/${slugPartido(c.partido)}.png`} alt="" loading="lazy"
                            className="absolute inset-0 w-full h-full object-contain p-0.5 bg-white"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{c.partido}</td>
                      <td className="px-4 py-2.5 text-sky-700 whitespace-nowrap">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-sky-700 whitespace-nowrap">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-sky-700 font-semibold tabular-nums">{vp.toLocaleString('es-PE')}</td>
                      <td className="px-4 py-2.5 text-purple-700 font-semibold tabular-nums">{vd.toLocaleString('es-PE')}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900 tabular-nums">{tot.toLocaleString('es-PE')}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: c.color }} />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-12">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {loading && <p className="px-5 py-3 text-xs text-slate-400">Cargando resultados…</p>}
        {!loading && granTotal === 0 && (
          <p className="px-5 py-6 text-center text-sm text-slate-400">Esperando actas transmitidas — aún no hay votos en este ámbito.</p>
        )}
      </div>
    </div>
  )
}

function Panel({ titulo, sub, total, data }: { titulo: string; sub: string; total: number; data: any }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm">{titulo}</h3>
          <span className="text-xs text-slate-500">{sub}</span>
        </div>
        <span className="bg-slate-100 text-sky-600 text-xs font-bold rounded-full px-2 py-0.5">Total: {total.toLocaleString('es-PE')}</span>
      </div>
      <div className="h-52"><Bar data={data} options={chartOpts} /></div>
    </div>
  )
}
