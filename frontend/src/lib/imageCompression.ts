export interface ResultadoCompresionWebP {
  /** Data URL listo para `<img src>` y almacenamiento en Firestore (`data:image/webp;base64,...`). */
  dataUrl: string
  /** Tamaño aproximado en bytes del WebP binario. */
  bytes: number
  ancho: number
  alto: number
}

export interface OpcionesCompresion {
  /** Lado máximo en píxeles (por defecto 480 px para foto de perfil). */
  ladoMaximo?: number
  /** Recorte cuadrado centrado (ideal para avatar circular de credencial). */
  recorteCuadrado?: boolean
  /** Peso objetivo máximo en bytes (por defecto 70 KB). */
  maxBytes?: number
}

function bytesDesdeDataUrl(dataUrl: string): number {
  const idx = dataUrl.indexOf(',')
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
  return Math.floor((base64.length * 3) / 4)
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }
    img.src = url
  })
}

function dibujarEnCanvas(
  img: HTMLImageElement,
  ladoMaximo: number,
  recorteCuadrado: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Tu navegador no soporta procesamiento de imágenes en canvas.')

  if (recorteCuadrado) {
    const ladoOrigen = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = Math.floor((img.naturalWidth - ladoOrigen) / 2)
    const sy = Math.floor((img.naturalHeight - ladoOrigen) / 2)
    const destino = Math.min(ladoMaximo, ladoOrigen)
    canvas.width = destino
    canvas.height = destino
    ctx.drawImage(img, sx, sy, ladoOrigen, ladoOrigen, 0, 0, destino, destino)
    return canvas
  }

  const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight))
  canvas.width = Math.max(1, Math.round(img.naturalWidth * escala))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * escala))
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Redimensiona y comprime una fotografía en cliente a WebP ligero (~40–70 KB)
 * en base64 para guardarla en Cloud Firestore sin usar Firebase Storage.
 */
export async function comprimirImagenAWebP(
  archivo: File,
  opciones: OpcionesCompresion = {},
): Promise<ResultadoCompresionWebP> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (JPG, PNG o WebP).')
  }

  const ladoInicial = opciones.ladoMaximo ?? 480
  const recorteCuadrado = opciones.recorteCuadrado ?? true
  const maxBytes = opciones.maxBytes ?? 70 * 1024

  const img = await cargarImagen(archivo)
  const dimensiones = [ladoInicial, Math.round(ladoInicial * 0.75), 300]
  const calidades = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34]

  let mejor: ResultadoCompresionWebP | null = null

  for (const lado of dimensiones) {
    const canvas = dibujarEnCanvas(img, lado, recorteCuadrado)
    for (const calidad of calidades) {
      const dataUrl = canvas.toDataURL('image/webp', calidad)
      if (!dataUrl.startsWith('data:image/webp;base64,')) {
        throw new Error('Tu navegador no soporta compresión WebP.')
      }
      const bytes = bytesDesdeDataUrl(dataUrl)
      mejor = { dataUrl, bytes, ancho: canvas.width, alto: canvas.height }
      if (bytes <= maxBytes) {
        return mejor
      }
    }
  }

  if (!mejor || mejor.dataUrl.length > 155_000) {
    throw new Error('La imagen es demasiado pesada incluso comprimida. Intenta con otra fotografía.')
  }

  return mejor
}
