import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { VOTOS_ESPECIALES, slugPartido } from '../lib/candidatos'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface Voto { nivel: string; partido: string; cantidad: number; metodo: string }
interface Lista { partido: string; letra: string; color: string; orden: number }

type Nivel = 'REGIONAL' | 'PROVINCIAL' | 'DISTRITAL'
const NIVEL_LABEL: Record<Nivel, string> = {
  REGIONAL: 'Gobernador Regional',
  PROVINCIAL: 'Alcaldía Provincial',
  DISTRITAL: 'Alcaldía Distrital',
}

const chartOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9, weight: 'bold' } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } },
  },
}

// Iniciales de respaldo si la lista no trae sigla
function inicialesPartido(p: string): string {
  const stop = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'por', 'para'])
  const w = p.replace(/[()]/g, '').split(/\s+/).filter(x => !stop.has(x.toLowerCase()))
  return (w.slice(0, 3).map(x => x[0]).join('') || p.slice(0, 3)).toUpperCase()
}

function agrupar(votos: Voto[], nivel?: string, metodo?: string) {
  const acc: Record<string, number> = {}
  for (const v of votos) {
    if (nivel && v.nivel !== nivel) continue
    if (metodo && v.metodo !== metodo) continue
    acc[v.partido] = (acc[v.partido] ?? 0) + (v.cantidad || 0)
  }
  return acc
}
const dataset = (acc: Record<string, number>, orden: Lista[]) => ({
  labels: orden.map(o => o.letra),
  datasets: [{ data: orden.map(o => acc[o.partido] ?? 0), backgroundColor: orden.map(o => o.color), borderRadius: 4 }],
})
const total = (acc: Record<string, number>) => Object.values(acc).reduce((a, b) => a + b, 0)

