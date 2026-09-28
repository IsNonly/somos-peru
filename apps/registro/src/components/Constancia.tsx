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

// El espacio entre la línea azul y el párrafo "Por su participación..." es
// angosto: un nombre largo en 2 líneas se monta sobre ambos. Se reduce el
// tamaño de letra según el largo del nombre para que entre en una sola línea
// (con clamp() sigue siendo responsivo al ancho de pantalla).
function tamanoNombre(nombre: string): { min: number; pref: number; max: number } {
  const len = (nombre || '').trim().length
  if (len <= 18) return { min: 13, pref: 3.0, max: 30 }
  if (len <= 24) return { min: 12, pref: 2.6, max: 26 }
  if (len <= 30) return { min: 11, pref: 2.2, max: 22 }
  if (len <= 36) return { min: 10, pref: 1.9, max: 19 }
  if (len <= 44) return { min: 9, pref: 1.6, max: 16 }
  return { min: 8, pref: 1.3, max: 13 }
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

      {/* NOMBRE — sobre la línea azul, en una sola línea (ver tamanoNombre) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[68%] text-center"
        style={{ top: `${POS.nombreTop}%` }}
      >
        <span
          className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-extrabold uppercase tracking-wide text-[#1b2a4a] leading-tight"
          style={(({ min, pref, max }) => ({ fontSize: `clamp(${min}px, ${pref}vw, ${max}px)` }))(tamanoNombre(nombre))}
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
