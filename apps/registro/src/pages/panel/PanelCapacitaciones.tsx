import { GraduationCap } from 'lucide-react'

export default function PanelCapacitaciones() {
  return (
    <div className="max-w-3xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <GraduationCap size={32} className="mx-auto text-sky-500 mb-3" />
        <h2 className="text-lg font-extrabold text-slate-900">Progreso de Capacitaciones</h2>
        <p className="text-sm text-slate-500 mt-1">
          Esta vista (KPIs, dona de credenciales, barras Videos vs PDF y tabla con recordatorio por WhatsApp)
          se construye en el siguiente paso. Ya está listo el "Panel General".
        </p>
      </div>
    </div>
  )
}