export default function DashboardPage() {
  const { distritosEfectivos, f, ambitoLabel, loading: scopeLoading } = useFiltros()
  const [votos, setVotos] = useState<Voto[]>([])
  const [listas, setListas] = useState<Lista[]>([])   // universo de partidos del ámbito (tabla candidaturas)
  const [mesas, setMesas] = useState(0)
  const [loading, setLoading] = useState(true)

  // ── Universo de partidos: SIEMPRE desde la tabla `candidaturas` (misma
  //    fuente que ve el personero en la conteo-app), acotado al ámbito. ──
  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      let q = supabase.from('candidaturas').select('partido, sigla, color, orden, provincia, distrito').eq('activo', true)
      if (f.departamento) q = q.eq('departamento', f.departamento)
      const { data } = await q
      if (!vivo) return
      const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().trim()
      const rows = (data ?? []).filter((r: any) =>
        (!f.provincia || !r.provincia || norm(r.provincia) === norm(f.provincia)) &&
        (!f.distrito  || !r.distrito  || norm(r.distrito)  === norm(f.distrito)))
      const map = new Map<string, Lista>()
      for (const r of rows as any[]) {
        if (map.has(r.partido)) continue
        map.set(r.partido, {
          partido: r.partido,
          letra: (r.sigla || inicialesPartido(r.partido)).slice(0, 4),
          color: r.color || '#64748b',
          orden: r.orden ?? 999,
        })
      }
      const arr = [...map.values()].sort((a, b) => a.orden - b.orden || a.partido.localeCompare(b.partido, 'es'))
      setListas(arr)
    })()
    return () => { vivo = false }
  }, [scopeLoading, f.departamento, f.provincia, f.distrito])

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

  // Orden final = partidos del ámbito + votos especiales + cualquier partido
  // que aparezca en los votos pero no esté en candidaturas (defensivo).
  const orden = useMemo<Lista[]>(() => {
    const base = [...listas]
    const vistos = new Set(base.map(l => l.partido))
    for (const v of votos) {
      if (vistos.has(v.partido)) continue
      if (VOTOS_ESPECIALES.some(e => e.partido === v.partido)) continue
      vistos.add(v.partido)
      base.push({ partido: v.partido, letra: inicialesPartido(v.partido), color: '#94a3b8', orden: 998 })
    }
    return [
      ...base,
      ...VOTOS_ESPECIALES.map(e => ({ partido: e.partido, letra: e.partido.slice(0, 4), color: e.color, orden: 1000 })),
    ]
  }, [listas, votos])

  // Niveles presentes (según lo que realmente llegó en los votos)
  const niveles = useMemo<Nivel[]>(() => {
    const set = new Set(votos.map(v => v.nivel))
    return (['REGIONAL', 'PROVINCIAL', 'DISTRITAL'] as Nivel[]).filter(n => set.has(n))
  }, [votos])

  const porNivel = useMemo(() => {
    const o: Record<string, Record<string, number>> = {}
    for (const n of ['REGIONAL', 'PROVINCIAL', 'DISTRITAL']) {
      o[n] = agrupar(votos, n)
      o[n + ':MANUAL'] = agrupar(votos, n, 'MANUAL')
      o[n + ':IMAGEN'] = agrupar(votos, n, 'IMAGEN')
    }
    return o
  }, [votos])

  const consolidado = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const l of orden) acc[l.partido] = niveles.reduce((s, n) => s + (porNivel[n][l.partido] ?? 0), 0)
    return acc
  }, [orden, niveles, porNivel])
  const granTotal = total(consolidado)

  const chips = useMemo(() => orden
    .filter(l => !VOTOS_ESPECIALES.some(e => e.partido === l.partido))
    .map(l => ({ letra: l.letra, color: l.color, pct: granTotal > 0 ? ((consolidado[l.partido] ?? 0) / granTotal) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct).slice(0, 6), [orden, consolidado, granTotal])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">📊 Dashboard de Resultados Electorales</h1>
          <p className="text-sm text-slate-500">
            Ámbito: <strong className="text-sky-600">{ambitoLabel || 'Tumbes'}</strong>
            {listas.length > 0 && <span className="text-slate-400"> · {listas.length} listas</span>}
          </p>
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

      {/* Un par de paneles (Manual / OCR) por cada nivel presente */}
      <div className="grid lg:grid-cols-2 gap-5">
        {niveles.flatMap(n => [
          <Panel key={n + 'M'} titulo={`${NIVEL_LABEL[n]} (Manual)`} sub="Votos digitados"
            total={total(porNivel[n + ':MANUAL'])} data={dataset(porNivel[n + ':MANUAL'], orden)} />,
          <Panel key={n + 'O'} titulo={`${NIVEL_LABEL[n]} (OCR / Foto)`} sub="Votos procesados por imagen"
            total={total(porNivel[n + ':IMAGEN'])} data={dataset(porNivel[n + ':IMAGEN'], orden)} />,
        ])}
        {niveles.length === 0 && (
          <p className="text-sm text-slate-400 col-span-2 py-6 text-center">Aún no hay votos transmitidos en este ámbito.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-extrabold text-slate-900">Consolidado {ambitoLabel || 'Tumbes'}</h3>
            <span className="text-xs text-slate-500">Total consolidado ({niveles.map(n => NIVEL_LABEL[n]).join(' + ') || '—'}, Manual + OCR)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-50 text-emerald-600 font-bold rounded-full px-2.5 py-1">Total: {granTotal.toLocaleString('es-PE')}</span>
            <span className="bg-slate-100 text-slate-500 font-semibold rounded px-2 py-1">Mesas: {mesas}</span>
          </div>
        </div>
        <div className="h-60"><Bar data={dataset(consolidado, orden)} options={chartOpts} /></div>
      </div>

      {/* Tabla de partidos */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-sm">Detalle de Partidos</h3>
          <p className="text-xs text-slate-500">Listas de {ambitoLabel || 'Tumbes'} — fuente: tabla de candidaturas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left whitespace-nowrap">Símbolo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Partido / Tipo</th>
                {niveles.map(n => (
                  <th key={n} className="px-4 py-3 text-left whitespace-nowrap">Votos {NIVEL_LABEL[n].split(' ')[0]}</th>
                ))}
                <th className="px-4 py-3 text-left whitespace-nowrap">Total Votos</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">% Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orden
                .filter(l => !f.partido || l.partido === f.partido)
                .map(l => {
                  const porN = niveles.map(n => porNivel[n][l.partido] ?? 0)
                  const tot = porN.reduce((a, b) => a + b, 0)
                  return { l, porN, tot }
                })
                .sort((a, b) => b.tot - a.tot)
                .map(({ l, porN, tot }) => {
                  const pct = granTotal > 0 ? (tot / granTotal) * 100 : 0
                  return (
                    <tr key={l.partido} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="relative w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                          <span className="text-[0.5rem] font-black" style={{ color: l.color }}>{l.letra}</span>
                          <img src={`/partidos/${slugPartido(l.partido)}.png`} alt="" loading="lazy"
                            className="absolute inset-0 w-full h-full object-contain p-0.5 bg-white"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{l.partido}</td>
                      {porN.map((n, i) => (
                        <td key={i} className="px-4 py-2.5 text-sky-700 font-semibold tabular-nums">{n.toLocaleString('es-PE')}</td>
                      ))}
                      <td className="px-4 py-2.5 font-bold text-slate-900 tabular-nums">{tot.toLocaleString('es-PE')}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: l.color }} />
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
