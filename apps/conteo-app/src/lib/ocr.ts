// ────────────────────────────────────────────────────────────────────────────
// Pipeline OCR para actas electorales
// 1. OpenCV  → preprocesa imagen (gris, umbral, contraste)
// 2. Gemini  → OCR principal (si hay API key)
// 3. Tesseract → fallback cuando no hay Gemini
// ────────────────────────────────────────────────────────────────────────────

declare const cv: any

function geminiPrompt(partidos: string[], sanIsidro: boolean): string {
  const lista = partidos.length
    ? `\nEstos son los partidos que postulan en este distrito (úsalos como referencia para reconocer cada fila):\n${partidos.map(p => `- ${p}`).join('\n')}\n`
    : ''
  if (sanIsidro) return `Esta es la foto de un ACTA DE ESCRUTINIO de San Isidro (Elecciones Municipales 2026).
Lee SOLO la tabla "ORGANIZACIONES POLÍTICAS". Ignora todo lo demás (encabezados, firmas, logos, sellos).
La tabla tiene exactamente estas columnas que importan:
- "TOTAL DE VOTOS MUNICIPAL PROVINCIAL" (primera columna de votos) → "provincial"
- "TOTAL DE VOTOS MUNICIPAL DISTRITAL" (segunda columna de votos) → "distrital"
Cómo leer cada casilla de votos:
- Cada casilla tiene 3 cuadritos (centenas, decenas, unidades) con dígitos escritos A MANO. Junta los dígitos de la casilla en un solo número: "1 0 0" = 100, "8 4" = 84, "6 7" = 67, "2 2 7" = 227.
- Si la casilla tiene "0" o está vacía, el valor es 0.
- Si la casilla de la columna DISTRITAL está pintada de GRIS/NEGRO (sombreada), ese partido no postula en distrital: distrital = 0.
- Los números chicos de los bordes izquierdo y derecho (1, 2, 3 … 26) son el número de fila, NO son votos.
Recorre TODAS las filas de arriba hacia abajo sin saltarte ninguna: las organizaciones políticas, luego VOTOS EN BLANCO, VOTOS NULOS y VOTOS IMPUGNADOS.
En "partido" copia el nombre tal como está impreso en la fila.
${lista}
Lee también la última fila "TOTAL DE VOTOS EMITIDOS" de cada columna. La suma de todas las filas (incluidos blanco, nulos e impugnados) debe dar ese total: si no cuadra, vuelve a mirar las casillas.
Devuelve SOLO un JSON válido con este formato exacto:
{"votos": [{"partido": "nombre", "provincial": número, "distrital": número}], "total_provincial": número, "total_distrital": número}`
  return `Analiza esta foto de un ACTA ELECTORAL peruana (Elecciones Regionales y Municipales 2026).
El acta es una tabla: cada fila es una organización política (con su número de orden y logo) y al final están las filas de VOTOS EN BLANCO, VOTOS NULOS y VOTOS IMPUGNADOS.
Las columnas de votos son, de izquierda a derecha: MUNICIPAL PROVINCIAL y MUNICIPAL DISTRITAL (si solo hay una columna de votos, pon el mismo valor en ambas).
Los números suelen estar escritos A MANO: léelos con cuidado, dígito por dígito.
${lista}
Reglas:
- Recorre TODAS las filas de arriba hacia abajo, sin saltarte ninguna, incluidas BLANCO, NULOS e IMPUGNADOS.
- En "partido" copia el nombre de la organización tal como está impreso en el acta.
- Si la casilla está vacía, tachada o con una raya, el valor es 0.
- No confundas el número de orden de la fila con los votos.
Devuelve SOLO un JSON válido con este formato exacto:
{"votos": [{"partido": "nombre de la organización", "provincial": número, "distrital": número}]}`
}

export interface VotoOCR { partido: string; provincial: number; distrital: number }
export interface LecturaOCR { votos: VotoOCR[]; totalProvincial?: number; totalDistrital?: number }

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

// Achica la foto (a color) a máx. 2000px: una foto de celular pesa varios MB
// y con datos móviles tarda en subir; a 2000px los números se siguen leyendo bien.
async function reducirFoto(base64: string, mimeType: string): Promise<{ data: string; mime: string }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
        if (scale === 1) return resolve({ data: base64, mime: mimeType })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1], mime: 'image/jpeg' })
      } catch {
        resolve({ data: base64, mime: mimeType })
      }
    }
    img.onerror = () => resolve({ data: base64, mime: mimeType })
    img.src = `data:${mimeType};base64,${base64}`
  })
}

