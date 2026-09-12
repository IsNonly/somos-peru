import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, DISTRITOS_META } from './supabase'
import { useScope } from './scope'

// Los 43 distritos de Lima Metropolitana: ámbito por defecto del Administrador.
const LIMA_METRO = Object.keys(DISTRITOS_META)
const ESPECIALES = ['NULO', 'BLANCO', 'IMPUGNADO']

export interface Filtros {
  departamento: string
  provincia: string
  distrito: string
  colegio: string
  mesa: string
  partido: string
}

const VACIO: Filtros = {
  departamento: '', provincia: '', distrito: '',
  colegio: '', mesa: '', partido: '',
}

interface Ctx {
  f: Filtros
  set: (k: keyof Filtros, v: string) => void
  reset: () => void
  // opciones para los selects
  departamentos: string[]
  provincias: string[]
  distritos: string[]
  colegios: string[]
  mesas: string[]
  partidos: string[]
  // del scope
  esAdmin: boolean
  bloqueado: (k: keyof Filtros) => boolean   // true si el select debe estar deshabilitado
  ambitoLabel: string
  loading: boolean
  // lista efectiva de distritos a consultar (respeta ámbito + filtro manual)
  distritosEfectivos: string[] | null        // null = sin límite
}

const FiltrosContext = createContext<Ctx | null>(null)

export function useFiltros() {
  const c = useContext(FiltrosContext)
  if (!c) throw new Error('useFiltros fuera de <FiltrosProvider>')
  return c
}

