import { useEffect, useState, useCallback } from 'react'
import { supabase, DISTRITOS, ROLES, generarToken, generarClave } from '../lib/supabase'
import type { Profile, Rol } from '../lib/supabase'
import { rolNorm } from '../lib/panel'
import { Search, Download, X, CheckCircle, XCircle, Clock, MessageCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

function whatsappUrl(celular: string, p: Profile) {
  const num = celular.replace(/\D/g, '')
  const msg = encodeURIComponent(
    `Hola ${p.nombre_completo?.split(' ')[0] ?? ''}, te informamos que tu credencial electoral Somos Perú 2026 ha sido generada.\n\n` +
    `TOKEN: ${p.token_verificacion ?? ''}\nCLAVE: ${p.clave_acceso ?? ''}\n\n` +
    `Ingresa a la app de conteo y capacitación con esas credenciales. ¡Gracias!`
  )
  return `https://wa.me/51${num}?text=${msg}`
}

const BADGE_ROL: Record<string, string> = {
  'Administrador General':    'bg-purple-500/20 text-purple-300',
  'Coordinador Distrital':    'bg-blue-500/20 text-blue-300',
  'Coordinador Provincial':   'bg-cyan-500/20 text-cyan-300',
  'Personero de Mesa':        'bg-orange-500/20 text-orange-300',
  'Personero de Local de Votación': 'bg-pink-500/20 text-pink-300',
}

const BADGE_CRED: Record<string, { cls: string; icon: any }> = {
  'Confirmado': { cls: 'text-green-400', icon: CheckCircle },
  'Bloqueado':  { cls: 'text-red-400',   icon: XCircle },
  'Pendiente':  { cls: 'text-yellow-400', icon: Clock },
}

export default function PersonerosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [distFilter, setDistFilter] = useState('')
  const [credFilter, setCredFilter] = useState('')
  const [detalle, setDetalle] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('fecha_registro', { ascending: false })
    setProfiles((data ?? []) as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.nombre_completo?.toLowerCase().includes(q) || p.dni?.includes(q) ||
      p.local_votacion?.toLowerCase().includes(q) || p.mesa_asignada?.includes(q)
    return matchSearch
      && (!rolFilter  || rolNorm(p.rol) === rolFilter)
      && (!distFilter || p.distrito_asignado === distFilter)
      && (!credFilter || p.credencial_estado === credFilter)
  })

  const confirmarCredencial = async (id: string, estado: 'Confirmado' | 'Bloqueado') => {
    await supabase.from('profiles').update({ credencial_estado: estado }).eq('id', id)
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, credencial_estado: estado } : p))
    if (detalle?.id === id) setDetalle(prev => prev ? { ...prev, credencial_estado: estado } : prev)
  }

  const exportExcel = () => {
    const rows = filtered.map(p => ({
      'ID': p.id,
      'Nombres y Apellidos': p.nombre_completo,
      'DNI': p.dni,
      'Celular': p.celular,
      'Correo': p.correo,
      'Rol': p.rol,
      'Distrito donde Vota': p.distrito_vota,
      'Mesa de Sufragio': p.mesa_sufragio,
      'Local de Votación': p.local_votacion,
      'Distrito Asignado': p.distrito_asignado,
      'Mesa Asignada': p.mesa_asignada,
      'Experiencia': p.tiene_experiencia ? 'Sí' : 'No',
      'Movilidad': p.cuenta_movilidad ? 'Sí' : 'No',
      'Videos': p.videos_vistos,
      'PDFs': p.pdfs_vistos,
      'Quiz': p.quiz_estado,
      'Token': p.token_verificacion,
      'Clave': p.clave_acceso,
      'Credencial': p.credencial_estado,
      'Fecha Registro': p.fecha_registro,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personeros')
    XLSX.writeFile(wb, `SomosPerú_Personeros_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Administración</p>
          <h1 className="text-white text-2xl font-bold">Personeros y Coordinadores</h1>
        </div>
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-600/30 hover:bg-green-600/30 text-green-400 rounded-xl text-sm font-medium transition-all">
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 flex-1 min-w-[220px]">
          <Search size={14} className="text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, DNI, local…"
            className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-white/30" /></button>}
        </div>
        <select value={rolFilter} onChange={e => setRolFilter(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={distFilter} onChange={e => setDistFilter(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todos los distritos</option>
          {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={credFilter} onChange={e => setCredFilter(e.target.value)}
          className="bg-[#16162a] border border-white/8 rounded-xl px-3 py-2 text-sm text-white/70 outline-none">
          <option value="">Todas las credenciales</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Confirmado">Confirmado</option>
          <option value="Bloqueado">Bloqueado</option>
        </select>
      </div>

      <p className="text-white/30 text-xs">{filtered.length} de {profiles.length} registros</p>

      {/* Tabla */}
      <div className="bg-[#16162a] border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/30 text-white/40 text-xs uppercase tracking-wide">
                {['#','Nombre','DNI','Rol','Distrito Asignado','Mesa Asignada','Quiz','Credencial','WA','Acción'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-3 bg-white/5 rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-white/30">Sin registros</td></tr>
              ) : filtered.map((p, i) => {
                const cred = BADGE_CRED[p.credencial_estado] ?? BADGE_CRED['Pendiente']
                const CredIcon = cred.icon
                return (
                  <tr key={p.id} onClick={() => setDetalle(p)}
                    className="hover:bg-white/3 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-white/30 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">{p.nombre_completo}</td>
                    <td className="px-4 py-3 text-white/60 font-mono">{p.dni}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_ROL[rolNorm(p.rol)] ?? 'bg-white/10 text-white/50'}`}>
                        {rolNorm(p.rol).replace('Coordinador de ', 'Coord. ').replace('Coordinador ', 'Coord. ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">{p.distrito_asignado ?? '—'}</td>
                    <td className="px-4 py-3 text-white/60 font-mono">{p.mesa_asignada ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${p.quiz_estado === 'Aprobado' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {p.quiz_estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CredIcon size={15} className={cred.cls} />
                    </td>
                    <td className="px-4 py-3">
                      {p.celular && (
                        <a href={whatsappUrl(p.celular, p)} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title={`Enviar credencial por WhatsApp a ${p.celular}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-all">
                          <MessageCircle size={13} />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {p.credencial_estado !== 'Confirmado' && (
                          <button onClick={() => confirmarCredencial(p.id, 'Confirmado')}
                            className="px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-xs font-medium transition-all">
                            Confirmar
                          </button>
                        )}
                        {p.credencial_estado !== 'Bloqueado' && (
                          <button onClick={() => confirmarCredencial(p.id, 'Bloqueado')}
                            className="px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs font-medium transition-all">
                            Bloquear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle modal */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDetalle(null)}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">{detalle.nombre_completo}</h3>
              <button onClick={() => setDetalle(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {([
                ['DNI', detalle.dni],
                ['Celular', detalle.celular],
                ['Correo', detalle.correo],
                ['Rol', detalle.rol],
                ['Distrito vota', detalle.distrito_vota],
                ['Mesa sufragio', detalle.mesa_sufragio],
                ['Distrito asignado', detalle.distrito_asignado],
                ['Mesa asignada', detalle.mesa_asignada],
                ['Token', detalle.token_verificacion],
                ['Clave', detalle.clave_acceso],
                ['Videos vistos', String(detalle.videos_vistos)],
                ['PDFs vistos', String(detalle.pdfs_vistos)],
                ['Quiz', detalle.quiz_estado],
                ['Credencial', detalle.credencial_estado],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}>
                  <p className="text-white/30 text-xs uppercase tracking-wide">{k}</p>
                  <p className="text-white font-medium">{v ?? '—'}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={() => { confirmarCredencial(detalle.id, 'Confirmado'); setDetalle(null) }}
                className="flex-1 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-all">
                Confirmar credencial
              </button>
              <button onClick={() => { confirmarCredencial(detalle.id, 'Bloqueado'); setDetalle(null) }}
                className="flex-1 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-all">
                Bloquear
              </button>
              {detalle.celular && (
                <a href={whatsappUrl(detalle.celular, detalle)} target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-2 bg-green-600/20 border border-green-600/30 text-green-300 rounded-xl text-sm font-medium hover:bg-green-600/30 transition-all flex items-center justify-center gap-2">
                  <MessageCircle size={14} /> Enviar por WA
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
