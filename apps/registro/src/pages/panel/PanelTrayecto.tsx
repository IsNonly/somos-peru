import { Navigation } from 'lucide-react'

export default function PanelTrayecto() {
  return (
    <div className="max-w-3xl">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <Navigation size={32} className="mx-auto text-sky-500 mb-3" />
        <h2 className="text-lg font-extrabold text-slate-900">Trayecto y Desplazamiento</h2>
        <p className="text-sm text-slate-500 mt-1">
          El mapa de rutas (lugar de votación → centro asignado, distancia y tiempo, enlace a Google Maps)
          se construye en el siguiente paso. Requiere cargar lat/lng de los colegios (hoy están vacías en la base).
        </p>
      </div>
    </div>
  )
}
