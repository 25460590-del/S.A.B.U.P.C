import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Mantiene la pantalla encendida durante guardias y operación de consola de radio
 * usando la API nativa `navigator.wakeLock`, con respaldo seguro si no está soportada.
 */
export function useWakeLock() {
  const soportado = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [activo, setActivo] = useState(false)
  const [deseado, setDeseado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const adquirir = useCallback(async () => {
    if (!soportado) {
      setError('Tu navegador no permite mantener la pantalla encendida.')
      return
    }
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setActivo(true)
      setError(null)
      sentinel.addEventListener('release', () => {
        setActivo(false)
      })
    } catch {
      setActivo(false)
      setError('No se pudo mantener la pantalla encendida. Revisa el ahorro de batería o los permisos.')
    }
  }, [soportado])

  const liberar = useCallback(async () => {
    if (sentinelRef.current && !sentinelRef.current.released) {
      await sentinelRef.current.release().catch(() => undefined)
    }
    sentinelRef.current = null
    setActivo(false)
  }, [])

  const alternar = useCallback(async () => {
    if (deseado) {
      setDeseado(false)
      await liberar()
    } else {
      setDeseado(true)
      await adquirir()
    }
  }, [adquirir, deseado, liberar])

  useEffect(() => {
    if (!deseado) return
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        void adquirir()
      }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [adquirir, deseado])

  useEffect(() => {
    return () => {
      void liberar()
    }
  }, [liberar])

  return { soportado, activo, deseado, error, alternar }
}
