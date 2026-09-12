export const VOTOS_ESPECIALES = [
  { partido: 'NULO',      color: '#94a3b8' },
  { partido: 'BLANCO',    color: '#cbd5e1' },
  { partido: 'IMPUGNADO', color: '#f97316' },
]

// Ruta al logo del partido en /public/partidos/<slug>.png (fallback: badge de iniciales)
export function slugPartido(partido: string): string {
  return partido
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
