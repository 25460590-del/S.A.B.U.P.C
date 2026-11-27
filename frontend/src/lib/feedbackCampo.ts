/**
 * Utilidades ligeras para operación en campo:
 * - Sanitización de teléfonos para enlaces `tel:`.
 * - Feedback háptico (`navigator.vibrate`) y tonos sintéticos cortos vía Web Audio API
 *   (cero archivos de audio externos, seguro en navegadores sin soporte).
 */

export function sanitizarTelefonoTel(telefono?: string | null): string {
  if (!telefono) return ''
  const limpio = telefono.trim().replace(/[^\d+]/g, '')
  const digitos = limpio.replace(/\D/g, '')
  return digitos.length >= 7 ? limpio : ''
}

let audioCtxCompartido: AudioContext | null = null

function obtenerAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    if (!audioCtxCompartido) {
      audioCtxCompartido = new Ctor()
    }
    if (audioCtxCompartido.state === 'suspended') {
      void audioCtxCompartido.resume().catch(() => undefined)
    }
    return audioCtxCompartido
  } catch {
    return null
  }
}

function emitirTono(
  ctx: AudioContext,
  frecuenciaHz: number,
  inicioSeg: number,
  duracionSeg: number,
  tipo: OscillatorType = 'sine',
  ganancia = 0.14,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(frecuenciaHz, inicioSeg)
  gain.gain.setValueAtTime(0.001, inicioSeg)
  gain.gain.exponentialRampToValueAtTime(ganancia, inicioSeg + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.001, inicioSeg + duracionSeg)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(inicioSeg)
  osc.stop(inicioSeg + duracionSeg + 0.01)
}

export function reproducirFeedbackCampo(tipo: 'exito' | 'alerta'): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(tipo === 'exito' ? [60] : [110, 60, 140])
    } catch {
      // Algunos navegadores bloquean vibración sin gesto reciente
    }
  }

  const ctx = obtenerAudioContext()
  if (!ctx) return
  try {
    const ahora = ctx.currentTime
    if (tipo === 'exito') {
      emitirTono(ctx, 920, ahora, 0.11, 'sine', 0.14)
    } else {
      emitirTono(ctx, 290, ahora, 0.11, 'triangle', 0.16)
      emitirTono(ctx, 210, ahora + 0.14, 0.14, 'triangle', 0.16)
    }
  } catch {
    // Ignorar error de reproducción en dispositivos silenciados o restringidos
  }
}
