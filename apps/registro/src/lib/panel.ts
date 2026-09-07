import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
export const claveLocal = (d: string | null | undefined, l: string | null | undefined) => `${norm(d)}||${norm(l)}`

export const ROL_LOCAL = 'Personero de Centro de Votación'
export const ROL_MESA = 'Personero de Mesa'
export const ROL_COORD_DIST = 'Coordinador Distrital'
export const ROL_ZONAL = 'Coordinador Provincial'

// El padrón (PADRON_SOMOSPERU.xlsx) trae varios nombres para el mismo rol.
// Normalizamos a los 4 canónicos + Administrador.
//
// "Coordinador Zonal" = "Coordinador Distrital" = "Coordinador de Distritos": supervisa
// los colegios que le fueron asignados (uno o varios) dentro de UN distrito. En el padrón
// real, quienes traen "Coordinador Zonal" son justamente los que tienen listas largas de
// colegios en `local_asignado` — es el mismo rol, solo con otro nombre.
// "Coordinador Provincial" es un rol aparte y más amplio (ve TODA la provincia); no se toca.
// "Personero de Centro de Votación" (antes "Coordinador de Local", y luego "Personero de
// Local de Votación") es el nombre oficial actual; los perfiles ya importados pueden seguir
// teniendo cualquiera de los 2 nombres viejos hasta que corra la migración de BD.
export function rolNorm(rol: string | null | undefined): string {
  const r = norm(rol)
  if (r === 'PERSONERO DE MESA') return ROL_MESA
  if (r === 'COORDINADOR DE LOCAL' || r === 'PERSONERO DE LOCAL DE VOTACION' || r === 'PERSONERO DE CENTRO DE VOTACION') return ROL_LOCAL
  if (r === 'COORDINADOR PROVINCIAL') return ROL_ZONAL
  if (r === 'COORDINADOR DISTRITAL' || r === 'COORDINADOR DE DISTRITOS' || r === 'COORDINADOR ZONAL') return ROL_COORD_DIST
  if (r.includes('ADMINISTRADOR')) return 'Administrador General'
  return rol ?? ''
}

export interface Colegio {
  id: string; nombre: string; distrito: string | null
  direccion: string | null; total_mesas: number | null; electores: number | null
}
export interface Perfil {
  id: string; nombre_completo: string; dni: string | null; celular: string | null; rol: string
  distrito_asignado: string | null; distrito_vota: string | null
  local_asignado: string | null; local_votacion: string | null
  mesa_asignada: string | null
  credencial_estado: string | null; quiz_estado: string | null
  tiene_experiencia: boolean | null; cuenta_movilidad: boolean | null; se_compromete: boolean | null
  videos_vistos: number | null; pdfs_vistos: number | null
  modificado_por: string | null; modificado_at: string | null
}

