import { Trash2, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { VerificacionBorradoOperativo } from '../../services/operativosService'

interface ModalEliminarOperativoProps {
  operativoNombre: string
  opEsCerrado: boolean
  etiquetaCerrado: string
  verificandoBorrado: boolean
  estadoBorrado: VerificacionBorradoOperativo | null
  motivoCancelacion: string
  confirmacionNombreEliminar: string
  eliminando: boolean
  alCambiarMotivo: (valor: string) => void
  alCambiarConfirmacion: (valor: string) => void
  alConfirmarEliminacion: (e: FormEvent) => void
  alConfirmarCancelacion: (e: FormEvent) => void
  alCerrar: () => void
}

export function ModalEliminarOperativo({
  operativoNombre,
  opEsCerrado,
  etiquetaCerrado,
  verificandoBorrado,
  estadoBorrado,
  motivoCancelacion,
  confirmacionNombreEliminar,
  eliminando,
  alCambiarMotivo,
  alCambiarConfirmacion,
  alConfirmarEliminacion,
  alConfirmarCancelacion,
  alCerrar,
}: ModalEliminarOperativoProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Eliminar o cancelar operativo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col gap-4 border-2 border-alerta p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Trash2
              size={20}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-alerta dark:text-noche-rojo-texto"
            />
            <div>
              <h3 className="text-base font-bold text-alerta dark:text-noche-rojo-texto">
                {estadoBorrado && !estadoBorrado.vacio
                  ? 'Borrado físico bloqueado por registros asociados'
                  : 'Eliminar Operativo'}
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Acción exclusiva de Administrador con trazabilidad en auditoría.
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

        {verificandoBorrado || !estadoBorrado ? (
          <p className="py-4 text-center text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Verificando registros asociados del operativo...
          </p>
        ) : estadoBorrado.vacio ? (
          <form onSubmit={alConfirmarEliminacion} className="flex flex-col gap-3">
            <p className="rounded-lg bg-superficie-suave p-2.5 text-xs text-tinta dark:bg-noche-campo dark:text-noche-tinta">
              El operativo está completamente vacío (sin asistencias, material ni prerregistros).
              Puede eliminarse físicamente sin dejar registros huérfanos.
            </p>
            <p className="text-xs text-tinta dark:text-noche-tinta">
              Para confirmar, escribe exactamente el nombre del operativo:{' '}
              <strong className="select-all">{operativoNombre}</strong>
            </p>

            <input
              type="text"
              value={confirmacionNombreEliminar}
              onChange={(e) => alCambiarConfirmacion(e.target.value)}
              placeholder={operativoNombre}
              className="campo text-sm"
              required
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={eliminando}
                onClick={alCerrar}
                className="btn-salvia text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  eliminando || confirmacionNombreEliminar.trim() !== operativoNombre.trim()
                }
                className="btn-rojo text-xs"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={alConfirmarCancelacion} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-ambar bg-ambar-suave p-3 text-xs text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
              <p className="font-bold">
                No se permite borrar físicamente este operativo porque ya tiene actividad registrada
                (evita registros huérfanos):
              </p>
              <ul className="list-inside list-disc text-[11px] font-medium">
                {estadoBorrado.tieneAsistencias && <li>Asistencias de personal registradas</li>}
                {estadoBorrado.tieneEquipos && <li>Material de turno registrado</li>}
                {estadoBorrado.tienePrerregistros && <li>Prerregistros en convocatoria</li>}
              </ul>
            </div>

            {opEsCerrado ? (
              <>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Este operativo ya se encuentra en estado <strong>{etiquetaCerrado}</strong> (solo
                  lectura) y su historial permanece resguardado.
                </p>
                <div className="flex justify-end">
                  <button type="button" onClick={alCerrar} className="btn-salvia text-xs">
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-tinta dark:text-noche-tinta">
                  Puedes darlo de <strong>baja lógica marcándolo como Cancelado</strong>: quedará
                  bloqueado en modo solo lectura igual que un operativo finalizado y conservará sus
                  registros históricos.
                </p>

                <div className="flex flex-col gap-1">
                  <label htmlFor="op-motivo-cancelar" className="etiqueta">
                    Motivo de cancelación (opcional)
                  </label>
                  <input
                    id="op-motivo-cancelar"
                    type="text"
                    maxLength={200}
                    value={motivoCancelacion}
                    onChange={(e) => alCambiarMotivo(e.target.value)}
                    placeholder="Ej. Suspendido por condiciones meteorológicas / creado por error"
                    className="campo text-xs"
                  />
                </div>

                <p className="text-xs text-tinta dark:text-noche-tinta">
                  Escribe exactamente <strong className="select-all">{operativoNombre}</strong> para
                  confirmar:
                </p>

                <input
                  type="text"
                  value={confirmacionNombreEliminar}
                  onChange={(e) => alCambiarConfirmacion(e.target.value)}
                  placeholder={operativoNombre}
                  className="campo text-sm"
                  required
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={eliminando}
                    onClick={alCerrar}
                    className="btn-salvia text-xs"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={
                      eliminando || confirmacionNombreEliminar.trim() !== operativoNombre.trim()
                    }
                    className="btn-rojo text-xs"
                  >
                    {eliminando ? 'Cancelando...' : 'Cancelar operativo (baja lógica)'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </article>
    </div>
  )
}
