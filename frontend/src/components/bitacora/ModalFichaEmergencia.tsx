import { HeartPulse, X } from 'lucide-react'
import { normalizarNombrePropio } from '../../lib/nombres'
import { etiquetaAyudantia } from '../../lib/permisos'
import { nombreCompleto } from '../../services/authService'
import type { Usuario } from '../../types'

interface ModalFichaEmergenciaProps {
  integrante: Usuario
  alCerrar: () => void
}

export function ModalFichaEmergencia({ integrante, alCerrar }: ModalFichaEmergenciaProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de Emergencia de ${nombreCompleto(integrante)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col gap-3.5 p-5">
        <div className="flex items-start justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
          <div className="flex items-center gap-2">
            <HeartPulse
              size={19}
              strokeWidth={2}
              className="shrink-0 text-alerta dark:text-noche-rojo-texto"
            />
            <div>
              <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                Ficha de Emergencia
              </h3>
              <p className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                {nombreCompleto(integrante)} · {etiquetaAyudantia(integrante.ayudantia)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar Ficha de Emergencia"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <dl className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Tipo de sangre
            </dt>
            <dd className="rounded-full bg-alerta-suave px-2.5 py-0.5 font-bold tabular-nums text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
              {integrante.tipo_sangre}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">Alergias</dt>
            <dd className="text-right font-semibold text-tinta dark:text-noche-tinta">
              {integrante.alergias || 'Ninguna'}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Condiciones / medicamentos
            </dt>
            <dd className="text-right font-medium text-tinta dark:text-noche-tinta">
              {integrante.padecimientos_medicamentos || 'Ninguno'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Contacto de emergencia
            </dt>
            <dd className="text-right font-bold text-tinta dark:text-noche-tinta">
              {normalizarNombrePropio(integrante.contacto_emergencia_nombre)}
              {integrante.contacto_emergencia_parentesco
                ? ` (${integrante.contacto_emergencia_parentesco})`
                : ''}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
            <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Teléfono de emergencia
            </dt>
            <dd className="text-right font-bold tabular-nums text-tinta dark:text-noche-tinta">
              {integrante.contacto_emergencia_telefono}
            </dd>
          </div>
        </dl>

        <div className="flex justify-end pt-1">
          <button type="button" onClick={alCerrar} className="btn-salvia min-h-9 px-4 text-xs">
            Cerrar
          </button>
        </div>
      </article>
    </div>
  )
}
