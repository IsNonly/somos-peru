import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  Play, Lock, CheckCircle, LogOut, BookOpen, X, Download, Award, Users, ChevronRight, MapPin,
  type LucideIcon,
} from 'lucide-react'
import Constancia from '../components/Constancia'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

const fechaLarga = (d: Date) =>
  `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

const PDF_URL = '/manuals/Cartilla_Personero_ERM_2026.pdf'
const PDF_TIEMPO_MIN = 60 // segundos requeridos de lectura

const VIDEO_URL = '/videos/Capacitacion_Personero_ERM_2026.mp4'
const VIDEO_VECES = 2 // veces que hay que ver el video completo

const FECHA_LIMITE = '03/10/2026 a las 11:59 p. m.'

const QUIZ: { pregunta: string; opciones: string[]; correcta: number }[] = [
  {
    pregunta: '¿Cuál es la función principal del personero de mesa?',
    opciones: [
      'Contar los votos de su partido favorito en una mesa separada.',
      'Fiscalizar el proceso electoral en la mesa de sufragio.',
      'Anular votos de candidatos con los que no está de acuerdo.',
      'Clausurar la mesa de votación si hay discrepancias.',
    ],
    correcta: 1,
  },
  {
    pregunta: '¿Cuándo puede ingresar el personero al aula de votación?',
    opciones: [
      'En cualquier momento durante la jornada electoral.',
      'Solo durante el conteo de votos.',
      'Desde el inicio de la jornada electoral.',
      'A partir del mediodía para supervisar el refrigerio.',
    ],
    correcta: 2,
  },
  {
    pregunta: '¿Qué debe hacer el personero ante una irregularidad en la mesa?',
    opciones: [
      'Clausurar la mesa unilateralmente.',
      'Amenazar con denuncias penales a los electores.',
      'Reportar a la ONPE a través de los canales oficiales.',
      'Anular automáticamente la mesa de votación.',
    ],
    correcta: 2,
  },
  {
    pregunta: '¿Dónde debe colocarse el personero durante la votación?',
    opciones: [
      'Entre el presidente y el secretario de la mesa.',
      'Dentro de la cámara de votación para supervisar.',
      'Detrás de los miembros de mesa sujetando las actas.',
      'En el lugar asignado, sin interferir con el proceso.',
    ],
    correcta: 3,
  },
  {
    pregunta: '¿Qué debe hacer el personero si la firma está omitida en el acta?',
    opciones: [
      'El personero recibe una sanción económica de la ODPE.',
      'El personero puede firmarla en ese instante para subsanar la omisión.',
      'Anular el acta inmediatamente.',
      'Reportar al fiscal de turno.',
    ],
    correcta: 1,
  },
]

type Paso = 'video' | 'cartilla' | 'quiz'

interface Profile {
  nombre_completo: string
  dni: string
  rol: string | null
  distrito_asignado: string | null
  distrito_vota: string | null
  mesa_asignada: string | null
  local_asignado: string | null
  local_votacion: string | null
  quiz_estado: string | null
  videos_vistos: number
  pdfs_vistos: number
}

export default function CapacitarPage() {
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [userId, setUserId]           = useState('')   // id real del perfil (para updates de profiles)
  const [authId, setAuthId]           = useState('')   // id de auth (para quiz_intentos)
  const [videosVistos, setVideosVistos] = useState(0)
  const [pdfsVistos, setPdfsVistos]   = useState(0)
  const [quizEstado, setQuizEstado]   = useState<string | null>(null)
  const [paso, setPaso]               = useState<Paso>('video')
  const [currentQ, setCurrentQ]       = useState(0)
  const [respuestas, setRespuestas]   = useState<number[]>([])
  const [quizDone, setQuizDone]       = useState<{ puntaje: number; aprobado: boolean } | null>(null)
  const [loading, setLoading]         = useState(true)
  const [verConstancia, setVerConstancia] = useState(false)
  const [fechaAprobacion, setFechaAprobacion] = useState<Date | null>(null)

  // Lectura de la cartilla (temporizador anti-salto)
  const [segundosLectura, setSegundosLectura] = useState(0)
  const [lecturaCompleta, setLecturaCompleta] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Video
  const videoRef  = useRef<HTMLVideoElement | null>(null)
  const maxPosRef = useRef(0)   // punto más avanzado alcanzado en la reproducción actual (anti-adelanto)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setAuthId(user.id)

      // Resolver el perfil por DNI: profiles.id no siempre = auth.users.id
      const dni = (user.email ?? '').split('@')[0]
      const cols = 'id, nombre_completo, dni, rol, distrito_asignado, distrito_vota, mesa_asignada, local_asignado, local_votacion, quiz_estado, videos_vistos, pdfs_vistos'
      let { data: p } = await supabase.from('profiles').select(cols).eq('dni', dni).maybeSingle()
      if (!p) {
        const r = await supabase.from('profiles').select(cols).eq('id', user.id).maybeSingle()
        p = r.data
      }
      setUserId(p?.id ?? user.id)

      if (p) {
        setProfile(p as Profile)
        const videos = p.videos_vistos || 0
        const pdfs = p.pdfs_vistos || 0
        setVideosVistos(videos)
        setPdfsVistos(pdfs)
        setQuizEstado(p.quiz_estado)
        // Aterriza en el primer paso pendiente
        if (videos < VIDEO_VECES) setPaso('video')
        else if (pdfs < 1) setPaso('cartilla')
        else setPaso('quiz')
        if (p.quiz_estado === 'Aprobado') {
          setQuizDone({ puntaje: 5, aprobado: true })
          // Fecha del primer intento aprobado, para la constancia
          const { data: intento } = await supabase.from('quiz_intentos')
            .select('created_at')
            .eq('user_id', user.id).eq('aprobado', true)
            .order('created_at', { ascending: true }).limit(1).maybeSingle()
          setFechaAprobacion(intento?.created_at ? new Date(intento.created_at) : new Date())
        }
        // Si ya leyó el PDF antes, marcar lectura completa
        if (pdfs >= 1) setLecturaCompleta(true)
      }
      setLoading(false)
    }
    init()
  }, [])

  // Temporizador de lectura: corre mientras el paso "cartilla" está activo y no se ha completado
  useEffect(() => {
    if (paso === 'cartilla' && pdfsVistos < 1 && !lecturaCompleta) {
      timerRef.current = setInterval(() => {
        setSegundosLectura(s => {
          const next = s + 1
          if (next >= PDF_TIEMPO_MIN) {
            clearInterval(timerRef.current!)
            setLecturaCompleta(true)
          }
          return next
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paso, pdfsVistos, lecturaCompleta])

  const marcarPdfLeido = async () => {
    if (!lecturaCompleta || pdfsVistos >= 1) return
    const nuevo = pdfsVistos + 1
    setPdfsVistos(nuevo)
    await supabase.from('profiles').update({ pdfs_vistos: nuevo }).eq('id', userId)
    setPaso('quiz')
  }

  // Registra el punto más avanzado visto (para no dejar adelantar el video)
  const onVideoTime = () => {
    const v = videoRef.current
    if (v && v.currentTime > maxPosRef.current) maxPosRef.current = v.currentTime
  }
  const onVideoSeeking = () => {
    const v = videoRef.current
    if (v && v.currentTime > maxPosRef.current + 2) v.currentTime = maxPosRef.current
  }
  const onVideoEnded = async () => {
    if (videosVistos >= VIDEO_VECES) return
    const nuevo = videosVistos + 1
    setVideosVistos(nuevo)
    maxPosRef.current = 0
    const v = videoRef.current
    if (v && nuevo < VIDEO_VECES) { v.currentTime = 0; v.pause() }
    await supabase.from('profiles').update({ videos_vistos: nuevo }).eq('id', userId)
  }

  const doneVideo    = videosVistos >= VIDEO_VECES
  const doneCartilla = pdfsVistos >= 1
  const doneQuiz     = quizEstado === 'Aprobado'
  const unlockedCartilla = doneVideo
  const unlockedQuiz     = doneVideo && doneCartilla

  const responder = (idx: number) => {
    const nuevas = [...respuestas, idx]
    setRespuestas(nuevas)
    if (currentQ + 1 < QUIZ.length) {
      setCurrentQ(q => q + 1)
    } else {
      const puntaje = nuevas.reduce((acc, r, i) => acc + (r === QUIZ[i].correcta ? 1 : 0), 0)
      const aprobado = puntaje >= 4
      setQuizDone({ puntaje, aprobado })
      if (aprobado) setFechaAprobacion(new Date())
      supabase.from('quiz_intentos').insert({ user_id: authId, puntaje, aprobado, respuestas: nuevas })
      // Al aprobar el quiz la capacitación queda completa -> cuenta habilitada
      supabase.from('profiles').update({
        quiz_estado: aprobado ? 'Aprobado' : 'Reprobado',
        ...(aprobado ? { credencial_estado: 'Confirmado' } : {}),
      }).eq('id', userId)
      setQuizEstado(aprobado ? 'Aprobado' : 'Reprobado')
    }
  }

  const reintentarQuiz = () => {
    setCurrentQ(0)
    setRespuestas([])
    setQuizDone(null)
  }

  const handleSalir = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const irAPaso = (destino: Paso) => {
    if (destino === 'cartilla' && !unlockedCartilla) return
    if (destino === 'quiz' && !unlockedQuiz) return
    setPaso(destino)
  }

  const firstName = profile?.nombre_completo?.split(' ')[0] ?? ''
  const tiempoRestante = Math.max(0, PDF_TIEMPO_MIN - segundosLectura)
  const pctLectura = Math.min((segundosLectura / PDF_TIEMPO_MIN) * 100, 100)
  const pctVideo = Math.min((videosVistos / VIDEO_VECES) * 100, 100)

  const cargoConstancia    = profile?.rol ?? 'Personero de Mesa'
  const distritoConstancia = profile?.distrito_asignado ?? profile?.distrito_vota ?? 'Tumbes'
  const fechaConstancia    = fechaLarga(fechaAprobacion ?? new Date())
  const centro             = profile?.local_asignado ?? profile?.local_votacion ?? '—'

  // Constancia de Participación a pantalla completa
  if (verConstancia) return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-800">
      <div className="no-print flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <p className="text-xs font-bold text-slate-700 truncate">Constancia de Participación</p>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00a3e8] hover:bg-[#0092d0] text-white text-xs font-bold transition-colors">
            <Download size={13} /> Descargar PDF
          </button>
          <button onClick={() => setVerConstancia(false)}
            className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center">
        <div className="constancia-print w-full max-w-[1000px]">
          <Constancia
            nombre={profile?.nombre_completo ?? ''}
            cargo={cargoConstancia}
            distrito={distritoConstancia}
            fecha={fechaConstancia}
          />
        </div>
      </div>
      <p className="no-print text-center text-[11px] text-white/60 py-2 flex-shrink-0">
        En el diálogo de impresión elige <strong>Guardar como PDF</strong> · Orientación horizontal
      </p>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-[#00a3e8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pasoTitulo = paso === 'video' ? 'Ver Curso' : paso === 'cartilla' ? 'Leer Cartilla' : 'Evaluación'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#e11d48] flex items-center justify-center text-white text-base flex-shrink-0">❤️</div>
          <span className="text-lg font-extrabold text-slate-900">Capacítate</span>
        </div>
        <button onClick={handleSalir}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 text-xs font-bold transition-colors">
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
        {/* Breadcrumb */}
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1">
          {profile?.rol ?? 'Personero'} <ChevronRight size={12} /> Curso Virtual para Personeros 2026
        </p>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-4">{pasoTitulo}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-4 sm:gap-6 items-start">

          {/* Sidebar: menú de pasos */}
          <aside className="lg:sticky lg:top-6 space-y-4">
            <div className="hidden lg:flex bg-gradient-to-br from-sky-50 to-sky-100 rounded-2xl border border-sky-100 items-center justify-center py-6">
              <Users size={40} className="text-[#00a3e8]" strokeWidth={1.5} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-2">
              <p className="hidden lg:block px-2.5 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Menú principal
              </p>
              <div className="flex lg:flex-col gap-1.5 overflow-x-auto">
                <PasoNav n={1} label="Ver curso" icon={Play} activo={paso === 'video'}
                  bloqueado={false} completado={doneVideo} onClick={() => irAPaso('video')} />
                <PasoNav n={2} label="Cartilla" icon={BookOpen} activo={paso === 'cartilla'}
                  bloqueado={!unlockedCartilla} completado={doneCartilla} onClick={() => irAPaso('cartilla')} />
                <PasoNav n={3} label="Evaluación" icon={Award} activo={paso === 'quiz'}
                  bloqueado={!unlockedQuiz} completado={doneQuiz} onClick={() => irAPaso('quiz')} />
              </div>
            </div>

            <div className="hidden lg:block bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Ten presente que <strong>el curso estará habilitado hasta el {FECHA_LIMITE}</strong>. Luego de esa fecha, ya no podrás ingresar.
              </p>
            </div>
          </aside>

          {/* Contenido principal */}
          <main className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

            {paso === 'video' && (
              <div>
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-[#0b3d6b] text-white">
                  <p className="text-xs sm:text-sm font-bold truncate">
                    Curso virtual para personeros ERM 2026 – Módulo 1 / Oficina Nacional de Procesos Electorales
                  </p>
                  <span className="text-[11px] font-semibold text-sky-200 flex-shrink-0">Video Oficial</span>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                  <video
                    ref={videoRef}
                    src={VIDEO_URL}
                    controls
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    onTimeUpdate={onVideoTime}
                    onSeeking={onVideoSeeking}
                    onEnded={onVideoEnded}
                    className="w-full rounded-xl bg-black aspect-video"
                  />

                  <div className={`rounded-xl border p-3.5 ${doneVideo ? 'border-green-200 bg-green-50/60' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${doneVideo ? 'text-green-600' : 'text-slate-500'}`}>
                        {doneVideo && <CheckCircle size={14} />}
                        Video completado al {Math.round(pctVideo)}%
                      </span>
                      <span className="text-xs font-bold text-slate-400">{videosVistos}/{VIDEO_VECES}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${doneVideo ? 'bg-green-400' : 'bg-[#00a3e8]'}`}
                        style={{ width: `${pctVideo}%` }} />
                    </div>
                    {!doneVideo && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        Debes ver el video completo {VIDEO_VECES} veces sin adelantarlo. Llevas {videosVistos} de {VIDEO_VECES}.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => irAPaso('cartilla')}
                      disabled={!unlockedCartilla}
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold shadow-lg transition-all ${
                        unlockedCartilla
                          ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {unlockedCartilla ? <CheckCircle size={17} /> : <Lock size={15} />}
                      Continuar a Leer Cartilla
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paso === 'cartilla' && (
              <div>
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-[#0b3d6b] text-white">
                  <p className="text-xs sm:text-sm font-bold truncate">Cartilla del Personero ERM 2026</p>
                  {!doneCartilla && (
                    <span className="text-[11px] font-semibold text-sky-200 flex-shrink-0">
                      {lecturaCompleta ? '¡Lectura completada!' : `${tiempoRestante}s restantes`}
                    </span>
                  )}
                </div>

                <div className="h-1.5 bg-slate-100 flex-shrink-0">
                  <div
                    className={`h-full transition-all duration-1000 ${lecturaCompleta || doneCartilla ? 'bg-green-400' : 'bg-[#00a3e8]'}`}
                    style={{ width: `${doneCartilla ? 100 : pctLectura}%` }}
                  />
                </div>

                <iframe
                  src={PDF_URL}
                  className="w-full border-0"
                  style={{ height: '65vh', minHeight: 420 }}
                  title="Cartilla del Personero ERM 2026"
                />

                <div className="p-4 sm:p-5">
                  {doneCartilla ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                        <CheckCircle size={15} /> Cartilla leída
                      </span>
                      <button
                        onClick={() => irAPaso('quiz')}
                        disabled={!unlockedQuiz}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold shadow-lg bg-green-500 hover:bg-green-600 text-white shadow-green-500/30 transition-all"
                      >
                        <CheckCircle size={17} /> Continuar a Evaluación <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : lecturaCompleta ? (
                    <button
                      onClick={marcarPdfLeido}
                      className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Confirmar lectura y continuar
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00a3e8] rounded-full transition-all duration-1000" style={{ width: `${pctLectura}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-500 tabular-nums w-16 text-right">
                        {segundosLectura}s / {PDF_TIEMPO_MIN}s
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {paso === 'quiz' && (
              <div>
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-[#0b3d6b] text-white">
                  <p className="text-xs sm:text-sm font-bold truncate">Cuestionario Oficial — Evaluación de Personeros</p>
                  {!quizDone && <span className="text-[11px] font-semibold text-sky-200 flex-shrink-0">{currentQ + 1} / {QUIZ.length}</span>}
                </div>

                {!unlockedQuiz ? (
                  <div className="p-8 flex flex-col items-center text-center gap-2">
                    <Lock size={28} className="text-slate-300" />
                    <p className="text-sm font-bold text-slate-500">Evaluación bloqueada</p>
                    <p className="text-xs text-slate-400">Debes completar el video y la cartilla primero.</p>
                  </div>
                ) : quizDone ? (
                  <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-3">
                    {quizDone.aprobado ? (
                      <>
                        <CheckCircle size={40} className="text-green-500" />
                        <p className="text-base font-extrabold text-slate-800">¡Evaluación aprobada!</p>
                        <p className="text-sm text-slate-500">Obtuviste {quizDone.puntaje} de {QUIZ.length} respuestas correctas.</p>
                        <p className="text-xs text-slate-400">Ya puedes descargar tu constancia en el panel de la derecha.</p>
                      </>
                    ) : (
                      <>
                        <X size={40} className="text-red-400" />
                        <p className="text-base font-extrabold text-slate-800">No aprobaste esta vez</p>
                        <p className="text-sm text-slate-500">Obtuviste {quizDone.puntaje} de {QUIZ.length}. Necesitas al menos 4/5.</p>
                        <button
                          onClick={reintentarQuiz}
                          className="mt-2 px-5 py-2.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-xl text-sm transition-all"
                        >
                          Reintentar evaluación
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-4 sm:p-5">
                    <div className="h-1.5 bg-slate-100 rounded-full mb-5">
                      <div className="bg-[#00a3e8] h-1.5 rounded-full transition-all" style={{ width: `${(currentQ / QUIZ.length) * 100}%` }} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mb-4">{QUIZ[currentQ].pregunta}</p>
                    <div className="space-y-2.5">
                      {QUIZ[currentQ].opciones.map((op, i) => (
                        <button key={i} onClick={() => responder(i)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:border-[#00a3e8] hover:bg-sky-50 text-sm transition-all">
                          <span className="font-bold text-[#00a3e8] mr-2">{String.fromCharCode(65 + i)}.</span>{op}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Panel derecho: acreditación */}
          <aside className="space-y-4">
            {doneQuiz && (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
                <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                  <Award size={22} className="text-green-500" />
                </div>
                <p className="text-xs font-bold text-green-700 leading-snug mb-3">
                  ¡Capacitación completada exitosamente! Tienes acceso a todos tus materiales y constancia oficial.
                </p>
                <button
                  onClick={() => setVerConstancia(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Award size={14} /> Constancia de Capacitación
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-3">
                <MapPin size={13} className="text-[#00a3e8]" /> Datos de Acreditación
              </p>
              <div className="space-y-2 text-xs">
                <DatoFila label="DNI" value={profile?.dni ?? '—'} />
                <DatoFila label="Rol" value={profile?.rol ?? '—'} />
                <DatoFila label="Distrito" value={profile?.distrito_asignado ?? profile?.distrito_vota ?? '—'} />
                <DatoFila label="Centro" value={centro} />
              </div>
            </div>

            <div className="lg:hidden bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                El curso estará habilitado hasta el <strong>{FECHA_LIMITE}</strong>.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function PasoNav({ n, label, icon: Icon, activo, bloqueado, completado, onClick }: {
  n: number; label: string; icon: LucideIcon
  activo: boolean; bloqueado: boolean; completado: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueado}
      className={`flex-1 lg:flex-none flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
        activo
          ? 'bg-[#00a3e8] text-white shadow-md shadow-sky-500/20'
          : bloqueado
            ? 'text-slate-300 cursor-not-allowed'
            : 'text-slate-600 hover:bg-sky-50'
      }`}
    >
      <Icon size={16} className={activo ? 'text-white' : bloqueado ? 'text-slate-300' : 'text-[#00a3e8]'} />
      <span className="flex-1 text-left truncate">{n}. {label}</span>
      {completado
        ? <CheckCircle size={16} className={activo ? 'text-white' : 'text-green-500'} />
        : bloqueado && <Lock size={13} className="text-slate-300" />}
    </button>
  )
}

function DatoFila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 font-medium">{label}:</span>
      <span className="text-slate-700 font-bold text-right truncate max-w-[60%]">{value}</span>
    </div>
  )
}
