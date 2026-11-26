import { X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { AsistenciaPersonal } from '../../types'

interface ModalSignosVitalesProps {
  objetivo: AsistenciaPersonal
  spo2: string
  fc: string
  fr: string
  ta: string
  temp: string
  ocupado: boolean
  alCambiarSpo2: (valor: string) => void
  alCambiarFc: (valor: string) => void
  alCambiarFr: (valor: string) => void
  alCambiarTa: (valor: string) => void
  alCambiarTemp: (valor: string) => void
  alGuardar: (e: FormEvent) => void
  alCerrar: () => void
}

export function ModalSignosVitales({
  objetivo,
  spo2,
  fc,
  fr,
  ta,
  temp,
  ocupado,
  alCambiarSpo2,
  alCambiarFc,
  alCambiarFr,
  alCambiarTa,
  alCambiarTemp,
  alGuardar,
  alCerrar,
}: ModalSignosVitalesProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Captura de Signos Vitales"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
              Captura de Signos Vitales
            </h3>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              {objetivo.usuario_nombre}
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={alGuardar} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="vit-spo2" className="etiqueta">
                SpO2 (%)
              </label>
              <input
                id="vit-spo2"
                type="text"
                placeholder="98"
                value={spo2}
                onChange={(e) => alCambiarSpo2(e.target.value)}
                className="campo tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="vit-fc" className="etiqueta">
                FC (lpm)
              </label>
              <input
                id="vit-fc"
                type="text"
                placeholder="76"
                value={fc}
                onChange={(e) => alCambiarFc(e.target.value)}
                className="campo tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="vit-fr" className="etiqueta">
                FR (rpm)
              </label>
              <input
                id="vit-fr"
                type="text"
                placeholder="16"
                value={fr}
                onChange={(e) => alCambiarFr(e.target.value)}
                className="campo tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="vit-ta" className="etiqueta">
                TA (mmHg)
              </label>
              <input
                id="vit-ta"
                type="text"
                placeholder="120/80"
                value={ta}
                onChange={(e) => alCambiarTa(e.target.value)}
                className="campo tabular-nums"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="vit-temp" className="etiqueta">
                Temperatura (°C)
              </label>
              <input
                id="vit-temp"
                type="text"
                placeholder="36.6"
                value={temp}
                onChange={(e) => alCambiarTemp(e.target.value)}
                className="campo tabular-nums"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={alCerrar} className="btn-salvia">
              Cancelar
            </button>
            <button type="submit" disabled={ocupado} className="btn-verde">
              {ocupado ? 'Guardando...' : 'Guardar Signos'}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
