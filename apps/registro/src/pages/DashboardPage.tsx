import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { AdminCtx } from '../components/Layout'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js'
import * as XLSX from 'xlsx'
import { Users, UserCheck, Target, Award, BookOpen, FileCheck, Download } from 'lucide-react'

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

interface CentroCount { centro: string; count: number }

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
  const { esCoordRegional, departamento } = useOutletContext<AdminCtx>()
  const [stats, setStats] = useState<Stats | null>(null)
  const [porCentro, setPorCentro] = useState<CentroCount[]>([])
  const [loading, setLoading] = useState(true)
  const [perfiles, setPerfiles] = useState<any[]>([])

  useEffect(() => {
    const fetch = async () => {
      // Paginado: Supabase corta cada consulta en 1000 filas y VES ya tiene más.
      const profiles: any[] = []
      for (let desde = 0; ; desde += 1000) {
        let pq = supabase.from('profiles')
          .select('nombre_completo, dni, celular, rol, quiz_estado, videos_vistos, pdfs_vistos, credencial_estado, distrito_asignado, local_asignado, local_votacion, mesa_asignada, acta_transmitida, departamento_asignado, departamento_vota')
          .order('nombre_completo').order('id').range(desde, desde + 999)
        if (esCoordRegional && departamento) pq = pq.or(`departamento_asignado.eq.${departamento},departamento_vota.eq.${departamento}`)
        const { data } = await pq
        profiles.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      setPerfiles(profiles)

      if (profiles.length) {
        const personeros   = profiles.filter(p => p.rol === 'Personero de Mesa' || p.rol === 'Personero de Centro de Votación' || p.rol === 'Personero de Local de Votación').length
        const coordinadores = profiles.filter(p => p.rol?.includes('Coordinador')).length
        const credenciales = profiles.filter(p => p.credencial_estado === 'Confirmado').length
        const quizAprobados = profiles.filter(p => p.quiz_estado === 'Aprobado').length
        const videosOk = profiles.reduce((a, p) => a + (p.videos_vistos >= 1 ? 1 : 0), 0)
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

        // Cada instancia opera UN solo distrito, así que se desglosa por Centro de
        // Votación (todos, no un top: el gráfico se desplaza si son muchos).
        const byCentro: Record<string, number> = {}
        profiles.forEach(p => {
          // Coordinadores pueden traer varios colegios ("A | B"): se cuentan una sola vez, en el primero.
          const c = String(p.local_asignado || p.local_votacion || '').split(/[,|]/)[0].trim()
          if (c) byCentro[c] = (byCentro[c] || 0) + 1
        })
        setPorCentro(
          Object.entries(byCentro)
            .map(([centro, count]) => ({ centro, count }))
            .sort((a, b) => b.count - a.count || a.centro.localeCompare(b.centro, 'es'))
        )
      }
      setLoading(false)
    }
    fetch()
  }, [esCoordRegional, departamento])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const centroDe = (p: any) => String(p.local_asignado || p.local_votacion || '').trim()
  const descargarExcel = () => {
    const filas = [...perfiles]
      .sort((a, b) => centroDe(a).localeCompare(centroDe(b), 'es') || String(a.mesa_asignada ?? '').localeCompare(String(b.mesa_asignada ?? '')))
      .map(p => ({
        'Centro de Votación': centroDe(p),
        'Mesa Designada': p.mesa_asignada ?? '',
        Nombre: p.nombre_completo, DNI: p.dni ?? '', Celular: p.celular ?? '', Rol: p.rol,
        Distrito: p.distrito_asignado ?? '',
        Capacitación: p.quiz_estado === 'Aprobado' ? 'Aprobado' : 'Pendiente',
        Credencial: p.credencial_estado ?? 'Pendiente',
        'Acta transmitida': p.acta_transmitida ? 'Sí' : 'No',
      }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Personeros')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porCentro.map(c => ({ 'Centro de Votación': c.centro, Personeros: c.count }))), 'Por Centro de Votación')
    XLSX.writeFile(wb, `SomosPeru_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const chartData = {
    labels: porCentro.map(d => d.centro.length > 34 ? d.centro.slice(0, 33) + '…' : d.centro),
    datasets: [{
      label: 'Personeros',
      data: porCentro.map(d => d.count),
      backgroundColor: '#E8534A99',
      borderColor: '#E8534A',
      borderWidth: 1,
      borderRadius: 6,
    }],
  }

  const chartOpts: any = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: (items: any[]) => porCentro[items[0].dataIndex].centro } },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ffffff60', precision: 0 } },
      y: { grid: { display: false }, ticks: { color: '#ffffffa0', font: { size: 10 }, autoSkip: false } },
    },
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Panel de Control</p>
        <h1 className="text-white text-2xl font-bold">Dashboard Electoral</h1>
        <p className="text-white/40 text-sm mt-1">
          Avance meta total — Elecciones Regionales y Municipales 2026
          {esCoordRegional && departamento && <> · <span className="text-white/70 font-semibold">{departamento}</span></>}
        </p>
      </div>
        <button onClick={descargarExcel} disabled={!perfiles.length}
          className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3 py-2 flex items-center gap-1.5">
          <Download size={13} /> Descargar Excel
        </button>
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

      {/* Gráfica por centro de votación */}
      {porCentro.length > 0 && (
        <div className="bg-[#16162a] border border-white/8 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Personeros por Centro de Votación ({porCentro.length})</h2>
          <div className="max-h-[32rem] overflow-y-auto pr-1">
            <div style={{ height: Math.max(240, porCentro.length * 22 + 30) }}>
              <Bar data={chartData} options={chartOpts} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
