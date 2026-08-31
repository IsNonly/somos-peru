// ────────────────────────────────────────────────────────────────────────────
// Pipeline OCR para actas electorales
// 1. OpenCV  → preprocesa imagen (gris, umbral, contraste)
// 2. Gemini  → OCR principal (si hay API key)
// 3. Tesseract → fallback cuando no hay Gemini
// ────────────────────────────────────────────────────────────────────────────

declare const cv: any

const GEMINI_PROMPT = `Analiza esta imagen de un acta electoral peruana (Elecciones Regionales y Municipales 2026).
Extrae TODOS los votos numéricos por partido o candidato.
Devuelve SOLO un JSON válido con este formato exacto:
{"votos": [{"partido": "nombre del partido o candidato", "provincial": número, "distrital": número}]}
Si un valor no está claro, usa 0. No incluyas texto adicional, solo el JSON.`

// ── 1. Preprocesar con OpenCV ─────────────────────────────────────────────
export async function preprocesarImagen(base64: string): Promise<string> {
  if (!(window as any).cvReady || typeof cv === 'undefined') return base64

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)

        const src = cv.imread(canvas)

        // Convertir a gris
        const gray = new cv.Mat()
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

        // Escalar a máx 1800px para balance velocidad/calidad
        const scale = Math.min(1, 1800 / Math.max(img.width, img.height))
        const resized = new cv.Mat()
        cv.resize(gray, resized, new cv.Size(
          Math.round(img.width * scale),
          Math.round(img.height * scale)
        ))

        // Umbral adaptativo para mejorar texto en formularios
        const thresh = new cv.Mat()
        cv.adaptiveThreshold(
          resized, thresh, 255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY, 11, 2
        )

        // Mostrar resultado en canvas temporal
        const outCanvas = document.createElement('canvas')
        cv.imshow(outCanvas, thresh)

        src.delete(); gray.delete(); resized.delete(); thresh.delete()

        resolve(outCanvas.toDataURL('image/jpeg', 0.92).split(',')[1])
      } catch {
        resolve(base64.split(',')[1] ?? base64)
      }
    }
    img.onerror = () => resolve(base64.split(',')[1] ?? base64)
    img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`
  })
}

// ── 2. OCR con Gemini ─────────────────────────────────────────────────────
async function ocrGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<{ partido: string; provincial: number; distrital: number }[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: GEMINI_PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })

  if (!res.ok) throw new Error(`Gemini error ${res.status}`)

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Extraer JSON del texto (puede venir con markdown ```json ... ```)
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini no devolvió JSON válido')

  const parsed = JSON.parse(match[0])
  return parsed.votos ?? []
}

// ── 3. Fallback Tesseract ────────────────────────────────────────────────
async function ocrTesseract(
  imageBase64: string
): Promise<{ partido: string; provincial: number; distrital: number }[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker({ langPath: 'https://tessdata.projectnaptha.com/4.0.0', language: 'spa' } as any)
  const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
  const { data: { text } } = await worker.recognize(dataUrl)
  await worker.terminate()

  // Parsear números del texto crudo — heurística para actas
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: { partido: string; provincial: number; distrital: number }[] = []

  lines.forEach(line => {
    const nums = line.match(/\d+/g)
    if (nums && nums.length >= 1) {
      const prov = parseInt(nums[0])
      const dist = nums.length >= 2 ? parseInt(nums[1]) : 0
      if (prov > 0 && prov < 600) {
        result.push({ partido: line.replace(/\d+/g, '').trim() || `Partido ${result.length + 1}`, provincial: prov, distrital: dist })
      }
    }
  })

  return result
}

// ── Función principal ────────────────────────────────────────────────────
export async function procesarActa(
  imageBase64: string,
  mimeType: string,
  geminiKey?: string
): Promise<{
  votos: { partido: string; provincial: number; distrital: number }[]
  metodo: 'GEMINI' | 'TESSERACT'
  textoRaw?: string
}> {
  // 1. Preprocesar con OpenCV si está disponible
  const imagenProcesada = await preprocesarImagen(imageBase64.split(',')[1] ?? imageBase64)

  // 2. Intentar Gemini primero
  if (geminiKey?.trim()) {
    try {
      const votos = await ocrGemini(imagenProcesada, mimeType, geminiKey.trim())
      return { votos, metodo: 'GEMINI' }
    } catch (e) {
      console.warn('Gemini OCR falló, usando Tesseract:', e)
    }
  }

  // 3. Fallback Tesseract
  const votos = await ocrTesseract(imagenProcesada)
  return { votos, metodo: 'TESSERACT' }
}
