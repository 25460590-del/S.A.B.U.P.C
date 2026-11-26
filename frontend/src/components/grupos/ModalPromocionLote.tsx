import { AlertCircle, GraduationCap, ShieldCheck, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { AYUDANTIAS_ACTIVAS } from '../../constants/catalogos'
import { nombreCompleto } from '../../services/authService'
import type { AyudantiaSlot, Usuario } from '../../types'
import type { SeleccionGrupoFormativo } from './usePromocionLote'

interface ModalPromocionLoteProps {
  grupo: SeleccionGrupoFormativo
  seleccionadosEfectivos: Usuario[]
  seleccionadosSinAyudantia: Usuario[]
  gruposOmegaActivos: string[]
  subgrupoDestinoOmega: string
  modoAyudantiaLote: 'comun' | 'individual'
  ayudantiaComun: AyudantiaSlot
  ayudantiasIndividuales: Record<string, AyudantiaSlot>
  promoviendo: boolean
  errorModal: string | null
  alCambiarDestinoOmega: (valor: string) => void
  alCambiarModoAyudantia: (modo: 'comun' | 'individual') => void
  alCambiarAyudantiaComun: (ay: AyudantiaSlot) => void
  alCambiarAyudantiaIndividual: (uid: string, ay: AyudantiaSlot) => void
  alConfirmar: (e: FormEvent) => void
  alCerrar: () => void
}

export function ModalPromocionLote({
  grupo,
  seleccionadosEfectivos,
  seleccionadosSinAyudantia,
  gruposOmegaActivos,
  subgrupoDestinoOmega,
  modoAyudantiaLote,
  ayudantiaComun,
  ayudantiasIndividuales,
  promoviendo,
  errorModal,
  alCambiarDestinoOmega,
  alCambiarModoAyudantia,
  alCambiarAyudantiaComun,
  alCambiarAyudantiaIndividual,
  alConfirmar,
  alCerrar,
}: ModalPromocionLoteProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Promover integrantes seleccionados"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <article className="tarjeta flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-3 border-naranja bg-udec px-4 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} strokeWidth={2} />
            <div>
              <h4 className="text-sm font-bold">
                {grupo.etapa === 'Alfa'
                  ? 'Promover de Alfa a Omega'
                  : grupo.etapa === 'SIERRA'
                    ? 'Graduar de SIERRA a Grupo Operativo'
                    : 'Promover de Omega a Grupo Operativo'}
              </h4>
              <p className="text-[11px] text-white/85">
                {seleccionadosEfectivos.length} integrante
                {seleccionadosEfectivos.length === 1 ? '' : 's'} de {grupo.nombre}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={promoviendo}
            onClick={alCerrar}
            aria-label="Cerrar ventana"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <form onSubmit={alConfirmar} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {errorModal && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{errorModal}</span>
            </div>
          )}

          {grupo.etapa === 'Alfa' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="destino-omega" className="etiqueta">
                Grupo destino en Omega
              </label>
              {gruposOmegaActivos.length === 0 ? (
                <p className="rounded-lg border border-ambar bg-ambar-suave p-3 text-xs font-semibold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                  No hay grupos activos de Omega disponibles. Crea un grupo Omega primero en el
                  panel de Grupos.
                </p>
              ) : (
                <select
                  id="destino-omega"
                  value={subgrupoDestinoOmega}
                  onChange={(e) => alCambiarDestinoOmega(e.target.value)}
                  className="campo min-h-10 text-xs font-semibold"
                  disabled={promoviendo}
                  required
                >
                  {gruposOmegaActivos.map((sg) => (
                    <option key={sg} value={sg}>
                      {sg}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                Cada integrante conservará la ayudantía que ya tenga asignada.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-borde bg-superficie-suave p-3 text-xs text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta">
                <p className="font-semibold">
                  Destino: <span className="text-udec dark:text-activo-claro">Grupo Operativo</span>
                </p>
                <p className="mt-0.5 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                  Al integrarse a Grupo Operativo concluyen su grupo formativo y deben contar con
                  una ayudantía asignada.
                </p>
              </div>

              {seleccionadosSinAyudantia.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro">
                  <ShieldCheck size={16} strokeWidth={2} className="shrink-0" />
                  <span>Todos los integrantes seleccionados ya cuentan con ayudantía asignada.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-ambar bg-ambar-suave/50 p-3 dark:border-noche-borde dark:bg-noche-campo">
                  <div>
                    <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                      Ayudantía obligatoria para {seleccionadosSinAyudantia.length} integrante
                      {seleccionadosSinAyudantia.length === 1 ? '' : 's'} sin ayudantía
                    </p>
                    <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      Quienes ya tenían ayudantía conservarán la actual automáticamente.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => alCambiarModoAyudantia('comun')}
                      className={`min-h-8 cursor-pointer rounded-lg px-2.5 text-[11px] font-semibold ${
                        modoAyudantiaLote === 'comun'
                          ? 'bg-udec text-white'
                          : 'border border-borde bg-tarjeta text-tinta-suave dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                      }`}
                    >
                      Misma para todos
                    </button>
                    <button
                      type="button"
                      onClick={() => alCambiarModoAyudantia('individual')}
                      className={`min-h-8 cursor-pointer rounded-lg px-2.5 text-[11px] font-semibold ${
                        modoAyudantiaLote === 'individual'
                          ? 'bg-udec text-white'
                          : 'border border-borde bg-tarjeta text-tinta-suave dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                      }`}
                    >
                      Elegir por persona
                    </button>
                  </div>

                  {modoAyudantiaLote === 'comun' ? (
                    <div className="flex flex-col gap-1">
                      <label htmlFor="ayudantia-lote-comun" className="etiqueta">
                        Ayudantía a asignar
                      </label>
                      <select
                        id="ayudantia-lote-comun"
                        value={ayudantiaComun}
                        onChange={(e) => alCambiarAyudantiaComun(e.target.value as AyudantiaSlot)}
                        className="campo min-h-10 text-xs font-semibold"
                        disabled={promoviendo}
                      >
                        {AYUDANTIAS_ACTIVAS.map((ay) => (
                          <option key={ay} value={ay}>
                            {ay}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                      {seleccionadosSinAyudantia.map((u) => (
                        <div
                          key={u.uid}
                          className="flex items-center justify-between gap-2 rounded-lg border border-borde bg-tarjeta px-2.5 py-2 dark:border-noche-borde dark:bg-noche-tarjeta"
                        >
                          <span className="truncate text-xs font-semibold text-tinta dark:text-noche-tinta">
                            {nombreCompleto(u)}
                          </span>
                          <select
                            aria-label={`Ayudantía para ${nombreCompleto(u)}`}
                            value={ayudantiasIndividuales[u.uid] ?? 'Socorros'}
                            onChange={(e) =>
                              alCambiarAyudantiaIndividual(u.uid, e.target.value as AyudantiaSlot)
                            }
                            className="campo min-h-8 w-44 py-0.5 text-[11px] font-semibold"
                            disabled={promoviendo}
                          >
                            {AYUDANTIAS_ACTIVAS.map((ay) => (
                              <option key={ay} value={ay}>
                                {ay}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-borde pt-3 dark:border-noche-borde">
            <button
              type="button"
              disabled={promoviendo}
              onClick={alCerrar}
              className="btn-salvia min-h-10 px-3.5 text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={promoviendo || (grupo.etapa === 'Alfa' && gruposOmegaActivos.length === 0)}
              className="btn-naranja min-h-10 px-4 text-xs"
            >
              <GraduationCap size={15} strokeWidth={2} />
              <span>
                {promoviendo
                  ? 'Procesando...'
                  : grupo.etapa === 'Alfa'
                    ? `Promover (${seleccionadosEfectivos.length})`
                    : `Graduar a Grupo Operativo (${seleccionadosEfectivos.length})`}
              </span>
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
