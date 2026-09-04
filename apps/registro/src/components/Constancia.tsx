/**
 * Constancia de Participación — Somos Perú, Defensores del Voto ERM 2026
 *
 * Renderiza la plantilla oficial (public/constancia-template.jpg) y superpone
 * los datos del personero. Las posiciones son porcentajes sobre el lienzo, así
 * que si la plantilla cambia basta con ajustar las constantes POS.
 */

const TEMPLATE_SRC = '/constancia-template.jpg'

// Relación de aspecto real de la plantilla (ancho / alto): 963 × 692.
const RATIO = '963 / 692'

// Posición vertical (%) de cada bloque sobre el lienzo. Ajustable a ojo.
const POS = {
  nombreTop: 41.5, // el nombre se apoya sobre la línea azul, bajo "Se otorga la presente constancia a:"
  infoTop: 86,      // fila FECHA · CARGO · DISTRITO, bajo el sello inferior
}

interface ConstanciaProps {
  nombre: string
  cargo: string
  distrito: string
  fecha: string // ya formateada, ej. "2 de setiembre de 2026"
}

export default function Constancia({ nombre, cargo, distrito, fecha }: ConstanciaProps) {
  return (
    <div
      className="constancia-lienzo relative w-full bg-white shadow-lg select-none"
      style={{ aspectRatio: RATIO, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <img
        src={TEMPLATE_SRC}
        alt="Constancia de Participación — Somos Perú 2026"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* NOMBRE — sobre la línea azul */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[62%] text-center"
        style={{ top: `${POS.nombreTop}%` }}
      >
        <span
          className="font-extrabold uppercase tracking-wide text-[#1b2a4a] leading-tight"
          style={{ fontSize: 'clamp(13px, 3vw, 30px)' }}
        >
          {nombre || '—'}
        </span>
      </div>

      {/* FECHA · CARGO · DISTRITO */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[80%] flex items-start justify-center gap-[7%] text-center"
        style={{ top: `${POS.infoTop}%` }}
      >
        {[
          { label: 'FECHA', value: fecha },
          { label: 'CARGO', value: cargo },
          { label: 'DISTRITO', value: distrito },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 min-w-0">
            <p
              className="font-bold uppercase text-[#e2001a] tracking-[0.14em]"
              style={{ fontSize: 'clamp(6px, 1vw, 11px)' }}
            >
              {label}
            </p>
            <p
              className="font-semibold text-[#1b2a4a] leading-tight break-words mt-0.5"
              style={{ fontSize: 'clamp(8px, 1.35vw, 14px)' }}
            >
              {value || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
