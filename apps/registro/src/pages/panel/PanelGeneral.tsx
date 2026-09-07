import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import {
  usePanelData, rolNorm, type CentroFila, type ZonaGrupo,
  ROL_MESA, ROL_LOCAL, ROL_COORD_DIST, ROL_ZONAL,
} from '../../lib/panel'
import {
  Search, Download, Building2, LayoutGrid, ShieldCheck, MapPin, Users, Phone,
  AlertTriangle, ChevronRight, MessageCircle, GraduationCap,
} from 'lucide-react'

interface PanelCtx {
  rol: string
  ambito: { departamento: string; provincia: string; distrito: string }
  ambitoListo: boolean
}

const LIMA_METRO = [
  'Ancón','Ate','Barranco','Breña','Carabayllo','Cercado de Lima','Chaclacayo','Chorrillos','Cieneguilla',
  'Comas','El Agustino','Independencia','Jesús María','La Molina','La Victoria','Lince','Los Olivos',
  'Lurigancho-Chosica','Lurín','Magdalena del Mar','Miraflores','Pachacámac','Pucusana','Pueblo Libre',
  'Puente Piedra','Punta Hermosa','Punta Negra','Rímac','San Bartolo','San Borja','San Isidro',
  'San Juan de Lurigancho','San Juan de Miraflores','San Luis','San Martín de Porres','San Miguel',
  'Santa Anita','Santa María del Mar','Santa Rosa','Santiago de Surco','Surquillo','Villa El Salvador',
  'Villa María del Triunfo',
]
const ROLES = [ROL_MESA, ROL_LOCAL, ROL_ZONAL, ROL_COORD_DIST, 'Administrador General']
const wa = (tel?: string | null) => tel ? `https://wa.me/51${String(tel).replace(/\D/g, '')}` : undefined

