import {
  Activity,
  AlertTriangle,
  Clock,
  CloudOff,
  HeartPulse,
  LogOut,
  MoreVertical,
  Package,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
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
  evaluarAlertaSignosVitales,
  formatearHoraCorta,
  superaCuatroHorasEnServicio,
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

const ESTADOS_EN_TURNO_MOVIL: EstadoOperativo[] = ['En servicio', 'En descanso', 'Reserva']

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
  // Bottom sheet móvil de acciones táctiles (>= 44px) + confirmación 2 toques para Salida Manual
  const [accionesMovilId, setAccionesMovilId] = useState<string | null>(null)
  const [confirmandoSalidaId, setConfirmandoSalidaId] = useState<string | null>(null)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAhoraMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const asistenciaSheet = accionesMovilId
    ? (filtradas.find((a) => a.id === accionesMovilId) ?? null)
    : null

  function cerrarSheetMovil() {
    setAccionesMovilId(null)
    setConfirmandoSalidaId(null)
  }

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
            : 'Ajusta el buscador o los chips de estatus y fuerza de tarea.'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* MÓVIL (< md): filas limpias con botón único de Acciones (>= 44px) y bottom sheet */}
      <div className="divide-y divide-borde md:hidden dark:divide-noche-borde">
        {filtradas.map((a) => {
          const cerrada = a.hora_salida !== null
          const grupo = etiquetaGrupoAsistencia(a, mapaPerfiles)
          const marcado = seleccionadosIds.includes(a.id)
          const propios = equiposPropiosPorAsistencia.get(a.id) ?? []
          const estabaPrerregistrado = uidsPrerregistrados.has(a.usuario_uid)
          const alertaRelevo = superaCuatroHorasEnServicio(a, ahoraMs)
          const alertaSv = evaluarAlertaSignosVitales(a.signos_vitales)

          return (
            <div key={a.id} className="flex items-center justify-between gap-2.5 px-3 py-2.5">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {!esFinalizado && modoRapidoAbierto && !cerrada && (
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alAlternarSeleccion(a.id)}
                    aria-label={`Seleccionar a ${a.usuario_nombre}`}
                    className="mt-1 h-5 w-5 shrink-0 rounded accent-udec"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                      {normalizarNombrePropio(a.usuario_nombre)}
                    </span>
                    {estabaPrerregistrado && (
                      <span className="shrink-0 rounded bg-salvia px-1.5 py-0.5 text-[11px] font-semibold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                        Confirmado
                      </span>
                    )}
                    {a.sync_status === 'pendiente' && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                        <CloudOff size={11} strokeWidth={2} />
                        <span>Pendiente de sincronizar</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    {grupo} · {etiquetaAyudantia(a.ayudantia_slot)} ·{' '}
                    <span className="tabular-nums">{formatearHoraCorta(a.hora_entrada?.toMillis())}</span> ·{' '}
                    <span className="font-semibold text-tinta dark:text-noche-tinta">{a.rol_en_turno}</span>
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {cerrada ? (
                      <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-[11px] font-bold tabular-nums text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                        Salida {formatearHoraCorta(a.hora_salida?.toMillis())}
                      </span>
                    ) : a.equipos_bupc_pendientes > 0 ? (
                      <span className="rounded-full bg-naranja-suave px-2 py-0.5 text-[11px] font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                        BUPC ({a.equipos_bupc_pendientes})
                      </span>
                    ) : (
                      <span className="rounded-full bg-activo-suave px-2 py-0.5 text-[11px] font-bold text-activo-texto dark:bg-noche-campo dark:text-activo-claro">
                        {a.estado_operativo === 'En servicio' ? 'En turno' : a.estado_operativo}
                      </span>
                    )}

                    {alertaRelevo && (
                      <span
                        title="Más de 4 horas continuas en servicio — sugerir relevo e hidratación"
                        className="inline-flex items-center gap-1 rounded-full bg-ambar-suave px-2 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                      >
                        <Clock size={11} strokeWidth={2} />
                        <span>Relevo (+4 h)</span>
                      </span>
                    )}

                    {alertaSv.fueraDeRango && (
                      <span
                        title={`Signos vitales fuera de rango: ${alertaSv.motivos.join(', ')}`}
                        className="inline-flex items-center gap-1 rounded-full bg-alerta-suave px-2 py-0.5 text-[11px] font-bold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                      >
                        <AlertTriangle size={11} strokeWidth={2} />
                        <span>SV alerta</span>
                      </span>
                    )}

                    {propios.length > 0 && (
                      <span className="rounded-full bg-salvia px-2 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                        Propio ({propios.length})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmandoSalidaId(null)
                  setAccionesMovilId(a.id)
                }}
                aria-label={`Abrir acciones para ${a.usuario_nombre}`}
                className="btn-salvia min-h-11 shrink-0 px-3 text-xs"
              >
                <MoreVertical size={16} strokeWidth={2} />
                <span>Acciones</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet móvil de acciones (>= 44-48px) con selector de estado operativo y confirmación 2 toques */}
      {asistenciaSheet && (() => {
        const a = asistenciaSheet
        const cerrada = a.hora_salida !== null
        const propios = equiposPropiosPorAsistencia.get(a.id) ?? []
        const confirmandoSalida = confirmandoSalidaId === a.id
        const alertaSv = evaluarAlertaSignosVitales(a.signos_vitales)

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Acciones de ${a.usuario_nombre}`}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 md:hidden"
            onClick={cerrarSheetMovil}
          >
            <article
              onClick={(e) => e.stopPropagation()}
              className="tarjeta flex max-h-[85dvh] w-full flex-col gap-3.5 overflow-y-auto rounded-t-2xl rounded-b-none p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-start justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-tinta dark:text-noche-tinta">
                    {normalizarNombrePropio(a.usuario_nombre)}
                  </h4>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    {etiquetaGrupoAsistencia(a, mapaPerfiles)} · {etiquetaAyudantia(a.ayudantia_slot)} · Entrada{' '}
                    <span className="tabular-nums">{formatearHoraCorta(a.hora_entrada?.toMillis())}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarSheetMovil}
                  aria-label="Cerrar acciones"
                  className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-borde text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              {!cerrada && !esFinalizado && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="sheet-rol" className="etiqueta">
                      Rol en turno
                    </label>
                    <select
                      id="sheet-rol"
                      value={a.rol_en_turno}
                      onChange={(e) => alCambiarRol(a.id, e.target.value as RolEnTurno)}
                      className="campo min-h-11 text-sm"
                    >
                      {opcionesRolEnTurno(a.rol_en_turno).map((rol) => (
                        <option key={rol} value={rol}>
                          {rol}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="etiqueta">Estado operativo</span>
                    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Estado operativo">
                      {ESTADOS_EN_TURNO_MOVIL.map((est) => {
                        const activo = a.estado_operativo === est
                        return (
                          <button
                            key={est}
                            type="button"
                            onClick={() => alCambiarEstado(a.id, est)}
                            className={`min-h-11 cursor-pointer rounded-lg px-2 text-xs font-bold transition-colors ${
                              activo
                                ? 'bg-udec text-white'
                                : 'border border-borde bg-superficie-suave text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta'
                            }`}
                          >
                            {est}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    cerrarSheetMovil()
                    alAbrirMaterial(a.id)
                  }}
                  className="btn-salvia min-h-12 w-full justify-start px-4 text-sm"
                >
                  <Package size={18} strokeWidth={2} />
                  <span>
                    Material del turno
                    {a.equipos_bupc_pendientes + propios.length > 0
                      ? ` (${a.equipos_bupc_pendientes + propios.length})`
                      : ''}
                  </span>
                </button>

                {!esFinalizado && (
                  <button
                    type="button"
                    onClick={() => {
                      cerrarSheetMovil()
                      alAbrirVitales(a)
                    }}
                    className={`btn min-h-12 w-full justify-start px-4 text-sm ${
                      alertaSv.fueraDeRango
                        ? 'border border-alerta bg-alerta-suave text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                        : 'border border-borde-fuerte bg-tarjeta text-tinta hover:bg-superficie-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta'
                    }`}
                  >
                    <Activity size={18} strokeWidth={2} />
                    <span>
                      Signos vitales
                      {alertaSv.fueraDeRango
                        ? ` · Alerta (${alertaSv.motivos.join(', ')})`
                        : a.signos_vitales?.spo2
                          ? ` (SpO2 ${a.signos_vitales.spo2}%)`
                          : ''}
                    </span>
                  </button>
                )}

                {mapaUsuarios.has(a.usuario_uid) && (
                  <button
                    type="button"
                    onClick={() => {
                      cerrarSheetMovil()
                      alAbrirFichaEmergencia(a.usuario_uid)
                    }}
                    className="btn min-h-12 w-full justify-start border border-alerta/50 bg-alerta-suave px-4 text-sm text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                  >
                    <HeartPulse size={18} strokeWidth={2} />
                    <span>Consultar Ficha de Emergencia</span>
                  </button>
                )}
              </div>

              {!esFinalizado && !cerrada && (
                <div className="border-t border-borde pt-3 dark:border-noche-borde">
                  {confirmandoSalida ? (
                    <div className="flex flex-col gap-2.5 rounded-lg border border-alerta bg-alerta-suave p-3 dark:bg-noche-rojo-suave">
                      <p className="text-xs font-bold text-alerta-texto dark:text-noche-rojo-texto">
                        ¿Confirmas cerrar la salida manual de {normalizarNombrePropio(a.usuario_nombre)}?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmandoSalidaId(null)}
                          className="btn-salvia min-h-11 text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={ocupadoId === a.id}
                          onClick={() => {
                            cerrarSheetMovil()
                            alCerrarSalidaManual(a)
                          }}
                          className="btn-rojo min-h-11 text-xs"
                        >
                          {ocupadoId === a.id ? 'Cerrando...' : 'Confirmar Salida'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={ocupadoId === a.id}
                      onClick={() => setConfirmandoSalidaId(a.id)}
                      className="btn min-h-12 w-full border border-alerta bg-tarjeta text-sm text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                    >
                      <LogOut size={17} strokeWidth={2} />
                      <span>Cerrar Salida Manual</span>
                    </button>
                  )}
                </div>
              )}
            </article>
          </div>
        )
      })()}

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
              const alertaRelevo = superaCuatroHorasEnServicio(a, ahoraMs)
              const alertaSv = evaluarAlertaSignosVitales(a.signos_vitales)

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
                        <span className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                          <CloudOff size={10} strokeWidth={2} />
                          <span>Pendiente de sincronizar</span>
                        </span>
                      )}
                      {estabaPrerregistrado && (
                        <span className="rounded bg-salvia px-1.5 py-0.5 text-[11px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                          Confirmado
                        </span>
                      )}
                      {alertaRelevo && (
                        <span
                          title="Más de 4 horas continuas en servicio — sugerir relevo e hidratación"
                          className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                        >
                          <Clock size={11} strokeWidth={2} />
                          <span>Relevo +4 h</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      {grupo} ·{' '}
                      <span className="font-semibold text-udec-oscuro dark:text-activo-claro">
                        {etiquetaAyudantia(a.ayudantia_slot)}
                      </span>{' '}
                      · <span className="tabular-nums">{a.usuario_cuenta}</span>
                      {claveRadio ? ` · ${claveRadio}` : ''}
                    </span>
                  </td>

                  <td className="px-2.5 py-1.5 whitespace-nowrap">
                    <span className="block text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
                      {formatearHoraCorta(a.hora_entrada?.toMillis())}
                    </span>
                    <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
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
                        <span className="inline-flex rounded-full bg-superficie-suave px-2 py-0.5 text-[11px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                          Salida registrada
                        </span>
                        <span className="mt-0.5 block text-[11px] font-semibold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {formatearHoraCorta(a.hora_salida?.toMillis())} ({a.horas_totales ?? 0} h)
                        </span>
                      </div>
                    ) : a.equipos_bupc_pendientes > 0 ? (
                      <span className="inline-flex rounded-full bg-naranja-suave px-2 py-0.5 text-[11px] font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                        Con material ({a.equipos_bupc_pendientes})
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-activo-suave px-2 py-0.5 text-[11px] font-bold text-activo-texto dark:bg-noche-campo dark:text-activo-claro">
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
                          className="cursor-pointer rounded-full border border-udec/35 bg-salvia/70 px-2 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro hover:bg-salvia dark:border-activo-claro/35 dark:bg-noche-campo dark:text-activo-claro"
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
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-alerta/45 bg-alerta-suave px-2 text-[11px] font-semibold text-alerta-texto hover:border-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                        >
                          <HeartPulse size={13} strokeWidth={2} />
                          <span>Ficha</span>
                        </button>
                      )}
                      {!esFinalizado && (
                        <button
                          type="button"
                          onClick={() => alAbrirVitales(a)}
                          title={
                            alertaSv.fueraDeRango
                              ? `Signos vitales fuera de rango: ${alertaSv.motivos.join(', ')}`
                              : 'Signos vitales'
                          }
                          className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold ${
                            alertaSv.fueraDeRango
                              ? 'border-alerta bg-alerta-suave text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                              : 'border-borde bg-fondo text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta'
                          }`}
                        >
                          {alertaSv.fueraDeRango ? (
                            <AlertTriangle size={13} strokeWidth={2} />
                          ) : (
                            <Activity size={13} strokeWidth={2} />
                          )}
                          <span className="tabular-nums">
                            {a.signos_vitales?.spo2 ? `${a.signos_vitales.spo2}%` : 'SV'}
                          </span>
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
