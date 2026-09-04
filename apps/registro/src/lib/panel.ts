import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
export const claveLocal = (d: string | null | undefined, l: string | null | undefined) => `${norm(d)}||${norm(l)}`

export const ROL_LOCAL = 'Personero de Local de Votación'
export const ROL_MESA = 'Personero de Mesa'
export const ROL_COORD_DIST = 'Coordinador de Distritos'
export const ROL_ZONAL = 'Coordinador Provincial'

export interface Colegio {
  id: string; nombre: string; distrito: string | null
  direccion: string | null; total_mesas: number | null; electores: number | null
}
export interface Perfil {
  id: string; nombre_completo: string; dni: string | null; celular: string | null; rol: string
  distrito_asignado: string | null; distrito_vota: string | null
  local_asignado: string | null; local_votacion: string | null
  credencial_estado: string | null; quiz_estado: string | null
  tiene_experiencia: boolean | null; cuenta_movilidad: boolean | null; se_compromete: boolean | null
  videos_vistos: number | null; pdfs_vistos: number | null
}

export interface Persona { nombre: string; dni: string | null; celular: string | null }
export interface CentroFila extends Colegio {
  pcv: Persona | null
  zonal: (Persona & { distrito: string | null; nColegios: number }) | null
  nPersoneros: number
  cobertura: number
}
export interface ZonaGrupo {
  zonal: Persona
  distrito: string | null
  centros: CentroFila[]
}

async function traerTodo<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const paso = 1000
  let out: T[] = []
  for (let from = 0; ; from += paso) {
    const { data, error } = await build(from, from + paso - 1)
    if (error) { console.error(error.message); break }
    out = out.concat((data ?? []) as T[])
    if (!data || data.length < paso) break
  }
  return out
}

export interface PanelData {
  loading: boolean
  colegios: Colegio[]
  perfiles: Perfil[]
  coordsDistritales: (Perfil & { acreditado: boolean })[]
  zonales: Perfil[]
  centros: CentroFila[]            // solo centros con alguna asignación (PCV / personeros / zonal)
  zonas: ZonaGrupo[]               // grupos multi-colegio (zonal con >1 colegio)
  sinZonal: CentroFila[]           // centros con asignación pero sin zonal
  kpis: { personerosMesa: number; centros: number; centrosConPCV: number; coordDistritales: number; zonales: number }
}

export function usePanelData(scope?: { departamento?: string; provincia?: string }): PanelData {
  const dep = scope?.departamento || 'Lima'
  const prov = scope?.provincia || 'Lima'
  const [d, setD] = useState<PanelData>({
    loading: true, colegios: [], perfiles: [], coordsDistritales: [], zonales: [],
    centros: [], zonas: [], sinZonal: [],
    kpis: { personerosMesa: 0, centros: 0, centrosConPCV: 0, coordDistritales: 0, zonales: 0 },
  })

  useEffect(() => {
    let vivo = true
    setD(prev => ({ ...prev, loading: true }))
    ;(async () => {
      const [colegios, perfiles] = await Promise.all([
        traerTodo<Colegio>((f, t) => {
          let cq = supabase.from('colegios')
            .select('id, nombre, distrito, direccion, total_mesas, electores')
            .eq('departamento', dep).order('distrito').order('nombre').range(f, t)
          if (prov) cq = cq.eq('provincia', prov)
          return cq
        }),
        traerTodo<Perfil>((f, t) => supabase.from('profiles')
          .select('id, nombre_completo, dni, celular, rol, distrito_asignado, distrito_vota, local_asignado, local_votacion, credencial_estado, quiz_estado, tiene_experiencia, cuenta_movilidad, se_compromete, videos_vistos, pdfs_vistos')
          .order('nombre_completo').range(f, t)),
      ])
      if (!vivo) return

      const acreditado = (p: Perfil) => p.credencial_estado === 'Confirmado' || p.quiz_estado === 'Aprobado'
      const coordsDistritales = perfiles.filter(p => p.rol === ROL_COORD_DIST)
        .map(p => ({ ...p, acreditado: acreditado(p) }))
        .sort((a, b) => (a.distrito_asignado ?? '').localeCompare(b.distrito_asignado ?? '', 'es'))
      const zonales = perfiles.filter(p => p.rol === ROL_ZONAL)

      // PCV y conteo de personeros por (distrito+colegio)
      const pcvMap = new Map<string, Persona>()
      const persMap = new Map<string, number>()
      for (const p of perfiles) {
        if (p.rol === ROL_LOCAL) {
          const k = claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion)
          if (!k.endsWith('||') && !pcvMap.has(k)) pcvMap.set(k, { nombre: p.nombre_completo, dni: p.dni, celular: p.celular })
        } else if (p.rol === ROL_MESA) {
          const k = claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion)
          if (!k.endsWith('||')) persMap.set(k, (persMap.get(k) ?? 0) + 1)
        }
      }

      // Zonal: Coordinador Provincial. local_asignado = lista de colegios separada por coma.
      // key = claveLocal(distrito_asignado del zonal, nombre de colegio de su lista)
      const zonalMap = new Map<string, Persona & { distrito: string | null; nColegios: number }>()
      for (const z of zonales) {
        const lista = String(z.local_asignado ?? '').split(',').map(s => s.trim()).filter(Boolean)
        if (!lista.length) continue
        for (const nom of lista) {
          const k = claveLocal(z.distrito_asignado || z.distrito_vota, nom)
          if (!k.endsWith('||') && !zonalMap.has(k))
            zonalMap.set(k, { nombre: z.nombre_completo, dni: z.dni, celular: z.celular, distrito: z.distrito_asignado, nColegios: lista.length })
        }
      }

      const todasFilas: CentroFila[] = colegios.map(c => {
        const k = claveLocal(c.distrito, c.nombre)
        const nP = persMap.get(k) ?? 0
        const tm = c.total_mesas ?? 0
        return {
          ...c,
          pcv: pcvMap.get(k) ?? null,
          zonal: zonalMap.get(k) ?? null,
          nPersoneros: nP,
          cobertura: tm ? Math.round((nP / tm) * 100) : 0,
        }
      })
      const centros = todasFilas.filter(c => c.pcv || c.nPersoneros > 0 || c.zonal)

      // Agrupar por zonal multi-colegio
      const grupos = new Map<string, ZonaGrupo>()
      const sinZonal: CentroFila[] = []
      for (const c of centros) {
        if (c.zonal && c.zonal.nColegios > 1) {
          const key = c.zonal.nombre + '|' + (c.zonal.dni ?? '')
          if (!grupos.has(key)) grupos.set(key, {
            zonal: { nombre: c.zonal.nombre, dni: c.zonal.dni, celular: c.zonal.celular },
            distrito: c.zonal.distrito, centros: [],
          })
          grupos.get(key)!.centros.push(c)
        } else {
          sinZonal.push(c) // incluye "únicos" (zonal con 1 colegio) y sin zonal
        }
      }
      const zonas = [...grupos.values()].sort((a, b) => b.centros.length - a.centros.length)

      setD({
        loading: false, colegios, perfiles, coordsDistritales, zonales,
        centros, zonas, sinZonal,
        kpis: {
          personerosMesa: perfiles.filter(p => p.rol === ROL_MESA).length,
          centros: centros.length,
          centrosConPCV: centros.filter(c => c.pcv).length,
          coordDistritales: coordsDistritales.length,
          zonales: zonales.length,
        },
      })
    })()
    return () => { vivo = false }
  }, [dep, prov])

  return d
}
