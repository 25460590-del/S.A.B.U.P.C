export interface ResultadoCompresionWebP {
  /** Data URL listo para `<img src>` y almacenamiento en Firestore. */
  dataUrl: string
  /** Tamaño aproximado en bytes de la imagen comprimida. */
  bytes: number
  ancho: number
  alto: number
}

export interface OpcionesCompresion {
  /** Lado máximo en píxeles (por defecto 640 px para foto de perfil). */
  ladoMaximo?: number
  /** Recorte cuadrado centrado (ideal para avatar circular de credencial). */
  recorteCuadrado?: boolean
  /** Peso objetivo máximo en bytes (por defecto 75 KB). */
  maxBytes?: number
}

interface FuenteImagenDecodificada {
  fuente: CanvasImageSource
  ancho: number
  alto: number
  liberar: () => void
}

const MAX_DATA_URL_CHARS = 155_000
const MIME_NO_IMAGEN = /^(text\/|video\/|audio\/|application\/(pdf|zip|json|msword))/i

function bytesDesdeDataUrl(dataUrl: string): number {
  const idx = dataUrl.indexOf(',')
  const base64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
  return Math.floor((base64.length * 3) / 4)
}

function cargarConHtmlImage(archivo: File): Promise<FuenteImagenDecodificada> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()

    const limpiar = () => {
      URL.revokeObjectURL(url)
    }

    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => undefined)
        }
        const ancho = img.naturalWidth || img.width
        const alto = img.naturalHeight || img.height
        if (ancho <= 0 || alto <= 0) {
          limpiar()
          reject(
            new Error(
              'No se pudo leer la fotografía seleccionada. Intenta tomarla de nuevo o elige otra imagen.',
            ),
          )
          return
        }
        resolve({
          fuente: img,
          ancho,
          alto,
          liberar: limpiar,
        })
      } catch {
        limpiar()
        reject(
          new Error(
            'No se pudo procesar la fotografía seleccionada. Intenta con otra imagen de tu galería.',
          ),
        )
      }
    }

    img.onerror = () => {
      limpiar()
      reject(
        new Error(
          'El formato de la fotografía no es compatible con este navegador. Intenta tomar otra foto o elegir una desde la galería.',
        ),
      )
    }

    img.src = url
  })
}

async function decodificarImagenSegura(archivo: File): Promise<FuenteImagenDecodificada> {
  // 1. Intento principal con createImageBitmap: soporta fotos pesadas (5–20 MB) con menor RAM
  //    y corrige automáticamente la orientación EXIF de la cámara móvil.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          fuente: bitmap,
          ancho: bitmap.width,
          alto: bitmap.height,
          liberar: () => bitmap.close(),
        }
      }
      bitmap.close()
    } catch {
      // Fallback sin opciones (algunos navegadores móviles no soportan imageOrientation en options)
      try {
        const bitmap = await createImageBitmap(archivo)
        if (bitmap.width > 0 && bitmap.height > 0) {
          return {
            fuente: bitmap,
            ancho: bitmap.width,
            alto: bitmap.height,
            liberar: () => bitmap.close(),
          }
        }
        bitmap.close()
      } catch {
        // Continúa al fallback estándar con ObjectURL + Image
      }
    }
  }

  // 2. Respaldo universal con URL.createObjectURL + HTMLImageElement (liberando siempre la URL)
  return cargarConHtmlImage(archivo)
}

