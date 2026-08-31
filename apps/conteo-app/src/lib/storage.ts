import { supabase } from './supabase'

// Comprimir imagen antes de subir (máx 800KB)
async function comprimirImagen(dataUrl: string, maxKB = 800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let quality = 0.85
      let scale   = 1

      // Reducir escala si es muy grande
      const maxDim = 1600
      if (img.width > maxDim || img.height > maxDim) {
        scale = maxDim / Math.max(img.width, img.height)
      }

      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const compress = () => {
        const result = canvas.toDataURL('image/jpeg', quality)
        const sizeKB  = Math.round(result.length * 0.75 / 1024)
        if (sizeKB > maxKB && quality > 0.3) {
          quality -= 0.1
          compress()
        } else {
          resolve(result)
        }
      }
      compress()
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

// Subir imagen del acta a Supabase Storage
export async function subirImagenActa(
  mesaNumero: string,
  dataUrl: string,
  mimeType = 'image/jpeg'
): Promise<string | null> {
  try {
    const comprimida = await comprimirImagen(dataUrl)
    const base64 = comprimida.split(',')[1]
    const bytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const blob   = new Blob([bytes], { type: mimeType })

    const path = `actas/${mesaNumero}_${Date.now()}.jpg`

    const { error } = await supabase.storage
      .from('actas')
      .upload(path, blob, { upsert: true, contentType: mimeType })

    if (error) {
      console.error('Storage upload error:', error)
      return null
    }

    const { data } = supabase.storage.from('actas').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error('Error subiendo imagen:', e)
    return null
  }
}
