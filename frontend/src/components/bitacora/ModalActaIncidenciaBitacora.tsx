import { FileWarning, Upload, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { EquipoTurno } from '../../types'

interface ModalActaIncidenciaBitacoraProps {
  objetivo: EquipoTurno
  motivo: string
  archivoEvidencia: File | null
  ocupado: boolean
  alCambiarMotivo: (valor: string) => void
  alCambiarArchivo: (file: File | null) => void
  alEnviar: (e: FormEvent) => void
  alCerrar: () => void
}

export function ModalActaIncidenciaBitacora({
  objetivo,
  motivo,
  archivoEvidencia,
  ocupado,
  alCambiarMotivo,
  alCambiarArchivo,
  alEnviar,
  alCerrar,
}: ModalActaIncidenciaBitacoraProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Acta de Incidencia de Material"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col gap-4 border-2 border-alerta p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <FileWarning
              size={20}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-alerta dark:text-noche-rojo-texto"
            />
            <div>
              <h3 className="text-base font-bold text-alerta dark:text-noche-rojo-texto">
                Acta de Incidencia · Material BUPC
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                {objetivo.nombre_articulo} · {objetivo.usuario_nombre}
              </p>
            </div>
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

        <form onSubmit={alEnviar} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="inc-motivo" className="etiqueta">
              Motivo de la incidencia (obligatorio)
            </label>
            <textarea
              id="inc-motivo"
              rows={3}
              maxLength={400}
              placeholder="Describe extravío, daño o faltante..."
              value={motivo}
              onChange={(e) => alCambiarMotivo(e.target.value)}
              className="campo min-h-20 py-2 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="etiqueta">Evidencia fotográfica (opcional)</span>
            <label className="btn-salvia min-h-10 cursor-pointer text-xs">
              <Upload size={15} strokeWidth={2} />
              <span>{archivoEvidencia ? archivoEvidencia.name : 'Adjuntar fotografía'}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => alCambiarArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={alCerrar} className="btn-salvia">
              Cancelar
            </button>
            <button type="submit" disabled={ocupado} className="btn-rojo">
              {ocupado ? 'Guardando...' : 'Levantar Acta y Liberar'}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
