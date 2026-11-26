import { CloudOff, PackagePlus, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { EQUIPO_BUPC_SUGERIDO } from '../../constants/catalogos'
import { normalizarNombrePropio } from '../../lib/nombres'
import type { AsistenciaPersonal, EquipoTurno } from '../../types'
import { formatearHoraCorta } from './helpers'

interface ModalMaterialBitacoraProps {
  asistencia: AsistenciaPersonal
  equiposBupc: EquipoTurno[]
  equiposPropios: EquipoTurno[]
  esFinalizado: boolean
  ocupadoId: string | null
  articuloNombre: string
  articuloFolio: string
  articuloCantidad: number
  mantenerEnCadena: boolean
  alCambiarNombre: (valor: string) => void
  alCambiarFolio: (valor: string) => void
  alCambiarCantidad: (valor: number) => void
  alCambiarMantener: (valor: boolean) => void
  alAsignar: (e: FormEvent) => void
  alDevolverOk: (eq: EquipoTurno) => void
  alAbrirIncidencia: (eq: EquipoTurno) => void
  alCerrar: () => void
}

export function ModalMaterialBitacora({
  asistencia,
  equiposBupc,
  equiposPropios,
  esFinalizado,
  ocupadoId,
  articuloNombre,
  articuloFolio,
  articuloCantidad,
  mantenerEnCadena,
  alCambiarNombre,
  alCambiarFolio,
  alCambiarCantidad,
  alCambiarMantener,
  alAsignar,
  alDevolverOk,
  alAbrirIncidencia,
  alCerrar,
}: ModalMaterialBitacoraProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Material del turno del Brigadista"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <article className="tarjeta flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
        <header className="flex items-center justify-between gap-2 border-b border-borde bg-udec px-4 py-3 text-white dark:border-noche-borde">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">
              Material del turno · {normalizarNombrePropio(asistencia.usuario_nombre)}
            </h3>
            <p className="text-[11px] text-white/85 tabular-nums">
              BUPC pendientes: {asistencia.equipos_bupc_pendientes} · Propio registrado:{' '}
              {equiposPropios.length}
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar cajón de material"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {!esFinalizado && asistencia.hora_salida === null && (
            <form
              onSubmit={alAsignar}
              className="flex flex-col gap-2.5 rounded-lg border border-borde bg-superficie-suave p-3 dark:border-noche-borde dark:bg-noche-campo"
            >
              <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                Entregar nuevo artículo BUPC
              </span>

              <div className="flex flex-wrap gap-1">
                {EQUIPO_BUPC_SUGERIDO.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => alCambiarNombre(item)}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      articuloNombre === item
                        ? 'bg-udec text-white'
                        : 'border border-borde bg-tarjeta text-tinta dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Nombre del artículo"
                  value={articuloNombre}
                  onChange={(e) => alCambiarNombre(e.target.value)}
                  className="campo min-h-9 text-xs sm:col-span-6"
                  required
                />
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Serie o folio (opcional)"
                  value={articuloFolio}
                  onChange={(e) => alCambiarFolio(e.target.value)}
                  className="campo min-h-9 text-xs tabular-nums sm:col-span-4"
                />
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label="Cantidad"
                  value={articuloCantidad}
                  onChange={(e) => alCambiarCantidad(Math.max(1, Number(e.target.value) || 1))}
                  className="campo min-h-9 text-center text-xs font-bold tabular-nums sm:col-span-2"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  <input
                    type="checkbox"
                    checked={mantenerEnCadena}
                    onChange={(e) => alCambiarMantener(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-udec"
                  />
                  <span>Mantener abierto para seguir entregando</span>
                </label>
                <button
                  type="submit"
                  disabled={ocupadoId === asistencia.id}
                  className="btn-naranja min-h-9 px-3.5 text-xs"
                >
                  <PackagePlus size={14} strokeWidth={2} />
                  <span>{ocupadoId === asistencia.id ? 'Asignando...' : 'Entregar'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Sección 1: Material BUPC */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase text-naranja-oscuro dark:text-naranja">
                Material BUPC ({equiposBupc.length})
              </h4>
              <span className="text-[11px] font-medium text-tinta-suave dark:text-noche-tinta-suave">
                Sujeto a devolución
              </span>
            </div>

            {equiposBupc.length === 0 ? (
              <p className="rounded-lg border border-borde bg-superficie-suave py-3.5 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                Sin artículos BUPC asignados aún.
              </p>
            ) : (
              equiposBupc.map((eq) => {
                const pendiente = !eq.devuelto && eq.acta_incidencia === null
                const cant = eq.cantidad ?? 1
                return (
                  <div
                    key={eq.id}
                    className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-2.5 dark:border-noche-borde dark:bg-noche-campo"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                          {cant > 1 ? `${cant}× ` : ''}
                          {eq.nombre_articulo}
                          {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                        </p>
                        <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          Entregado: {formatearHoraCorta(eq.creado_en?.toMillis())}
                          {eq.creado_por_nombre ? ` · Por ${eq.creado_por_nombre}` : ''}
                        </p>
                        {eq.falla_reportada && (
                          <p className="text-[11px] font-semibold text-alerta dark:text-noche-rojo-texto">
                            Falla: {eq.falla_reportada}
                          </p>
                        )}
                        {eq.acta_incidencia && (
                          <p className="text-[11px] font-semibold text-ambar-texto dark:text-noche-ambar-texto">
                            Acta: {eq.acta_incidencia.motivo}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {eq.sync_status === 'pendiente' && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[9px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                            <CloudOff size={9} strokeWidth={2} />
                            <span>Pendiente de sincronizar</span>
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            eq.devuelto
                              ? 'bg-activo-suave text-activo dark:bg-noche-tarjeta dark:text-activo-claro'
                              : eq.acta_incidencia
                                ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                : 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-tarjeta dark:text-naranja'
                          }`}
                        >
                          {eq.devuelto ? 'Devuelto OK' : eq.acta_incidencia ? 'Con Acta' : 'Pendiente'}
                        </span>
                      </div>
                    </div>

                    {pendiente && !esFinalizado && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={ocupadoId === eq.id}
                          onClick={() => alDevolverOk(eq)}
                          className="cursor-pointer rounded border border-activo bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo hover:bg-emerald-100 disabled:opacity-50 dark:border-activo-claro dark:bg-noche-tarjeta dark:text-activo-claro"
                        >
                          Devolver OK
                        </button>
                        <button
                          type="button"
                          disabled={ocupadoId === eq.id}
                          onClick={() => alAbrirIncidencia(eq)}
                          className="cursor-pointer rounded border border-alerta bg-tarjeta px-2.5 py-1 text-[11px] font-bold text-alerta hover:bg-alerta-suave disabled:opacity-50 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                        >
                          Acta de Incidencia
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Sección 2: Material Propio */}
          <div className="flex flex-col gap-2 border-t border-borde pt-3 dark:border-noche-borde">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase text-udec dark:text-activo-claro">
                Material Propio ({equiposPropios.length})
              </h4>
              <span className="text-[11px] font-medium text-tinta-suave dark:text-noche-tinta-suave">
                Informativo · no bloquea salida
              </span>
            </div>

            {equiposPropios.length === 0 ? (
              <p className="rounded-lg border border-borde bg-superficie-suave py-3.5 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                Sin material propio registrado en este turno.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {equiposPropios.map((eq) => {
                  const cant = eq.cantidad ?? 1
                  return (
                    <div
                      key={eq.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-udec/25 bg-salvia/40 p-2.5 dark:border-activo-claro/25 dark:bg-noche-campo"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                          {cant > 1 ? `${cant}× ` : ''}
                          {eq.nombre_articulo}
                          {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                        </p>
                        <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          Registrado: {formatearHoraCorta(eq.creado_en?.toMillis())}
                        </p>
                        {eq.falla_reportada && (
                          <p className="text-[11px] font-semibold text-alerta dark:text-noche-rojo-texto">
                            Observación: {eq.falla_reportada}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {eq.sync_status === 'pendiente' && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[9px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                            <CloudOff size={9} strokeWidth={2} />
                            <span>Pendiente de sincronizar</span>
                          </span>
                        )}
                        <span className="rounded-full bg-salvia px-2 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro">
                          Propio
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
