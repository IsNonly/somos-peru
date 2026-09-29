import { useEffect, useState, useMemo } from 'react'
import { supabase, AMBITO_DEPARTAMENTO } from '../lib/supabase'
import { useFiltros } from '../lib/filtros'
import { VOTOS_ESPECIALES, slugPartido } from '../lib/candidatos'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface Voto { nivel: string; partido: string; cantidad: number; metodo: string }
interface Lista { partido: string; nombre?: string; letra: string; color: string; orden: number }

type Nivel = 'REGIONAL' | 'PROVINCIAL' | 'DISTRITAL'
const NIVELES: Nivel[] = ['REGIONAL', 'PROVINCIAL', 'DISTRITAL']
const NIVEL_LABEL: Record<Nivel, string> = {
  REGIONAL: 'Gobernador Regional',
  PROVINCIAL: 'Alcaldía Provincial',
  DISTRITAL: 'Alcaldía Distrital',
}
const NIVEL_ICONO: Record<Nivel, string> = { REGIONAL: '🏛️', PROVINCIAL: '🏢', DISTRITAL: '🏘️' }

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

function agrupar(votos: Voto[], metodo?: string) {
  const acc: Record<string, number> = {}
  for (const v of votos) {
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
  // Universo de partidos POR NIVEL (tabla `candidaturas`, misma fuente que ve el
  // personero en la conteo-app) -antes se mezclaba un solo universo para todos
  // los niveles, lo que terminaba sumando votos de la Alcaldía Provincial de
  // Lima junto con los de la Alcaldía Distrital como si fueran la misma lista.
  const [listasPorNivel, setListasPorNivel] = useState<Record<Nivel, Lista[]>>({ REGIONAL: [], PROVINCIAL: [], DISTRITAL: [] })
  const [mesas, setMesas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (scopeLoading) return
    let vivo = true
    ;(async () => {
      let q = supabase.from('candidaturas').select('nivel, partido, sigla, color, orden, provincia, distrito').eq('activo', true)
      if (f.departamento) q = q.eq('departamento', f.departamento)
      const { data } = await q
      if (!vivo) return
      const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().trim()
      const rows = (data ?? []).filter((r: any) =>
        (!f.provincia || !r.provincia || norm(r.provincia) === norm(f.provincia)) &&
        (!f.distrito  || !r.distrito  || norm(r.distrito)  === norm(f.distrito)))

      const porNivel: Record<Nivel, Lista[]> = { REGIONAL: [], PROVINCIAL: [], DISTRITAL: [] }
      for (const nivel of NIVELES) {
        const map = new Map<string, Lista>()
        for (const r of rows.filter((x: any) => x.nivel === nivel) as any[]) {
          if (map.has(r.partido)) continue
          map.set(r.partido, {
            partido: r.partido,
            letra: (r.sigla || inicialesPartido(r.partido)).slice(0, 4),
            color: r.color || '#64748b',
            orden: r.orden ?? 999,
          })
        }
        porNivel[nivel] = [...map.values()].sort((a, b) => a.orden - b.orden || a.partido.localeCompare(b.partido, 'es'))
      }
      setListasPorNivel(porNivel)
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

  // Niveles a mostrar: los que tienen listas cargadas para este ámbito, más
  // cualquiera que ya tenga votos (defensivo). Un distrito sin Gobernador
  // Regional (caso de Lima Metropolitana) simplemente no lo muestra.
  const niveles = useMemo<Nivel[]>(() => {
    const conVotos = new Set(votos.map(v => v.nivel))
    const set = new Set<Nivel>([...NIVELES.filter(n => listasPorNivel[n].length > 0), ...([...conVotos] as Nivel[])])
    return NIVELES.filter(n => set.has(n))
  }, [listasPorNivel, votos])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">📊 Dashboard de Resultados Electorales</h1>
        <p className="text-sm text-slate-500">
          Ámbito: <strong className="text-sky-600">{ambitoLabel || AMBITO_DEPARTAMENTO}</strong>
          {' · '}Mesas con actas transmitidas: <strong className="text-slate-700">{mesas}</strong>
        </p>
      </div>

      {!loading && niveles.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-10 bg-white rounded-2xl border border-slate-200">
          Aún no hay votos transmitidos en este ámbito.
        </p>
      )}

      {/* Un bloque completo por nivel -Gobernador Regional / Alcaldía Provincial /
          Alcaldía Distrital-, cada uno con SU propio consolidado y % de
          participación: son elecciones distintas, no se suman entre sí. */}
      {niveles.map(nivel => (
        <BloqueNivel key={nivel} nivel={nivel} votos={votos.filter(v => v.nivel === nivel)} listas={listasPorNivel[nivel]} />
      ))}
    </div>
  )
}

function BloqueNivel({ nivel, votos, listas }: { nivel: Nivel; votos: Voto[]; listas: Lista[] }) {
  const { f } = useFiltros()

  // Orden final = partidos del nivel + votos especiales + cualquier partido que
  // aparezca en los votos pero no esté en candidaturas (defensivo).
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
      ...VOTOS_ESPECIALES.map(e => ({ partido: e.partido, nombre: e.nombre, letra: e.partido.slice(0, 4), color: e.color, orden: 1000 })),
    ]
  }, [listas, votos])

  const manual = useMemo(() => agrupar(votos, 'MANUAL'), [votos])
  const imagen = useMemo(() => agrupar(votos, 'IMAGEN'), [votos])
  const consolidado = useMemo(() => agrupar(votos), [votos])
  const granTotal = total(consolidado)

  const chips = useMemo(() => orden
    .filter(l => !VOTOS_ESPECIALES.some(e => e.partido === l.partido))
    .map(l => ({ letra: l.letra, color: l.color, pct: granTotal > 0 ? ((consolidado[l.partido] ?? 0) / granTotal) * 100 : 0 }))
    .sort((a, b) => b.pct - a.pct).slice(0, 6), [orden, consolidado, granTotal])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          {NIVEL_ICONO[nivel]} {NIVEL_LABEL[nivel]}
        </h2>
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
        <Panel titulo={`${NIVEL_LABEL[nivel]} (Manual)`} sub="Votos digitados" total={total(manual)} data={dataset(manual, orden)} />
        <Panel titulo={`${NIVEL_LABEL[nivel]} (OCR / Foto)`} sub="Votos procesados por imagen" total={total(imagen)} data={dataset(imagen, orden)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-extrabold text-slate-900">Consolidado {NIVEL_LABEL[nivel]}</h3>
            <span className="text-xs text-slate-500">Manual + OCR</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-50 text-emerald-600 font-bold rounded-full px-2.5 py-1">Total de Votos: {granTotal.toLocaleString('es-PE')}</span>
          </div>
        </div>
        {granTotal > 0
          ? <div className="h-60"><Bar data={dataset(consolidado, orden)} options={chartOpts} /></div>
          : <p className="text-sm text-slate-400 text-center py-10">Esperando actas transmitidas para este nivel.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-900 text-sm">Detalle de Partidos — {NIVEL_LABEL[nivel]}</h3>
          <p className="text-xs text-slate-500">Fuente: tabla de candidaturas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left whitespace-nowrap">Símbolo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Partido / Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Total Votos</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">% Participación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orden
                .filter(l => !f.partido || l.partido === f.partido)
                .map(l => ({ l, tot: consolidado[l.partido] ?? 0 }))
                .sort((a, b) => {
                  const aEsp = VOTOS_ESPECIALES.some(e => e.partido === a.l.partido)
                  const bEsp = VOTOS_ESPECIALES.some(e => e.partido === b.l.partido)
                  if (aEsp !== bEsp) return aEsp ? 1 : -1
                  if (aEsp && bEsp) return 0
                  return b.tot - a.tot
                })
                .map(({ l, tot }) => {
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
                      <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{l.nombre ?? l.partido}</td>
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
      </div>
    </section>
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
