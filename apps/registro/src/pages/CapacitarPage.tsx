import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Play, Lock, CheckCircle, LogOut, BookOpen, X, Download, Award } from 'lucide-react'
import Constancia from '../components/Constancia'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

const fechaLarga = (d: Date) =>
  `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`

const PDF_URL = '/manuals/Cartilla_Personero_ERM_2026.pdf'
const PDF_TIEMPO_MIN = 60 // segundos requeridos de lectura

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

interface Profile {
  nombre_completo: string
  dni: string
  rol: string | null
  distrito_asignado: string | null
  distrito_vota: string | null
  mesa_asignada: string | null
  quiz_estado: string | null
  videos_vistos: number
  pdfs_vistos: number
}

export default function CapacitarPage() {
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [userId, setUserId]           = useState('')
  const [videosVistos, setVideosVistos] = useState(0)
  const [pdfsVistos, setPdfsVistos]   = useState(0)
  const [quizEstado, setQuizEstado]   = useState<string | null>(null)
  const [quizMode, setQuizMode]       = useState(false)
  const [currentQ, setCurrentQ]       = useState(0)
  const [respuestas, setRespuestas]   = useState<number[]>([])
  const [quizDone, setQuizDone]       = useState<{ puntaje: number; aprobado: boolean } | null>(null)
  const [loading, setLoading]         = useState(true)
  const [verConstancia, setVerConstancia] = useState(false)
  const [fechaAprobacion, setFechaAprobacion] = useState<Date | null>(null)

  // PDF modal state
  const [pdfModal, setPdfModal]       = useState(false)
  const [pdfAbierto, setPdfAbierto]   = useState(false)
  const [segundosLectura, setSegundosLectura] = useState(0)
  const [lecturaCompleta, setLecturaCompleta] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)

      const { data: p } = await supabase.from('profiles')
        .select('nombre_completo, dni, rol, distrito_asignado, distrito_vota, mesa_asignada, quiz_estado, videos_vistos, pdfs_vistos')
        .eq('id', user.id)
        .single()

      if (p) {
        setProfile(p as Profile)
        setVideosVistos(p.videos_vistos || 0)
        setPdfsVistos(p.pdfs_vistos || 0)
        setQuizEstado(p.quiz_estado)
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
        if ((p.pdfs_vistos || 0) >= 1) setLecturaCompleta(true)
      }
      setLoading(false)
    }
    init()
  }, [])

  // Temporizador: corre mientras el modal está abierto y no se ha completado
  useEffect(() => {
    if (pdfModal && !lecturaCompleta) {
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
  }, [pdfModal, lecturaCompleta])

  const abrirPDF = () => {
    setPdfModal(true)
    setPdfAbierto(true)
  }

  const cerrarPDF = () => {
    setPdfModal(false)
    // El timer acumulado se conserva aunque cierre el modal
  }

  const marcarPdfLeido = async () => {
    if (!lecturaCompleta) return
    if (pdfsVistos >= 1) return
    const nuevo = pdfsVistos + 1
    setPdfsVistos(nuevo)
    await supabase.from('profiles').update({ pdfs_vistos: nuevo }).eq('id', userId)
  }

  const marcarVideo = async () => {
    if (videosVistos >= 2) return
    const nuevo = videosVistos + 1
    setVideosVistos(nuevo)
    await supabase.from('profiles').update({ videos_vistos: nuevo }).eq('id', userId)
  }

  const puedeQuiz = videosVistos >= 2 && pdfsVistos >= 1 && !quizDone

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
      supabase.from('quiz_intentos').insert({ user_id: userId, puntaje, aprobado, respuestas: nuevas })
      supabase.from('profiles').update({ quiz_estado: aprobado ? 'Aprobado' : 'Reprobado' }).eq('id', userId)
      setQuizEstado(aprobado ? 'Aprobado' : 'Reprobado')
    }
  }

  const handleSalir = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const firstName = profile?.nombre_completo?.split(' ')[0] ?? ''
  const tiempoRestante = Math.max(0, PDF_TIEMPO_MIN - segundosLectura)
  const pct = Math.min((segundosLectura / PDF_TIEMPO_MIN) * 100, 100)

  const cargoConstancia    = profile?.rol ?? 'Personero de Mesa'
  const distritoConstancia = profile?.distrito_asignado ?? profile?.distrito_vota ?? 'Lima'
  const fechaConstancia    = fechaLarga(fechaAprobacion ?? new Date())

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

  // Modal PDF a pantalla completa
  if (pdfModal) return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#00a3e8] text-white flex-shrink-0">
        <div className="flex-1">
          <p className="text-xs font-bold truncate">Cartilla del Personero ERM 2026</p>
          {!lecturaCompleta && (
            <p className="text-[11px] opacity-80">Permanece leyendo — {tiempoRestante}s restantes</p>
          )}
          {lecturaCompleta && (
            <p className="text-[11px] font-bold text-green-200">¡Lectura completada! Ya puedes confirmar.</p>
          )}
        </div>
        <button
          onClick={cerrarPDF}
          className="ml-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-all"
        >
          <X size={18} />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-white/20 flex-shrink-0">
        <div
          className={`h-full transition-all duration-1000 ${lecturaCompleta ? 'bg-green-400' : 'bg-white'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* PDF embebido */}
      <iframe
        src={PDF_URL}
        className="flex-1 w-full border-0"
        title="Cartilla del Personero ERM 2026"
      />

      {/* Barra inferior */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-200">
        {!lecturaCompleta ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00a3e8] rounded-full transition-all duration-1000"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-500 tabular-nums w-14 text-right">
              {segundosLectura}s / {PDF_TIEMPO_MIN}s
            </span>
          </div>
        ) : (
          <button
            onClick={() => { marcarPdfLeido(); cerrarPDF() }}
            className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-extrabold rounded-2xl text-sm shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            Confirmar lectura y continuar
          </button>
        )}
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#c9e6f8]">
      <div className="w-8 h-8 border-2 border-[#00a3e8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  /* ── MODO QUIZ ── */
  if (quizMode && !quizDone) {
    const q = QUIZ[currentQ]
    return (
      <div className="min-h-screen bg-[#c9e6f8] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-[24px] p-6 shadow-xl border border-sky-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-800">Cuestionario Oficial</h2>
            <span className="text-xs text-slate-400 font-semibold">{currentQ + 1} / {QUIZ.length}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full mb-5">
            <div className="bg-[#00a3e8] h-1.5 rounded-full transition-all" style={{ width: `${(currentQ / QUIZ.length) * 100}%` }} />
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-4">{q.pregunta}</p>
          <div className="space-y-2.5">
            {q.opciones.map((op, i) => (
              <button key={i} onClick={() => responder(i)}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 text-slate-700 hover:border-[#00a3e8] hover:bg-sky-50 text-sm transition-all">
                <span className="font-bold text-[#00a3e8] mr-2">{String.fromCharCode(65 + i)}.</span>{op}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#c9e6f8] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md bg-white rounded-[24px] shadow-xl border border-sky-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Capacítate</h1>
            <p className="text-xs text-slate-400 font-medium">Ficha de Capacitación de Personeros</p>
          </div>
          <button onClick={handleSalir}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 text-xs font-bold transition-colors">
            <LogOut size={13} />
            Salir
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Bienvenida */}
          <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
            <p className="text-sm font-bold text-slate-800 mb-2">
              ¡Bienvenido, <span className="text-[#00a3e8]">{firstName}</span>!
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-0.5 bg-white rounded-full text-slate-600 border border-slate-200 font-medium">
                DNI: {profile?.dni ?? '—'}
              </span>
              <span className="px-2.5 py-0.5 bg-white rounded-full text-slate-600 border border-slate-200 font-medium">
                Distrito: {profile?.distrito_asignado ?? 'No aplica'}
              </span>
              <span className="px-2.5 py-0.5 bg-white rounded-full text-slate-600 border border-slate-200 font-medium">
                Mesa: {profile?.mesa_asignada ?? 'No aplica'}
              </span>
            </div>
          </div>

          {/* Estadísticas de progreso */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Videos vistos"     value={videosVistos} total={2} done={videosVistos >= 2} />
            <StatCard label="Cartilla leída"    value={pdfsVistos}   total={1} done={pdfsVistos >= 1} />
            <div className="rounded-2xl border border-slate-200 p-3 text-center">
              <p className="text-[10px] text-slate-400 font-semibold leading-tight mb-1.5">Evaluación</p>
              <p className={`text-xs font-extrabold ${
                quizEstado === 'Aprobado' ? 'text-green-500' :
                quizEstado === 'Reprobado' ? 'text-red-500' : 'text-amber-500'
              }`}>
                {quizEstado === 'Aprobado' ? 'Aprobado' : quizEstado === 'Reprobado' ? 'Reprobado' : 'Pendiente'}
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="space-y-2">

            {/* Ver Video Tutorial */}
            <ActionItem
              icon={<Play size={17} className="text-[#00a3e8]" />}
              title="Ver Video Tutorial"
              subtitle="Ver el vídeo instructivo (Conteo)"
              unlocked
              done={videosVistos >= 2}
              onAction={marcarVideo}
              actionLabel={videosVistos >= 2 ? 'Visto ✓' : `Marcar visto (${videosVistos}/2)`}
            />

            {/* Cartilla PDF con temporizador */}
            <div className={`rounded-2xl border transition-all ${
              pdfsVistos >= 1 ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-white hover:border-sky-200'
            }`}>
              <div className="flex items-center gap-3 p-3.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={17} className={pdfsVistos >= 1 ? 'text-green-500' : 'text-[#00a3e8]'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">Cartilla del Personero ERM 2026</p>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {pdfsVistos >= 1
                      ? 'Cartilla leída ✓'
                      : pdfAbierto
                        ? lecturaCompleta
                          ? 'Lectura completada — puedes confirmar'
                          : `Leyendo... ${tiempoRestante}s restantes`
                        : 'Debes leer la cartilla completa (mín. 1 min)'}
                  </p>
                </div>

                {pdfsVistos >= 1 ? (
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                ) : lecturaCompleta ? (
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button
                      onClick={abrirPDF}
                      className="text-xs px-3 py-1.5 bg-slate-100 text-slate-500 font-bold rounded-lg transition-all"
                    >
                      Ver cartilla
                    </button>
                    <button
                      onClick={marcarPdfLeido}
                      className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Confirmar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={abrirPDF}
                    className="text-xs px-3 py-1.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
                  >
                    <BookOpen size={12} />
                    {pdfAbierto ? `${tiempoRestante}s` : 'Leer cartilla'}
                  </button>
                )}
              </div>
            </div>

            {/* Cuestionario */}
            <ActionItem
              icon={<CheckCircle size={17} className={puedeQuiz ? 'text-[#00a3e8]' : 'text-slate-300'} />}
              title="Cuestionario de Preguntas"
              subtitle={puedeQuiz ? 'Listo — debes aprobar 4/5 preguntas' : 'Bloqueado (Ver 2 vídeos y leer la cartilla)'}
              unlocked={puedeQuiz}
              done={quizEstado === 'Aprobado'}
              onAction={() => setQuizMode(true)}
              actionLabel="Iniciar"
            />

            {/* Constancia de Participación */}
            <ActionItem
              icon={<Award size={17} className={quizEstado === 'Aprobado' ? 'text-[#00a3e8]' : 'text-slate-300'} />}
              title="Constancia de Participación"
              subtitle={quizEstado === 'Aprobado'
                ? 'Lista — con tu nombre, fecha, cargo y distrito'
                : 'Bloqueado (Aprobar: 4/5 en Cuestionario)'}
              unlocked={quizEstado === 'Aprobado'}
              done={false}
              onAction={() => setVerConstancia(true)}
              actionLabel="Ver / Descargar"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, total, done }: { label: string; value: number; total: number; done: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3 text-center">
      <p className="text-[10px] text-slate-400 font-semibold leading-tight mb-1">{label}</p>
      <p className={`text-base font-extrabold ${done ? 'text-green-500' : 'text-[#00a3e8]'}`}>{value}/{total}</p>
    </div>
  )
}

function ActionItem({ icon, title, subtitle, unlocked, done, onAction, actionLabel }: {
  icon: React.ReactNode; title: string; subtitle: string
  unlocked: boolean; done: boolean; onAction: () => void; actionLabel: string
}) {
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
      unlocked ? 'border-slate-200 bg-white hover:border-sky-200' : 'border-slate-100 bg-slate-50/50 opacity-70'
    }`}>
      <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate">{title}</p>
        <p className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-1">{subtitle}</p>
      </div>
      {unlocked && !done && (
        <button onClick={onAction}
          className="text-xs px-3 py-1.5 bg-[#00a3e8] hover:bg-[#0092d0] text-white font-bold rounded-lg transition-all flex-shrink-0">
          {actionLabel}
        </button>
      )}
      {done && <CheckCircle size={18} className="text-green-500 flex-shrink-0" />}
      {!unlocked && <Lock size={16} className="text-slate-300 flex-shrink-0" />}
    </div>
  )
}
