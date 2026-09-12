import { useState, useRef, useEffect, useCallback } from 'react'
import {
  supabase, getMiPerfil, VOTOS_ESPECIALES, haversineM,
} from '../lib/supabase'
import type { Candidato } from '../lib/supabase'
import {
  getCandidaturas, type Candidaturas, type BloqueCandidaturas, type NivelCandidatura,
} from '../lib/candidaturas'
import { procesarActa } from '../lib/ocr'
import { subirImagenActa } from '../lib/storage'
import {
  Camera, Send, CheckCircle, AlertTriangle,
  Loader, MapPin, Key, ChevronDown, ChevronUp, Minus, Plus,
  Info, PencilLine, LogOut, UserCheck, Map as MapIcon,
  Eye, Layers, ChevronLeft, X, UserCircle2, type LucideIcon,
} from 'lucide-react'

type Modo = 'MANUAL' | 'IMAGEN'
type Fase = 'setup' | 'enviado'

// Ruta del logo del partido en /public/partidos/<slug>.png
// Si el archivo no existe, la fila cae automáticamente al badge de iniciales.
function slugPartido(partido: string): string {
  return partido
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Busca el candidato cuyo nombre o partido más se parece al texto reconocido por OCR
function matchCandidato(lista: Candidato[], texto: string): Candidato | undefined {
  const t = texto.toLowerCase()
  return lista.find(c =>
    t.includes(c.partido.toLowerCase().slice(0, 6)) || c.partido.toLowerCase().includes(t.slice(0, 6)) ||
    (!!c.nombre && (t.includes(c.nombre.toLowerCase().slice(0, 6)) || c.nombre.toLowerCase().includes(t.slice(0, 6))))
  )
}

// Carga la clave Gemini guardada en Supabase (tabla app_config, por auth user id)
async function getGeminiKey(authId: string): Promise<string> {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('user_id', authId)
    .eq('key', 'gemini_api_key')
    .maybeSingle()
  return data?.value ?? ''
}

async function saveGeminiKey(authId: string, key: string) {
  await supabase.from('app_config').upsert(
    { user_id: authId, key: 'gemini_api_key', value: key },
    { onConflict: 'user_id,key' }
  )
}

export default function ConteoPage() {
  return (
    <>
      <IntroModal />
      <ConteoPageInner />
    </>
  )
}

// ── Modal de bienvenida: se muestra una vez por sesión al entrar el personero ──
function IntroModal() {
  const [visible, setVisible] = useState(() => {
    try { return sessionStorage.getItem('conteo_intro_ok') !== '1' } catch { return true }
  })
  if (!visible) return null

  const cerrar = () => {
    try { sessionStorage.setItem('conteo_intro_ok', '1') } catch { /* modo privado */ }
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5 fade-in">
      <div className="w-full max-w-sm bg-[#121829] border border-white/10 rounded-3xl p-7 text-center space-y-5 shadow-2xl shadow-black/50">
        <div className="w-16 h-16 mx-auto rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center">
          <Info size={28} className="text-sky-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-white font-extrabold text-lg">
            Control de <span className="text-sky-400">Votación</span>
          </h2>
          <p className="text-white/50 text-xs leading-relaxed">
            Bienvenido al sistema. Tienes <span className="text-white font-semibold">2 opciones</span> independientes
            para registrar tus actas de mesa:
          </p>
        </div>
        <div className="bg-[#0e1322] border border-white/8 rounded-2xl p-4 space-y-2.5 text-left">
          <p className="text-white/70 text-xs flex gap-2">
            <PencilLine size={15} className="text-sky-400 flex-shrink-0 mt-0.5" />
            <span><span className="text-white font-semibold">Formulario Manual:</span> Conteo digitado.</span>
          </p>
          <p className="text-white/70 text-xs flex gap-2">
            <Camera size={15} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <span><span className="text-white font-semibold">Formulario Imagen:</span> Foto y OCR.</span>
          </p>
        </div>
        <button onClick={cerrar}
          className="w-full py-3.5 bg-gradient-to-r from-[#3b82f6] to-[#0ea5e9] hover:opacity-95 text-white font-bold rounded-2xl text-sm active:scale-[0.98] transition-all">
          Entendido, comenzar
        </button>
      </div>
    </div>
  )
}

type VotosPorNivel = Record<NivelCandidatura, Record<string, number>>
const VOTOS_VACIOS: VotosPorNivel = { REGIONAL: {}, PROVINCIAL: {}, DISTRITAL: {} }

function ConteoPageInner() {
  const [perfil, setPerfil]           = useState<any>(null)
  const [userId, setUserId]           = useState('')   // id real del perfil (para escrituras)
  const [authId, setAuthId]           = useState('')   // id de auth (para app_config)
  const [mesa, setMesa]               = useState('')
  const [mesaConfirmada, setMesaConfirmada] = useState(false)
  const [electoresHabiles, setElectoresHabiles] = useState('')
  const [modo, setModo]               = useState<Modo>('MANUAL')
  const [vista, setVista]             = useState<'landing' | 'conteo'>('landing')
  const [verModal, setVerModal]       = useState<Modo | null>(null)
  const [fase, setFase]               = useState<Fase>('setup')
  const [cand, setCand]               = useState<Candidaturas | null>(null)
  const [candLoading, setCandLoading] = useState(true)
  const [votos, setVotos]             = useState<VotosPorNivel>(VOTOS_VACIOS)
  const [imgSrc, setImgSrc]           = useState<string | null>(null)
  const [imgMime, setImgMime]         = useState('image/jpeg')
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [ocrMetodo, setOcrMetodo]     = useState<'GEMINI' | 'TESSERACT' | null>(null)
  const [gpsStatus, setGpsStatus]     = useState<'idle' | 'loading' | 'ok' | 'warn' | 'fail'>('idle')
  const [gpsMsg, setGpsMsg]           = useState('')
  const [gpsCoords, setGpsCoords]     = useState<{ lat: number; lon: number } | null>(null)
  const [enviando, setEnviando]       = useState(false)
  const [error, setError]             = useState('')
  const [geminiKey, setGeminiKey]     = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Foto de instalación de mesa (evidencia previa al escrutinio)
  const [fotoInstalacion, setFotoInstalacion]   = useState<string | null>(null)
  const [subiendoInstalacion, setSubiendoInstalacion] = useState(false)
  const instalacionInputRef = useRef<HTMLInputElement>(null)

  const bloques = cand?.bloques ?? []

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [p, key] = await Promise.all([
        getMiPerfil('*'),
        getGeminiKey(user.id),
      ])
      setUserId(p?.id ?? user.id)   // el id real del perfil, para escrituras
      setAuthId(user.id)
      setPerfil(p)
      setGeminiKey(key)
      if (p?.mesa_asignada) setMesa(p.mesa_asignada)
      if (p?.acta_transmitida) setFase('enviado')

      // Si ya se tomó la foto de instalación antes, recuperarla
      if (p?.mesa_asignada) {
        const { data: acta } = await supabase.from('actas')
          .select('foto_instalacion_url').eq('mesa_numero', p.mesa_asignada).maybeSingle()
        if (acta?.foto_instalacion_url) setFotoInstalacion(acta.foto_instalacion_url)
      }
    }
    init()
  }, [])

  // ── Cargar las candidaturas del ámbito del personero ───────────────────
  useEffect(() => {
    if (!perfil) return
    let vivo = true
    setCandLoading(true)
    getCandidaturas(perfil)
      .then(c => { if (vivo) { setCand(c); setCandLoading(false) } })
      .catch(() => { if (vivo) { setCand({ ambito: { departamento: null, provincia: null, distrito: null }, bloques: [] }); setCandLoading(false) } })
    return () => { vivo = false }
  }, [perfil])

  // ── GPS: valida radio 50m del colegio ──────────────────────────────────
  const detectarGPS = useCallback(async () => {
    setGpsStatus('loading')
    setGpsMsg('Detectando ubicación GPS para validar radio de 50m del colegio…')

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        setGpsCoords({ lat, lon })

        // Buscar colegio de esta mesa en BD para validar distancia
        const { data: colegio } = await supabase
          .from('colegios')
          .select('latitude, longitude, nombre')
          .eq('distrito', perfil?.distrito_asignado ?? '')
          .not('latitude', 'is', null)
          .limit(1)
          .single()

        if (colegio?.latitude && colegio?.longitude) {
          const dist = Math.round(haversineM(lat, lon, colegio.latitude, colegio.longitude))
          if (dist <= 50) {
            setGpsStatus('ok')
            setGpsMsg(`Ubicación verificada — ${dist}m del ${colegio.nombre}`)
          } else {
            setGpsStatus('warn')
            setGpsMsg(`Fuera de rango: ${dist}m del colegio (máx 50m). Puedes continuar pero se registrará.`)
          }
        } else {
          setGpsStatus('ok')
          setGpsMsg('Ubicación GPS registrada')
        }
      },
      () => {
        setGpsStatus('fail')
        setGpsMsg('No se pudo obtener la ubicación. Activa el GPS.')
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }, [perfil])

  // ── Foto de instalación de mesa (evidencia previa al escrutinio) ───────
  const tomarFotoInstalacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!mesa.trim()) { setError('Ingresa el número de mesa antes de tomar la foto de instalación.'); return }
    const mime = file.type || 'image/jpeg'

    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      setSubiendoInstalacion(true)
      setError('')
      try {
        const url = await subirImagenActa(mesa.trim(), dataUrl, mime)
        if (!url) { setError('No se pudo subir la foto. Inténtalo de nuevo.'); setSubiendoInstalacion(false); return }

        const dep  = cand?.ambito.departamento ?? perfil?.departamento_asignado ?? perfil?.departamento_vota ?? null
        const prov = cand?.ambito.provincia    ?? perfil?.provincia_asignado    ?? perfil?.provincia_vota    ?? null
        const dist = cand?.ambito.distrito     ?? perfil?.distrito_asignado     ?? perfil?.distrito_vota     ?? null

        await supabase.from('actas').upsert({
          mesa_numero:          mesa.trim(),
          colegio_nombre:       perfil?.local_asignado ?? perfil?.local_votacion ?? null,
          departamento:         dep,
          provincia:            prov,
          distrito:             dist,
          personero_id:         userId || null,
          personero_dni:        perfil?.dni ?? null,
          foto_instalacion_url: url,
          instalada_at:         new Date().toISOString(),
        }, { onConflict: 'mesa_numero' })

        setFotoInstalacion(url)
      } catch {
        setError('No se pudo guardar la foto de instalación. Inténtalo de nuevo.')
      }
      setSubiendoInstalacion(false)
    }
    reader.readAsDataURL(file)
  }

  // ── Manejar foto ────────────────────────────────────────────────────────
  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const mime = file.type || 'image/jpeg'
    setImgMime(mime)

    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      setImgSrc(dataUrl)

      if (modo === 'IMAGEN') {
        setOcrLoading(true)
        try {
          const base64 = dataUrl.split(',')[1]
          const resultado = await procesarActa(base64, mime, geminiKey)
          setOcrMetodo(resultado.metodo)

          if (resultado.votos.length > 0) {
            // Mapear resultados OCR a los candidatos de cada bloque cargado.
            // El OCR devuelve {partido, provincial, distrital}: 'provincial' se
            // usa para el bloque PROVINCIAL y 'distrital' para el DISTRITAL.
            const nuevos: VotosPorNivel = { REGIONAL: {}, PROVINCIAL: {}, DISTRITAL: {} }
            for (const b of bloques) {
              const lista = [...b.candidatos, ...VOTOS_ESPECIALES]
              resultado.votos.forEach(v => {
                const c = matchCandidato(lista, v.partido)
                if (!c) return
                const n = b.nivel === 'DISTRITAL' ? v.distrital : v.provincial
                if (n > 0) nuevos[b.nivel][c.id] = n
              })
            }
            setVotos(nuevos)
          }
        } catch {
          setError('No se pudo procesar el acta automáticamente. Ingresa los votos manualmente.')
        }
        setOcrLoading(false)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const cambiarVoto = (nivel: NivelCandidatura, id: string, delta: number) => {
    setVotos(prev => ({
      ...prev,
      [nivel]: { ...prev[nivel], [id]: Math.max(0, (prev[nivel][id] || 0) + delta) },
    }))
  }

  const totalNivel = (nivel: NivelCandidatura) =>
    Object.values(votos[nivel]).reduce((a, b) => a + b, 0)
  const granTotal = (['REGIONAL', 'PROVINCIAL', 'DISTRITAL'] as NivelCandidatura[])
    .reduce((s, n) => s + totalNivel(n), 0)

  // ── Enviar acta ─────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!mesa.trim()) { setError('Ingresa el número de mesa.'); return }
    if (!bloques.length) { setError('No hay listas de candidatos cargadas para tu ámbito. Avisa a tu coordinador.'); return }
    if (granTotal === 0) { setError('Ingresa al menos un voto.'); return }
    setEnviando(true); setError('')

    try {
      // Verificar bloqueo
      const { data: existente } = await supabase
        .from('actas').select('id, bloqueada').eq('mesa_numero', mesa).maybeSingle()
      if (existente?.bloqueada) {
        setError('El conteo ya fue transmitido y se encuentra bloqueado (solo 1 envío permitido).')
        setEnviando(false); return
      }

      // Subir imagen si hay foto
      let imagenUrl: string | null = null
      if (imgSrc) {
        setError('')
        imagenUrl = await subirImagenActa(mesa, imgSrc, imgMime)
      }

      const dep  = cand?.ambito.departamento ?? perfil?.departamento_asignado ?? perfil?.departamento_vota ?? null
      const prov = cand?.ambito.provincia    ?? perfil?.provincia_asignado    ?? perfil?.provincia_vota    ?? null
      const dist = cand?.ambito.distrito     ?? perfil?.distrito_asignado     ?? perfil?.distrito_vota     ?? null
      const electores = electoresHabiles.trim() ? parseInt(electoresHabiles.replace(/\D/g, ''), 10) : null

      // Crear/actualizar acta
      const { data: acta, error: actaErr } = await supabase.from('actas').upsert({
        mesa_numero:       mesa.trim(),
        colegio_nombre:    perfil?.local_asignado ?? perfil?.local_votacion ?? null,
        departamento:      dep,
        provincia:         prov,
        distrito:          dist,
        electores_habiles: Number.isFinite(electores as number) ? electores : null,
        personero_id:      userId || null,
        personero_dni:     perfil?.dni ?? null,
        imagen_url:        imagenUrl,
        metodo:            modo,
        ocr_raw:           ocrMetodo ? { metodo: ocrMetodo } : null,
        estado:            'TRANSMITIDA',
        bloqueada:         true,
        latitude:          gpsCoords?.lat ?? null,
        longitude:         gpsCoords?.lon ?? null,
        gps_valido:        gpsStatus === 'ok',
        transmitida_at:    new Date().toISOString(),
      }, { onConflict: 'mesa_numero' }).select().single()

      if (actaErr) throw actaErr

      // Insertar votos de todos los niveles (filtrar ceros)
      const filas = bloques.flatMap(b => {
        const lista = [...b.candidatos, ...VOTOS_ESPECIALES]
        return Object.entries(votos[b.nivel])
          .map(([id, cantidad]) => {
            const c = lista.find(x => x.id === id)
            return {
              acta_id:      acta.id,
              mesa_numero:  mesa,
              nivel:        b.nivel,
              departamento: dep,
              provincia:    prov,
              distrito:     dist,
              partido:      c?.partido ?? id,
              candidato:    c?.nombre || null,
              cantidad,
            }
          })
          .filter(f => f.cantidad > 0)
      })

      if (filas.length) await supabase.from('votos').insert(filas)

      if (userId) await supabase.from('profiles').update({ acta_transmitida: true }).eq('id', userId)
      setFase('enviado')
    } catch (e: any) {
      setError(e.message ?? 'Error al transmitir. Inténtalo de nuevo.')
    }
    setEnviando(false)
  }

  const guardarGeminiKey = async () => {
    if (authId) await saveGeminiKey(authId, geminiKey)
    setShowKeyInput(false)
  }

  // ── ENVIADO ─────────────────────────────────────────────────────────────
  if (fase === 'enviado') return (
    <div className="min-h-[calc(100svh-80px)] flex flex-col items-center justify-center p-6 text-center space-y-5 fade-in">
      <div className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
        <CheckCircle size={40} className="text-green-400" />
      </div>
      <h2 className="text-white font-bold text-xl">Acta ya Transmitida</h2>
      <p className="text-white/50 text-sm max-w-xs">
        Mesa <span className="text-white font-mono font-bold">{perfil?.mesa_asignada ?? mesa}</span> —
        solo 1 envío permitido.
      </p>
    </div>
  )

  // ── PANTALLA ÚNICA DE CONTEO (personero) ────────────────────────────────
  const gpsBtn =
    gpsStatus === 'ok'   ? 'text-green-400 border-green-500/40' :
    gpsStatus === 'warn' ? 'text-yellow-400 border-yellow-500/40' :
    gpsStatus === 'fail' ? 'text-red-400 border-red-500/40' :
                           'text-green-400 border-green-500/40'

  const ambitoTxt = [cand?.ambito.distrito, cand?.ambito.provincia, cand?.ambito.departamento]
    .filter(Boolean).join(', ')
  const centro = perfil?.local_asignado ?? perfil?.local_votacion ?? 'Sin centro asignado'
  const distritoTxt = perfil?.distrito_asignado ?? perfil?.distrito_vota ?? cand?.ambito.distrito ?? '—'

  const personeroCard = (
    <div className="bg-[#131a2e] border border-white/10 rounded-2xl p-4 flex items-center gap-3">
      <UserCircle2 size={26} className="text-white/70 flex-shrink-0" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-white/35 font-bold">Personero</p>
        <p className="text-white font-bold text-sm truncate">{perfil?.nombre_completo ?? '—'}</p>
        <p className="text-white/40 text-xs truncate">
          DNI: {perfil?.dni ?? '—'} <span className="mx-1 text-white/20">|</span> Distrito: {distritoTxt}
        </p>
      </div>
      <button onClick={detectarGPS}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border bg-white/[0.02] flex-shrink-0 ${gpsBtn}`}>
        {gpsStatus === 'loading'
          ? <Loader size={13} className="animate-spin" />
          : <MapPin size={13} />}
        <span className="hidden sm:inline">Confirmar Llegada</span>
      </button>
      <button onClick={() => supabase.auth.signOut()}
        className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center flex-shrink-0">
        <LogOut size={15} />
      </button>
    </div>
  )

  // ── LANDING: instalación de mesa + elegir método de escrutinio ──────────
  if (vista === 'landing') return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4 fade-in">
      {personeroCard}

      {gpsMsg && (
        <p className={`text-xs px-2 -mt-1 ${
          gpsStatus === 'warn' ? 'text-yellow-400' :
          gpsStatus === 'fail' ? 'text-red-400' : 'text-green-400'}`}>
          {gpsMsg}
        </p>
      )}

      {/* Instalación de Mesa de Sufragio */}
      <div className="bg-gradient-to-br from-sky-500/[0.06] to-[#131a2e] border border-sky-500/25 rounded-2xl p-4 space-y-3 shadow-[0_0_24px_-8px_rgba(56,189,248,0.25)]">
        <p className="flex items-center gap-2 text-sky-400 font-extrabold text-sm">
          <span className="w-6 h-6 rounded-md bg-sky-500 flex items-center justify-center flex-shrink-0">
            <Camera size={13} className="text-white" />
          </span>
          Instalación de Mesa de Sufragio
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-white/40 text-[11px] font-semibold mb-1 block">Mesa de sufragio:</label>
            <input value={mesa} onChange={e => { setMesa(e.target.value); setMesaConfirmada(false) }}
              placeholder="000000"
              className="w-full bg-[#0b0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 outline-none focus:border-sky-500/50" />
          </div>
          <div>
            <label className="text-white/40 text-[11px] font-semibold mb-1 block">Centro de votación:</label>
            <input value={centro} disabled readOnly
              className="w-full bg-[#0b0f1d]/60 border border-white/10 rounded-xl px-4 py-2.5 text-white/50 text-sm outline-none cursor-not-allowed" />
          </div>
          <button onClick={() => instalacionInputRef.current?.click()} disabled={subiendoInstalacion}
            className="py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 whitespace-nowrap">
            {subiendoInstalacion
              ? <Loader size={15} className="animate-spin" />
              : fotoInstalacion ? <CheckCircle size={15} /> : <Camera size={15} />}
            {fotoInstalacion ? 'Foto lista' : 'Tomar Foto'}
          </button>
          <input ref={instalacionInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={tomarFotoInstalacion} />
        </div>
        {fotoInstalacion && (
          <div className="flex items-center gap-2 rounded-xl overflow-hidden border border-white/10 w-fit">
            <img src={fotoInstalacion} alt="Instalación de mesa" className="h-14 w-20 object-cover" />
            <span className="pr-3 text-green-400 text-[11px] font-semibold flex items-center gap-1">
              <CheckCircle size={12} /> Evidencia guardada
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className={`flex items-center gap-1.5 text-sm font-semibold cursor-pointer ${mesaConfirmada ? 'text-sky-400' : 'text-white/40'}`}>
            <input type="checkbox" checked={mesaConfirmada}
              onChange={e => setMesaConfirmada(e.target.checked && !!mesa.trim())}
              className="accent-sky-500 w-4 h-4" />
            Confirmar mesa
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sky-400 text-xs font-semibold flex-shrink-0">Electores hábiles:</span>
            <input value={electoresHabiles} inputMode="numeric"
              onChange={e => setElectoresHabiles(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ej. 300"
              className="w-24 bg-[#0b0f1d] border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs placeholder-white/25 outline-none focus:border-sky-500/50 tabular-nums" />
          </div>
        </div>
      </div>

      {/* Escrutinio: elegir método */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="flex items-center gap-2 text-white font-extrabold text-sm">
            <Layers size={16} className="text-white/60" /> Escrutinio
          </p>
          <span className="text-white/30 text-[11px] font-mono">Mesa de sufragio {mesa.trim() || '---'}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <TarjetaEscrutinio
            color="sky" icon={PencilLine}
            titulo="Registro Manual"
            desc="Ingreso casilla por casilla para candidatos y actas."
            botonLabel="Registro Manual"
            onIniciar={() => { setModo('MANUAL'); setVista('conteo') }}
            onVer={() => setVerModal('MANUAL')}
          />
          <TarjetaEscrutinio
            color="violet" icon={Camera}
            titulo="Conteo por Imagen (OCR)"
            desc="Escaneo inteligente de actas con IA y extracción de votos."
            botonLabel="Escanear Acta"
            onIniciar={() => { setModo('IMAGEN'); setVista('conteo') }}
            onVer={() => setVerModal('IMAGEN')}
          />
        </div>
      </div>

      {verModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4 fade-in"
          onClick={() => setVerModal(null)}>
          <div className="w-full max-w-sm bg-[#121829] border border-white/10 rounded-3xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">
                {verModal === 'MANUAL' ? 'Registro Manual' : 'Conteo por Imagen (OCR)'}
              </h3>
              <button onClick={() => setVerModal(null)} className="text-white/40 hover:text-white/70">
                <X size={18} />
              </button>
            </div>
            {granTotal === 0 ? (
              <p className="text-white/40 text-xs">Aún no has registrado votos.</p>
            ) : (
              <div className="grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${bloques.length + 1}, minmax(0, 1fr))` }}>
                {bloques.map(b => (
                  <div key={b.nivel}>
                    <p className="text-white/40 text-[9px] uppercase tracking-widest font-semibold">{b.nivel}</p>
                    <p className="text-white text-base font-extrabold tabular-nums">{totalNivel(b.nivel)}</p>
                  </div>
                ))}
                <div>
                  <p className="text-white/40 text-[9px] uppercase tracking-widest font-semibold">Total</p>
                  <p className="text-sky-400 text-base font-extrabold tabular-nums">{granTotal}</p>
                </div>
              </div>
            )}
            <p className="text-white/30 text-[11px]">Estado: Pendiente de transmisión.</p>
          </div>
        </div>
      )}
    </div>
  )

  // ── CONTEO: candidatos del método elegido ────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4 fade-in">

      {/* Volver + método activo */}
      <div className="flex items-center gap-3">
        <button onClick={() => setVista('landing')}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={17} />
        </button>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm truncate">
            {modo === 'MANUAL' ? 'Registro Manual' : 'Conteo por Imagen (OCR)'}
          </p>
          <p className="text-white/35 text-xs truncate">
            Mesa {mesa.trim() || '000000'} {'·'} {centro}
          </p>
        </div>
      </div>

      {/* Modo IMAGEN: foto del acta + OCR */}
      {modo === 'IMAGEN' && (
        <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 space-y-3">
          <div onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center cursor-pointer hover:border-sky-500/50 transition-all">
            <Camera size={32} className="mx-auto text-white/25 mb-2" />
            <p className="text-white/50 text-sm">Toca para abrir la cámara / subir foto del acta</p>
            <p className="text-white/25 text-xs mt-1">Se procesa con IA automáticamente</p>
          </div>
          {imgSrc && (
            <div className="rounded-xl overflow-hidden border border-white/10">
              <img src={imgSrc} alt="Acta" className="w-full object-contain max-h-48" />
            </div>
          )}
          {ocrLoading && (
            <p className="flex items-center gap-2 text-sky-300 text-xs">
              <Loader size={14} className="animate-spin" /> Procesando acta con IA…
            </p>
          )}
          {ocrMetodo && !ocrLoading && (
            <p className={`flex items-center gap-1.5 text-xs font-medium ${ocrMetodo === 'GEMINI' ? 'text-green-300' : 'text-yellow-300'}`}>
              <CheckCircle size={13} /> Votos reconocidos ({ocrMetodo}) — revísalos abajo.
            </p>
          )}
          <button onClick={() => setShowKeyInput(!showKeyInput)}
            className="w-full flex items-center justify-between text-white/50 text-xs pt-1">
            <span className="flex items-center gap-1.5">
              <Key size={12} className={geminiKey ? 'text-green-400' : 'text-white/30'} />
              Clave OCR Gemini {geminiKey ? '(configurada)' : '(opcional)'}
            </span>
            {showKeyInput ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showKeyInput && (
            <div className="space-y-2">
              <input value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="AIzaSy…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:border-sky-500/50" />
              <button onClick={guardarGeminiKey}
                className="w-full py-2 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-medium">
                Guardar clave
              </button>
              <p className="text-white/25 text-xs">Sin clave usa Tesseract como fallback.</p>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
        </div>
      )}

      {/* Banner de conteo */}
      <div className="bg-gradient-to-r from-sky-950/80 to-[#131a2e] border border-sky-500/20 rounded-2xl px-4 py-3 flex items-center gap-2">
        <UserCheck size={15} className="text-sky-400 flex-shrink-0" />
        <span className="text-sky-300 font-bold text-xs uppercase tracking-wider">
          {modo === 'MANUAL' ? 'Conteo Manual Oficial' : 'Conteo por Imagen Oficial'}
        </span>
      </div>

      {/* Cabeceras de columna */}
      <div className="flex items-center justify-between px-3 text-white/30 text-[10px] font-bold uppercase tracking-widest">
        <span>Partido {'·'} Candidato</span>
        <span>Conteo votos</span>
      </div>

      {/* Estado de carga de candidaturas */}
      {candLoading && (
        <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-6 flex items-center justify-center gap-2 text-white/40 text-sm">
          <Loader size={16} className="animate-spin" /> Cargando listas de tu ámbito…
        </div>
      )}

      {!candLoading && bloques.length === 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-5 space-y-1.5">
          <p className="text-red-300 font-bold text-sm flex items-center gap-2">
            <AlertTriangle size={15} /> Sin listas de candidatos para tu ámbito
          </p>
          <p className="text-red-200/70 text-xs">
            {ambitoTxt
              ? <>No hay candidaturas cargadas para <span className="font-semibold">{ambitoTxt}</span>. Avisa a tu coordinador antes de la jornada.</>
              : <>Tu perfil no tiene distrito/provincia asignado. Avisa a tu coordinador.</>}
          </p>
        </div>
      )}

      {/* Secciones dinámicas por nivel (Regional / Provincial / Distrital) */}
      {!candLoading && bloques.map(b => (
        <SeccionVotos
          key={b.nivel}
          bloque={b}
          total={totalNivel(b.nivel)}
          votos={votos[b.nivel]}
          onDelta={(id, d) => cambiarVoto(b.nivel, id, d)}
        />
      ))}

      {/* Resumen */}
      {bloques.length > 0 && (
        <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 grid gap-2 text-center"
          style={{ gridTemplateColumns: `repeat(${bloques.length + 1}, minmax(0, 1fr))` }}>
          {bloques.map(b => (
            <div key={b.nivel}>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">{b.nivel}</p>
              <p className="text-white text-lg font-extrabold tabular-nums">{totalNivel(b.nivel)}</p>
            </div>
          ))}
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Gran Total</p>
            <p className="text-sky-400 text-lg font-extrabold tabular-nums">{granTotal}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Transmitir */}
      <button onClick={enviar} disabled={enviando || ocrLoading || !mesa.trim() || !mesaConfirmada || !bloques.length}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]">
        {enviando
          ? <><Loader size={16} className="animate-spin" /> Transmitiendo…</>
          : <><Send size={16} /> Transmitir {modo === 'MANUAL' ? 'Resultados Manuales' : 'Acta'}</>}
      </button>
      {!mesaConfirmada && (
        <p className="text-white/30 text-xs text-center">
          Ingresa el N° de mesa y marca "Confirmar" para habilitar el envío.
        </p>
      )}
    </div>
  )
}