function dibujarEnCanvas(
  imagen: FuenteImagenDecodificada,
  ladoMaximo: number,
  recorteCuadrado: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No fue posible preparar la imagen en este dispositivo.')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (recorteCuadrado) {
    const ladoOrigen = Math.min(imagen.ancho, imagen.alto)
    const sx = Math.floor((imagen.ancho - ladoOrigen) / 2)
    const sy = Math.floor((imagen.alto - ladoOrigen) / 2)
    const destino = Math.max(1, Math.min(ladoMaximo, ladoOrigen))
    canvas.width = destino
    canvas.height = destino
    ctx.drawImage(imagen.fuente, sx, sy, ladoOrigen, ladoOrigen, 0, 0, destino, destino)
    return canvas
  }

  const escala = Math.min(1, ladoMaximo / Math.max(imagen.ancho, imagen.alto))
  canvas.width = Math.max(1, Math.round(imagen.ancho * escala))
  canvas.height = Math.max(1, Math.round(imagen.alto * escala))
  ctx.drawImage(imagen.fuente, 0, 0, canvas.width, canvas.height)
  return canvas
}

function codificarCanvas(
  canvas: HTMLCanvasElement,
  calidad: number,
): string | null {
  // Prioriza formato ligero moderno; si el navegador (p. ej. Safari en iOS) no lo soporta,
  // usa JPEG comprimido como respaldo automático.
  const webp = canvas.toDataURL('image/webp', calidad)
  if (webp.startsWith('data:image/webp;base64,')) {
    return webp
  }
  const jpeg = canvas.toDataURL('image/jpeg', calidad)
  if (jpeg.startsWith('data:image/jpeg;base64,')) {
    return jpeg
  }
  return null
}

/**
 * Redimensiona y comprime una fotografía en cliente (incluyendo capturas directas de cámara móvil
 * de 5–20 MB) para guardarla de forma segura en Cloud Firestore sin Firebase Storage.
 */
export async function comprimirImagenAWebP(
  archivo: File,
  opciones: OpcionesCompresion = {},
): Promise<ResultadoCompresionWebP> {
  if (!archivo || archivo.size === 0) {
    throw new Error('No se recibió ninguna fotografía. Intenta de nuevo.')
  }

  // En cámara móvil (Android/iOS) `archivo.type` puede llegar vacío o genérico;
  // solo rechazamos tipos que claramente NO son imagen y validamos el resto al decodificar.
  if (archivo.type && MIME_NO_IMAGEN.test(archivo.type)) {
    throw new Error('Selecciona una fotografía válida.')
  }

  const ladoInicial = Math.min(800, Math.max(300, opciones.ladoMaximo ?? 640))
  const recorteCuadrado = opciones.recorteCuadrado ?? true
  const maxBytes = opciones.maxBytes ?? 75 * 1024

  const decodificada = await decodificarImagenSegura(archivo)

  try {
    const dimensiones = Array.from(
      new Set([ladoInicial, Math.round(ladoInicial * 0.78), 420, 320, 240]),
    ).sort((a, b) => b - a)
    const calidades = [0.82, 0.74, 0.64, 0.54, 0.44, 0.34, 0.26]

    let mejor: ResultadoCompresionWebP | null = null

    for (const lado of dimensiones) {
      const canvas = dibujarEnCanvas(decodificada, lado, recorteCuadrado)
      try {
        for (const calidad of calidades) {
          const dataUrl = codificarCanvas(canvas, calidad)
          if (!dataUrl) {
            throw new Error(
              'Este dispositivo no pudo comprimir la fotografía. Intenta desde otro navegador.',
            )
          }
          const bytes = bytesDesdeDataUrl(dataUrl)
          const candidato: ResultadoCompresionWebP = {
            dataUrl,
            bytes,
            ancho: canvas.width,
            alto: canvas.height,
          }
          if (!mejor || candidato.dataUrl.length < mejor.dataUrl.length) {
            mejor = candidato
          }
          if (bytes <= maxBytes && dataUrl.length <= MAX_DATA_URL_CHARS) {
            return candidato
          }
        }
      } finally {
        // Libera memoria de canvas en móviles tras cada intento
        canvas.width = 0
        canvas.height = 0
      }
    }

    if (!mejor || mejor.dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error(
        'La fotografía es demasiado pesada para guardarse. Intenta tomarla con mejor iluminación o elige otra imagen.',
      )
    }

    return mejor
  } finally {
    decodificada.liberar()
  }
}
