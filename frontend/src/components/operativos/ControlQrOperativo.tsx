import { Download, Lock, RefreshCw, Unlock } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useRef } from 'react'
import { PERIODO_QR_DINAMICO_SEG } from '../../services/operativosService'
import type { ModoQrOperativo, Operativo, SecretoVigenteOperativo } from '../../types'

interface ControlQrOperativoProps {
  operativo: Operativo
  opEsCerrado: boolean
  opEsCancelado: boolean
  opRecepcionAbierta: boolean
  puedeConfigurarGlobal: boolean
  cambiandoEstado: boolean
  payloadQrActual: string
  secretoVigente: SecretoVigenteOperativo | null
  segundosRestantesQr: number
  alAlternarRecepcion: () => void
  alCambiarModoQr: (modo: ModoQrOperativo) => void
}

export function ControlQrOperativo({
  operativo,
  opEsCerrado,
  opEsCancelado,
  opRecepcionAbierta,
  puedeConfigurarGlobal,
  cambiandoEstado,
  payloadQrActual,
  secretoVigente,
  segundosRestantesQr,
  alAlternarRecepcion,
  alCambiarModoQr,
}: ControlQrOperativoProps) {
  const qrOperativoRef = useRef<HTMLDivElement>(null)

  function descargarQrOperativoPng() {
    if (!opRecepcionAbierta) return
    const canvas = qrOperativoRef.current?.querySelector('canvas')
    if (!canvas) return
    const enlace = document.createElement('a')
    enlace.href = canvas.toDataURL('image/png')
    const slug = operativo.nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    enlace.download = `qr-operativo-${slug || operativo.id}.png`
    enlace.click()
  }

  return (
    <article className="tarjeta mx-auto flex w-full max-w-2xl flex-col gap-4 p-5">
      {opEsCerrado ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
            <Lock size={24} strokeWidth={2} />
          </div>
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Operativo {opEsCancelado ? 'cancelado' : 'finalizado'}
          </h3>
          <p className="max-w-md text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Los códigos QR de entrada y salida se encuentran deshabilitados de forma definitiva.
          </p>
        </div>
      ) : !opRecepcionAbierta ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
            <Lock size={24} strokeWidth={2} />
          </div>
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Recepción cerrada
          </h3>
          <p className="max-w-md text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Recepción cerrada — no se admiten nuevas entradas; las salidas siguen habilitadas desde
            el escáner de credenciales o la bitácora.
          </p>
          {puedeConfigurarGlobal && (
            <button
              type="button"
              disabled={cambiandoEstado}
              onClick={alAlternarRecepcion}
              className="btn-verde mt-1 min-h-10 px-4 text-xs"
            >
              <Unlock size={15} strokeWidth={2} />
              <span>Reabrir recepción</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
            <div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Control QR · {operativo.nombre}
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Proyecta o imprime este código para el pase de lista en campo.
              </p>
            </div>

            {puedeConfigurarGlobal && (
              <button
                type="button"
                disabled={cambiandoEstado}
                onClick={alAlternarRecepcion}
                className="btn min-h-9 border border-ambar bg-ambar-suave px-3 text-xs text-ambar-texto hover:bg-ambar-hover dark:bg-noche-ambar dark:text-noche-ambar-texto"
              >
                <Lock size={14} strokeWidth={2} />
                <span>Cerrar Recepción</span>
              </button>
            )}
          </div>

          {puedeConfigurarGlobal && (
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-superficie-suave p-1 dark:bg-noche-campo">
              <button
                type="button"
                disabled={cambiandoEstado}
                onClick={() => alCambiarModoQr('dinamico')}
                className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
                  operativo.modo_qr === 'dinamico'
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                }`}
              >
                QR Dinámico (30 s)
              </button>
              <button
                type="button"
                disabled={cambiandoEstado}
                onClick={() => alCambiarModoQr('estatico')}
                className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
                  operativo.modo_qr === 'estatico'
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                }`}
              >
                QR Fijo
              </button>
            </div>
          )}

          {/* Visor QR SIEMPRE sobre fondo #FFFFFF puro con margen amplio */}
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div
              ref={qrOperativoRef}
              className="flex shrink-0 items-center justify-center rounded-xl border border-borde-fuerte bg-[#FFFFFF] p-4"
            >
              {payloadQrActual ? (
                <QRCodeCanvas
                  value={payloadQrActual}
                  size={180}
                  bgColor="#FFFFFF"
                  fgColor="#18181B"
                  level="M"
                  includeMargin
                />
              ) : (
                <div className="flex h-[180px] w-[180px] items-center justify-center text-xs font-semibold text-tinta-suave">
                  Generando código...
                </div>
              )}
            </div>

            {operativo.modo_qr === 'dinamico' ? (
              <div className="flex w-full flex-1 flex-col gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  <RefreshCw size={14} strokeWidth={2} />
                  <span>Rotación automática verificada (cada 30 s)</span>
                </span>

                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-3xl font-extrabold tracking-widest tabular-nums text-udec dark:text-activo-claro">
                    {secretoVigente ? secretoVigente.nonce : '--------'}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-naranja-oscuro dark:text-naranja">
                    00:{String(segundosRestantesQr).padStart(2, '0')}s
                  </span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-esqueleto dark:bg-noche-campo">
                  <div
                    className="h-full rounded-full bg-naranja transition-all duration-300"
                    style={{
                      width: `${(segundosRestantesQr / PERIODO_QR_DINAMICO_SEG) * 100}%`,
                    }}
                  />
                </div>

                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  El código cambia cada 30 segundos (con ventana de gracia de 60 s) y se valida en
                  el servidor. Al cerrar la recepción, se desactiva automáticamente.
                </p>
              </div>
            ) : (
              <div className="flex w-full flex-1 flex-col gap-3">
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Código fijo para imprimir o proyectar en el punto de control. Si cierras la
                  recepción, las capturas previas ya no podrán registrar nuevas entradas.
                </p>
                <button
                  type="button"
                  disabled={!payloadQrActual}
                  onClick={descargarQrOperativoPng}
                  className="btn-salvia w-full text-xs"
                >
                  <Download size={16} strokeWidth={2} />
                  <span>Descargar código QR</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  )
}