export interface Persona { nombre: string; dni: string | null; celular: string | null }
export interface CentroFila extends Colegio {
  pcv: Persona | null
  zonal: (Persona & { distrito: string | null; nColegios: number; lista: string[] }) | null
  personeros: Persona[]     // personeros de mesa inscritos en este centro
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

export function usePanelData(scope?: { departamento?: string; provincia?: string; distritos?: string[] | null }): PanelData & { refetch: () => void } {
  const dep = scope?.departamento || 'Lima'
  const prov = scope?.provincia || 'Lima'
  const distritos = scope?.distritos ?? null
  const [d, setD] = useState<PanelData>({
    loading: true, colegios: [], perfiles: [], coordsDistritales: [], zonales: [],
    centros: [], zonas: [], sinZonal: [],
    kpis: { personerosMesa: 0, centros: 0, centrosConPCV: 0, coordDistritales: 0, zonales: 0 },
  })

  const [reloadKey, setReloadKey] = useState(0)

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
          if (distritos) cq = cq.in('distrito', distritos)
          return cq
        }),
        traerTodo<Perfil>((f, t) => {
          let pq = supabase.from('profiles')
            .select('id, nombre_completo, dni, celular, rol, distrito_asignado, distrito_vota, local_asignado, local_votacion, mesa_asignada, credencial_estado, quiz_estado, tiene_experiencia, cuenta_movilidad, se_compromete, videos_vistos, pdfs_vistos, modificado_por, modificado_at')
            .order('nombre_completo').range(f, t)
          if (distritos) pq = pq.in('distrito_asignado', distritos)
          return pq
        }),
      ])
      if (!vivo) return

      const acreditado = (p: Perfil) => p.credencial_estado === 'Confirmado' || p.quiz_estado === 'Aprobado'
      const coordsDistritales = perfiles.filter(p => rolNorm(p.rol) === ROL_COORD_DIST)
        .map(p => ({ ...p, acreditado: acreditado(p) }))
        .sort((a, b) => (a.distrito_asignado ?? '').localeCompare(b.distrito_asignado ?? '', 'es'))
      const zonales = perfiles.filter(p => rolNorm(p.rol) === ROL_ZONAL)

      // PCV y lista de personeros por (distrito+colegio)
      const pcvMap = new Map<string, Persona>()
      const persListMap = new Map<string, Persona[]>()
      for (const p of perfiles) {
        const k = claveLocal(p.distrito_asignado || p.distrito_vota, p.local_asignado || p.local_votacion)
        if (k.endsWith('||')) continue
        if (rolNorm(p.rol) === ROL_LOCAL) {
          if (!pcvMap.has(k)) pcvMap.set(k, { nombre: p.nombre_completo, dni: p.dni, celular: p.celular })
        } else if (rolNorm(p.rol) === ROL_MESA) {
          const arr = persListMap.get(k) ?? []
          arr.push({ nombre: p.nombre_completo, dni: p.dni, celular: p.celular })
          persListMap.set(k, arr)
        }
      }

      // Zona multi-colegio: Coordinador Provincial (todo) y Coordinador Distrital/de Distritos/Zonal
      // (colegios asignados dentro de su distrito) pueden traer varios colegios en local_asignado,
      // separados por coma (padrón importado) o por " | " (registro web, ver RegisterPage.tsx).
      // key = claveLocal(distrito_asignado del coordinador, nombre de colegio de su lista)
      const zonalMap = new Map<string, Persona & { distrito: string | null; nColegios: number; lista: string[] }>()
      for (const z of [...zonales, ...coordsDistritales]) {
        const lista = String(z.local_asignado ?? '').split(/[,|]/).map(s => s.trim()).filter(Boolean)
        if (!lista.length) continue
        for (const nom of lista) {
          const k = claveLocal(z.distrito_asignado || z.distrito_vota, nom)
          if (!k.endsWith('||') && !zonalMap.has(k))
            zonalMap.set(k, { nombre: z.nombre_completo, dni: z.dni, celular: z.celular, distrito: z.distrito_asignado, nColegios: lista.length, lista })
        }
      }

      const todasFilas: CentroFila[] = colegios.map(c => {
        const k = claveLocal(c.distrito, c.nombre)
        const lst = persListMap.get(k) ?? []
        const tm = c.total_mesas ?? 0
        return {
          ...c,
          pcv: pcvMap.get(k) ?? null,
          zonal: zonalMap.get(k) ?? null,
          personeros: lst,
          nPersoneros: lst.length,
          cobertura: tm ? Math.round((lst.length / tm) * 100) : 0,
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
          personerosMesa: perfiles.filter(p => rolNorm(p.rol) === ROL_MESA).length,
          centros: centros.length,
          centrosConPCV: centros.filter(c => c.pcv).length,
          coordDistritales: coordsDistritales.length,
          zonales: zonales.length,
        },
      })
    })()
    return () => { vivo = false }
  }, [dep, prov, distritos, reloadKey])

  return { ...d, refetch: () => setReloadKey(k => k + 1) }
}
