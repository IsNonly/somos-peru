import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Dibuja el PDF dentro de la página, hoja por hoja. Chrome en Android no
// muestra PDFs dentro de un <iframe> (pide descargarlo), así que lo pintamos
// nosotros con PDF.js y se lee igual en cualquier celular.
export default function VisorPDF({ url, titulo, style }: { url: string; titulo: string; style?: React.CSSProperties }) {
  const cont = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [progreso, setProgreso] = useState('')

  useEffect(() => {
    let cancelado = false
    const tarea = pdfjs.getDocument({ url })
    ;(async () => {
      try {
        const doc = await tarea.promise
        const div = cont.current
        if (!div || cancelado) return
        div.innerHTML = ''
        const ancho = Math.max(div.clientWidth - 16, 280)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelado) return
          setProgreso(`${n} / ${doc.numPages}`)
          const pag = await doc.getPage(n)
          const base = pag.getViewport({ scale: 1 })
          const vp = pag.getViewport({ scale: (ancho / base.width) * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(vp.width)
          canvas.height = Math.floor(vp.height)
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          canvas.style.margin = '0 auto 8px'
          canvas.style.background = '#fff'
          canvas.style.boxShadow = '0 1px 3px rgba(0,0,0,.15)'
          canvas.setAttribute('aria-label', `${titulo} — página ${n}`)
          div.appendChild(canvas)
          await pag.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
          if (n === 1 && !cancelado) setEstado('listo')
        }
        if (!cancelado) setEstado('listo')
      } catch (e) {
        if (!cancelado) { console.error('VisorPDF', e); setEstado('error') }
      }
    })()
    return () => { cancelado = true; tarea.destroy() }
  }, [url, titulo])

  return (
    <div className="relative w-full bg-slate-200 overflow-y-auto" style={style} title={titulo}>
      <div ref={cont} className="p-2" />
      {estado === 'cargando' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-[#00a3e8] rounded-full animate-spin" />
          Cargando cartilla… {progreso}
        </div>
      )}
      {estado === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-600">
          No se pudo mostrar la cartilla aquí.
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-[#00a3e8] text-white font-bold">
            Abrir cartilla
          </a>
        </div>
      )}
    </div>
  )
}
