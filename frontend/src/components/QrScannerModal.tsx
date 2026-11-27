import { Html5Qrcode } from 'html5-qrcode'
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  QrCode,
  Repeat,
  SwitchCamera,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { parsearQrEscaneado } from '../services/asistenciasService'

export interface TarjetaRafagaQr {
  id: number
  tipo: 'exito' | 'alerta'
  titulo: string
  detalle: string
  subdetalle?: string
}

interface QrScannerModalProps {
  titulo?: string
  subtitulo?: string
  instruccion?: string
  procesando?: boolean
  /** Habilita el switch "Escaneo continuo (fila)" para pase de lista VÍA 2 en puerta. */
  permitirModoContinuo?: boolean
  /** Estado controlado o inicial del modo continuo (fila). */
  modoContinuo?: boolean
  alCambiarModoContinuo?: (activo: boolean) => void
  /** Tarjeta flotante (~2.5 s) mostrada sobre el visor en modo ráfaga. */
  tarjetaRafaga?: TarjetaRafagaQr | null
  alDetectar: (codigo: string) => void
  alCerrar: () => void
}

const VENTANA_ANTIDUPLICADO_RAFAGA_MS = 8_000

export function QrScannerModal({
  titulo = 'Visor Escáner QR',
  subtitulo = 'Registro de Entrada / Salida',
  instruccion = 'Encuadra el código QR del Puesto de Mando',
  procesando = false,
  permitirModoContinuo = false,
  modoContinuo: modoContinuoProp,
  alCambiarModoContinuo,
  tarjetaRafaga = null,
  alDetectar,
  alCerrar,
}: QrScannerModalProps) {
  const reactId = useId()
  const regionId = `qr-reader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const detectadoRef = useRef(false)
  const procesandoRef = useRef(procesando)
  const alDetectarRef = useRef(alDetectar)
  const ultimosLeidosRef = useRef<Map<string, number>>(new Map())

  const [modoContinuoLocal, setModoContinuoLocal] = useState(false)
  const modoContinuo = permitirModoContinuo ? (modoContinuoProp ?? modoContinuoLocal) : false
  const modoContinuoRef = useRef(modoContinuo)

  useEffect(() => {
    alDetectarRef.current = alDetectar
  }, [alDetectar])

  useEffect(() => {
    procesandoRef.current = procesando
  }, [procesando])

  useEffect(() => {
    modoContinuoRef.current = modoContinuo
    if (!modoContinuo) {
      ultimosLeidosRef.current.clear()
    }
  }, [modoContinuo])

  const [camaraFrontal, setCamaraFrontal] = useState(false)
  const [linternaActiva, setLinternaActiva] = useState(false)
  const [soportaLinterna, setSoportaLinterna] = useState(false)
  const [camaraLista, setCamaraLista] = useState(false)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    detectadoRef.current = false
    const scanner = new Html5Qrcode(regionId)
    scannerRef.current = scanner

    async function iniciar() {
      setErrorCamara(null)
      setCamaraLista(false)
      setLinternaActiva(false)
      setSoportaLinterna(false)

      try {
        await scanner.start(
          { facingMode: camaraFrontal ? 'user' : 'environment' },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (texto) => {
            if (procesandoRef.current) return

            if (modoContinuoRef.current) {
              const parsed = parsearQrEscaneado(texto)
              const clave = parsed?.tipo === 'credencial_bupc' ? parsed.uid : texto
              const ahora = Date.now()
              const ultimoMs = ultimosLeidosRef.current.get(clave) ?? 0
              if (ahora - ultimoMs < VENTANA_ANTIDUPLICADO_RAFAGA_MS) {
                return
              }
              ultimosLeidosRef.current.set(clave, ahora)
              // Limpieza ligera del mapa para evitar crecimiento indefinido
              if (ultimosLeidosRef.current.size > 120) {
                for (const [k, ts] of ultimosLeidosRef.current.entries()) {
                  if (ahora - ts >= VENTANA_ANTIDUPLICADO_RAFAGA_MS) {
                    ultimosLeidosRef.current.delete(k)
                  }
                }
              }
              alDetectarRef.current(texto)
              return
            }

            if (detectadoRef.current) return
            detectadoRef.current = true
            alDetectarRef.current(texto)
          },
          () => {
            // Ignora frames sin QR
          },
        )
        if (cancelado) {
          await scanner.stop().catch(() => undefined)
          return
        }
        setCamaraLista(true)
        try {
          const caps = scanner.getRunningTrackCameraCapabilities()
          setSoportaLinterna(Boolean(caps.torchFeature().isSupported()))
        } catch {
          setSoportaLinterna(false)
        }
      } catch {
        if (!cancelado) {
          setErrorCamara(
            'No se pudo acceder a la cámara. Verifica los permisos del navegador o intenta cambiar de cámara.',
          )
        }
      }
    }

    void iniciar()

    return () => {
      cancelado = true
      if (scanner.isScanning) {
        void scanner.stop().then(() => scanner.clear()).catch(() => undefined)
      } else {
        try {
          scanner.clear()
        } catch {
          // ignore
        }
      }
    }
  }, [regionId, camaraFrontal])

  async function alternarLinterna() {
    const scanner = scannerRef.current
    if (!scanner || !soportaLinterna) return
    const siguiente = !linternaActiva
    try {
      const caps = scanner.getRunningTrackCameraCapabilities()
      await caps.torchFeature().apply(siguiente)
      setLinternaActiva(siguiente)
    } catch {
      setSoportaLinterna(false)
    }
  }

  function alternarModoContinuo() {
    const siguiente = !modoContinuo
    if (alCambiarModoContinuo) {
      alCambiarModoContinuo(siguiente)
    } else {
      setModoContinuoLocal(siguiente)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex flex-col bg-[#18181B] text-white"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between">
        {/* Encabezado Verde UdeC */}
        <header className="flex items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar escáner"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">{titulo}</h2>
              <p className="truncate text-xs font-medium text-white/85">{subtitulo}</p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-activo-suave px-3 py-1 text-xs font-bold text-activo-texto">
            <Camera size={14} strokeWidth={2} />
            <span>{camaraLista ? 'Activa' : 'Iniciando...'}</span>
          </span>
        </header>

        {/* Switch de modo Ráfaga en Puerta (solo VÍA 2 de mandos) */}
        {permitirModoContinuo && (
          <div className="flex items-center justify-between gap-3 border-b border-noche-borde bg-noche-campo px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Repeat
                size={16}
                strokeWidth={2}
                className={modoContinuo ? 'text-naranja' : 'text-white/70'}
              />
              <div>
                <span className="block font-bold text-white">Escaneo continuo (fila)</span>
                <span className="text-[11px] text-white/75">
                  Mantiene la cámara abierta e ignora re-lecturas 8 s
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={modoContinuo}
              aria-label="Activar escaneo continuo en fila"
              onClick={alternarModoContinuo}
              className={`inline-flex min-h-11 min-w-20 shrink-0 cursor-pointer items-center justify-center rounded-full px-3 text-xs font-bold transition-colors ${
                modoContinuo
                  ? 'bg-naranja text-tinta'
                  : 'border border-white/25 bg-white/10 text-white'
              }`}
            >
              {modoContinuo ? 'Activo' : 'Normal'}
            </button>
          </div>
        )}

        {/* Área de cámara en vivo con marco guía naranja + tarjeta flotante ráfaga */}
        <main className="relative flex flex-1 flex-col items-center justify-center gap-4 p-5">
          {tarjetaRafaga && (
            <div
              role="status"
              className={`flex w-full max-w-[320px] items-start gap-2.5 rounded-xl border-2 p-3 shadow-lg ${
                tarjetaRafaga.tipo === 'exito'
                  ? 'border-activo-claro bg-udec-oscuro text-white'
                  : 'border-alerta bg-noche-rojo-suave text-noche-rojo-texto'
              }`}
            >
              {tarjetaRafaga.tipo === 'exito' ? (
                <CheckCircle2
                  size={20}
                  strokeWidth={2.2}
                  className="mt-0.5 shrink-0 text-activo-claro"
                />
              ) : (
                <AlertCircle size={20} strokeWidth={2.2} className="mt-0.5 shrink-0 text-alerta" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{tarjetaRafaga.titulo}</p>
                <p className="text-xs font-semibold opacity-95">{tarjetaRafaga.detalle}</p>
                {tarjetaRafaga.subdetalle && (
                  <p className="mt-0.5 text-[11px] opacity-85">{tarjetaRafaga.subdetalle}</p>
                )}
              </div>
            </div>
          )}

          <div className="relative w-full max-w-[300px] overflow-hidden rounded-xl border-4 border-naranja bg-noche-tarjeta">
            <div id={regionId} className="min-h-[260px] w-full" />
            {procesando && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 p-4 text-center">
                <QrCode size={36} strokeWidth={2} className="animate-pulse text-naranja" />
                <p className="text-sm font-bold">Validando código QR...</p>
              </div>
            )}
          </div>

          <p className="text-center text-sm font-semibold text-white/90">{instruccion}</p>

          {errorCamara ? (
            <div
              role="alert"
              className="flex w-full items-start gap-2 rounded-lg border border-alerta bg-noche-rojo-suave p-3 text-xs text-noche-rojo-texto"
            >
              <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{errorCamara}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-activo-claro" />
              <span>
                {modoContinuo
                  ? 'Modo ráfaga activo · presenta el siguiente QR'
                  : 'Escáner listo para leer código QR'}
              </span>
            </div>
          )}
        </main>

        {/* Controles inferiores: Linterna y Cambio de cámara */}
        <footer className="border-t border-noche-borde bg-noche-campo p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void alternarLinterna()}
              disabled={!soportaLinterna || procesando}
              className="btn min-h-12 bg-salvia text-udec-oscuro hover:bg-salvia-hover disabled:opacity-45"
            >
              {linternaActiva ? (
                <FlashlightOff size={20} strokeWidth={2} />
              ) : (
                <Flashlight size={20} strokeWidth={2} />
              )}
              <span>{linternaActiva ? 'Apagar' : 'Linterna'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCamaraFrontal((v) => !v)}
              disabled={procesando}
              className="btn min-h-12 bg-tarjeta text-tinta hover:bg-superficie-suave"
            >
              <SwitchCamera size={20} strokeWidth={2} />
              <span>{camaraFrontal ? 'Frontal' : 'Trasera'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
