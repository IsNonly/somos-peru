import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js'
import { Users, UserCheck, Target, Award, BookOpen, FileCheck } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface Stats {
  total_personeros: number
  total_coordinadores: number
  total_registros: number
  credenciales_emitidas: number
  quiz_aprobados: number
  videos_completados: number
  pdfs_completados: number
  actas_transmitidas: number
}

interface DistritoCount { distrito_asignado: string; count: number }

const KPI = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) => (
  <div className="bg-[#16162a] border border-white/8 rounded-2xl p-5">
    <div className={`inline-flex w-10 h-10 items-center justify-center rounded-xl mb-3`} style={{ background: color + '20' }}>
      <Icon size={20} style={{ color }} strokeWidth={1.8} />
    </div>
    <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{label}</p>
    <p className="text-white text-2xl font-bold tabular-nums">{value}</p>
  </div>
)

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [distDist, setDistDist] = useState<DistritoCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [{ data: profiles }, { data: metas }] = await Promise.all([
        supabase.from('profiles').select('rol, quiz_estado, videos_vistos, pdfs_vistos, credencial_estado, distrito_asignado, acta_transmitida'),
        supabase.from('distritos').select('nombre, meta_mesas'),
      ])

      if (profiles) {
        const personeros   = profiles.filter(p => p.rol === 'Personero de Mesa' || p.rol === 'Personero de Centro de Votación' || p.rol === 'Personero de Local de Votación').length
        const coordinadores = profiles.filter(p => p.rol?.includes('Coordinador')).length
        const credenciales = profiles.filter(p => p.credencial_estado === 'Confirmado').length
        const quizAprobados = profiles.filter(p => p.quiz_estado === 'Aprobado').length
        const videosOk = profiles.reduce((a, p) => a + (p.videos_vistos >= 2 ? 1 : 0), 0)
        const pdfsOk   = profiles.reduce((a, p) => a + (p.pdfs_vistos >= 1 ? 1 : 0), 0)
        const actas    = profiles.filter(p => p.acta_transmitida).length

        setStats({
          total_personeros: personeros,
          total_coordinadores: coordinadores,
          total_registros: profiles.length,
          credenciales_emitidas: credenciales,
          quiz_aprobados: quizAprobados,
          videos_completados: videosOk,
          pdfs_completados: pdfsOk,
          actas_transmitidas: actas,
        })

        const byDist: Record<string, number> = {}
        profiles.forEach(p => {
          if (p.distrito_asignado) byDist[p.distrito_asignado] = (byDist[p.distrito_asignado] || 0) + 1
        })
        setDistDist(
          Object.entries(byDist)
            .map(([distrito_asignado, count]) => ({ distrito_asignado, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
        )
      }
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const chartData = {
    labels: distDist.map(d => d.distrito_asignado.replace('Distrito', 'D.')),
    datasets: [{
      label: 'Personeros',
      data: distDist.map(d => d.count),
      backgroundColor: '#E8534A99',
      borderColor: '#E8534A',
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const chartOpts: any = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ffffff60', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ffffff60' } },
    },
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Panel de Control</p>
        <h1 className="text-white text-2xl font-bold">Dashboard Electoral</h1>
        <p className="text-white/40 text-sm mt-1">Avance meta total — Elecciones Regionales y Municipales 2026</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Users}     label="Personeros"         value={stats?.total_personeros ?? 0}    color="#E8534A" />
        <KPI icon={UserCheck} label="Coordinadores"       value={stats?.total_coordinadores ?? 0}  color="#F59E0B" />
        <KPI icon={Target}    label="Total registros"     value={stats?.total_registros ?? 0}      color="#10B981" />
        <KPI icon={Award}     label="Credenciales"        value={stats?.credenciales_emitidas ?? 0} color="#8B5CF6" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={BookOpen}  label="Videos completados"  value={stats?.videos_completados ?? 0}   color="#06B6D4" />
        <KPI icon={FileCheck} label="PDFs completados"    value={stats?.pdfs_completados ?? 0}     color="#84CC16" />
        <KPI icon={UserCheck} label="Quiz aprobados"      value={stats?.quiz_aprobados ?? 0}       color="#F472B6" />
        <KPI icon={Target}    label="Actas transmitidas"  value={stats?.actas_transmitidas ?? 0}   color="#FB923C" />
      </div>

      {/* Gráfica por distrito */}
      {distDist.length > 0 && (
        <div className="bg-[#16162a] border border-white/8 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Distribución por Distrito</h2>
          <Bar data={chartData} options={chartOpts} />
        </div>
      )}

      {/* Meta coverage */}
      <div className="bg-[#16162a] border border-white/8 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-1">Cobertura de Mesas</h2>
        <p className="text-white/40 text-xs mb-4">Total meta Lima Metropolitana: 29,121 mesas</p>
        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-brand-red rounded-full transition-all"
            style={{ width: `${Math.min(((stats?.total_personeros ?? 0) / 29121) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-white/40 text-xs">{stats?.total_personeros ?? 0} cubiertas</span>
          <span className="text-white/40 text-xs">{((stats?.total_personeros ?? 0) / 291.21).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
