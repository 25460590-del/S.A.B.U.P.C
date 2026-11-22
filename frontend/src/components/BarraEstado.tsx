import { RefreshCw, ShieldAlert, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

interface BarraEstadoProps {
  /** Reservado por retrocompatibilidad; no se muestra en estado estable. */
  etiquetaDerecha?: string
  variante?: 'normal' | 'alerta'
  /** Muestra la franja compacta de sincronización cuando hay escrituras locales pendientes. */
  sincronizando?: boolean
}

/**
 * Indicador de conexión silencioso (UI limpia):
 * - En conexión estable: NO renderiza ninguna barra superior.
 * - Solo aparece ante un estado accionable: sin conexión, sincronizando cambios pendientes o alerta de acceso.
 */
export function BarraEstado({
  variante = 'normal',
  sincronizando = false,
}: BarraEstadoProps) {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)

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

  if (variante === 'alerta') {
    return (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-alerta bg-alerta-suave px-3 py-1.5 text-xs font-semibold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
      >
        <ShieldAlert size={14} strokeWidth={2} aria-hidden="true" />
        <span>Acceso restringido · Cuenta inactiva</span>
      </div>
    )
  }

  if (!enLinea) {
    return (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-ambar bg-ambar-suave px-3 py-1.5 text-xs font-semibold text-ambar-texto dark:border-ambar/70 dark:bg-noche-ambar dark:text-noche-ambar-texto"
      >
        <WifiOff size={14} strokeWidth={2} aria-hidden="true" />
        <span>Sin conexión — guardando localmente</span>
      </div>
    )
  }

  if (sincronizando) {
    return (
      <div
        role="status"
        className="flex w-full items-center justify-center gap-2 border-b border-borde bg-salvia px-3 py-1.5 text-xs font-semibold text-udec-oscuro dark:border-noche-borde dark:bg-noche-campo dark:text-activo-claro"
      >
        <RefreshCw size={13} strokeWidth={2} className="animate-spin" aria-hidden="true" />
        <span>Sincronizando cambios pendientes</span>
      </div>
    )
  }

  return null
}
