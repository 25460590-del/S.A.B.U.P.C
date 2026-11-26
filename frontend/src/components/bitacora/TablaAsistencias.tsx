import { Activity, CloudOff, HeartPulse, Package } from 'lucide-react'
import { ESTADOS_OPERATIVOS, opcionesRolEnTurno } from '../../constants/catalogos'
import { normalizarNombrePropio } from '../../lib/nombres'
import { etiquetaAyudantia } from '../../lib/permisos'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  EstadoOperativo,
  PerfilOperativoMinimo,
  RolEnTurno,
  Usuario,
} from '../../types'
import {
  etiquetaGrupoAsistencia,
  etiquetaMetodoEntrada,
  formatearHoraCorta,
} from './helpers'

interface TablaAsistenciasProps {
  asistenciasTotales: number
  filtradas: AsistenciaPersonal[]
  esFinalizado: boolean
  modoRapidoAbierto: boolean
  seleccionadosIds: string[]
  ocupadoId: string | null
  mapaPerfiles: Map<string, PerfilOperativoMinimo>
  mapaUsuarios: Map<string, Usuario>
  uidsPrerregistrados: Set<string>
  equiposPropiosPorAsistencia: Map<string, EquipoTurno[]>
  alAlternarSeleccion: (id: string) => void
  alSeleccionarTodosEnTurno: () => void
  alCambiarRol: (asistenciaId: string, rol: RolEnTurno) => void
  alCambiarEstado: (asistenciaId: string, estado: EstadoOperativo) => void
  alAbrirFichaEmergencia: (uid: string) => void
  alAbrirMaterial: (asistenciaId: string) => void
  alAbrirVitales: (a: AsistenciaPersonal) => void
  alCerrarSalidaManual: (a: AsistenciaPersonal) => void
}

