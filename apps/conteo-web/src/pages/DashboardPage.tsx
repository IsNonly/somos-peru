import { useEffect, useState, useCallback } from 'react'
import { supabase, DISTRITOS_META, colorPartido } from '../lib/supabase'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Activity, CheckSquare, Clock, Award, RefreshCw, ShieldCheck, TrendingUp, Landmark } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

interface Resultado { distrito: string; nivel: string; partido: string; total_votos: number; mesas_con_reporte: number }

const KPI = ({ icon: Icon, label, value, sub, color, trend }: any) => (
  <div className="bg-[#121224]/90 border border-white/10 rounded-2xl p-5 relative overflow-hidden backdrop-blur-md hover:border-white/20 transition-all shadow-xl group">
    <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity" style={{ background: color }} />
    <div className="flex items-center justify-between mb-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10" style={{ background: `${color}15` }}>
        <Icon size={20} style={{ color }} strokeWidth={2} />
      </div>
      {trend && (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <TrendingUp size={12} /> {trend}
        </span>
      )}
    </div>
    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">{label}</p>
    <p className="text-white text-3xl font-extrabold tabular-nums mt-1">{value}</p>
    {sub && <p className="text-white/40 text-xs mt-1 font-medium">{sub}</p>}
  </div>
)

export default function DashboardPage() {
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [totalMetas] = useState(29121)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('vista_resultados').select('*')
    setResultados((data ?? []) as Resultado[])
    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // Realtime: suscripción a nuevos votos
    const channel = supabase.channel('votos-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const mesasConReporte = [...new Set(resultados.map(r => r.mesas_con_reporte))].reduce((a, b) => a + b, 0)
  const distritosConReporte = [...new Set(resultados.map(r => r.distrito))].length
  const pctAvance = ((mesasConReporte / totalMetas) * 100).toFixed(2)

  // Top 5 partidos provinciales
  const topPartidos = Object.entries(
    resultados.filter(r => r.nivel === 'PROVINCIAL').reduce((acc, r) => {
      acc[r.partido] = (acc[r.partido] || 0) + r.total_votos
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const lider = topPartidos[0]

  const barData = {
    labels: topPartidos.map(([p]) => p.replace('Alianza para el Progreso', 'APP').replace('Partido Aprista Peruano', 'APRA').replace('Somos Perú', 'SP').replace('Acción Popular', 'AP')),
    datasets: [{
      data: topPartidos.map(([, v]) => v),
      backgroundColor: topPartidos.map(([p]) => colorPartido(p) + '99'),
      borderColor:     topPartidos.map(([p]) => colorPartido(p)),
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const doughnutData = topPartidos.length ? {
    labels: topPartidos.map(([p]) => p),
    datasets: [{
      data: topPartidos.map(([, v]) => v),
      backgroundColor: topPartidos.map(([p]) => colorPartido(p) + 'CC'),
      borderColor: '#16162a',
      borderWidth: 2,
    }],
  } : null

  const chartOpts: any = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#ffffff08' }, ticks: { color: '#ffffff50', font: { size: 10 } } },
      y: { grid: { color: '#ffffff08' }, ticks: { color: '#ffffff50' } },
    },
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Tiempo Real</p>
          <h1 className="text-white text-2xl font-bold">Dashboard Electoral</h1>
          <p className="text-white/30 text-xs mt-1">
            Última actualización: {lastUpdate.toLocaleTimeString('es-PE')}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#16162a] border border-white/8 hover:bg-white/5 text-white/60 rounded-xl text-sm transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={CheckSquare} label="Mesas aperturadas" value={mesasConReporte.toLocaleString()} sub={`de ${totalMetas.toLocaleString()}`} color="#E8534A" />
        <KPI icon={Activity}   label="Avance"             value={`${pctAvance}%`}                   sub="del total Lima"                         color="#10B981" />
        <KPI icon={Award}      label="Distritos"           value={distritosConReporte}                sub="con reporte"                            color="#F59E0B" />
        <KPI icon={Clock}      label="Partido líder"       value={lider?.[0] ?? '—'}                 sub={lider ? `${lider[1].toLocaleString()} votos` : ''} color={lider ? colorPartido(lider[0]) : '#6B7280'} />
      </div>

      {/* Barra de avance */}
      <div className="bg-[#16162a] border border-white/8 rounded-2xl p-5">
        <div className="flex justify-between mb-3">
          <p className="text-white font-semibold">Proporción de mesas aperturadas</p>
          <span className="text-brand-red font-bold">{pctAvance}%</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-brand-red rounded-full transition-all duration-700"
            style={{ width: `${Math.min(parseFloat(pctAvance), 100)}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-white/30">
          <span>{mesasConReporte.toLocaleString()} aperturadas</span>
          <span>{(totalMetas - mesasConReporte).toLocaleString()} pendientes</span>
        </div>
      </div>

      {/* Gráficos */}
      {topPartidos.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-[#16162a] border border-white/8 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">Votos Provinciales por Partido</h2>
            <Bar data={barData} options={chartOpts} />
          </div>
          <div className="bg-[#16162a] border border-white/8 rounded-2xl p-5 flex flex-col">
            <h2 className="text-white font-semibold mb-4">Distribución</h2>
            {doughnutData && (
              <div className="flex-1 flex items-center justify-center">
                <Doughnut data={doughnutData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
              </div>
            )}
          </div>
        </div>
      )}

      {topPartidos.length === 0 && !loading && (
        <div className="text-center py-16 text-white/30 text-sm">
          Esperando actas transmitidas…
        </div>
      )}
    </div>
  )
}