// ── 2. OCR con Gemini ─────────────────────────────────────────────────────
async function ocrGemini(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  modelo: string,
  partidos: string[],
  sanIsidro: boolean
): Promise<LecturaOCR> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: geminiPrompt(partidos, sanIsidro) },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    }),
  })

  if (!res.ok) {
    // Motivo que da Google (clave inválida, cuota agotada, alta demanda…)
    let motivo = ''
    try { motivo = (await res.json())?.error?.message ?? '' } catch { /* sin cuerpo */ }
    throw new Error(`Gemini error ${res.status}${motivo ? `: ${motivo.slice(0, 160)}` : ''}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Extraer JSON del texto (puede venir con markdown ```json ... ```)
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Gemini no devolvió JSON válido')

  const parsed = JSON.parse(match[0])
  // Asegura números (a veces vienen como texto: "67")
  const num = (x: unknown) => { const n = parseInt(String(x ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 0 }
  const votos: VotoOCR[] = (parsed.votos ?? []).map((v: any) => ({ partido: String(v?.partido ?? ''), provincial: num(v?.provincial), distrital: num(v?.distrital) }))
  return {
    votos,
    totalProvincial: parsed.total_provincial != null ? num(parsed.total_provincial) : undefined,
    totalDistrital: parsed.total_distrital != null ? num(parsed.total_distrital) : undefined,
  }
}

// ── 3. Fallback Tesseract ────────────────────────────────────────────────
async function ocrTesseract(
  imageBase64: string
): Promise<{ partido: string; provincial: number; distrital: number }[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker({ langPath: 'https://tessdata.projectnaptha.com/4.0.0' } as any)
  // tesseract.js v4 no auto-inicializa el idioma a partir de la opción `language`
  // de createWorker (se ignora en silencio): sin este paso, recognize() falla
  // porque el motor nunca cargó el modelo — createWorker no lanza error, pero
  // internamente el puntero al motor queda nulo.
  await worker.loadLanguage('spa')
  await worker.initialize('spa')
  const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
  const { data: { text } } = await worker.recognize(dataUrl)
  await worker.terminate()

  // Parsear números del texto crudo — heurística para actas.
  // El conteo de votos SIEMPRE es el último número de la fila (va después
  // del nombre del partido); un posible número de orden de la organización
  // política (1, 2, 3…) puede venir ANTES del nombre y no debe confundirse
  // con los votos — por eso se toma desde el final, no desde el inicio.
  // Actas de un solo nivel (ej. solo "Municipal Provincial"): 2 números por
  // fila → [orden, votos]. Actas combinadas (Provincial + Distrital en la
  // misma tabla): 3 números → [orden, votos provincial, votos distrital].
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: { partido: string; provincial: number; distrital: number }[] = []

  lines.forEach(line => {
    const nums = line.match(/\d+/g)
    if (!nums || !nums.length) return
    const valores = nums.map(n => parseInt(n, 10))
    const votos = valores[valores.length - 1]
    const provincial = valores.length >= 3 ? valores[valores.length - 2] : votos
    const distrital = votos
    if (votos > 0 && votos < 600) {
      result.push({ partido: line.replace(/\d+/g, '').trim() || `Partido ${result.length + 1}`, provincial, distrital })
    }
  })

  return result
}

// ── Función principal ────────────────────────────────────────────────────
export async function procesarActa(
  imageBase64: string,
  mimeType: string,
  geminiKey?: string,
  // Nombres de los partidos del distrito: se le pasan a Gemini para que
  // reconozca cada fila del acta con más seguridad.
  partidos: string[] = [],
  // San Isidro usa un prompt específico de su acta (columnas Provincial /
  // Distrital, casillas de 3 dígitos, celdas sombreadas, fila de TOTAL).
  sanIsidro = false
): Promise<{
  votos: VotoOCR[]
  totalProvincial?: number
  totalDistrital?: number
  metodo: 'GEMINI' | 'TESSERACT'
  textoRaw?: string
  // Si Gemini se intentó y falló (ej. "alta demanda"), queda el motivo acá
  // aunque el resultado final haya salido de Tesseract -sin esto, el fallo de
  // Gemini se perdía en un console.warn y parecía que nunca se intentó.
  geminiError?: string
}> {
  const original = imageBase64.split(',')[1] ?? imageBase64

  // 2. Intentar Gemini primero. 'flash-lite' va antes que el 'flash' grande:
  // en la práctica el grande devuelve 503 "alta demanda" con mucha frecuencia
  // -probado con actas reales-, mientras que el lite respondió siempre y leyó
  // el acta perfecto (19/19 partidos + blanco/nulo/impugnado). Si el lite
  // falla igual, se reintenta una vez con el grande antes de caer a Tesseract.
  let geminiError: string | undefined
  if (geminiKey?.trim()) {
    const foto = await reducirFoto(original, mimeType)
    // Con mucha gente escaneando a la vez Google responde 429/503 por ratos:
    // se reintenta (con una pausa) antes de rendirse.
    const intentos = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-flash-latest']
    for (let i = 0; i < intentos.length; i++) {
      const modelo = intentos[i]
      if (i > 0) await new Promise(r => setTimeout(r, 1500 * i))
      try {
        // Gemini recibe la foto ORIGINAL: el preprocesado blanco/negro de
        // OpenCV ayuda a Tesseract pero a Gemini le borra trazos de los
        // números escritos a mano.
        const lectura = await ocrGemini(foto.data, foto.mime, geminiKey.trim(), modelo, partidos, sanIsidro)
        return { ...lectura, metodo: 'GEMINI' }
      } catch (e) {
        geminiError = e instanceof Error ? e.message : String(e)
        console.warn(`Gemini OCR (${modelo}) falló:`, e)
      }
    }
  }

  // San Isidro: sin respaldo Tesseract. Lee la hoja entera y llena números
  // equivocados; mejor avisar que la IA no respondió para volver a intentar.
  if (sanIsidro) throw new Error(geminiError
    ? `La IA no respondió (${geminiError}). Espera unos segundos y vuelve a subir la foto.`
    : 'No hay clave de IA configurada para escanear el acta.')

  // 3. Fallback Tesseract (con la imagen preprocesada por OpenCV)
  const imagenProcesada = await preprocesarImagen(original)
  const votos = await ocrTesseract(imagenProcesada)
  return { votos, metodo: 'TESSERACT', geminiError }
}
