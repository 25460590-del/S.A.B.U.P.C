import { Html5Qrcode } from 'html5-qrcode'
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Flashlight,
  FlashlightOff,
  QrCode,
  SwitchCamera,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

interface QrScannerModalProps {
  titulo?: string
  subtitulo?: string
  instruccion?: string
  procesando?: boolean
  alDetectar: (codigo: string) => void
  alCerrar: () => void
}

export function QrScannerModal({
  titulo = 'Visor Escáner QR',
  subtitulo = 'Registro de Entrada / Salida',
  instruccion = 'Encuadra el código QR del Puesto de Mando',
  procesando = false,
  alDetectar,
  alCerrar,
}: QrScannerModalProps) {
  const reactId = useId()
  const regionId = `qr-reader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const detectadoRef = useRef(false)
  const alDetectarRef = useRef(alDetectar)

  useEffect(() => {
    alDetectarRef.current = alDetectar
  }, [alDetectar])

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex flex-col bg-[#18181B] text-white"
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between">
        {/* Encabezado Verde UdeC */}
        <header className="flex items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar escáner"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <div>
              <h2 className="text-base font-bold">{titulo}</h2>
              <p className="text-xs font-medium text-white/85">{subtitulo}</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-activo-suave px-3 py-1 text-xs font-bold text-activo">
            <Camera size={14} strokeWidth={2} />
            <span>{camaraLista ? 'Cámara Activa' : 'Iniciando...'}</span>
          </span>
        </header>

        {/* Área de cámara en vivo con marco guía naranja */}
        <main className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
          <div className="relative w-full max-w-[300px] overflow-hidden rounded-xl border-4 border-naranja bg-noche-tarjeta">
            <div id={regionId} className="min-h-[280px] w-full" />
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
              <span>Escáner listo para leer código QR</span>
            </div>
          )}
        </main>

        {/* Controles inferiores: Linterna y Cambio de cámara */}
        <footer className="border-t border-noche-borde bg-noche-campo p-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void alternarLinterna()}
              disabled={!soportaLinterna || procesando}
              className="btn bg-salvia text-udec-oscuro hover:bg-emerald-100 disabled:opacity-45"
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
              className="btn bg-tarjeta text-tinta hover:bg-superficie-suave"
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
