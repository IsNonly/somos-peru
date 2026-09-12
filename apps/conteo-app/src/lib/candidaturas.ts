// ────────────────────────────────────────────────────────────────────────────
// Candidaturas por ámbito, leídas de la BD (tabla `candidaturas`).
//
// Sustituye a las listas hardcodeadas que vivían en supabase.ts.
// Cada personero ve SOLO las listas de su departamento / provincia / distrito,
// en los 3 niveles de la ERM 2026:
//   REGIONAL   -> Gobernador Regional
//   PROVINCIAL -> Alcalde Provincial
//   DISTRITAL  -> Alcalde Distrital
// ────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import type { Candidato } from './supabase'

export type NivelCandidatura = 'REGIONAL' | 'PROVINCIAL' | 'DISTRITAL'

export interface Ambito {
  departamento: string | null
  provincia: string | null
  distrito: string | null
}

export interface BloqueCandidaturas {
  nivel: NivelCandidatura
  titulo: string
  candidatos: Candidato[]
  provisional: boolean   // hay listas sin data oficial cargada (fuente = plantilla)
}

export interface Candidaturas {
  ambito: Ambito
  bloques: BloqueCandidaturas[]   // solo los niveles que tienen listas
}

interface FilaCandidatura {
  id: number
  nivel: NivelCandidatura
  partido: string
  candidato: string | null
  sigla: string | null
  color: string | null
  orden: number | null
  fuente: string | null
  provincia: string | null
  distrito: string | null
}

// Iniciales de respaldo cuando la fila no trae `sigla`
function inicialesPartido(partido: string): string {
  const stop = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'por', 'para'])
  const palabras = partido.replace(/[()]/g, '').split(/\s+/).filter(w => !stop.has(w.toLowerCase()))
  return (palabras.slice(0, 3).map(w => w[0]).join('') || partido.slice(0, 3)).toUpperCase()
}

function aCandidato(f: FilaCandidatura): Candidato {
  return {
    id: `cand_${f.id}`,
    nombre: f.candidato ?? '',
    partido: f.partido,
    color: f.color || '#6B7280',
    letra: (f.sigla || inicialesPartido(f.partido)).slice(0, 4),
  }
}

// ── Resolver el ámbito (dep/prov/dist) del personero ───────────────────────
// Usa la asignación de trabajo; cae al lugar donde vota; completa dep/prov
// faltantes desde `colegios` a partir del distrito.
export async function resolverAmbito(perfil: any): Promise<Ambito> {
  let departamento = perfil?.departamento_asignado ?? perfil?.departamento_vota ?? null
  let provincia = perfil?.provincia_asignado ?? perfil?.provincia_vota ?? null
  const distrito = perfil?.distrito_asignado ?? perfil?.distrito_vota ?? null

  if (distrito && (!departamento || !provincia)) {
    const { data } = await supabase
      .from('colegios')
      .select('departamento, provincia')
      .eq('distrito', distrito)
      .not('departamento', 'is', null)
      .limit(50)
    if (data && data.length) {
      // Preferir Tumbes si el mismo nombre de distrito se repite entre departamentos
      const tumbes = data.find(d => d.departamento === 'Tumbes')
      const elegido = tumbes ?? data[0]
      departamento = departamento ?? elegido.departamento
      provincia = provincia ?? elegido.provincia
    }
  }
  return { departamento, provincia, distrito }
}

const TITULOS: Record<NivelCandidatura, (a: Ambito) => string> = {
  REGIONAL: a => `Gobernador Regional${a.departamento ? ` — ${a.departamento}` : ''}`,
  PROVINCIAL: a => `Alcaldía Provincial${a.provincia ? ` — ${a.provincia}` : ''}`,
  DISTRITAL: a => `Alcaldía Distrital${a.distrito ? ` — ${a.distrito}` : ''}`,
}

// ── Cargar las candidaturas del ámbito ─────────────────────────────────────
export async function getCandidaturas(perfil: any): Promise<Candidaturas> {
  const ambito = await resolverAmbito(perfil)
  if (!ambito.departamento) return { ambito, bloques: [] }

  // Un solo roundtrip: todas las listas activas del departamento; se agrupan
  // por nivel en cliente usando provincia/distrito de cada fila.
  const { data, error } = await supabase
    .from('candidaturas')
    .select('id, nivel, partido, candidato, sigla, color, orden, fuente, provincia, distrito')
    .eq('activo', true)
    .eq('departamento', ambito.departamento)
    .order('orden', { ascending: true })
    .order('partido', { ascending: true })

  if (error || !data) return { ambito, bloques: [] }
  const rows = data as FilaCandidatura[]

  // Comparación de provincia/distrito tolerante a tildes y mayúsculas:
  // `colegios` (de CALI.xlsx) no lleva tildes en vocales, la data de ONPE sí.
  const norm = (s?: string | null) =>
    (s ?? '').normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase().trim()
  const provOK = (r: FilaCandidatura) => !ambito.provincia || norm(r.provincia) === norm(ambito.provincia)
  const distOK = (r: FilaCandidatura) => !ambito.distrito || norm(r.distrito) === norm(ambito.distrito)

  const bloques: BloqueCandidaturas[] = []
  const agregar = (nivel: NivelCandidatura, pred: (r: FilaCandidatura) => boolean) => {
    const fs = rows.filter(r => r.nivel === nivel && pred(r))
    if (!fs.length) return
    bloques.push({
      nivel,
      titulo: TITULOS[nivel](ambito),
      candidatos: fs.map(aCandidato),
      provisional: fs.some(r => {
        const f = (r.fuente ?? '')
        return f.startsWith('plantilla') || f.includes('VALIDAR')
      }),
    })
  }

  agregar('REGIONAL', () => true)
  agregar('PROVINCIAL', provOK)
  agregar('DISTRITAL', r => provOK(r) && distOK(r))

  return { ambito, bloques }
}