export function TablaAsistencias({
  asistenciasTotales,
  filtradas,
  esFinalizado,
  modoRapidoAbierto,
  seleccionadosIds,
  ocupadoId,
  mapaPerfiles,
  mapaUsuarios,
  uidsPrerregistrados,
  equiposPropiosPorAsistencia,
  alAlternarSeleccion,
  alSeleccionarTodosEnTurno,
  alCambiarRol,
  alCambiarEstado,
  alAbrirFichaEmergencia,
  alAbrirMaterial,
  alAbrirVitales,
  alCerrarSalidaManual,
}: TablaAsistenciasProps) {
  if (filtradas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 p-8 text-center">
        <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
          {asistenciasTotales === 0
            ? 'Sin personal registrado en este operativo'
            : 'Sin coincidencias con los filtros activos'}
        </p>
        <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
          {asistenciasTotales === 0
            ? 'Escanea una credencial QR o usa el registro manual para iniciar el pase de lista.'
            : 'Ajusta el buscador o los chips de estatus.'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* MÓVIL (< md): filas densas de 2 líneas sin scroll horizontal */}
      <div className="divide-y divide-borde md:hidden dark:divide-noche-borde">
        {filtradas.map((a) => {
          const cerrada = a.hora_salida !== null
          const grupo = etiquetaGrupoAsistencia(a, mapaPerfiles)
          const marcado = seleccionadosIds.includes(a.id)
          const propios = equiposPropiosPorAsistencia.get(a.id) ?? []
          const estabaPrerregistrado = uidsPrerregistrados.has(a.usuario_uid)

          return (
            <div key={a.id} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {!esFinalizado && modoRapidoAbierto && !cerrada && (
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alAlternarSeleccion(a.id)}
                      aria-label={`Seleccionar a ${a.usuario_nombre}`}
                      className="h-4 w-4 shrink-0 rounded accent-udec"
                    />
                  )}
                  <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                    {normalizarNombrePropio(a.usuario_nombre)}
                  </span>
                  {a.sync_status === 'pendiente' && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[9px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                      <CloudOff size={9} strokeWidth={2} />
                      <span>Pendiente de sincronizar</span>
                    </span>
                  )}
                  {estabaPrerregistrado ? (
                    <span className="shrink-0 rounded bg-salvia px-1.5 py-0.5 text-[9px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                      Confirmado
                    </span>
                  ) : (
                    <span className="shrink-0 rounded border border-borde px-1.5 py-0.5 text-[9px] font-semibold text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave">
                      Sin prerregistro
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {propios.length > 0 && (
                    <span
                      title={`Material propio: ${propios.map((p) => p.nombre_articulo).join(', ')}`}
                      className="rounded-full bg-salvia px-2 py-0.5 text-[10px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro"
                    >
                      Propio ({propios.length})
                    </span>
                  )}
                  {cerrada ? (
                    <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-[10px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                      Salida {formatearHoraCorta(a.hora_salida?.toMillis())}
                    </span>
                  ) : a.equipos_bupc_pendientes > 0 ? (
                    <span className="rounded-full bg-naranja-suave px-2 py-0.5 text-[10px] font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                      BUPC ({a.equipos_bupc_pendientes})
                    </span>
                  ) : (
                    <span className="rounded-full bg-activo-suave px-2 py-0.5 text-[10px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
                      En turno
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    {grupo} · {etiquetaAyudantia(a.ayudantia_slot)} ·{' '}
                    {formatearHoraCorta(a.hora_entrada?.toMillis())}
                  </p>
                  <select
                    aria-label={`Rol en turno de ${a.usuario_nombre}`}
                    value={a.rol_en_turno}
                    disabled={cerrada || esFinalizado}
                    onChange={(e) => alCambiarRol(a.id, e.target.value as RolEnTurno)}
                    className="campo min-h-7 w-auto py-0.5 text-[11px]"
                  >
                    {opcionesRolEnTurno(a.rol_en_turno).map((rol) => (
                      <option key={rol} value={rol}>
                        {rol}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {mapaUsuarios.has(a.usuario_uid) && (
                    <button
                      type="button"
                      onClick={() => alAbrirFichaEmergencia(a.usuario_uid)}
                      aria-label={`Consultar Ficha de Emergencia de ${a.usuario_nombre}`}
                      title="Consultar Ficha de Emergencia"
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-alerta/45 bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                    >
                      <HeartPulse size={13} strokeWidth={2} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => alAbrirMaterial(a.id)}
                    className="cursor-pointer rounded border border-borde bg-salvia px-2 py-1 text-[11px] font-bold text-udec-oscuro dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                  >
                    Material
                    {a.equipos_bupc_pendientes + propios.length > 0
                      ? ` (${a.equipos_bupc_pendientes + propios.length})`
                      : ''}
                  </button>

                  {!esFinalizado && (
                    <button
                      type="button"
                      onClick={() => alAbrirVitales(a)}
                      aria-label={`Signos vitales de ${a.usuario_nombre}`}
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-borde bg-fondo text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
                    >
                      <Activity size={13} strokeWidth={2} />
                    </button>
                  )}

                  {!esFinalizado && !cerrada && (
                    <button
                      type="button"
                      disabled={ocupadoId === a.id}
                      onClick={() => alCerrarSalidaManual(a)}
                      className="cursor-pointer rounded border border-borde-fuerte bg-tarjeta px-2 py-1 text-[11px] font-bold text-tinta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta"
                    >
                      Salida
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ESCRITORIO (md+): tabla densa */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-udec-oscuro text-white">
            <tr>
              {!esFinalizado && modoRapidoAbierto && (
                <th scope="col" className="w-9 px-2.5 py-2 text-center">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos en turno"
                    onChange={alSeleccionarTodosEnTurno}
                    checked={
                      filtradas.some((a) => a.hora_salida === null) &&
                      filtradas
                        .filter((a) => a.hora_salida === null)
                        .every((a) => seleccionadosIds.includes(a.id))
                    }
                    className="h-4 w-4 rounded accent-naranja"
                  />
                </th>
              )}
              <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                Brigadista
              </th>
              <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                Entrada
              </th>
              <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                Rol / Estado
              </th>
              <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                Estatus turno
              </th>
              <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                Material
              </th>
              <th scope="col" className="px-3 py-2 text-right text-[11px] font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde dark:divide-noche-borde">
            {filtradas.map((a) => {
              const cerrada = a.hora_salida !== null
              const grupo = etiquetaGrupoAsistencia(a, mapaPerfiles)
              const p = mapaPerfiles.get(a.usuario_uid)
              const u = mapaUsuarios.get(a.usuario_uid)
              const claveRadio = p?.clave_radio || u?.clave_radio || u?.clave_personal_radio || ''
              const marcado = seleccionadosIds.includes(a.id)
              const propios = equiposPropiosPorAsistencia.get(a.id) ?? []
              const estabaPrerregistrado = uidsPrerregistrados.has(a.usuario_uid)

              return (
                <tr
                  key={a.id}
                  className="hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
                >
                  {!esFinalizado && modoRapidoAbierto && (
                    <td className="px-2.5 py-1.5 text-center">
                      {!cerrada && (
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alAlternarSeleccion(a.id)}
                          aria-label={`Seleccionar a ${a.usuario_nombre}`}
                          className="h-4 w-4 rounded accent-udec"
                        />
                      )}
                    </td>
                  )}

                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                        {normalizarNombrePropio(a.usuario_nombre)}
                      </span>
                      {a.sync_status === 'pendiente' && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[9px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                          <CloudOff size={9} strokeWidth={2} />
                          <span>Pendiente de sincronizar</span>
                        </span>
                      )}
                      {estabaPrerregistrado ? (
                        <span className="rounded bg-salvia px-1.5 py-0.5 text-[9px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                          Confirmado
                        </span>
                      ) : (
                        <span className="rounded border border-borde px-1.5 py-0.5 text-[9px] font-semibold text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave">
                          Sin prerregistro
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      {grupo} · {etiquetaAyudantia(a.ayudantia_slot)} ·{' '}
                      <span className="tabular-nums">{a.usuario_cuenta}</span>
                      {claveRadio ? ` · ${claveRadio}` : ''}
                    </span>
                  </td>

                  <td className="px-2.5 py-1.5 whitespace-nowrap">
                    <span className="block text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
                      {formatearHoraCorta(a.hora_entrada?.toMillis())}
                    </span>
                    <span className="text-[10px] text-tinta-suave dark:text-noche-tinta-suave">
                      {etiquetaMetodoEntrada(a.metodo_entrada)}
                    </span>
                  </td>

                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`Rol en turno de ${a.usuario_nombre}`}
                        value={a.rol_en_turno}
                        disabled={cerrada || esFinalizado}
                        onChange={(e) => alCambiarRol(a.id, e.target.value as RolEnTurno)}
                        className="campo min-h-8 w-auto py-0.5 text-[11px]"
                      >
                        {opcionesRolEnTurno(a.rol_en_turno).map((rol) => (
                          <option key={rol} value={rol}>
                            {rol}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Estado operativo de ${a.usuario_nombre}`}
                        value={a.estado_operativo}
                        disabled={cerrada || esFinalizado}
                        onChange={(e) => alCambiarEstado(a.id, e.target.value as EstadoOperativo)}
                        className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
                      >
                        {ESTADOS_OPERATIVOS.map((est) => (
                          <option key={est} value={est}>
                            {est}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  <td className="px-2.5 py-1.5 whitespace-nowrap">
                    {cerrada ? (
                      <div>
                        <span className="inline-flex rounded-full bg-superficie-suave px-2 py-0.5 text-[10px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                          Salida registrada
                        </span>
                        <span className="mt-0.5 block text-[10px] font-semibold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {formatearHoraCorta(a.hora_salida?.toMillis())} ({a.horas_totales ?? 0} h)
                        </span>
                      </div>
                    ) : a.equipos_bupc_pendientes > 0 ? (
                      <span className="inline-flex rounded-full bg-naranja-suave px-2 py-0.5 text-[10px] font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                        Con material ({a.equipos_bupc_pendientes})
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-activo-suave px-2 py-0.5 text-[10px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
                        En turno
                      </span>
                    )}
                  </td>

                  <td className="px-2.5 py-1.5 whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => alAbrirMaterial(a.id)}
                        className="btn-salvia min-h-8 px-2.5 text-[11px]"
                      >
                        <Package size={13} strokeWidth={2} />
                        <span>
                          {a.equipos_bupc_pendientes > 0
                            ? `BUPC (${a.equipos_bupc_pendientes})`
                            : esFinalizado
                              ? 'Ver'
                              : propios.length > 0
                                ? 'Ver / Entregar'
                                : 'Entregar'}
                        </span>
                      </button>

                      {propios.length > 0 && (
                        <button
                          type="button"
                          title={`Material propio: ${propios.map((prop) => prop.nombre_articulo).join(', ')}`}
                          onClick={() => alAbrirMaterial(a.id)}
                          className="cursor-pointer rounded-full border border-udec/35 bg-salvia/70 px-2 py-0.5 text-[10px] font-bold tabular-nums text-udec-oscuro hover:bg-salvia dark:border-activo-claro/35 dark:bg-noche-campo dark:text-activo-claro"
                        >
                          Propio ({propios.length})
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {mapaUsuarios.has(a.usuario_uid) && (
                        <button
                          type="button"
                          onClick={() => alAbrirFichaEmergencia(a.usuario_uid)}
                          title="Consultar Ficha de Emergencia"
                          aria-label={`Consultar Ficha de Emergencia de ${a.usuario_nombre}`}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-alerta/45 bg-alerta-suave px-2 text-[11px] font-semibold text-alerta hover:border-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                        >
                          <HeartPulse size={13} strokeWidth={2} />
                          <span>Ficha</span>
                        </button>
                      )}
                      {!esFinalizado && (
                        <button
                          type="button"
                          onClick={() => alAbrirVitales(a)}
                          title="Signos vitales"
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-borde bg-fondo px-2 text-[11px] font-semibold text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                        >
                          <Activity size={13} strokeWidth={2} />
                          <span>{a.signos_vitales?.spo2 ? `${a.signos_vitales.spo2}%` : 'SV'}</span>
                        </button>
                      )}
                      {!esFinalizado && !cerrada && (
                        <button
                          type="button"
                          disabled={ocupadoId === a.id}
                          onClick={() => alCerrarSalidaManual(a)}
                          className="btn-salvia min-h-8 px-2.5 text-[11px]"
                        >
                          {ocupadoId === a.id ? '...' : 'Cerrar Salida'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
