import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Play, FileText, CheckCircle, Lock, ChevronRight } from 'lucide-react'

interface TrainingItem {
  id: number
  tipo: 'VIDEO' | 'PDF'
  titulo: string
  url: string
  orden: number
}

interface Progress { item_id: number; completado: boolean }

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

export default function CapacitacionPage() {
  const [items, setItems] = useState<TrainingItem[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [userId, setUserId] = useState<string>('')
  const [quizMode, setQuizMode] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [respuestas, setRespuestas] = useState<number[]>([])
  const [quizDone, setQuizDone] = useState<{ puntaje: number; aprobado: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: dbItems }, { data: dbProg }, { data: profile }] = await Promise.all([
        supabase.from('training_items').select('*').eq('activo', true).order('orden'),
        supabase.from('training_progress').select('item_id, completado').eq('user_id', user.id),
        supabase.from('profiles').select('quiz_estado').eq('id', user.id).single(),
      ])

      if (!dbItems?.length) {
        const defaultItems = [
          { tipo: 'VIDEO', titulo: 'Manual del Personero de Mesa — Parte 1', url: '', orden: 1, activo: true },
          { tipo: 'VIDEO', titulo: 'Manual del Personero de Mesa — Parte 2', url: '', orden: 2, activo: true },
          { tipo: 'PDF',   titulo: 'Manual de instrucciones para personeros', url: '/manuals/Guion_Capacitacion_Personeros_ERM_2026.docx', orden: 3, activo: true },
          { tipo: 'PDF',   titulo: 'Defensa del Voto — Guía práctica', url: '', orden: 4, activo: true },
        ]
        const { data: inserted } = await supabase.from('training_items').insert(defaultItems).select()
        setItems((inserted ?? []) as TrainingItem[])
      } else {
        setItems(dbItems as TrainingItem[])
      }

      setProgress((dbProg ?? []) as Progress[])
      if (profile?.quiz_estado === 'Aprobado') {
        setQuizDone({ puntaje: 5, aprobado: true })
      }
      setLoading(false)
    }
    init()
  }, [])

  const marcarCompletado = async (itemId: number) => {
    await supabase.from('training_progress').upsert(
      { user_id: userId, item_id: itemId, completado: true, completado_at: new Date().toISOString() },
      { onConflict: 'user_id,item_id' }
    )
    setProgress(prev => {
      const exists = prev.find(p => p.item_id === itemId)
      if (exists) return prev.map(p => p.item_id === itemId ? { ...p, completado: true } : p)
      return [...prev, { item_id: itemId, completado: true }]
    })
    const type = items.find(i => i.id === itemId)?.tipo
    const field = type === 'VIDEO' ? 'videos_vistos' : 'pdfs_vistos'
    const { data: p } = await supabase.from('profiles').select(field).eq('id', userId).single()
    await supabase.from('profiles').update({ [field]: ((p as any)?.[field] ?? 0) + 1 }).eq('id', userId)
  }

  const isCompletado = (itemId: number) => progress.find(p => p.item_id === itemId)?.completado ?? false

  const videosOk = items.filter(i => i.tipo === 'VIDEO').filter(i => isCompletado(i.id)).length >= 2
  const pdfsOk   = items.filter(i => i.tipo === 'PDF').filter(i => isCompletado(i.id)).length >= 2
  const puedeQuiz = videosOk && pdfsOk && !quizDone

  const responder = (idx: number) => {
    const nuevas = [...respuestas, idx]
    setRespuestas(nuevas)
    if (currentQ + 1 < QUIZ.length) {
      setCurrentQ(q => q + 1)
    } else {
      const puntaje = nuevas.reduce((acc, r, i) => acc + (r === QUIZ[i].correcta ? 1 : 0), 0)
      const aprobado = puntaje >= 4
      setQuizDone({ puntaje, aprobado })
      supabase.from('quiz_intentos').insert({ user_id: userId, puntaje, aprobado, respuestas: nuevas })
      supabase.from('profiles').update({ quiz_estado: aprobado ? 'Aprobado' : 'Reprobado' }).eq('id', userId)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (quizMode && !quizDone) {
    const q = QUIZ[currentQ]
    return (
      <div className="max-w-2xl mx-auto space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-xl">Cuestionario Oficial de Capacitación</h2>
          <span className="text-white/40 text-sm">{currentQ + 1} / {QUIZ.length}</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full">
          <div className="h-full bg-brand-red rounded-full transition-all" style={{ width: `${((currentQ) / QUIZ.length) * 100}%` }} />
        </div>
        <div className="bg-[#16162a] border border-white/8 rounded-2xl p-6 space-y-5">
          <p className="text-white font-medium text-lg">{q.pregunta}</p>
          <div className="space-y-3">
            {q.opciones.map((op, i) => (
              <button key={i} onClick={() => responder(i)}
                className="w-full text-left px-4 py-3.5 rounded-xl border border-white/10 text-white/70 hover:border-brand-red/50 hover:bg-brand-red/10 hover:text-white transition-all text-sm">
                {String.fromCharCode(65 + i)}. {op}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (quizDone) {
    return (
      <div className="max-w-xl mx-auto text-center space-y-5 fade-in">
        <div className={`inline-flex w-20 h-20 items-center justify-center rounded-full border-2 mx-auto
          ${quizDone.aprobado ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
          <CheckCircle size={36} className={quizDone.aprobado ? 'text-green-400' : 'text-red-400'} />
        </div>
        <h2 className="text-white font-bold text-2xl">
          {quizDone.aprobado ? 'Aprobado' : 'Reprobado'}
        </h2>
        <p className="text-white/60">Puntaje: {quizDone.puntaje}/{QUIZ.length}</p>
        {!quizDone.aprobado && (
          <button onClick={() => { setQuizMode(false); setRespuestas([]); setCurrentQ(0); setQuizDone(null) }}
            className="px-6 py-3 bg-brand-red hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all">
            Reintentar
          </button>
        )}
        {quizDone.aprobado && (
          <p className="text-green-400 text-sm">Tu credencial está en proceso de confirmación.</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      <div>
        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Formación</p>
        <h1 className="text-white text-2xl font-bold">Capacitación Electoral</h1>
        <p className="text-white/40 text-sm mt-1">Completa todos los materiales para desbloquear el cuestionario.</p>
      </div>

      {/* Videos */}
      <div className="space-y-3">
        <h3 className="text-white/60 text-xs uppercase tracking-widest">Videos</h3>
        {items.filter(i => i.tipo === 'VIDEO').map(item => (
          <div key={item.id} className="bg-[#16162a] border border-white/8 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${isCompletado(item.id) ? 'bg-green-500/20' : 'bg-white/5'}`}>
              {isCompletado(item.id)
                ? <CheckCircle size={18} className="text-green-400" />
                : <Play size={18} className="text-white/40" />}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{item.titulo}</p>
              <p className="text-white/30 text-xs">{isCompletado(item.id) ? 'Completado' : 'Pendiente'}</p>
            </div>
            {!isCompletado(item.id) && (
              <button onClick={() => marcarCompletado(item.id)}
                className="px-3 py-1.5 bg-brand-red/20 border border-brand-red/30 text-brand-red hover:bg-brand-red/30 rounded-lg text-xs font-medium transition-all">
                Marcar visto
              </button>
            )}
          </div>
        ))}
      </div>

      {/* PDFs */}
      <div className="space-y-3">
        <h3 className="text-white/60 text-xs uppercase tracking-widest">Manuales PDF</h3>
        {items.filter(i => i.tipo === 'PDF').map(item => (
          <div key={item.id} className="bg-[#16162a] border border-white/8 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${isCompletado(item.id) ? 'bg-green-500/20' : 'bg-white/5'}`}>
              {isCompletado(item.id)
                ? <CheckCircle size={18} className="text-green-400" />
                : <FileText size={18} className="text-white/40" />}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{item.titulo}</p>
              <p className="text-white/30 text-xs">{isCompletado(item.id) ? 'Completado' : 'Pendiente'}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 bg-white/5 border border-white/10 text-white/60 hover:text-white rounded-lg text-xs font-medium transition-all">
                  Ver PDF
                </a>
              )}
              {!isCompletado(item.id) && (
                <button onClick={() => marcarCompletado(item.id)}
                  className="px-3 py-1.5 bg-brand-red/20 border border-brand-red/30 text-brand-red hover:bg-brand-red/30 rounded-lg text-xs font-medium transition-all">
                  Marcar leído
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quiz */}
      <div className={`border rounded-2xl p-6 ${puedeQuiz ? 'bg-brand-red/10 border-brand-red/30' : 'bg-white/3 border-white/8'}`}>
        <div className="flex items-center gap-3">
          {puedeQuiz
            ? <ChevronRight size={20} className="text-brand-red" />
            : <Lock size={20} className="text-white/30" />}
          <div>
            <p className="text-white font-semibold">Cuestionario Oficial de Capacitación Electoral</p>
            <p className="text-white/40 text-xs">
              {puedeQuiz ? 'Listo para rendir — debes aprobar 4/5 preguntas' : 'Bloqueado (Ver 2 videos y 2 PDFs)'}
            </p>
          </div>
          {puedeQuiz && (
            <button onClick={() => setQuizMode(true)}
              className="ml-auto px-4 py-2 bg-brand-red hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all">
              Iniciar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
