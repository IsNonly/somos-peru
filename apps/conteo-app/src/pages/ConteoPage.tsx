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

const normTxt = (s: string) =>
  s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const bigramas = (s: string) => {
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

// Similitud de Dice sobre bigramas de caracteres: tolera el ruido típico del
// OCR (letras cambiadas, palabras pegadas) mucho mejor que comparar substrings
// exactos, sin depender de que las palabras queden en el mismo orden.
const similitud = (a: string, b: string) => {
  const A = bigramas(a), B = bigramas(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const bg of A) if (B.has(bg)) inter++
  return (2 * inter) / (A.size + B.size)
}

// Umbral mínimo para aceptar una coincidencia: por debajo de esto el texto que
// leyó el OCR está demasiado distorsionado como para confiar en qué partido es
// -mejor no contarlo (queda en 0, se llena a mano) que asignarlo al equivocado.
const UMBRAL_COINCIDENCIA = 0.4

// Busca, entre TODOS los candidatos, el que más se parece al texto reconocido
// por OCR (no el primero que "casi" calza) y solo lo acepta si supera el umbral.
function matchCandidato(lista: Candidato[], texto: string): Candidato | undefined {
  const t = normTxt(texto)
  if (!t) return undefined
  let mejor: Candidato | undefined
  let mejorScore = 0
  for (const c of lista) {
    for (const nombre of [c.partido, c.nombre].filter(Boolean) as string[]) {
      const score = similitud(t, normTxt(nombre))
      if (score > mejorScore) { mejorScore = score; mejor = c }
    }
  }
  return mejorScore >= UMBRAL_COINCIDENCIA ? mejor : undefined
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
const NIVELES: NivelCandidatura[] = ['REGIONAL', 'PROVINCIAL', 'DISTRITAL']

// ONPE emite un acta FÍSICA SEPARADA por cada nivel (Gobernador Regional,
// Alcaldía Provincial, Alcaldía Distrital) -no siempre viene todo en una sola
// hoja combinada-, así que cada nivel necesita su propia foto y su propio
// resultado de OCR en vez de una sola foto global para toda la mesa.
interface FotoNivelState {
  imgSrc: string | null
  imgMime: string
  ocrLoading: boolean
  ocrMetodo: 'GEMINI' | 'TESSERACT' | null
  ocrSinMatch: boolean
  ocrGeminiError: string
}
const FOTO_NIVEL_VACIA: FotoNivelState = {
  imgSrc: null, imgMime: 'image/jpeg', ocrLoading: false, ocrMetodo: null, ocrSinMatch: false, ocrGeminiError: '',
}
const FOTOS_VACIAS: Record<NivelCandidatura, FotoNivelState> = {
  REGIONAL: { ...FOTO_NIVEL_VACIA }, PROVINCIAL: { ...FOTO_NIVEL_VACIA }, DISTRITAL: { ...FOTO_NIVEL_VACIA },
}

function ConteoPageInner() {
  const [perfil, setPerfil]           = useState<any>(null)
  const [userId, setUserId]           = useState('')   // id real del perfil (para escrituras)
  const [authId, setAuthId]           = useState('')   // id de auth (para app_config)
  const [mesa, setMesa]               = useState('')
  const [mesaConfirmada, setMesaConfirmada] = useState(false)
  // Validación contra el padrón oficial de mesas (tabla `mesas`, importada de ONPE):
  // evita que se confirme un número de mesa inventado o mal tipeado -antes solo se
  // exigían 6 dígitos, sin verificar que esa mesa exista de verdad-.
  const [mesaValida, setMesaValida]   = useState<'idle' | 'checking' | 'ok' | 'no'>('idle')
  const [mesaOficial, setMesaOficial] = useState<{ colegio_nombre: string; total_electores: number } | null>(null)
  // Si esta instancia todavía no tiene cargado su padrón oficial de mesas (tabla
  // `mesas` vacía), la validación no debe bloquear a nadie -solo se exige cuando
  // hay una lista real contra la cual comparar-.
  const [hayPadronMesas, setHayPadronMesas] = useState<boolean | null>(null)
  const [electoresHabiles, setElectoresHabiles] = useState('')
  const [modo, setModo]               = useState<Modo>('MANUAL')
  const [vista, setVista]             = useState<'landing' | 'conteo'>('landing')
  const [verModal, setVerModal]       = useState<Modo | null>(null)
  const [fase, setFase]               = useState<Fase>('setup')
  const [cand, setCand]               = useState<Candidaturas | null>(null)
  const [candLoading, setCandLoading] = useState(true)
  const [votos, setVotos]             = useState<VotosPorNivel>(VOTOS_VACIOS)
  const [fotos, setFotos]             = useState<Record<NivelCandidatura, FotoNivelState>>(FOTOS_VACIAS)
  const [gpsStatus, setGpsStatus]     = useState<'idle' | 'loading' | 'ok' | 'warn' | 'fail'>('idle')
  const [gpsMsg, setGpsMsg]           = useState('')
  const [gpsCoords, setGpsCoords]     = useState<{ lat: number; lon: number } | null>(null)
  const [enviando, setEnviando]       = useState(false)
  const [error, setError]             = useState('')
  const [geminiKey, setGeminiKey]     = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const inputRefs = useRef<Record<NivelCandidatura, HTMLInputElement | null>>({ REGIONAL: null, PROVINCIAL: null, DISTRITAL: null })

  const setFotoNivel = (nivel: NivelCandidatura, patch: Partial<FotoNivelState>) =>
    setFotos(prev => ({ ...prev, [nivel]: { ...prev[nivel], ...patch } }))

  // Foto de instalación de mesa (evidencia previa al escrutinio)
  const [fotoInstalacion, setFotoInstalacion]   = useState<string | null>(null)
  const [subiendoInstalacion, setSubiendoInstalacion] = useState(false)
  const instalacionInputRef = useRef<HTMLInputElement>(null)

  const bloques = cand?.bloques ?? []

  // Si el PCV ya le asignó oficialmente una mesa (mesa_asignada en su perfil, ver
  // "Asignar mesa" en el Panel del PCV), no debe poder escribir un número distinto
  // a mano -el campo se muestra bloqueado con la mesa que le corresponde de verdad-.
  const mesaAsignadaOficialmente = !!perfil?.mesa_asignada

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
      // Si el personero no configuró su propia clave, cae a la clave compartida
      // de la instancia (VITE_GEMINI_API_KEY) para que el OCR con IA funcione
      // sin que cada uno tenga que pegarla a mano.
      setGeminiKey(key || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '')
      if (p?.mesa_asignada) setMesa(p.mesa_asignada)
      if (p?.acta_transmitida) setFase('enviado')

      // Si ya se tomó la foto de instalación o se guardaron electores hábiles
      // antes (ej. se cerró el navegador a medio llenar), recuperarlos.
      if (p?.mesa_asignada) {
        const { data: acta } = await supabase.from('actas')
          .select('foto_instalacion_url, electores_habiles').eq('mesa_numero', p.mesa_asignada).maybeSingle()
        if (acta?.foto_instalacion_url) setFotoInstalacion(acta.foto_instalacion_url)
        if (acta?.electores_habiles != null) setElectoresHabiles(String(acta.electores_habiles))
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

        let distancia: number | null = null
        if (colegio?.latitude && colegio?.longitude) {
          distancia = Math.round(haversineM(lat, lon, colegio.latitude, colegio.longitude))
          if (distancia <= 50) {
            setGpsStatus('ok')
            setGpsMsg(`Ubicación verificada — ${distancia}m del ${colegio.nombre}`)
          } else {
            setGpsStatus('warn')
            setGpsMsg(`Fuera de rango: ${distancia}m del colegio (máx 50m). Puedes continuar pero se registrará.`)
          }
        } else {
          setGpsStatus('ok')
          setGpsMsg('Ubicación GPS registrada')
        }

        // Guarda/actualiza la asistencia de "LLEGADA" — esto es lo que lee el
        // panel de monitoreo de coordinadores (antes solo quedaba en el
        // estado local de React y nunca llegaba a la base de datos).
        if (userId) {
          const payload = {
            user_id: userId,
            distrito: perfil?.distrito_asignado ?? perfil?.distrito_vota ?? null,
            colegio_nombre: perfil?.local_asignado ?? perfil?.local_votacion ?? null,
            mesa_numero: perfil?.mesa_asignada ?? (mesa || null),
            latitude: lat,
            longitude: lon,
            distancia_m: distancia,
            tipo: 'LLEGADA',
          }
          const { data: existente } = await supabase.from('asistencias')
            .select('id').eq('user_id', userId).eq('tipo', 'LLEGADA').maybeSingle()
          if (existente) await supabase.from('asistencias').update(payload).eq('id', existente.id)
          else await supabase.from('asistencias').insert(payload)
        }
      },
      () => {
        setGpsStatus('fail')
        setGpsMsg('No se pudo obtener la ubicación. Activa el GPS.')
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }, [perfil, userId, mesa])

  // ¿Esta instancia ya tiene cargado su padrón oficial de mesas? Se chequea una sola
  // vez al montar -si está vacío (aún no se importó para este distrito), la
  // validación de abajo no debe bloquear a nadie-.
  useEffect(() => {
    supabase.from('mesas').select('id', { count: 'exact', head: true })
      .then(({ count }) => setHayPadronMesas((count ?? 0) > 0))
  }, [])

  // Verifica el número de mesa contra el padrón oficial (tabla `mesas`, importada de
  // ONPE) apenas se completan los 6 dígitos -antes solo se exigía el largo, sin
  // confirmar que la mesa exista de verdad-. Si "Electores hábiles" está vacío, se
  // prellena con el dato oficial (el personero lo puede corregir si hace falta).
  useEffect(() => {
    if (mesa.length !== 6) { setMesaValida('idle'); setMesaOficial(null); return }
    if (!hayPadronMesas) { setMesaValida('idle'); setMesaOficial(null); return }
    // Ya viene validada de origen: la asignó el PCV desde el padrón oficial mismo.
    if (mesaAsignadaOficialmente) { setMesaValida('ok'); return }
    let vivo = true
    setMesaValida('checking')
    supabase.from('mesas').select('colegio_nombre, total_electores').eq('numero', mesa).maybeSingle()
      .then(({ data }) => {
        if (!vivo) return
        if (data) {
          setMesaValida('ok')
          setMesaOficial({ colegio_nombre: data.colegio_nombre, total_electores: data.total_electores })
          setElectoresHabiles(prev => prev || (data.total_electores ? String(data.total_electores) : prev))
        } else {
          setMesaValida('no')
          setMesaOficial(null)
        }
      })
    return () => { vivo = false }
    // Si el PCV ya se la asignó oficialmente, no hace falta re-verificarla contra
    // el padrón -ya salió de ahí mismo-.
  }, [mesa, hayPadronMesas, mesaAsignadaOficialmente])

  // Campos base que identifican el acta de esta mesa, repetidos en cada
  // guardado parcial (foto de instalación, electores hábiles, envío final).
  const datosBaseActa = useCallback(() => ({
    colegio_nombre: perfil?.local_asignado ?? perfil?.local_votacion ?? null,
    departamento:   cand?.ambito.departamento ?? perfil?.departamento_asignado ?? perfil?.departamento_vota ?? null,
    provincia:      cand?.ambito.provincia    ?? perfil?.provincia_asignado    ?? perfil?.provincia_vota    ?? null,
    distrito:       cand?.ambito.distrito     ?? perfil?.distrito_asignado     ?? perfil?.distrito_vota     ?? null,
    personero_id:   userId || null,
    personero_dni:  perfil?.dni ?? null,
  }), [perfil, cand, userId])

  // Guarda "Electores hábiles" apenas el campo pierde el foco, para no
  // perderlo si el celular falla o se cierra el navegador antes de transmitir
  // (antes solo se guardaba junto con el acta al final del escrutinio).
  const guardarElectores = async () => {
    if (mesa.length !== 6) return
    const num = electoresHabiles.trim() ? parseInt(electoresHabiles.replace(/\D/g, ''), 10) : null
    await supabase.from('actas').upsert({
      mesa_numero: mesa.trim(),
      ...datosBaseActa(),
      electores_habiles: Number.isFinite(num as number) ? num : null,
    }, { onConflict: 'mesa_numero' })
  }

  // ── Foto de instalación de mesa (evidencia previa al escrutinio) ───────
  const tomarFotoInstalacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (mesa.length !== 6) { setError('Ingresa los 6 dígitos del número de mesa antes de tomar la foto de instalación.'); return }
    const mime = file.type || 'image/jpeg'

    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      setSubiendoInstalacion(true)
      setError('')
      try {
        const url = await subirImagenActa(mesa.trim(), dataUrl, mime)
        if (!url) { setError('No se pudo subir la foto. Inténtalo de nuevo.'); setSubiendoInstalacion(false); return }

        await supabase.from('actas').upsert({
          mesa_numero:          mesa.trim(),
          ...datosBaseActa(),
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

  // ── Manejar foto (una por nivel: Regional / Provincial / Distrital) ───────
  const handleFoto = async (nivel: NivelCandidatura, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const mime = file.type || 'image/jpeg'

    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      setFotoNivel(nivel, { imgSrc: dataUrl, imgMime: mime, ocrLoading: true, ocrSinMatch: false, ocrGeminiError: '' })

      try {
        const base64 = dataUrl.split(',')[1]
        const resultado = await procesarActa(base64, mime, geminiKey)

        // Mapear resultados OCR a los candidatos de ESTE nivel únicamente.
        // Cada foto es de un solo nivel (acta física separada por ONPE), así
        // que basta con tomar el valor que trajo el OCR en cualquiera de los
        // 2 campos -algunas actas de un solo nivel igual traen ambos iguales,
        // otras solo llenan uno- sin mezclarlo con los otros niveles.
        const b = bloques.find(x => x.nivel === nivel)
        const lista = b ? [...b.candidatos, ...VOTOS_ESPECIALES] : []
        const nuevosNivel: Record<string, number> = {}
        resultado.votos.forEach(v => {
          const c = matchCandidato(lista, v.partido)
          if (!c) return
          const n = v.distrital > 0 ? v.distrital : v.provincial
          if (n > 0) nuevosNivel[c.id] = n
        })

        // El texto reconocido puede no coincidir con ningún candidato real
        // (típico del fallback Tesseract con actas de mala calidad): en ese
        // caso NO hay que decir "votos reconocidos" -sería falso-, sino
        // avisar que hay que llenarlo a mano.
        if (Object.keys(nuevosNivel).length > 0) {
          setVotos(prev => ({ ...prev, [nivel]: nuevosNivel }))
          setFotoNivel(nivel, { ocrMetodo: resultado.metodo, ocrGeminiError: resultado.geminiError ?? '' })
        } else {
          setFotoNivel(nivel, { ocrMetodo: resultado.metodo, ocrSinMatch: true, ocrGeminiError: resultado.geminiError ?? '' })
        }
      } catch {
        setError('No se pudo procesar el acta automáticamente. Ingresa los votos manualmente.')
      }
      setFotoNivel(nivel, { ocrLoading: false })
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
    if (mesa.length !== 6) { setError('Ingresa los 6 dígitos del número de mesa.'); return }
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

      // Subir las fotos del acta -una por nivel- si las hay
      const imagenesUrl: Partial<Record<NivelCandidatura, string>> = {}
      for (const nivel of NIVELES) {
        const f = fotos[nivel]
        if (!f.imgSrc) continue
        setError('')
        const url = await subirImagenActa(`${mesa}_${nivel}`, f.imgSrc, f.imgMime)
        if (url) imagenesUrl[nivel] = url
      }
      // 'imagen_url' se mantiene con la primera foto para lo que ya lea ese
      // campo; 'imagenes_url' trae el detalle completo por nivel.
      const imagenUrl = Object.values(imagenesUrl)[0] ?? null
      const ocrRaw = Object.fromEntries(
        NIVELES.filter(n => fotos[n].ocrMetodo).map(n => [n, fotos[n].ocrMetodo])
      )

      const base = datosBaseActa()
      const { departamento: dep, provincia: prov, distrito: dist } = base
      const electores = electoresHabiles.trim() ? parseInt(electoresHabiles.replace(/\D/g, ''), 10) : null

      // Crear/actualizar acta
      const { data: acta, error: actaErr } = await supabase.from('actas').upsert({
        mesa_numero:       mesa.trim(),
        ...base,
        electores_habiles: Number.isFinite(electores as number) ? electores : null,
        imagen_url:        imagenUrl,
        imagenes_url:      Object.keys(imagenesUrl).length ? imagenesUrl : null,
        metodo:            modo,
        ocr_raw:           Object.keys(ocrRaw).length ? ocrRaw : null,
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
            <input value={mesa} inputMode="numeric" disabled={mesaAsignadaOficialmente} readOnly={mesaAsignadaOficialmente}
              onChange={e => { setMesa(e.target.value.replace(/\D/g, '').slice(0, 6)); setMesaConfirmada(false) }}
              placeholder="000000"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm placeholder-white/25 outline-none tabular-nums ${
                mesaAsignadaOficialmente
                  ? 'bg-[#0b0f1d]/60 border-white/10 text-white/80 cursor-not-allowed'
                  : 'bg-[#0b0f1d] border-white/10 text-white focus:border-sky-500/50'}`} />
            {mesaAsignadaOficialmente ? (
              <p className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                <CheckCircle size={11} /> Asignada por tu Personero de Centro de Votación
              </p>
            ) : (
              <>
                {mesa.length > 0 && mesa.length < 6 && (
                  <p className="text-amber-400 text-[10px] mt-1">Faltan {6 - mesa.length} dígito{6 - mesa.length === 1 ? '' : 's'}.</p>
                )}
                {mesa.length === 6 && hayPadronMesas && mesaValida === 'checking' && (
                  <p className="text-white/40 text-[10px] mt-1">Verificando mesa…</p>
                )}
                {mesa.length === 6 && mesaValida === 'ok' && mesaOficial && (
                  <p className="text-emerald-400 text-[10px] mt-1 flex items-center gap-1">
                    <CheckCircle size={11} /> Mesa verificada — {mesaOficial.colegio_nombre}
                  </p>
                )}
                {mesa.length === 6 && mesaValida === 'no' && (
                  <p className="text-red-400 text-[10px] mt-1">Esta mesa no existe en el padrón oficial. Revisa el número.</p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="text-white/40 text-[11px] font-semibold mb-1 block">Centro de votación:</label>
            <input value={centro} disabled readOnly
              className="w-full bg-[#0b0f1d]/60 border border-white/10 rounded-xl px-4 py-2.5 text-white/50 text-sm outline-none cursor-not-allowed" />
          </div>
          <button onClick={() => instalacionInputRef.current?.click()} disabled={subiendoInstalacion || mesa.length !== 6}
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
          {(() => {
            // Solo se exige que la mesa esté en el padrón oficial cuando esta
            // instancia ya tiene uno cargado (tabla `mesas`) -si todavía no se
            // importó para este distrito, se acepta con solo los 6 dígitos-.
            const puedeConfirmar = mesa.length === 6 && (!hayPadronMesas || mesaValida === 'ok')
            return (
              <label className={`flex items-center gap-1.5 text-sm font-semibold ${puedeConfirmar ? 'cursor-pointer' : 'cursor-not-allowed'} ${mesaConfirmada ? 'text-sky-400' : 'text-white/40'}`}>
                <input type="checkbox" checked={mesaConfirmada} disabled={!puedeConfirmar}
                  onChange={e => setMesaConfirmada(e.target.checked && puedeConfirmar)}
                  className="accent-sky-500 w-4 h-4" />
                Confirmar mesa
              </label>
            )
          })()}
          <div className="flex items-center gap-2">
            <span className="text-sky-400 text-xs font-semibold flex-shrink-0">Electores hábiles:</span>
            <input value={electoresHabiles} inputMode="numeric"
              onChange={e => setElectoresHabiles(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onBlur={guardarElectores}
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
                  <p className="text-white/40 text-[9px] uppercase tracking-widest font-semibold">Total de Votos Emitidos</p>
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

      {/* Modo IMAGEN: una foto + OCR por cada nivel (ONPE emite un acta física
          separada por nivel -Regional / Provincial / Distrital-, no siempre
          viene todo combinado en una sola hoja) */}
      {modo === 'IMAGEN' && (
        <div className="space-y-3">
          {bloques.length > 1 && (
            <p className="text-white/40 text-[11px] px-1">
              Sube una foto por cada acta: {bloques.map(b => b.titulo).join(' · ')}.
            </p>
          )}
          {bloques.map(b => {
            const f = fotos[b.nivel]
            return (
              <div key={b.nivel} className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 space-y-3">
                {bloques.length > 1 && (
                  <p className="text-white/70 text-xs font-bold">{b.titulo}</p>
                )}
                <div onClick={() => inputRefs.current[b.nivel]?.click()}
                  className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center cursor-pointer hover:border-sky-500/50 transition-all">
                  <Camera size={32} className="mx-auto text-white/25 mb-2" />
                  <p className="text-white/50 text-sm">
                    {f.imgSrc ? 'Toca para reemplazar la foto' : 'Toca para abrir la cámara / subir foto del acta'}
                  </p>
                  <p className="text-white/25 text-xs mt-1">Se procesa con IA automáticamente</p>
                </div>
                {f.imgSrc && (
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <img src={f.imgSrc} alt={`Acta ${b.titulo}`} className="w-full object-contain max-h-48" />
                  </div>
                )}
                {f.ocrLoading && (
                  <p className="flex items-center gap-2 text-sky-300 text-xs">
                    <Loader size={14} className="animate-spin" /> Procesando acta con IA…
                  </p>
                )}
                {f.ocrMetodo && !f.ocrLoading && (
                  f.ocrSinMatch ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-300">
                        <AlertTriangle size={13} /> No se pudo reconocer automáticamente ningún partido en la foto. Ingresa los votos manualmente abajo.
                      </p>
                      {f.ocrGeminiError && (
                        <p className="text-[11px] text-white/40 pl-[19px]">
                          Gemini no respondió ({f.ocrGeminiError}) — se intentó con el respaldo (Tesseract).
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className={`flex items-center gap-1.5 text-xs font-medium ${f.ocrMetodo === 'GEMINI' ? 'text-green-300' : 'text-yellow-300'}`}>
                      <CheckCircle size={13} /> Votos reconocidos ({f.ocrMetodo}) — revísalos abajo.
                    </p>
                  )
                )}
                <input ref={el => { inputRefs.current[b.nivel] = el }} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={e => handleFoto(b.nivel, e)} />
              </div>
            )
          })}
          <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 space-y-3">
            <button onClick={() => setShowKeyInput(!showKeyInput)}
              className="w-full flex items-center justify-between text-white/50 text-xs">
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
          </div>
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
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Total de Votos Emitidos</p>
            <p className="text-sky-400 text-lg font-extrabold tabular-nums">{granTotal}</p>
          </div>
        </div>
      )}

      {/* Votos especiales: blanco/nulo/impugnado desglosados por nivel */}
      {bloques.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${bloques.length}, minmax(0, 1fr))` }}>
          {bloques.map(b => (
            <div key={b.nivel} className="bg-[#131a2e] border border-white/8 rounded-2xl p-3 space-y-2">
              <p className="text-white/35 text-[9px] uppercase tracking-widest font-semibold text-center truncate">{b.nivel}</p>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {VOTOS_ESPECIALES.map(v => (
                  <div key={v.id}>
                    <p className="text-[9px] font-bold truncate" style={{ color: v.color }}>{v.nombre.replace('Votos ', '')}</p>
                    <p className="text-white text-sm font-extrabold tabular-nums">{votos[b.nivel][v.id] || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Transmitir */}
      <button onClick={enviar} disabled={enviando || Object.values(fotos).some(f => f.ocrLoading) || mesa.length !== 6 || !mesaConfirmada || !bloques.length}
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
      {/* Filas de candidatos */}
      <div className="divide-y divide-white/[0.06] max-h-[60vh] overflow-y-auto">
        {bloque.candidatos.map(c => (
          <FilaCandidato key={c.id} candidato={c} accent={accent} value={votos[c.id] || 0} onDelta={d => onDelta(c.id, d)} />
        ))}
      </div>

      {/* Votos especiales (blanco/nulo/impugnado): sección aparte y siempre
          visible (no dentro del scroll), acotada a ESTE nivel — cada bloque
          (Provincial/Distrital) lleva su propio conteo independiente. */}
      <div className="border-t-2 border-white/10 bg-black/20 pt-1">
        <p className="text-white/35 text-[9px] uppercase tracking-widest font-semibold px-4 pt-2 pb-1">
          Votos Especiales · {bloque.titulo}
        </p>
        <div className="divide-y divide-white/[0.06]">
          {VOTOS_ESPECIALES.map(c => (
            <FilaCandidato key={c.id} candidato={c} accent={accent} value={votos[c.id] || 0} onDelta={d => onDelta(c.id, d)} />
          ))}
        </div>
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
        <p className="text-white text-xs font-bold leading-tight truncate">{candidato.partido}</p>
        {candidato.nombre && (
          <p className="text-white/40 text-[10px] leading-tight mt-0.5 truncate">{candidato.nombre}</p>
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
