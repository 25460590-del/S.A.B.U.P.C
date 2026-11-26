import { Lock, Megaphone, ShieldAlert, Trash2, Unlock, Users } from 'lucide-react'
import type { FormEvent } from 'react'
import type { Operativo } from '../../types'
import { estiloCategoria } from './helpers'

interface ResumenOperativoProps {
  operativo: Operativo
  opEsCerrado: boolean
  opEsCancelado: boolean
  opRecepcionAbierta: boolean
  prerregistrosCount: number
  puedeGestionar: boolean
  puedeConfigurarGlobal: boolean
  puedeFinalizar: boolean
  soyAdmin: boolean
  cambiandoEstado: boolean
  verificandoCierre: boolean
  cupoEdicionActual: string
  confirmandoConvocatoria: boolean | null
  alCambiarCupoEdicion: (valor: string) => void
  alGuardarCupo: (e: FormEvent) => void
  alPedirConfirmacionConvocatoria: (valor: boolean | null) => void
  alConfirmarConvocatoria: (siguiente: boolean) => void
  alAlternarRecepcion: () => void
  alIniciarFinalizar: () => void
  alAbrirEliminarOCancelar: () => void
}

export function ResumenOperativo({
  operativo,
  opEsCerrado,
  opEsCancelado,
  opRecepcionAbierta,
  prerregistrosCount,
  puedeGestionar,
  puedeConfigurarGlobal,
  puedeFinalizar,
  soyAdmin,
  cambiandoEstado,
  verificandoCierre,
  cupoEdicionActual,
  confirmandoConvocatoria,
  alCambiarCupoEdicion,
  alGuardarCupo,
  alPedirConfirmacionConvocatoria,
  alConfirmarConvocatoria,
  alAlternarRecepcion,
  alIniciarFinalizar,
  alAbrirEliminarOCancelar,
}: ResumenOperativoProps) {
  return (
    <article className="tarjeta flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borde pb-4 dark:border-noche-borde">
        <div>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${estiloCategoria(operativo.categoria)}`}
          >
            {operativo.categoria}
          </span>
          <h3 className="mt-2 text-lg font-bold text-tinta dark:text-noche-tinta">
            {operativo.nombre}
          </h3>
          {operativo.descripcion && (
            <p className="mt-1 text-sm text-tinta-suave dark:text-noche-tinta-suave">
              {operativo.descripcion}
            </p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
          <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Sede
          </dt>
          <dd className="mt-0.5 font-bold text-tinta dark:text-noche-tinta">{operativo.sede}</dd>
        </div>
        <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
          <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Inicio
          </dt>
          <dd className="mt-0.5 font-bold tabular-nums text-tinta dark:text-noche-tinta">
            {operativo.fecha_inicio.replace('T', ' ')}
          </dd>
        </div>
        <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
          <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Cierre programado
          </dt>
          <dd className="mt-0.5 font-bold tabular-nums text-tinta dark:text-noche-tinta">
            {operativo.fecha_fin ? operativo.fecha_fin.replace('T', ' ') : 'Abierto'}
          </dd>
        </div>
        <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
          <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Creado por
          </dt>
          <dd className="mt-0.5 font-bold text-tinta dark:text-noche-tinta">
            {operativo.creado_por_nombre}
          </dd>
        </div>
      </dl>

      {/* Convocatoria y Prerregistro previo */}
      <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie-suave p-4 dark:border-noche-borde dark:bg-noche-campo">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Megaphone
              size={16}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-udec dark:text-activo-claro"
            />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-tinta dark:text-noche-tinta">
                Convocatoria y prerregistro previo
              </h4>
              <p className="mt-0.5 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                {opEsCerrado
                  ? `Este operativo está ${opEsCancelado ? 'cancelado' : 'finalizado'} en modo solo lectura.`
                  : operativo.convocatoria_abierta
                    ? 'Convocatoria abierta: los brigadistas pueden apuntarse por su cuenta antes del operativo y confirmar con QR al llegar.'
                    : 'Convocatoria cerrada: no admite nuevos prerregistros de brigadistas. Puedes seguir registrando altas manuales, editando roles y confirmando asistencias por QR.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-tarjeta px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-tinta dark:bg-noche-tarjeta dark:text-noche-tinta">
              <Users size={11} strokeWidth={2} />
              <span>
                {prerregistrosCount} apuntado
                {prerregistrosCount === 1 ? '' : 's'}
                {operativo.cupo_sugerido ? ` / ${operativo.cupo_sugerido}` : ''}
              </span>
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                operativo.convocatoria_abierta && !opEsCerrado
                  ? 'bg-activo-suave text-activo dark:bg-noche-tarjeta dark:text-activo-claro'
                  : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
              }`}
            >
              {operativo.convocatoria_abierta && !opEsCerrado
                ? 'Convocatoria abierta'
                : 'Convocatoria cerrada'}
            </span>
          </div>
        </div>

        {puedeConfigurarGlobal && !opEsCerrado && (
          <div className="flex flex-col gap-3 border-t border-borde pt-3 dark:border-noche-borde">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  Estado de la convocatoria (reversible)
                </span>
                <div
                  role="group"
                  aria-label="Estado de la convocatoria"
                  className="inline-flex rounded-lg border border-borde bg-tarjeta p-0.5 dark:border-noche-borde dark:bg-noche-tarjeta"
                >
                  <button
                    type="button"
                    disabled={cambiandoEstado || Boolean(operativo.convocatoria_abierta)}
                    onClick={() => alPedirConfirmacionConvocatoria(true)}
                    className={`min-h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-default ${
                      operativo.convocatoria_abierta
                        ? 'bg-udec text-white'
                        : 'text-tinta-suave hover:bg-salvia hover:text-udec-oscuro dark:text-noche-tinta-suave dark:hover:bg-noche-campo'
                    }`}
                  >
                    Convocatoria abierta
                  </button>
                  <button
                    type="button"
                    disabled={cambiandoEstado || !operativo.convocatoria_abierta}
                    onClick={() => alPedirConfirmacionConvocatoria(false)}
                    className={`min-h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-default ${
                      !operativo.convocatoria_abierta
                        ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                        : 'text-tinta-suave hover:bg-salvia hover:text-udec-oscuro dark:text-noche-tinta-suave dark:hover:bg-noche-campo'
                    }`}
                  >
                    Convocatoria cerrada
                  </button>
                </div>
              </div>

              <form onSubmit={alGuardarCupo} className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="resumen-cupo"
                    className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave"
                  >
                    Cupo sugerido (vacío = sin límite)
                  </label>
                  <input
                    id="resumen-cupo"
                    type="number"
                    min={1}
                    max={1000}
                    placeholder="Sin límite"
                    value={cupoEdicionActual}
                    onChange={(e) => alCambiarCupoEdicion(e.target.value)}
                    className="campo min-h-9 w-36 text-xs tabular-nums"
                    disabled={cambiandoEstado}
                  />
                </div>
                <button
                  type="submit"
                  disabled={cambiandoEstado}
                  className="btn-salvia min-h-9 px-3 text-xs"
                >
                  Guardar cupo
                </button>
              </form>
            </div>

            {confirmandoConvocatoria !== null && (
              <div
                role="region"
                aria-label="Confirmar cambio de convocatoria"
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-udec/35 bg-tarjeta p-3 dark:border-activo-claro/35 dark:bg-noche-tarjeta"
              >
                <p className="min-w-0 flex-1 text-xs font-medium text-tinta dark:text-noche-tinta">
                  {confirmandoConvocatoria
                    ? '¿Abrir la convocatoria ahora? Los brigadistas podrán apuntarse por su cuenta desde su panel.'
                    : '¿Cerrar la convocatoria ahora? Solo detiene nuevos prerregistros abiertos de brigadistas; podrás seguir dando altas manuales, editando roles y confirmando por QR.'}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={cambiandoEstado}
                    onClick={() => alPedirConfirmacionConvocatoria(null)}
                    className="btn-salvia min-h-8 px-3 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={cambiandoEstado}
                    onClick={() => alConfirmarConvocatoria(confirmandoConvocatoria)}
                    className={`min-h-8 px-3 text-xs ${
                      confirmandoConvocatoria ? 'btn-verde' : 'btn-naranja'
                    }`}
                  >
                    {cambiandoEstado
                      ? 'Guardando...'
                      : confirmandoConvocatoria
                        ? 'Sí, abrir convocatoria'
                        : 'Sí, cerrar convocatoria'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acciones operativas */}
      {puedeGestionar && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-borde pt-4 dark:border-noche-borde">
          {!opEsCerrado ? (
            <>
              {puedeConfigurarGlobal && (
                <button
                  type="button"
                  onClick={alAlternarRecepcion}
                  disabled={cambiandoEstado}
                  className={`btn min-h-10 px-4 text-xs ${
                    opRecepcionAbierta
                      ? 'border border-ambar bg-ambar-suave text-ambar-texto hover:bg-amber-100 dark:bg-noche-ambar dark:text-noche-ambar-texto'
                      : 'btn-verde'
                  }`}
                >
                  {opRecepcionAbierta ? (
                    <>
                      <Lock size={15} strokeWidth={2} />
                      <span>Cerrar Recepción</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={15} strokeWidth={2} />
                      <span>Abrir Recepción</span>
                    </>
                  )}
                </button>
              )}

              {puedeFinalizar ? (
                <button
                  type="button"
                  disabled={verificandoCierre}
                  onClick={alIniciarFinalizar}
                  className="btn-naranja min-h-10 px-4 text-xs"
                >
                  <ShieldAlert size={15} strokeWidth={2} />
                  <span>
                    {verificandoCierre ? 'Verificando pendientes...' : 'Finalizar Operativo'}
                  </span>
                </button>
              ) : (
                <span className="text-xs font-medium text-tinta-suave dark:text-noche-tinta-suave">
                  El cierre global definitivo del operativo corresponde a Administración.
                </span>
              )}
            </>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              <Lock size={14} strokeWidth={2} />
              <span>
                Este operativo fue {opEsCancelado ? 'cancelado' : 'finalizado'} de forma
                irreversible. Consulta su bitácora en modo solo lectura.
              </span>
            </p>
          )}

          {soyAdmin && (
            <button
              type="button"
              onClick={alAbrirEliminarOCancelar}
              className="btn ml-auto min-h-10 border border-alerta bg-tarjeta px-3.5 text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <Trash2 size={15} strokeWidth={2} />
              <span>Eliminar o Cancelar</span>
            </button>
          )}
        </div>
      )}
    </article>
  )
}
