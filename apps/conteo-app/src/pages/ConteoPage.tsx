import { useState, useRef, useEffect, useCallback } from 'react'
import {
  supabase, getMiPerfil, CANDIDATOS_METROPOLITANA, VOTOS_ESPECIALES,
  getCandidatosDistrital, haversineM,
} from '../lib/supabase'
import type { Candidato } from '../lib/supabase'
import { procesarActa } from '../lib/ocr'
import { subirImagenActa } from '../lib/storage'
import {
  Camera, Send, CheckCircle, AlertTriangle,
  Loader, MapPin, Key, ChevronDown, ChevronUp, Minus, Plus,
  Info, PencilLine, Filter, LogOut, UserCheck, Map as MapIcon,
} from 'lucide-react'

type Modo = 'MANUAL' | 'IMAGEN'
type Fase = 'setup' | 'enviado'
type Nivel = 'metro' | 'distrital'

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

function ConteoPageInner() {
  const [perfil, setPerfil]           = useState<any>(null)
  const [userId, setUserId]           = useState('')   // id real del perfil (para escrituras)
  const [authId, setAuthId]           = useState('')   // id de auth (para app_config)
  const [mesa, setMesa]               = useState('')
  const [mesaConfirmada, setMesaConfirmada] = useState(false)
  const [modo, setModo]               = useState<Modo>('MANUAL')
  const [fase, setFase]               = useState<Fase>('setup')
  const [votosMetro, setVotosMetro]         = useState<Record<string, number>>({})
  const [votosDistrital, setVotosDistrital] = useState<Record<string, number>>({})
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

  const candidatosDistrital = getCandidatosDistrital(perfil?.distrito_asignado)

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
    }
    init()
  }, [])

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
            // Mapear resultados OCR a los candidatos conocidos (metro y distrital)
            const nuevosMetro: Record<string, number> = {}
            const nuevosDistrital: Record<string, number> = {}
            resultado.votos.forEach(v => {
              const cMetro = matchCandidato(CANDIDATOS_METROPOLITANA, v.partido)
              if (cMetro && v.provincial > 0) nuevosMetro[cMetro.id] = v.provincial
              const cDist = matchCandidato(candidatosDistrital, v.partido)
              if (cDist && v.distrital > 0) nuevosDistrital[cDist.id] = v.distrital
            })
            setVotosMetro(nuevosMetro)
            setVotosDistrital(nuevosDistrital)
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

  const cambiarVoto = (nivel: Nivel, id: string, delta: number) => {
    const setter = nivel === 'metro' ? setVotosMetro : setVotosDistrital
    setter(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }))
  }

  const totalProv = Object.values(votosMetro).reduce((a, b) => a + b, 0)
  const totalDist = Object.values(votosDistrital).reduce((a, b) => a + b, 0)

  // ── Enviar acta ─────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!mesa.trim()) { setError('Ingresa el número de mesa.'); return }
    if (totalProv === 0 && totalDist === 0) { setError('Ingresa al menos un voto.'); return }
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

      // Crear/actualizar acta
      const { data: acta, error: actaErr } = await supabase.from('actas').upsert({
        mesa_numero:     mesa.trim(),
        colegio_nombre:  perfil?.local_asignado ?? perfil?.local_votacion ?? null,
        distrito:        perfil?.distrito_asignado ?? perfil?.distrito_vota ?? null,
        personero_id:    userId || null,
        personero_dni:   perfil?.dni ?? null,
        imagen_url:      imagenUrl,
        metodo:          modo,
        ocr_raw:         ocrMetodo ? { metodo: ocrMetodo } : null,
        estado:          'TRANSMITIDA',
        bloqueada:       true,
        latitude:        gpsCoords?.lat ?? null,
        longitude:       gpsCoords?.lon ?? null,
        gps_valido:      gpsStatus === 'ok',
        transmitida_at:  new Date().toISOString(),
      }, { onConflict: 'mesa_numero' }).select().single()

      if (actaErr) throw actaErr

      // Insertar votos (filtrar ceros)
      const distritoActa = perfil?.distrito_asignado ?? perfil?.distrito_vota ?? null
      const listaMetro     = [...CANDIDATOS_METROPOLITANA, ...VOTOS_ESPECIALES]
      const listaDistrital = [...candidatosDistrital, ...VOTOS_ESPECIALES]

      const filas = [
        ...Object.entries(votosMetro).map(([id, cantidad]) => {
          const c = listaMetro.find(x => x.id === id)
          return { acta_id: acta.id, mesa_numero: mesa, distrito: distritoActa, nivel: 'PROVINCIAL', partido: c?.partido ?? id, candidato: c?.nombre || null, cantidad }
        }),
        ...Object.entries(votosDistrital).map(([id, cantidad]) => {
          const c = listaDistrital.find(x => x.id === id)
          return { acta_id: acta.id, mesa_numero: mesa, distrito: distritoActa, nivel: 'DISTRITAL', partido: c?.partido ?? id, candidato: c?.nombre || null, cantidad }
        }),
      ].filter(f => f.cantidad > 0)

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
      <h2 className="text-white font-bold text-xl">Acta de Imagen ya Transmitida</h2>
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

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 space-y-4 fade-in">

      {/* Tarjeta del personero */}
      <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
          <UserCheck size={18} className="text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/35 font-bold">Personero</p>
          <p className="text-white font-bold text-sm truncate">{perfil?.nombre_completo ?? '—'}</p>
          <p className="text-white/40 text-xs truncate">
            DNI: <span className="text-sky-400 font-medium">{perfil?.dni ?? '—'}</span>
            {perfil?.distrito_asignado && <> {'·'} Distrito: {perfil.distrito_asignado}</>}
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

      {gpsMsg && (
        <p className={`text-xs px-2 -mt-1 ${
          gpsStatus === 'warn' ? 'text-yellow-400' :
          gpsStatus === 'fail' ? 'text-red-400' : 'text-green-400'}`}>
          {gpsMsg}
        </p>
      )}

      {/* Vista: Manual / Imagen */}
      <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-2 flex items-center gap-2">
        <span className="flex items-center gap-1 text-white/40 text-xs font-semibold px-2 flex-shrink-0">
          <Filter size={12} /> Vista:
        </span>
        <div className="flex-1 grid grid-cols-2 gap-2">
          {(['MANUAL', 'IMAGEN'] as Modo[]).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                modo === m
                  ? 'bg-sky-500/15 border-sky-500/50 text-sky-300'
                  : 'bg-transparent border-white/8 text-white/45'}`}>
              {m === 'MANUAL' ? 'Conteo Manual' : 'Conteo por Imagen'}
            </button>
          ))}
        </div>
      </div>

      {/* Número de Mesa / Acta */}
      <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white font-bold text-sm">Número de Mesa / Acta:</span>
          <span className="font-mono text-white/30 text-sm border border-white/10 rounded-lg px-3 py-1 tabular-nums">
            {mesa.trim() || '000000'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sky-400 text-sm font-semibold flex-shrink-0">Colegio:</span>
          <input value={mesa} onChange={e => { setMesa(e.target.value); setMesaConfirmada(false) }}
            placeholder="Ingresa tu mesa…"
            className="flex-1 min-w-0 bg-[#0b0f1d] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 outline-none focus:border-sky-500/50" />
          <label className={`flex items-center gap-1.5 text-sm font-semibold flex-shrink-0 cursor-pointer ${mesaConfirmada ? 'text-sky-400' : 'text-white/40'}`}>
            <input type="checkbox" checked={mesaConfirmada}
              onChange={e => setMesaConfirmada(e.target.checked && !!mesa.trim())}
              className="accent-sky-500 w-4 h-4" />
            Confirmar
          </label>
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
        <span>Partido {'·'} Alcalde</span>
        <span>Conteo votos</span>
      </div>

      {/* Alcaldía Metropolitana */}
      <SeccionVotos
        titulo={`Alcaldía Metropolitana (Lima - ${CANDIDATOS_METROPOLITANA.length} candidatos)`}
        subtitulo="Alcalde actual: Rafael López Aliaga (Renovación Popular)"
        accent="metro"
        total={totalProv}
        candidatos={CANDIDATOS_METROPOLITANA}
        votos={votosMetro}
        onDelta={(id, d) => cambiarVoto('metro', id, d)}
      />

      {/* Alcaldía Distrital */}
      <SeccionVotos
        titulo={`Alcaldía Distrital (${perfil?.distrito_asignado ?? 'Distrito'} - ${candidatosDistrital.length} candidatos)`}
        accent="distrital"
        total={totalDist}
        candidatos={candidatosDistrital}
        votos={votosDistrital}
        onDelta={(id, d) => cambiarVoto('distrital', id, d)}
      />

      {/* Resumen */}
      <div className="bg-[#131a2e] border border-white/8 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Total Metro</p>
          <p className="text-white text-lg font-extrabold tabular-nums">{totalProv}</p>
        </div>
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Total Distrital</p>
          <p className="text-white text-lg font-extrabold tabular-nums">{totalDist}</p>
        </div>
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Gran Total</p>
          <p className="text-sky-400 text-lg font-extrabold tabular-nums">{totalProv + totalDist}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {/* Transmitir */}
      <button onClick={enviar} disabled={enviando || ocrLoading || !mesa.trim() || !mesaConfirmada}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]">
        {enviando
          ? <><Loader size={16} className="animate-spin" /> Transmitiendo…</>
          : <><Send size={16} /> Transmitir {modo === 'MANUAL' ? 'Resultados Manuales' : 'Acta'}</>}
      </button>
      {!mesaConfirmada && (
        <p className="text-white/30 text-xs text-center">
          Ingresa el N° de mesa y marca “Confirmar” para habilitar el envío.
        </p>
      )}
    </div>
  )
}

// ── Sección de candidatos (Metropolitana o Distrital) ───────────────────────
function SeccionVotos({ titulo, subtitulo, total, accent, candidatos, votos, onDelta }: {
  titulo: string; subtitulo?: string; total: number
  accent: 'metro' | 'distrital'
  candidatos: Candidato[]
  votos: Record<string, number>; onDelta: (id: string, delta: number) => void
}) {
  const esMetro = accent === 'metro'
  const barra   = esMetro ? 'border-sky-500 bg-sky-500/5'   : 'border-emerald-500 bg-emerald-500/5'
  const tinta   = esMetro ? 'text-sky-300'                  : 'text-emerald-300'
  const icono   = esMetro ? 'text-sky-400'                  : 'text-emerald-400'
  const pill    = esMetro
    ? 'text-sky-300/80 border-sky-500/30 bg-sky-500/10'
    : 'text-emerald-300/80 border-emerald-500/30 bg-emerald-500/10'
  return (
    <div className="bg-[#131a2e] border border-white/8 rounded-2xl overflow-hidden">
      {/* Cabecera de sección */}
      <div className={`flex items-start justify-between gap-2 pl-4 pr-3 py-3 border-l-4 ${barra}`}>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <MapIcon size={13} className={`${icono} flex-shrink-0`} />
            <p className={`text-[11px] font-extrabold uppercase tracking-wide leading-tight ${tinta}`}>{titulo}</p>
          </div>
          {subtitulo && (
            <span className={`inline-block text-[9px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md border ${pill}`}>
              {subtitulo}
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
        {[...candidatos, ...VOTOS_ESPECIALES].map(c => (
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
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${value > 0 ? activa : 'border-l-2 border-transparent'}`}>
      <div className="relative w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
        <span className="text-[0.55rem] font-black leading-none text-center px-0.5" style={{ color: candidato.color }}>
          {candidato.letra}
        </span>
        {candidato.id.startsWith('c') || candidato.id.startsWith('d') ? (
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