// ── Tarjeta de método de escrutinio (Registro Manual / Conteo por Imagen) ────
function TarjetaEscrutinio({ color, icon: Icon, titulo, desc, botonLabel, onIniciar, onVer }: {
  color: 'sky' | 'violet'; icon: LucideIcon
  titulo: string; desc: string; botonLabel: string
  onIniciar: () => void; onVer: () => void
}) {
  const tema = color === 'sky'
    ? { fondo: 'from-sky-500/10 to-[#131a2e] border-sky-500/20', icono: 'bg-sky-500', boton: 'bg-sky-500 hover:bg-sky-400' }
    : { fondo: 'from-violet-500/10 to-[#131a2e] border-violet-500/20', icono: 'bg-violet-500', boton: 'bg-gradient-to-r from-purple-600 to-violet-500 hover:opacity-90' }
  return (
    <div className={`bg-gradient-to-br ${tema.fondo} border rounded-2xl p-3.5 flex flex-col gap-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tema.icono}`}>
          <Icon size={16} className="text-white" />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-white/10 text-white/50 flex-shrink-0">
          Pendiente
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-white font-bold text-xs leading-tight">{titulo}</p>
        <p className="text-white/40 text-[10px] leading-snug mt-1">{desc}</p>
      </div>
      <div className="mt-auto space-y-1.5">
        <button onClick={onIniciar}
          className={`w-full py-2 rounded-xl text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${tema.boton}`}>
          <Icon size={12} /> {botonLabel}
        </button>
        <button onClick={onVer}
          className="w-full py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[11px] font-semibold flex items-center justify-center gap-1.5">
          <Eye size={12} /> Ver
        </button>
      </div>
    </div>
  )
}

