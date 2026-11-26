import { registerSW } from 'virtual:pwa-register'

export interface EstadoPwaBeta {
  actualizacionDisponible: boolean
  aplicando: boolean
}

let estadoActual: EstadoPwaBeta = {
  actualizacionDisponible: false,
  aplicando: false,
}

let iniciado = false
let actualizarSwFn: ((reloadPage?: boolean) => Promise<void>) | null = null
const oyentes = new Set<() => void>()

function emitir() {
  for (const fn of oyentes) fn()
}

export function suscribirEstadoPwa(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function obtenerEstadoPwa(): EstadoPwaBeta {
  return estadoActual
}

/**
 * Control de PWA en fase beta:
 * 1. Bloquea el diálogo nativo "Instalar aplicación" (`beforeinstallprompt`) para no
 *    interrumpir al personal con instalaciones prematuras durante el periodo beta.
 * 2. Registra el Service Worker en modo controlado (`prompt`) y notifica a la UI
 *    cuando existe una nueva versión lista para aplicarse bajo decisión del usuario.
 */
export function iniciarControlPwaBeta(): void {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true

  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault()
  })

  try {
    actualizarSwFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        estadoActual = {
          actualizacionDisponible: true,
          aplicando: false,
        }
        emitir()
      },
    })
  } catch {
    // En entornos sin Service Worker (p. ej. pruebas o navegadores restringidos) no bloquea el arranque
  }
}

export async function aplicarActualizacionPwa(): Promise<void> {
  if (!actualizarSwFn || estadoActual.aplicando) return
  estadoActual = {
    actualizacionDisponible: true,
    aplicando: true,
  }
  emitir()
  try {
    await actualizarSwFn(true)
  } catch {
    estadoActual = {
      actualizacionDisponible: true,
      aplicando: false,
    }
    emitir()
  }
}

export function posponerActualizacionPwa(): void {
  if (!estadoActual.actualizacionDisponible) return
  estadoActual = {
    actualizacionDisponible: false,
    aplicando: false,
  }
  emitir()
}
