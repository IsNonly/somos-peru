import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase, CANDIDATOS_PROVINCIALES, haversineM } from '../lib/supabase'
import { procesarActa } from '../lib/ocr'
import { subirImagenActa } from '../lib/storage'
import {
  Camera, RefreshCw, Send, CheckCircle, AlertTriangle,
  Loader, MapPin, Key, ChevronDown, ChevronUp,
} from 'lucide-react'

type Modo = 'MANUAL' | 'IMAGEN'
type Fase = 'setup' | 'captura' | 'revision' | 'enviado'

interface VotoRow { candidato: string; provincial: number; distrital: number }

const initVotos = (): VotoRow[] =>
  CANDIDATOS_PROVINCIALES.map(c => ({ candidato: c, provincial: 0, distrital: 0 }))

// Carga la clave Gemini guardada en Supabase (tabla config)
async function getGeminiKey(userId: string): Promise<string> {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('user_id', userId)
    .eq('key', 'gemini_api_key')
    .single()
  return data?.value ?? ''
}

async function saveGeminiKey(userId: string, key: string) {
  await supabase.from('app_config').upsert(
    { user_id: userId, key: 'gemini_api_key', value: key },
    { onConflict: 'user_id,key' }
  )
}

export default function ConteoPage() {
  const [perfil, setPerfil]           = useState<any>(null)
  const [userId, setUserId]           = useState('')
  const [mesa, setMesa]               = useState('')
  const [modo, setModo]               = useState<Modo>('MANUAL')
  const [fase, setFase]               = useState<Fase>('setup')
  const [votos, setVotos]             = useState<VotoRow[]>(initVotos())
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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data: p }, key] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        getGeminiKey(user.id),
      ])
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
        setFase('revision')
        try {
          const base64 = dataUrl.split(',')[1]
          const resultado = await procesarActa(base64, mime, geminiKey)
          setOcrMetodo(resultado.metodo)

          if (resultado.votos.length > 0) {
            // Mapear resultados OCR a los candidatos conocidos
            const nuevos = initVotos()
            resultado.votos.forEach(v => {
              // Buscar candidato más cercano en la lista
              const idx = nuevos.findIndex(n =>
                n.candidato.toLowerCase().includes(v.partido.toLowerCase().slice(0, 6)) ||
                v.partido.toLowerCase().includes(n.candidato.toLowerCase().slice(0, 6))
              )
              if (idx >= 0) {
                nuevos[idx].provincial = v.provincial
                nuevos[idx].distrital  = v.distrital
              }
            })
            setVotos(nuevos)
          }
        } catch {
          setError('No se pudo procesar el acta automáticamente. Ingresa los votos manualmente.')
        }
        setOcrLoading(false)
      } else {
        setFase('revision')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const setVoto = (i: number, campo: 'provincial' | 'distrital', val: string) => {
    const n = parseInt(val) || 0
    setVotos(prev => prev.map((v, idx) => idx === i ? { ...v, [campo]: Math.max(0, n) } : v))
  }

  const totalProv = votos.reduce((a, v) => a + v.provincial, 0)
  const totalDist = votos.reduce((a, v) => a + v.distrital, 0)

  // ── Enviar acta ─────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!mesa.trim()) { setError('Ingresa el número de mesa.'); return }
    if (totalProv === 0 && totalDist === 0) { setError('Ingresa al menos un voto.'); return }
    setEnviando(true); setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Verificar bloqueo
      const { data: existente } = await supabase
        .from('actas').select('id, bloqueada').eq('mesa_numero', mesa).single()
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
        personero_id:    user!.id,
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
      const filas = votos.flatMap(v => [
        { acta_id: acta.id, mesa_numero: mesa, distrito: perfil?.distrito_asignado ?? null, nivel: 'PROVINCIAL', partido: v.candidato, cantidad: v.provincial },
        { acta_id: acta.id, mesa_numero: mesa, distrito: perfil?.distrito_asignado ?? null, nivel: 'DISTRITAL',  partido: v.candidato, cantidad: v.distrital  },
      ]).filter(f => f.cantidad > 0)

      if (filas.length) await supabase.from('votos').insert(filas)

      await supabase.from('profiles').update({ acta_transmitida: true }).eq('id', user!.id)
      setFase('enviado')
    } catch (e: any) {
      setError(e.message ?? 'Error al transmitir. Inténtalo de nuevo.')
    }
    setEnviando(false)
  }

  const guardarGeminiKey = async () => {
    if (userId) await saveGeminiKey(userId, geminiKey)
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

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (fase === 'setup') return (
    <div className="p-5 space-y-5 fade-in">
      <div className="pt-4">
        <h1 className="text-white font-bold text-xl">Conteo de Acta</h1>
        <p className="text-white/40 text-sm">Elecciones Regionales y Municipales 2026</p>
      </div>

      {/* Datos del personero */}
      {perfil && (
        <div className="bg-[#14141f] border border-white/8 rounded-2xl p-4">
          <p className="text-white font-semibold text-sm">{perfil.nombre_completo}</p>
          <p className="text-white/40 text-xs mt-0.5">DNI: {perfil.dni} · {perfil.rol}</p>
          {perfil.distrito_asignado && <p className="text-white/40 text-xs">{perfil.distrito_asignado}</p>}
        </div>
      )}

      {/* Mesa */}
      <div>
        <label className="block text-white/50 text-xs uppercase tracking-widest mb-2">Número de Mesa / Acta</label>
        <input value={mesa} onChange={e => setMesa(e.target.value)}
          placeholder="Ej. 064321"
          className="w-full bg-[#14141f] border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-white/25 outline-none focus:border-brand-red/50" />
      </div>

      {/* Modo */}
      <div>
        <label className="block text-white/50 text-xs uppercase tracking-widest mb-2">Modo de registro</label>
        <div className="grid grid-cols-2 gap-3">
          {(['MANUAL', 'IMAGEN'] as Modo[]).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className={`py-3 rounded-2xl text-sm font-semibold border transition-all
                ${modo === m ? 'bg-brand-red border-brand-red text-white' : 'bg-[#14141f] border-white/10 text-white/50'}`}>
              {m === 'MANUAL' ? 'Manual' : 'Escáner y Reconocimiento (IA)'}
            </button>
          ))}
        </div>
      </div>

      {/* Clave Gemini (modo imagen) */}
      {modo === 'IMAGEN' && (
        <div className="bg-[#14141f] border border-white/8 rounded-2xl p-4 space-y-3">
          <button onClick={() => setShowKeyInput(!showKeyInput)}
            className="w-full flex items-center justify-between text-white/60 text-sm">
            <span className="flex items-center gap-2">
              <Key size={14} className={geminiKey ? 'text-green-400' : 'text-white/30'} />
              Clave de Servicio OCR Gemini {geminiKey ? '(configurada)' : '(Opcional)'}
            </span>
            {showKeyInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showKeyInput && (
            <div className="space-y-2">
              <input value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-brand-red/50 font-mono" />
              <button onClick={guardarGeminiKey}
                className="w-full py-2 bg-brand-red/20 border border-brand-red/30 text-brand-red rounded-xl text-xs font-medium">
                Guardar clave
              </button>
              <p className="text-white/25 text-xs">Sin clave usa Tesseract como fallback.</p>
            </div>
          )}
        </div>
      )}

      {/* GPS */}
      <div className="bg-[#14141f] border border-white/8 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <MapPin size={16} className={
              gpsStatus === 'ok'   ? 'text-green-400' :
              gpsStatus === 'warn' ? 'text-yellow-400' :
              gpsStatus === 'fail' ? 'text-red-400' : 'text-white/30'} />
            <span className="text-white/70 text-sm leading-tight">{gpsMsg || 'Verificar ubicación GPS (radio 50m)'}</span>
          </div>
          {gpsStatus !== 'ok' && (
            <button onClick={detectarGPS}
              className="ml-3 text-xs text-brand-red font-medium flex-shrink-0">
              {gpsStatus === 'loading' ? <Loader size={14} className="animate-spin" /> : 'Activar'}
            </button>
          )}
        </div>
      </div>

      <button onClick={() => setFase('captura')} disabled={!mesa.trim()}
        className="w-full py-4 bg-brand-red hover:bg-red-600 text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-40 active:scale-[0.98]">
        Iniciar conteo
      </button>
    </div>
  )

  // ── CAPTURA ─────────────────────────────────────────────────────────────
  if (fase === 'captura') return (
    <div className="p-5 space-y-5 fade-in">
      <h2 className="text-white font-bold text-lg pt-4">
        {modo === 'IMAGEN' ? 'Escanear Acta (Tomar Foto)' : 'Registro Manual'}
      </h2>
      <p className="text-white/40 text-sm">Mesa: <span className="text-white font-mono font-bold">{mesa}</span></p>

      {modo === 'IMAGEN' ? (
        <div>
          <div onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-white/15 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-red/50 transition-all">
            <Camera size={40} className="mx-auto text-white/25 mb-3" />
            <p className="text-white/50 text-sm">Toca para abrir la cámara</p>
            <p className="text-white/25 text-xs mt-1">Se procesará con IA automáticamente</p>
          </div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleFoto} />
        </div>
      ) : (
        <button onClick={() => setFase('revision')}
          className="w-full py-4 bg-brand-red hover:bg-red-600 text-white font-bold rounded-2xl text-sm">
          Ingresar votos manualmente
        </button>
      )}

      <button onClick={() => setFase('setup')}
        className="w-full py-3 border border-white/10 text-white/50 rounded-2xl text-sm">
        Volver
      </button>
    </div>
  )

  // ── REVISIÓN ─────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5 fade-in">
      <div className="pt-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">
            {modo === 'IMAGEN' ? 'Conteo por Imagen' : 'Conteo Manual'}
          </h2>
          <p className="text-white/40 text-sm">Mesa: <span className="text-white font-mono">{mesa}</span></p>
        </div>
        {modo === 'IMAGEN' && (
          <button onClick={() => inputRef.current?.click()}
            className="text-xs text-brand-red font-medium flex items-center gap-1">
            <RefreshCw size={12} /> Cambiar foto
          </button>
        )}
      </div>

      {/* Estado OCR */}
      {ocrLoading && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <Loader size={16} className="text-blue-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-blue-300 text-sm">Iniciando escáner de acta…</p>
            <p className="text-blue-400/60 text-xs">Comprimiendo y procesando imagen con IA</p>
          </div>
        </div>
      )}

      {ocrMetodo && !ocrLoading && (
        <div className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 border text-xs font-medium
          ${ocrMetodo === 'GEMINI'
            ? 'bg-green-500/10 border-green-500/20 text-green-300'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'}`}>
          <CheckCircle size={13} />
          Acta procesada: Votos reconocidos ({ocrMetodo}) listos para revisar y aplicar.
        </div>
      )}

      {/* Preview imagen */}
      {imgSrc && modo === 'IMAGEN' && (
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <p className="text-white/30 text-xs px-3 py-2">Foto Cargada:</p>
          <img src={imgSrc} alt="Acta" className="w-full object-contain max-h-52" />
        </div>
      )}

      {/* Tabla votos */}
      <div className="bg-[#14141f] border border-white/8 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_76px_76px] bg-black/30 px-3 py-2.5 text-white/40 text-xs uppercase tracking-wide">
          <span>Partido / Tipo</span>
          <span className="text-center">Provincial</span>
          <span className="text-center">Distrital</span>
        </div>
        <div className="divide-y divide-white/5 max-h-[42vh] overflow-y-auto">
          {votos.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_76px_76px] items-center px-3 py-2 gap-1.5">
              <p className="text-white/80 text-xs leading-tight truncate pr-1">{v.candidato}</p>
              <input type="number" min={0} max={999} value={v.provincial || ''}
                onChange={e => setVoto(i, 'provincial', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1.5 text-white text-xs text-center w-full outline-none focus:border-brand-red/50" />
              <input type="number" min={0} max={999} value={v.distrital || ''}
                onChange={e => setVoto(i, 'distrital', e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1.5 text-white text-xs text-center w-full outline-none focus:border-brand-red/50" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_76px_76px] px-3 py-3 bg-black/20 border-t border-white/5 text-xs font-bold">
          <span className="text-white/50">SUBTOTAL</span>
          <span className="text-center text-white tabular-nums">{totalProv}</span>
          <span className="text-center text-white tabular-nums">{totalDist}</span>
        </div>
      </div>

      {/* Porcentaje sobre votos válidos */}
      {totalProv > 0 && (
        <p className="text-white/25 text-xs text-center">
          Porcentaje sobre votos válidos, nulos e impugnados
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />

      <button onClick={enviar} disabled={enviando || ocrLoading}
        className="w-full py-4 bg-brand-red hover:bg-red-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]">
        {enviando
          ? <><Loader size={16} className="animate-spin" /> Sincronizando foto con el servidor…</>
          : <><Send size={16} /> Transmitir Acta</>}
      </button>
    </div>
  )
}
