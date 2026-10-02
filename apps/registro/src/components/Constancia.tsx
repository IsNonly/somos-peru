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

// Posición vertical (%) de cada bloque sobre el lienzo.
const POS = {
  // La línea azul del nombre está al 45.5% de la altura (medido en la plantilla).
  // El nombre se ancla por ABAJO justo encima de ella: así, sea cual sea el
  // tamaño de letra, nunca la cruza (antes se anclaba por arriba y un nombre
  // grande bajaba hasta quedar tachado por la línea).
  nombreBottom: 55.2,
  infoTop: 87.5,    // fila FECHA · CARGO · DISTRITO, bajo el sello inferior (sin tocarlo)
}

// Las medidas son relativas al ANCHO DE LA CONSTANCIA (unidades cqw del
// contenedor), no al de la pantalla: en celular la constancia es angosta y los
// tamaños en px/vw hacían que un nombre largo se saliera por los costados.
const ANCHO_NOMBRE = 56      // % del ancho para el nombre: no debe tocar la columna izquierda (VIGILAMOS…)
const NOMBRE_MAX = 3.2       // tamaño máximo (en % del ancho) para nombres cortos
const EM_POR_LETRA = 0.74    // ancho aprox. de una mayúscula en negrita con tracking
const usaCqw = typeof CSS !== 'undefined' && CSS.supports?.('width: 1cqw')
const u = usaCqw ? 'cqw' : 'vw' // navegadores muy viejos: aproximación por pantalla

interface ConstanciaProps {
  nombre: string
  cargo: string
  distrito: string
  fecha: string // ya formateada, ej. "2 de setiembre de 2026"
}

// Tamaño del nombre para que SIEMPRE entre en una sola línea dentro de la
// columna central: los cortos van grandes y los largos se achican lo justo.
function tamanoNombre(nombre: string): string {
  const len = Math.max(1, (nombre || '').trim().length)
  const ajuste = ANCHO_NOMBRE / (len * EM_POR_LETRA)
  return `${Math.min(NOMBRE_MAX, ajuste).toFixed(2)}${u}`
}

export default function Constancia({ nombre, cargo, distrito, fecha }: ConstanciaProps) {
  return (
    <div
      className="constancia-lienzo relative w-full bg-white shadow-lg select-none"
      style={{ aspectRatio: RATIO, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', containerType: 'inline-size' }}
    >
      <img
        src={TEMPLATE_SRC}
        alt="Constancia de Participación — Somos Perú 2026"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* NOMBRE — apoyado sobre la línea azul, en una sola línea (ver tamanoNombre) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center"
        style={{ bottom: `${POS.nombreBottom}%`, width: `${ANCHO_NOMBRE}%` }}
      >
        <span
          className="block whitespace-nowrap font-extrabold uppercase tracking-wide text-[#1b2a4a] leading-none"
          style={{ fontSize: tamanoNombre(nombre) }}
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
              style={{ fontSize: `1.05${u}` }}
            >
              {label}
            </p>
            <p
              className="font-semibold text-[#1b2a4a] leading-tight break-words mt-0.5"
              style={{ fontSize: `1.45${u}` }}
            >
              {value || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