export function FiltrosProvider({ children }: { children: React.ReactNode }) {
  const scope = useScope()
  const [f, setF] = useState<Filtros>(VACIO)

  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [provincias, setProvincias]       = useState<string[]>([])
  const [distritos, setDistritos]         = useState<string[]>([])
  const [colegios, setColegios]           = useState<string[]>([])

  // Sembrar filtros desde el ámbito del usuario una vez resuelto el scope
  useEffect(() => {
    if (scope.loading || scope.esAdmin) return
    setF(p => ({
      ...p,
      departamento: scope.departamento || p.departamento,
      provincia: scope.provincia || p.provincia,
      distrito: scope.distrito || p.distrito,
    }))
  }, [scope.loading, scope.esAdmin, scope.departamento, scope.provincia, scope.distrito])

  // Departamentos — de la vista deduplicada del ubigeo nacional (25 deptos + Callao)
  useEffect(() => {
    if (scope.loading) return
    if (scope.esAdmin) {
      supabase.from('vista_departamentos').select('departamento').then(({ data }) => {
        setDepartamentos([...new Set((data ?? []).map((d: any) => d.departamento).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'es')))
      })
    } else {
      setDepartamentos(f.departamento ? [f.departamento] : ['Lima'])
    }
  }, [scope.loading, scope.esAdmin])

  useEffect(() => {
    const dep = f.departamento || 'Lima'
    if (!dep) { setProvincias([]); return }
    supabase.from('vista_provincias').select('provincia').eq('departamento', dep).then(({ data }) => {
      setProvincias([...new Set((data ?? []).map((d: any) => d.provincia).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es')))
    })
  }, [f.departamento, scope.esAdmin])

  useEffect(() => {
    const dep = f.departamento || 'Lima'
    if (dep && f.provincia) {
      supabase.from('vista_ubigeo').select('distrito').eq('departamento', dep).eq('provincia', f.provincia).order('distrito').then(({ data }) => {
        setDistritos([...new Set((data ?? []).map((d: any) => d.distrito).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'es')))
      })
    } else if (scope.esAdmin && (!f.departamento || f.departamento === 'Lima')) {
      setDistritos([...LIMA_METRO].sort())   // ámbito por defecto: Lima Metropolitana
    } else if (scope.esAdmin && f.departamento) {
      // Depto elegido, sin provincia todavía: TODOS sus distritos (todas sus provincias),
      // para no dejar la búsqueda "sin límite" (== nacional) mientras tanto.
      supabase.from('vista_ubigeo').select('distrito').eq('departamento', dep).order('distrito').then(({ data }) => {
        setDistritos([...new Set((data ?? []).map((d: any) => d.distrito).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'es')))
      })
    } else if (!scope.esAdmin && scope.distritos) {
      setDistritos([...scope.distritos].sort())
    } else {
      setDistritos([])
    }
  }, [f.departamento, f.provincia, scope.esAdmin, scope.distritos])

  useEffect(() => {
    if (!f.distrito) { setColegios([]); return }
    let cq = supabase.from('colegios').select('nombre').eq('distrito', f.distrito)
    if (f.departamento) cq = cq.eq('departamento', f.departamento)
    if (f.provincia)    cq = cq.eq('provincia', f.provincia)
    else if (scope.esAdmin && (!f.departamento || f.departamento === 'Lima'))
      cq = cq.eq('departamento', 'Lima').eq('provincia', 'Lima')
    cq.order('nombre').then(({ data }) => setColegios((data ?? []).map((c: any) => c.nombre)))
  }, [f.distrito, f.departamento, f.provincia, scope.esAdmin])

  // Partidos del ámbito — de la tabla `candidaturas` (misma fuente que la conteo-app)
  const [partidos, setPartidos] = useState<string[]>(ESPECIALES)
  useEffect(() => {
    if (scope.loading) return
    let q = supabase.from('candidaturas').select('partido').eq('activo', true)
    if (f.departamento) q = q.eq('departamento', f.departamento)
    q.then(({ data }) => {
      const nombres = [...new Set((data ?? []).map((r: any) => r.partido).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))
      setPartidos([...nombres, ...ESPECIALES])
    })
  }, [scope.loading, f.departamento])

  const [mesas, setMesas] = useState<string[]>([])
  useEffect(() => {
    if (!f.colegio) { setMesas([]); return }
    supabase.from('actas').select('mesa_numero').eq('colegio_nombre', f.colegio).order('mesa_numero').then(({ data }) => {
      setMesas([...new Set((data ?? []).map((m: any) => m.mesa_numero).filter(Boolean))])
    })
  }, [f.colegio])

  const set = (k: keyof Filtros, v: string) => {
    setF(prev => {
      const next = { ...prev, [k]: v }
      // limpiar niveles inferiores
      if (k === 'departamento') { next.provincia = ''; next.distrito = ''; next.colegio = ''; next.mesa = '' }
      if (k === 'provincia')    { next.distrito = ''; next.colegio = ''; next.mesa = '' }
      if (k === 'distrito')     { next.colegio = ''; next.mesa = '' }
      if (k === 'colegio')      { next.mesa = '' }
      return next
    })
  }

  const reset = () => {
    if (!scope.esAdmin && scope.distritos && scope.distritos.length === 1) {
      setF({ ...VACIO, distrito: scope.distritos[0] })
    } else {
      setF(VACIO)
    }
  }

  const bloqueado = (k: keyof Filtros) => {
    if (scope.esAdmin) return false
    if (k === 'departamento' || k === 'provincia') return true
    if (k === 'distrito') return !!(scope.distritos && scope.distritos.length === 1)
    return false
  }

  const distritosEfectivos = useMemo<string[] | null>(() => {
    if (f.distrito) return [f.distrito]
    if (!scope.esAdmin) return scope.distritos ?? null
    // Admin: si eligió provincia usa sus distritos; si eligió depto (sin provincia) usa
    // TODOS los distritos de ese depto (ya cargados arriba); si no, ámbito por defecto =
    // Lima Metropolitana. `null` es solo el estado transitorio mientras `distritos` carga.
    if (f.provincia) return distritos.length ? distritos : null
    if (f.departamento && f.departamento !== 'Lima') return distritos.length ? distritos : null
    return LIMA_METRO
  }, [f.distrito, f.provincia, f.departamento, distritos, scope.esAdmin, scope.distritos])

  const ambitoLabel = useMemo(() => {
    if (f.distrito) return `Distrito de ${f.distrito}`
    if (f.provincia) return `Provincia de ${f.provincia}`
    if (scope.esAdmin) return (f.departamento && f.departamento !== 'Lima') ? f.departamento : 'Lima Metropolitana'
    return scope.ambitoLabel
  }, [f.distrito, f.provincia, f.departamento, scope.esAdmin, scope.ambitoLabel])

  const value: Ctx = {
    f, set, reset,
    departamentos, provincias, distritos, colegios, mesas, partidos,
    esAdmin: scope.esAdmin,
    bloqueado,
    ambitoLabel,
    loading: scope.loading,
    distritosEfectivos,
  }

  return <FiltrosContext.Provider value={value}>{children}</FiltrosContext.Provider>
}
