import { AlertTriangle, X } from 'lucide-react'
import { normalizarNombrePropio } from '../../lib/nombres'
import type { ResultadoPreCierreOperativo } from '../../services/operativosService'

interface ModalFinalizarOperativoProps {
  operativoNombre: string
  preCierre: ResultadoPreCierreOperativo
  opRecepcionAbierta: boolean
  opEsCerrado: boolean
  puedeConfigurarGlobal: boolean
  cambiandoEstado: boolean
  finalizando: boolean
  alCerrar: () => void
  alReabrirRecepcion: () => void
  alIrABitacora: () => void
  alConfirmar: () => void
}

export function ModalFinalizarOperativo({
  operativoNombre,
  preCierre,
  opRecepcionAbierta,
  opEsCerrado,
  puedeConfigurarGlobal,
  cambiandoEstado,
  finalizando,
  alCerrar,
  alReabrirRecepcion,
  alIrABitacora,
  alConfirmar,
}: ModalFinalizarOperativoProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Finalizar Operativo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article
        className={`tarjeta flex max-h-[85dvh] w-full max-w-lg flex-col gap-4 overflow-hidden border-2 p-5 ${
          preCierre.deudores.length > 0 ? 'border-alerta' : 'border-naranja'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              size={22}
              strokeWidth={2}
              className={`mt-0.5 shrink-0 ${
                preCierre.deudores.length > 0
                  ? 'text-alerta dark:text-noche-rojo-texto'
                  : 'text-naranja-oscuro dark:text-naranja'
              }`}
            />
            <div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                {preCierre.deudores.length > 0
                  ? 'Cierre bloqueado por material BUPC pendiente'
                  : 'Confirmar cierre definitivo del operativo'}
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                {operativoNombre}
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

        {preCierre.deudores.length > 0 ? (
          <>
            <p className="text-xs font-semibold text-alerta dark:text-noche-rojo-texto">
              {preCierre.deudores.length} brigadista
              {preCierre.deudores.length === 1 ? '' : 's'} aún tienen equipo BUPC pendiente.
              Registra la devolución o levanta un Acta de Incidencia antes de finalizar.
            </p>

            <div className="flex max-h-60 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde bg-fondo dark:divide-noche-borde dark:border-noche-borde dark:bg-noche-campo">
              {preCierre.deudores.map(({ asistencia, equiposPendientes }) => (
                <div key={asistencia.id} className="p-3">
                  <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                    {normalizarNombrePropio(asistencia.usuario_nombre)}{' '}
                    <span className="font-normal text-tinta-suave dark:text-noche-tinta-suave">
                      ({asistencia.equipos_bupc_pendientes} pendiente
                      {asistencia.equipos_bupc_pendientes === 1 ? '' : 's'})
                    </span>
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    {equiposPendientes.map((eq) => (
                      <li key={eq.id}>
                        • {eq.cantidad && eq.cantidad > 1 ? `${eq.cantidad}× ` : ''}
                        {eq.nombre_articulo}
                        {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={alCerrar} className="btn-salvia text-xs">
                Cerrar
              </button>
              {!opRecepcionAbierta && !opEsCerrado && puedeConfigurarGlobal && (
                <button
                  type="button"
                  disabled={cambiandoEstado}
                  onClick={alReabrirRecepcion}
                  className="btn-salvia text-xs"
                >
                  Reabrir recepción
                </button>
              )}
              <button type="button" onClick={alIrABitacora} className="btn-verde text-xs">
                Ir a Bitácora para resolver
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-lg bg-naranja-suave p-3 text-xs text-tinta dark:bg-noche-campo dark:text-noche-tinta">
              <p className="font-bold">
                Al confirmar, primero se cerrará preventivamente la recepción y convocatoria, se
                volverá a verificar que no existan entregas pendientes y el operativo quedará
                finalizado de forma irreversible.
              </p>
              <p className="tabular-nums">
                • Asistentes totales: <strong>{preCierre.totalAsistencias}</strong>
                <br />• Salidas abiertas que se cerrarán automáticamente:{' '}
                <strong>{preCierre.asistenciasAbiertas.length}</strong>
                <br />• Material BUPC pendiente: <strong>0</strong>
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={finalizando}
                onClick={alCerrar}
                className="btn-salvia text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={finalizando}
                onClick={alConfirmar}
                className="btn-rojo text-xs"
              >
                {finalizando ? 'Finalizando...' : 'Confirmar Cierre Definitivo'}
              </button>
            </div>
          </>
        )}
      </article>
    </div>
  )
}
