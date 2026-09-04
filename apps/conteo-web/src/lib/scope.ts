import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Ámbito geográfico del usuario logueado.
// - Administrador General: ve todo (distritos = null) con filtros manuales.
// - Coordinador Provincial: ve TODA su provincia (todos sus distritos). Si solo tiene
//   `distrito_asignado`, se deduce la provincia de ese distrito (vista_ubigeo).
// - Coordinador de Distritos: ve SOLO su `distrito_asignado`.
// - Otro coordinador con provincia asignada: toda la provincia; con distrito: ese distrito.
// - Sin geografía: no ve nada.
export interface Scope {
  loading: boolean
  perfil: { nombre_completo?: string; rol?: string } | null
  esAdmin: boolean
  distritos: string[] | null   // null = sin límite
  ambitoLabel: string
  // geografía fija del ámbito (para prellenar/bloquear la barra de filtros)
  departamento: string
  provincia: string
  distrito: string
}

const SIN_AMBITO = '__sin_ambito__'

export function useScope(): Scope {
  const [s, setS] = useState<Scope>({
    loading: true, perfil: null, esAdmin: false, distritos: null, ambitoLabel: '',
    departamento: '', provincia: '', distrito: '',
  })

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (vivo) setS(x => ({ ...x, loading: false })); return }

      // Resolver por DNI (profiles.id no siempre = auth.users.id en la base importada)
      const dni = (user.email ?? '').split('@')[0]
      const cols = 'nombre_completo, rol, departamento_asignado, provincia_asignado, distrito_asignado'
      let { data: p } = await supabase.from('profiles').select(cols).eq('dni', dni).maybeSingle()
      if (!p) {
        const r = await supabase.from('profiles').select(cols).eq('id', user.id).maybeSingle()
        p = r.data
      }

      const rol = p?.rol ?? ''
      if (rol === 'Administrador General') {
        if (vivo) setS({
          loading: false, perfil: p, esAdmin: true, distritos: null, ambitoLabel: 'Ámbito nacional',
          departamento: '', provincia: '', distrito: '',
        })
        return
      }

      let dep  = (p?.departamento_asignado ?? '').trim()
      let prov = (p?.provincia_asignado ?? '').trim()
      const dist = (p?.distrito_asignado ?? '').trim()
      const esProvincial = /coordinador\s+provincial/i.test(rol)

      // Si es Provincial y no tiene provincia asignada, deducirla de su distrito
      if (esProvincial && (!prov || !dep) && dist) {
        const { data: u } = await supabase
          .from('vista_ubigeo').select('departamento, provincia').eq('distrito', dist)
        const rows = (u ?? []) as { departamento: string; provincia: string }[]
        const pick = rows.find(r => r.departamento === 'Lima') ?? rows[0]
        if (pick) { dep = dep || pick.departamento; prov = prov || pick.provincia }
      }

      let distritos: string[]
      let label: string
      if (esProvincial && dep && prov) {
        const { data: u } = await supabase
          .from('vista_ubigeo').select('distrito').eq('departamento', dep).eq('provincia', prov)
        distritos = [...new Set((u ?? []).map((c: any) => c.distrito).filter(Boolean))]
        label = `Provincia de ${prov}`
      } else if (dist) {
        // Coordinador de Distritos (o cualquiera con distrito): solo su distrito
        distritos = [dist]
        label = `Distrito de ${dist}`
      } else if (dep && prov) {
        const { data: u } = await supabase
          .from('vista_ubigeo').select('distrito').eq('departamento', dep).eq('provincia', prov)
        distritos = [...new Set((u ?? []).map((c: any) => c.distrito).filter(Boolean))]
        label = `Provincia de ${prov}`
      } else {
        distritos = [SIN_AMBITO]
        label = 'Sin ámbito asignado'
      }

      const distritoFijo = esProvincial ? '' : dist
      if (vivo) setS({
        loading: false, perfil: p, esAdmin: false, distritos, ambitoLabel: label,
        departamento: dep || (distritos[0] !== SIN_AMBITO ? 'Lima' : ''),
        provincia: prov,
        distrito: distritoFijo,
      })
    })()
    return () => { vivo = false }
  }, [])

  return s
}

// true si algún valor cae dentro del ámbito (o si no hay límite).
export function enAmbito(distritos: string[] | null, ...vals: (string | null | undefined)[]) {
  if (!distritos) return true
  return vals.some(v => !!v && distritos.includes(v))
}
