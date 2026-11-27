import { HeartPulse, Phone, X } from 'lucide-react'
import { sanitizarTelefonoTel } from '../../lib/feedbackCampo'
import { normalizarNombrePropio } from '../../lib/nombres'
import { etiquetaAyudantia } from '../../lib/permisos'
import { nombreCompleto } from '../../services/authService'
import type { Usuario } from '../../types'

interface ModalFichaEmergenciaProps {
  integrante: Usuario
  alCerrar: () => void
}

export function ModalFichaEmergencia({ integrante, alCerrar }: ModalFichaEmergenciaProps) {
  const telEmergencia = sanitizarTelefonoTel(integrante.contacto_emergencia_telefono)
  const telPropio = sanitizarTelefonoTel(integrante.celular)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de Emergencia de ${nombreCompleto(integrante)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col gap-3.5 border-2 border-alerta p-5">
        <div className="flex items-start justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
          <div className="flex items-center gap-2">
            <HeartPulse
              size={20}
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
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-tinta-suave hover:bg-superficie-suave dark:hover:bg-noche-campo"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <dl className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Tipo de sangre
            </dt>
            <dd className="rounded-full bg-alerta-suave px-2.5 py-0.5 font-bold tabular-nums text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
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
          {integrante.celular && (
            <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
              <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Celular del brigadista
              </dt>
              <dd className="text-right font-bold tabular-nums">
                {telPropio ? (
                  <a
                    href={`tel:${telPropio}`}
                    className="inline-flex items-center gap-1 text-udec underline decoration-udec/50 underline-offset-2 hover:text-udec-oscuro dark:text-activo-claro"
                  >
                    <Phone size={12} strokeWidth={2} />
                    <span>{integrante.celular}</span>
                  </a>
                ) : (
                  <span className="text-tinta dark:text-noche-tinta">{integrante.celular}</span>
                )}
              </dd>
            </div>
          )}
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
            <dd className="text-right font-bold tabular-nums">
              {telEmergencia ? (
                <a
                  href={`tel:${telEmergencia}`}
                  className="inline-flex items-center gap-1 text-alerta-texto underline decoration-alerta/60 underline-offset-2 dark:text-noche-rojo-texto"
                >
                  <Phone size={12} strokeWidth={2} />
                  <span>{integrante.contacto_emergencia_telefono}</span>
                </a>
              ) : (
                <span className="text-tinta dark:text-noche-tinta">
                  {integrante.contacto_emergencia_telefono || 'No registrado'}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 pt-1">
          {telEmergencia && (
            <a href={`tel:${telEmergencia}`} className="btn-rojo min-h-12 w-full text-sm">
              <Phone size={18} strokeWidth={2} />
              <span>Llamar a Contacto de Emergencia</span>
            </a>
          )}
          <button type="button" onClick={alCerrar} className="btn-salvia min-h-11 w-full text-xs">
            Cerrar
          </button>
        </div>
      </article>
    </div>
  )
}
