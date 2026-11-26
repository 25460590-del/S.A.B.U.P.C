import { AlertTriangle, RefreshCw, ShieldAlert, WifiOff, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  descartarRechazoOffline,
  obtenerEstadoColaOffline,
  suscribirColaOffline,
} from '../lib/colaOffline'
import {
  aplicarActualizacionPwa,
  obtenerEstadoPwa,
  posponerActualizacionPwa,
  suscribirEstadoPwa,
} from '../lib/pwaBeta'

interface BarraEstadoProps {
  /** Reservado por retrocompatibilidad; no se muestra en estado estable. */
  etiquetaDerecha?: string
  variante?: 'normal' | 'alerta'
  /** Muestra la franja compacta de sincronización cuando hay escrituras locales pendientes. */
  sincronizando?: boolean
}

/**
 * Indicador de conexión silencioso (UI limpia), actualizaciones PWA controladas y rechazos diferidos:
 * - En conexión estable sin pendientes, actualizaciones ni rechazos: NO renderiza ninguna barra superior.
 * - Solo aparece ante un estado accionable: sin conexión, sincronizando cambios pendientes,
 *   nueva versión disponible, rechazo diferido al reconectar o alerta de acceso.
 */
export function BarraEstado({
  variante = 'normal',
  sincronizando = false,
}: BarraEstadoProps) {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)
  const colaOffline = useSyncExternalStore(
    suscribirColaOffline,
    obtenerEstadoColaOffline,
    obtenerEstadoColaOffline,
  )
  const estadoPwa = useSyncExternalStore(
    suscribirEstadoPwa,
    obtenerEstadoPwa,
    obtenerEstadoPwa,
  )

  useEffect(() => {
    const alConectar = () => setEnLinea(true)
    const alDesconectar = () => setEnLinea(false)
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
    }
  }, [])

  const haySincronizacion = sincronizando || (enLinea && colaOffline.pendientes.length > 0)
  const hayRechazos = colaOffline.rechazos.length > 0
  const hayActualizacion = estadoPwa.actualizacionDisponible

  const barraPrincipal =
    variante === 'alerta' ? (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-alerta bg-alerta-suave px-3 py-1.5 text-xs font-semibold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
      >
        <ShieldAlert size={14} strokeWidth={2} aria-hidden="true" />
        <span>Acceso restringido · Cuenta inactiva</span>
      </div>
    ) : !enLinea ? (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-ambar bg-ambar-suave px-3 py-1.5 text-xs font-semibold text-ambar-texto dark:border-ambar/70 dark:bg-noche-ambar dark:text-noche-ambar-texto"
      >
        <WifiOff size={14} strokeWidth={2} aria-hidden="true" />
        <span>
          Sin conexión — guardando localmente
          {colaOffline.pendientes.length > 0
            ? ` (${colaOffline.pendientes.length} pendiente${colaOffline.pendientes.length === 1 ? '' : 's'})`
            : ''}
        </span>
      </div>
    ) : haySincronizacion ? (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-borde bg-salvia px-3 py-1.5 text-xs font-semibold text-udec-oscuro dark:border-noche-borde dark:bg-noche-campo dark:text-activo-claro"
      >
        <RefreshCw size={13} strokeWidth={2} className="animate-spin" aria-hidden="true" />
        <span>
          Sincronizando cambios pendientes
          {colaOffline.pendientes.length > 0 ? ` (${colaOffline.pendientes.length})` : ''}
        </span>
      </div>
    ) : null

  if (!barraPrincipal && !hayRechazos && !hayActualizacion) {
    return null
  }

  return (
    <div className="flex w-full shrink-0 flex-col">
      {hayActualizacion && (
        <div
          role="status"
          className="flex w-full items-center justify-center gap-2 border-b border-udec/30 bg-udec-oscuro px-3 py-1.5 text-xs font-semibold text-white dark:border-noche-borde dark:bg-noche-sidebar"
        >
          <button
            type="button"
            disabled={estadoPwa.aplicando}
            onClick={() => void aplicarActualizacionPwa()}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md bg-white/15 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/25 disabled:opacity-60"
          >
            <RefreshCw
              size={13}
              strokeWidth={2}
              className={estadoPwa.aplicando ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>
              {estadoPwa.aplicando
                ? 'Actualizando aplicación...'
                : 'Nueva versión disponible · Tocar para actualizar'}
            </span>
          </button>
          <button
            type="button"
            onClick={posponerActualizacionPwa}
            aria-label="Cerrar aviso de actualización"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
      {barraPrincipal}
      {hayRechazos && (
        <div
          role="alert"
          className="flex w-full flex-col gap-1.5 border-b border-alerta bg-alerta-suave px-3 py-2 text-xs text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          {colaOffline.rechazos.map((r) => (
            <div key={r.id} className="mx-auto flex w-full max-w-5xl items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
                <span className="font-semibold">{r.detalle}</span>
              </div>
              <button
                type="button"
                onClick={() => descartarRechazoOffline(r.id)}
                aria-label="Cerrar alerta de sincronización"
                className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-black/10"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
