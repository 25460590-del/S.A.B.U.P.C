/**
 * Gestión liviana de operaciones encoladas sin conexión y detección de rechazos diferidos
 * al recuperar señal (Plan Spark + persistencia IndexedDB de Firestore).
 */

export interface OperacionPendienteOffline {
  id: string
  descripcion: string
  creadaMs: number
}

export interface RechazoDiferidoOffline {
  id: string
  descripcion: string
  detalle: string
  fechaMs: number
}

export interface EstadoColaOffline {
  pendientes: OperacionPendienteOffline[]
  rechazos: RechazoDiferidoOffline[]
}

const pendientes = new Map<string, OperacionPendienteOffline>()
let rechazos: RechazoDiferidoOffline[] = []
const oyentes = new Set<() => void>()

let cacheEstado: EstadoColaOffline = { pendientes: [], rechazos: [] }

function reconstruirEstado() {
  cacheEstado = {
    pendientes: Array.from(pendientes.values()),
    rechazos: [...rechazos],
  }
}

function notificar() {
  reconstruirEstado()
  for (const cb of oyentes) {
    cb()
  }
}

export function estaEnLinea(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function traducirErrorSincronizacion(err: unknown, descripcion: string): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code === 'permission-denied') {
    return `No se pudo sincronizar "${descripcion}": el servidor rechazó el registro (el operativo pudo haber sido cerrado, la recepción cerrada o ya existía un turno abierto).`
  }
  if (code === 'failed-precondition') {
    return `No se pudo sincronizar "${descripcion}": las condiciones cambiaron en el servidor antes de reconectar.`
  }
  if (code === 'already-exists') {
    return `No se pudo sincronizar "${descripcion}": el registro ya existía en el servidor.`
  }
  if (code === 'not-found') {
    return `No se pudo sincronizar "${descripcion}": el documento ya no existe en el servidor.`
  }
  const msg = err instanceof Error && err.message ? err.message : 'error al sincronizar con el servidor'
  return `No se pudo sincronizar "${descripcion}": ${msg}`
}

export function registrarRechazoDiferido(descripcion: string, err: unknown): void {
  const detalle = traducirErrorSincronizacion(err, descripcion)
  const ahora = Date.now()
  const duplicadoReciente = rechazos.some(
    (r) => r.descripcion === descripcion && r.detalle === detalle && ahora - r.fechaMs < 5_000,
  )
  if (duplicadoReciente) return

  const nuevo: RechazoDiferidoOffline = {
    id: `rej_${ahora}_${Math.random().toString(36).slice(2, 8)}`,
    descripcion,
    detalle,
    fechaMs: ahora,
  }
  rechazos = [nuevo, ...rechazos].slice(0, 10)
  notificar()
}

/**
 * Despacha una escritura de Firestore que puede quedar encolada en la caché local offline:
 * - Si hay red (`navigator.onLine === true`): espera normalmente la confirmación y propaga errores al caller.
 * - Si NO hay red (`navigator.onLine === false`): devuelve de inmediato `{ encoladoLocal: true }` para no
 *   congelar la interfaz de campo, pero mantiene un observador sobre la promesa para capturar cualquier
 *   rechazo diferido cuando vuelva la señal y mostrar una alerta visible al usuario.
 */
export async function despacharEscrituraOffline(
  promesa: Promise<void>,
  descripcion: string,
): Promise<{ encoladoLocal: boolean }> {
  const opId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  pendientes.set(opId, { id: opId, descripcion, creadaMs: Date.now() })
  notificar()

  if (estaEnLinea()) {
    try {
      await promesa
      pendientes.delete(opId)
      notificar()
      return { encoladoLocal: false }
    } catch (err) {
      pendientes.delete(opId)
      notificar()
      throw err
    }
  }

  // Modo sin conexión: Firestore aplica el cambio optimista en IndexedDB y mantiene la promesa pendiente
  // hasta que el servidor responda al reconectar.
  void promesa.then(
    () => {
      pendientes.delete(opId)
      notificar()
    },
    (err) => {
      pendientes.delete(opId)
      registrarRechazoDiferido(descripcion, err)
    },
  )

  return { encoladoLocal: true }
}

export function obtenerEstadoColaOffline(): EstadoColaOffline {
  return cacheEstado
}

export function suscribirColaOffline(cb: () => void): () => void {
  oyentes.add(cb)
  return () => {
    oyentes.delete(cb)
  }
}

export function descartarRechazoOffline(id: string): void {
  rechazos = rechazos.filter((r) => r.id !== id)
  notificar()
}

export function limpiarRechazosOffline(): void {
  if (rechazos.length === 0) return
  rechazos = []
  notificar()
}