// ── Sección de candidatos de un nivel (Regional / Provincial / Distrital) ────
function SeccionVotos({ bloque, total, votos, onDelta }: {
  bloque: BloqueCandidaturas; total: number
  votos: Record<string, number>; onDelta: (id: string, delta: number) => void
}) {
  const esProv = bloque.nivel === 'PROVINCIAL'
  const barra   = esProv ? 'border-sky-500 bg-sky-500/5'   : 'border-emerald-500 bg-emerald-500/5'
  const tinta   = esProv ? 'text-sky-300'                  : 'text-emerald-300'
  const icono   = esProv ? 'text-sky-400'                  : 'text-emerald-400'
  const accent: 'metro' | 'distrital' = esProv ? 'metro' : 'distrital'
  return (
    <div className="bg-[#131a2e] border border-white/8 rounded-2xl overflow-hidden">
      {/* Cabecera de sección */}
      <div className={`flex items-start justify-between gap-2 pl-4 pr-3 py-3 border-l-4 ${barra}`}>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapIcon size={13} className={`${icono} flex-shrink-0`} />
            <p className={`text-[11px] font-extrabold uppercase tracking-wide leading-tight ${tinta}`}>
              {bloque.titulo} ({bloque.candidatos.length} listas)
            </p>
          </div>
          {bloque.provisional && (
            <span className="inline-block text-[9px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border text-amber-300/90 border-amber-500/30 bg-amber-500/10">
              Lista provisional — verifica contra tu acta física
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white/35 text-[9px] uppercase tracking-widest font-semibold">Votos</p>
          <p className="text-white text-xl font-black tabular-nums leading-none mt-0.5">{total}</p>
        </div>
      </div>
      {/* Filas */}
      <div className="divide-y divide-white/[0.06] max-h-[60vh] overflow-y-auto">
        {[...bloque.candidatos, ...VOTOS_ESPECIALES].map(c => (
          <FilaCandidato key={c.id} candidato={c} accent={accent} value={votos[c.id] || 0} onDelta={d => onDelta(c.id, d)} />
        ))}
      </div>
    </div>
  )
}

// ── Fila individual con controles +/- ────────────────────────────────────────
function FilaCandidato({ candidato, accent, value, onDelta }: {
  candidato: Candidato; accent: 'metro' | 'distrital'
  value: number; onDelta: (delta: number) => void
}) {
  const activa = accent === 'metro'
    ? 'bg-sky-500/[0.07] border-l-2 border-sky-500'
    : 'bg-emerald-500/[0.07] border-l-2 border-emerald-500'
  const mas = accent === 'metro' ? 'bg-sky-500 hover:bg-sky-400' : 'bg-emerald-500 hover:bg-emerald-400'
  const esLista = candidato.id.startsWith('cand_')
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${value > 0 ? activa : 'border-l-2 border-transparent'}`}>
      <div className="relative w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
        <span className="text-[0.55rem] font-black leading-none text-center px-0.5" style={{ color: candidato.color }}>
          {candidato.letra}
        </span>
        {esLista ? (
          <img
            src={`/partidos/${slugPartido(candidato.partido)}.png`}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain p-0.5 bg-white"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        {candidato.nombre ? (
          <>
            <p className="text-white text-xs font-bold leading-tight truncate">{candidato.nombre}</p>
            <p className="text-white/40 text-[10px] leading-tight mt-0.5 truncate">{candidato.partido}</p>
          </>
        ) : (
          <p className="text-white text-xs font-bold leading-tight truncate">{candidato.partido}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button type="button" onClick={() => onDelta(-1)} disabled={value === 0}
          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/60 disabled:opacity-30 flex items-center justify-center transition-all">
          <Minus size={13} />
        </button>
        <span className="w-10 text-center text-sm font-extrabold tabular-nums text-white border border-white/10 rounded-lg py-1">{value}</span>
        <button type="button" onClick={() => onDelta(1)}
          className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-all ${mas}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
