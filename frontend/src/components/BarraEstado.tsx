import { Moon, Sun, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTema } from '../context/TemaContext'

interface BarraEstadoProps {
  etiquetaDerecha?: string
  variante?: 'normal' | 'alerta'
}

export function BarraEstado({ etiquetaDerecha, variante = 'normal' }: BarraEstadoProps) {
  const { esOscuro, alternarTema } = useTema()
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

  const estiloBarra =
    variante === 'alerta'
      ? 'bg-tarjeta text-alerta border-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto dark:border-alerta'
      : enLinea
        ? 'bg-activo-suave text-activo border-activo dark:bg-noche-campo dark:text-activo-claro dark:border-noche-borde'
        : 'bg-ambar-suave text-ambar-texto border-ambar dark:bg-noche-ambar dark:text-noche-ambar-texto dark:border-ambar'

  return (
    <div
      role="status"
      className={`flex w-full items-center justify-between gap-2 border-b px-4 py-1.5 text-xs font-semibold ${estiloBarra}`}
    >
      <div className="flex items-center gap-2">
        {variante === 'alerta' ? (
          <>
            <span className="h-2 w-2 rounded-full bg-alerta" aria-hidden="true" />
            <span>Acceso Restringido · {esOscuro ? 'Modo Nocturno' : 'BUPC'}</span>
          </>
        ) : enLinea ? (
          <>
            <span className="h-2 w-2 rounded-full bg-activo dark:bg-activo-claro" aria-hidden="true" />
            <span>En línea · {esOscuro ? 'Modo Nocturno' : 'Sincronizado'}</span>
          </>
        ) : (
          <>
            <WifiOff size={14} strokeWidth={2} aria-hidden="true" />
            <span>Sin conexión · Caché local activa</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {etiquetaDerecha && (
          <span className="tabular-nums opacity-90">{etiquetaDerecha}</span>
        )}
        <button
          type="button"
          onClick={alternarTema}
          aria-label={esOscuro ? 'Cambiar a modo día' : 'Cambiar a modo nocturno'}
          title={esOscuro ? 'Cambiar a modo día' : 'Cambiar a modo nocturno'}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-current/25 hover:bg-black/5 dark:hover:bg-white/10"
        >
          {esOscuro ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
        </button>
      </div>
    </div>
  )
}