export default function PanelGeneral() {
  const { rol, ambito: miAmbito, ambitoListo } = useOutletContext<PanelCtx>()
  const esProvincial = rolNorm(rol) === ROL_ZONAL
  const esDistrital = rolNorm(rol) === ROL_COORD_DIST
  const esAdmin = rolNorm(rol) === 'Administrador General'

  const [tab, setTab] = useState<'centros' | 'padron'>('centros')
  const [q, setQ] = useState('')
  const [fDepto, setFDepto] = useState('')
  const [fProv, setFProv] = useState('')
  const [fDist, setFDist] = useState('')
  const [fRol, setFRol] = useState('')
  const [fExp, setFExp] = useState('')
  const [fMov, setFMov] = useState('')
  const [fComp, setFComp] = useState('')
  const [chip, setChip] = useState<'todos' | 'multi' | 'unicos' | 'sinzonal'>('todos')
  const [agrupar, setAgrupar] = useState(true)

  const [sel, setSel] = useState<CentroFila | null>(null)

  // Distritos de la provincia asignada (solo para Coordinador Provincial)
  const [distritosProvincia, setDistritosProvincia] = useState<string[]>([])
  useEffect(() => {
    if (!ambitoListo || !esProvincial || !miAmbito.provincia) return
    const dep = miAmbito.departamento || 'Lima'
    supabase.from('vista_ubigeo').select('distrito').eq('departamento', dep).eq('provincia', miAmbito.provincia)
      .then(({ data }) => setDistritosProvincia([...new Set((data ?? []).map((r: any) => r.distrito).filter(Boolean))]))
  }, [ambitoListo, esProvincial, miAmbito.departamento, miAmbito.provincia])

  // Sembrar los filtros con el ámbito del usuario (no admin) una vez resuelto
  useEffect(() => {
    if (!ambitoListo) return
    if (esDistrital && miAmbito.distrito) { setFDist(miAmbito.distrito); return }
    if (esProvincial) {
      setFDepto(miAmbito.departamento || 'Lima')
      setFProv(miAmbito.provincia || '')
    }
  }, [ambitoListo, esDistrital, esProvincial, miAmbito.departamento, miAmbito.provincia, miAmbito.distrito])

  // Lista efectiva de distritos a consultar: respeta el ámbito fijo del rol,
  // o el filtro manual de distrito (aplica también a Admin, para que el
  // selector de distrito acote también la Jerarquía Distrital y los KPIs).
  const distritosEfectivos = useMemo<string[] | null>(() => {
    if (esDistrital) return miAmbito.distrito ? [miAmbito.distrito] : []
    if (esProvincial) return distritosProvincia
    if (fDist) return [fDist]
    return null
  }, [esDistrital, esProvincial, miAmbito.distrito, distritosProvincia, fDist])

  const bloqueado = (campo: 'depto' | 'prov' | 'dist') => {
    if (esDistrital) return true
    if (esProvincial) return campo !== 'dist'
    return false
  }

  const d = usePanelData({
    departamento: (esProvincial ? miAmbito.departamento : fDepto) || 'Lima',
    provincia: esProvincial ? miAmbito.provincia : (fProv || (fDepto ? '' : 'Lima')),
    distritos: distritosEfectivos,
  })

  // Opciones de ubigeo (vistas nacionales)
  const [departamentos, setDepartamentos] = useState<string[]>([])
  const [provincias, setProvincias] = useState<string[]>([])
  const [distritos, setDistritos] = useState<string[]>(LIMA_METRO)

  useEffect(() => {
    if (!ambitoListo || !esAdmin) return
    supabase.from('vista_departamentos').select('departamento').then(({ data }) =>
      setDepartamentos([...new Set((data ?? []).map((r: any) => r.departamento).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))))
  }, [ambitoListo, esAdmin])
  useEffect(() => {
    const dep = fDepto || 'Lima'
    supabase.from('vista_provincias').select('provincia').eq('departamento', dep).then(({ data }) =>
      setProvincias([...new Set((data ?? []).map((r: any) => r.provincia).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'))))
  }, [fDepto])
  useEffect(() => {
    const dep = fDepto || 'Lima'
    if (!fDepto && !fProv) { setDistritos(LIMA_METRO); return }
    if (!fProv) { setDistritos([]); return }
    supabase.from('vista_ubigeo').select('distrito').eq('departamento', dep).eq('provincia', fProv).order('distrito')
      .then(({ data }) => setDistritos([...new Set((data ?? []).map((r: any) => r.distrito).filter(Boolean))]))
  }, [fDepto, fProv])

  const setDepto = (v: string) => { setFDepto(v); setFProv(''); setFDist('') }
  const setProv = (v: string) => { setFProv(v); setFDist('') }
  const ambito = fDist || fProv || fDepto || 'Lima Metropolitana'

  const perfilesFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase()
    return d.perfiles.filter(p => {
      if (s && !(
        p.nombre_completo?.toLowerCase().includes(s) ||
        (p.dni ?? '').includes(s) ||
        (p.local_asignado ?? '').toLowerCase().includes(s) ||
        (p.distrito_asignado ?? '').toLowerCase().includes(s))) return false
      if (fDist && p.distrito_asignado !== fDist && p.distrito_vota !== fDist) return false
      if (fRol && rolNorm(p.rol) !== fRol) return false
      if (fExp && (fExp === 'si') !== !!p.tiene_experiencia) return false
      if (fMov && (fMov === 'si') !== !!p.cuenta_movilidad) return false
      if (fComp && (fComp === 'si') !== !!p.se_compromete) return false
      return true
    })
  }, [d.perfiles, q, fDist, fRol, fExp, fMov, fComp])

  // Centros filtrados por búsqueda / distrito / chip
  const filtrarCentro = (c: CentroFila) => {
    const s = q.trim().toLowerCase()
    if (s && !(c.nombre.toLowerCase().includes(s) || (c.distrito ?? '').toLowerCase().includes(s) ||
      (c.pcv?.nombre ?? '').toLowerCase().includes(s) || (c.zonal?.nombre ?? '').toLowerCase().includes(s))) return false
    if (fDist && c.distrito !== fDist) return false
    if (chip === 'multi') return !!(c.zonal && c.zonal.nColegios > 1)
    if (chip === 'unicos') return !!(c.zonal && c.zonal.nColegios === 1)
    if (chip === 'sinzonal') return !c.zonal
    return true
  }

  const centrosFlat = useMemo(() => d.centros.filter(filtrarCentro), [d.centros, q, fDist, chip])
  const zonasFiltradas = useMemo<ZonaGrupo[]>(() =>
    d.zonas.map(z => ({ ...z, centros: z.centros.filter(filtrarCentro) })).filter(z => z.centros.length),
    [d.zonas, q, fDist, chip])
  const sinZonalFiltrado = useMemo(() => d.sinZonal.filter(filtrarCentro), [d.sinZonal, q, fDist, chip])

  const chipCounts = useMemo(() => ({
    todos: d.centros.length,
    multi: d.centros.filter(c => c.zonal && c.zonal.nColegios > 1).length,
    unicos: d.centros.filter(c => c.zonal && c.zonal.nColegios === 1).length,
    sinzonal: d.centros.filter(c => !c.zonal).length,
  }), [d.centros])

  const exportar = () => {
    const rows = centrosFlat.map(c => ({
      Distrito: c.distrito ?? '', Colegio: c.nombre, Dirección: c.direccion ?? '',
      Mesas: c.total_mesas ?? 0, Electores: c.electores ?? 0,
      PCV: c.pcv?.nombre ?? '', 'Celular PCV': c.pcv?.celular ?? '',
      'Personeros de Mesa': c.nPersoneros, 'Cobertura %': c.cobertura,
      Zonal: c.zonal?.nombre ?? '', 'Celular Zonal': c.zonal?.celular ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Centros y Mesas')
    XLSX.writeFile(wb, `ConteoLima_Centros_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  if (!ambitoListo || d.loading) return <div className="py-20 text-center text-slate-400 text-sm">Cargando panel…</div>

  return (
    <div className="space-y-4 w-full">

      {/* 1. JERARQUÍA DISTRITAL */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black bg-slate-800 text-white rounded px-2 py-1 tracking-wide">JERARQUÍA DISTRITAL</span>
          <h2 className="text-base font-extrabold text-slate-900">Red de Coordinadores Distritales de Lima ({d.coordsDistritales.length})</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">Monitoreo general de Lima Metropolitana · cada tarjeta es el coordinador de un distrito.</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {d.coordsDistritales.map(c => (
            <div key={c.id} className="flex-shrink-0 w-64 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold bg-slate-800 text-white rounded px-2 py-0.5 flex items-center gap-1">
                  <MapPin size={10} /> {c.distrito_asignado ?? '—'}
                </span>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                  c.acreditado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.acreditado ? '✓ Acreditado' : '⏳ Pendiente'}
                </span>
              </div>
              <p className="font-bold text-slate-800 text-sm leading-tight">{c.nombre_completo}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">DNI: {c.dni ?? '—'}</p>
              <div className="flex items-center justify-between mt-2">
                <a href={wa(c.celular)} target="_blank" rel="noreferrer"
                  className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <Phone size={11} /> {c.celular ?? 's/n'}
                </a>
                <button onClick={() => { setFDist(c.distrito_asignado ?? ''); setTab('centros') }}
                  className="text-[11px] font-bold text-sky-600 flex items-center gap-0.5 hover:underline">
                  Ver distrito <ChevronRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. FILTROS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, DNI, local…"
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-sky-500" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0">
          <Sel v={fDepto} set={setDepto} all="🗺️ Lima (Metrop.)" opts={departamentos} disabled={bloqueado('depto')} />
          <Sel v={fProv} set={setProv} all={fDepto ? 'Todas las provincias' : 'Prov. de Lima'} opts={provincias} disabled={bloqueado('prov')} />
          <Sel v={fDist} set={setFDist} all="📍 Todos los distritos" opts={esProvincial ? distritosProvincia : distritos} disabled={bloqueado('dist')} />
          <Sel v={fRol} set={setFRol} all="🛡️ Todos los roles" opts={ROLES} />
          <Sel v={fExp} set={setFExp} all="⭐ Exp: Todos" opts={[['si', 'Con experiencia'], ['no', 'Sin experiencia']]} />
          <Sel v={fMov} set={setFMov} all="🚗 Mov: Todos" opts={[['si', 'Con movilidad'], ['no', 'Sin movilidad']]} />
          <Sel v={fComp} set={setFComp} all="📅 Comp: Todos" opts={[['si', 'Comprometido'], ['no', 'Pendiente']]} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="bg-sky-50 text-sky-700 font-bold rounded-full px-3 py-1">{perfilesFiltrados.length} personeros</span>
          <span className="text-slate-400">Total padrón: <strong className="text-slate-700">{d.perfiles.length}</strong></span>
        </div>
      </section>

      {/* 3. INDICADORES */}
      <section>
        <p className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <LayoutGrid size={15} /> Indicadores Electorales · {ambito}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi color="#3b82f6" icon={Users}      value={d.kpis.personerosMesa} label="Personeros de Mesa" sub="En Lima Metropolitana" />
          <Kpi color="#06b6d4" icon={Building2}   value={d.kpis.centros}        label="Centros de Votación" sub="Con personal asignado" />
          <Kpi color="#f59e0b" icon={ShieldCheck} value={d.kpis.centrosConPCV}  label="Centros con PCV" sub="Personero de Centro asignado" />
          <Kpi color="#22c55e" icon={ShieldCheck} value={d.kpis.coordDistritales} label="Coord. Distritales" sub="Distritales activos" />
          <Kpi color="#8b5cf6" icon={MapPin}      value={d.kpis.zonales}        label="Zonales" sub="Coordinadores Provinciales" />
        </div>
      </section>

      {/* 4. TABS */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Tab active={tab === 'centros'} onClick={() => setTab('centros')} icon={Building2} label="Centros y Mesas" />
          <Tab active={tab === 'padron'} onClick={() => setTab('padron')} icon={LayoutGrid} label="Padrón Detallado" />
        </div>
        <button onClick={exportar}
          className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 flex items-center gap-1.5">
          <Download size={13} /> Descargar Excel
        </button>
      </div>

      {tab === 'centros' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              <ChipBtn active={chip === 'todos'} onClick={() => setChip('todos')} label="Todos" n={chipCounts.todos} />
              <ChipBtn active={chip === 'multi'} onClick={() => setChip('multi')} label="Multi-Colegio" n={chipCounts.multi} />
              <ChipBtn active={chip === 'unicos'} onClick={() => setChip('unicos')} label="Únicos" n={chipCounts.unicos} />
              <ChipBtn active={chip === 'sinzonal'} onClick={() => setChip('sinzonal')} label="Sin Zonal" n={chipCounts.sinzonal} />
            </div>
            <label className="text-xs text-slate-500 flex items-center gap-2">
              <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} />
              Agrupar por Zona / Coordinador
            </label>
          </div>

          {agrupar ? (
            <div className="space-y-4">
              {sinZonalFiltrado.length > 0 && (
                <Grid centros={sinZonalFiltrado} onPick={setSel} />
              )}
              {zonasFiltradas.map(z => (
                <div key={z.zonal.nombre + z.zonal.dni} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                    <p className="text-sm font-extrabold text-violet-800 flex items-center gap-2">
                      <GraduationCap size={15} /> Zona Multi-Colegio: {z.zonal.nombre}
                      <span className="text-xs font-semibold text-violet-500">({z.centros.length} colegios a cargo)</span>
                    </p>
                    {z.zonal.celular && (
                      <a href={wa(z.zonal.celular)} target="_blank" rel="noreferrer"
                        className="text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 flex items-center gap-1.5">
                        <MessageCircle size={12} /> WhatsApp Zonal
                      </a>
                    )}
                  </div>
                  <Grid centros={z.centros} borde="#8b5cf6" onPick={setSel} />
                </div>
              ))}
              {sinZonalFiltrado.length === 0 && zonasFiltradas.length === 0 && (
                <p className="text-sm text-slate-400 py-10 text-center">Sin centros con esos filtros.</p>
              )}
            </div>
          ) : (
            centrosFlat.length
              ? <Grid centros={centrosFlat} onPick={setSel} />
              : <p className="text-sm text-slate-400 py-10 text-center">Sin centros con esos filtros.</p>
          )}
        </>
      )}

      {tab === 'padron' && <TablaPadron perfiles={perfilesFiltrados} />}

      {sel && <CentroModal c={sel} onClose={() => setSel(null)} />}
    </div>
  )
}

function CentroModal({ c, onClose }: { c: CentroFila; onClose: () => void }) {
  const [t, setT] = useState<'personeros' | 'zona'>('personeros')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mt-16 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <Building2 size={16} className="text-slate-400" /> {c.nombre}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <MapPin size={11} /> Distrito: <strong>{c.distrito ?? '—'}</strong> · {c.nPersoneros} personero{c.nPersoneros === 1 ? '' : 's'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>

        <div className="flex gap-2 p-3">
          <button onClick={() => setT('personeros')}
            className={`flex-1 text-sm font-bold rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 ${
              t === 'personeros' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Users size={14} /> Personeros ({c.nPersoneros})
          </button>
          <button onClick={() => setT('zona')}
            className={`flex-1 text-sm font-bold rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 ${
              t === 'zona' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <GraduationCap size={14} /> Zona ({c.zonal ? c.zonal.nColegios : 0} loc.)
          </button>
        </div>

        <div className="p-4 pt-0 space-y-3 max-h-[60vh] overflow-y-auto">
          {t === 'personeros' ? (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                  🪪 Personero de Centro de Votación (PCV)
                </p>
                {c.pcv ? (
                  <div className="flex items-center justify-between mt-1.5">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{c.pcv.nombre}</p>
                      <p className="text-xs text-slate-500">DNI: {c.pcv.dni ?? '—'}</p>
                    </div>
                    {c.pcv.celular && (
                      <a href={wa(c.pcv.celular)} target="_blank" rel="noreferrer"
                        className="text-xs text-emerald-600 font-bold flex items-center gap-1"><Phone size={12} /> {c.pcv.celular}</a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Este centro de votación aún no tiene un Personero de Centro asignado.
                  </p>
                )}
              </div>

              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                Personeros de mesa asignados ({c.personeros.length})
              </p>
              {c.personeros.length === 0 ? (
                <p className="text-sm text-slate-400">Ningún personero de mesa inscrito en este centro todavía.</p>
              ) : (
                <div className="space-y-2">
                  {c.personeros.map((p, i) => (
                    <div key={i} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2"
                      style={{ borderLeft: '4px solid #16a34a' }}>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{p.nombre}</p>
                        <p className="text-xs text-slate-500">
                          <span className="text-emerald-600 font-semibold">Personero de Mesa</span> · DNI: {p.dni ?? '—'}
                        </p>
                      </div>
                      {p.celular
                        ? <a href={wa(p.celular)} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 font-bold flex items-center gap-1"><Phone size={12} /> {p.celular}</a>
                        : <span className="text-emerald-500">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {c.zonal ? (
                <>
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                    <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Zonal (Coordinador Provincial)</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.zonal.nombre}</p>
                        <p className="text-xs text-slate-500">DNI: {c.zonal.dni ?? '—'} · {c.zonal.nColegios} colegios a cargo</p>
                      </div>
                      {c.zonal.celular && (
                        <a href={wa(c.zonal.celular)} target="_blank" rel="noreferrer"
                          className="text-xs text-emerald-600 font-bold flex items-center gap-1"><Phone size={12} /> {c.zonal.celular}</a>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Colegios de esta zona</p>
                  <ol className="space-y-1 text-sm list-decimal list-inside">
                    {c.zonal.lista.map((n, i) => (
                      <li key={i} className={n.toUpperCase() === c.nombre.toUpperCase() ? 'font-bold text-slate-900' : 'text-slate-600'}>
                        {n}{n.toUpperCase() === c.nombre.toUpperCase() && ' ← este'}
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="text-sm text-slate-400">Este centro no pertenece a ninguna zona multi-colegio.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- sub-componentes ---------- */

function Sel({ v, set, all, opts, disabled }: {
  v: string; set: (s: string) => void; all: string; opts: (string | [string, string])[]; disabled?: boolean
}) {
  return (
    <select value={v} onChange={e => set(e.target.value)} disabled={disabled}
      className="flex-shrink-0 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600 outline-none max-w-[12rem] disabled:bg-slate-100 disabled:text-slate-400">
      <option value="">{all}</option>
      {opts.map(o => {
        const [val, lbl] = Array.isArray(o) ? o : [o, o]
        return <option key={val} value={val}>{lbl}</option>
      })}
    </select>
  )
}

function Kpi({ color, icon: Icon, value, label, sub }: {
  color: string; icon: any; value: number; label: string; sub: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
        <Icon size={13} style={{ color }} /> {label}
      </div>
      <p className="text-2xl font-black text-slate-900 mt-1 leading-none">{value.toLocaleString('es-PE')}</p>
      <p className="text-[10px] text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

function Tab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick}
      className={`text-sm font-bold rounded-lg px-4 py-2 border flex items-center gap-1.5 transition-colors ${
        active ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
      <Icon size={14} /> {label}
    </button>
  )
}

function ChipBtn({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg px-2.5 py-1.5 font-bold border transition-colors flex items-center gap-1.5 ${
        active ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
      {label} <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>{n}</span>
    </button>
  )
}

function Grid({ centros, borde, onPick }: { centros: CentroFila[]; borde?: string; onPick: (c: CentroFila) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
      {centros.slice(0, 400).map(c => <Card key={c.id} c={c} borde={borde} onClick={() => onPick(c)} />)}
    </div>
  )
}

function Card({ c, borde, onClick }: { c: CentroFila; borde?: string; onClick: () => void }) {
  const cov = c.cobertura >= 100 ? '#16a34a' : c.cobertura >= 40 ? '#d97706' : '#dc2626'
  return (
    <div onClick={onClick}
      className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-shadow"
      style={{ borderLeft: `4px solid ${borde ?? (c.pcv ? '#16a34a' : '#f59e0b')}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 rounded px-2 py-0.5 flex items-center gap-1">
          <MapPin size={11} /> {c.distrito ?? '—'}
        </span>
        <span className={`text-[10px] font-bold rounded-full px-2 py-1 ${
          c.pcv ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          {c.pcv ? '✓ Con Personero de Centro' : '⚠ Sin Personero de Centro'}
        </span>
      </div>

      <div>
        <p className="font-extrabold text-slate-900 text-sm flex items-start gap-1.5">
          <Building2 size={15} className="mt-0.5 flex-shrink-0 text-slate-400" /> {c.nombre}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
          <MapPin size={11} /> {c.direccion || 'Dirección no registrada'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2.5 text-center">
        <M v={c.total_mesas ?? 0} l="Mesas" />
        <M v={c.nPersoneros} l="Personeros" />
        <M v={(c.electores ?? 0).toLocaleString('es-PE')} l="Electores" />
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
          <span>Cobertura de mesas</span>
          <span style={{ color: cov }}>{c.nPersoneros} de {c.total_mesas ?? 0} ({c.cobertura}%)</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.cobertura)}%`, background: cov }} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        <Linea tag="PCV" cls="bg-emerald-100 text-emerald-700" p={c.pcv} vacio="Sin Personero de Centro" />
        <Linea tag="Zonal" cls="bg-violet-100 text-violet-700"
          p={c.zonal ? { nombre: c.zonal.nombre, dni: c.zonal.dni, celular: c.zonal.celular } : null} vacio="Sin zonal" />
      </div>
    </div>
  )
}

function M({ v, l }: { v: string | number; l: string }) {
  return (
    <div>
      <p className="text-base font-black text-slate-900 leading-none">{v}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1">{l}</p>
    </div>
  )
}

function Linea({ tag, cls, p, vacio }: {
  tag: string; cls: string; p: { nombre: string; celular: string | null; dni?: string | null } | null; vacio: string
}) {
  return (
    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-[9px] font-bold rounded px-1.5 py-0.5 ${cls}`}>{tag}</span>
        <span className={`truncate font-medium ${p ? 'text-slate-700' : 'text-slate-400'}`}>{p?.nombre || vacio}</span>
      </div>
      {p?.celular
        ? <a href={wa(p.celular)} target="_blank" rel="noreferrer" className="text-emerald-600 font-bold flex items-center gap-1 flex-shrink-0"><Phone size={11} /> {p.celular}</a>
        : !p && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
    </div>
  )
}

function TablaPadron({ perfiles }: { perfiles: ReturnType<typeof usePanelData>['perfiles'] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-500">{perfiles.length} registros</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              {['DNI', 'Nombre', 'Celular', 'Rol', 'Distrito Asignado', 'Local Asignado', 'Credencial'].map(h => (
                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {perfiles.slice(0, 800).map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono font-semibold text-sky-700">{p.dni ?? '—'}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{p.nombre_completo}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.celular ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-600 rounded px-2 py-0.5">{rolNorm(p.rol)}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{p.distrito_asignado ?? p.distrito_vota ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 max-w-[280px] truncate">{p.local_asignado ?? p.local_votacion ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-bold ${
                    p.credencial_estado === 'Confirmado' ? 'text-emerald-600'
                    : p.credencial_estado === 'Bloqueado' ? 'text-rose-600' : 'text-amber-600'}`}>
                    {p.credencial_estado ?? 'Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {perfiles.length > 800 && <p className="px-4 py-3 text-xs text-slate-400">Mostrando 800 de {perfiles.length}.</p>}
      </div>
    </div>
  )
}

