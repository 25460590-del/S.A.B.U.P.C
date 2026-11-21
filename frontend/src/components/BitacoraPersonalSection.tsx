import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  PackagePlus,
  QrCode,
  Search,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { EQUIPO_BUPC_SUGERIDO, ESTADOS_OPERATIVOS, ROLES_EN_TURNO } from '../constants/catalogos'
import {
  actualizarEstadoOperativo,
  actualizarRolEnTurno,
  cerrarSalidaConCandado,
  escucharAsistenciasDeOperativo,
  escucharUsuariosParaBitacora,
  guardarSignosVitales,
  registrarAsistenciaManual,
  registrarAsistenciaQR,
} from '../services/asistenciasService'
import { mensajeDeError, nombreCompleto } from '../services/authService'
import {
  asignarEquipoBupc,
  escucharEquiposDeOperativo,
  levantarActaIncidencia,
  marcarEquipoDevueltoOk,
} from '../services/equiposService'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  EstadoOperativo,
  Operativo,
  RolEnTurno,
  Usuario,
} from '../types'
import { AlertaInactivoModal } from './AlertaInactivoModal'
import { CandadoDuroModal } from './CandadoDuroModal'
import { QrScannerModal } from './QrScannerModal'

interface BitacoraPersonalSectionProps {
  encargado: Usuario
  operativo: Operativo
}

function formatearHora24(ms?: number): string {
  if (!ms) return '--:--:--'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function BitacoraPersonalSection({ encargado, operativo }: BitacoraPersonalSectionProps) {
  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([])
  const [equipos, setEquipos] = useState<EquipoTurno[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)

  // Modales
  const [escanerAbierto, setEscanerAbierto] = useState(false)
  const [procesandoQr, setProcesandoQr] = useState(false)
  const [alertaInactivo, setAlertaInactivo] = useState<Usuario | null>(null)
  const [candadoPendientes, setCandadoPendientes] = useState<EquipoTurno[] | null>(null)

  // Modal Registro Manual
  const [modalManual, setModalManual] = useState(false)
  const [uidManual, setUidManual] = useState('')
  const [rolManual, setRolManual] = useState<RolEnTurno>('Primeros Auxilios')

  // Modal Signos Vitales
  const [vitalesObjetivo, setVitalesObjetivo] = useState<AsistenciaPersonal | null>(null)
  const [spo2, setSpo2] = useState('')
  const [fc, setFc] = useState('')
  const [fr, setFr] = useState('')
  const [ta, setTa] = useState('')
  const [temp, setTemp] = useState('')

  // Modal Asignar Equipo BUPC
  const [asignarObjetivo, setAsignarObjetivo] = useState<AsistenciaPersonal | null>(null)
  const [articuloNombre, setArticuloNombre] = useState(EQUIPO_BUPC_SUGERIDO[0])
  const [articuloFolio, setArticuloFolio] = useState('')

  // Modal Acta de Incidencia
  const [incidenciaObjetivo, setIncidenciaObjetivo] = useState<EquipoTurno | null>(null)
  const [motivoIncidencia, setMotivoIncidencia] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null)

  useEffect(() => {
    const cancelarAsis = escucharAsistenciasDeOperativo(
      operativo.id,
      (lista) => {
        setAsistencias(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    const cancelarEq = escucharEquiposDeOperativo(operativo.id, setEquipos)
    const cancelarUsr = escucharUsuariosParaBitacora(setUsuarios, () => undefined)

    return () => {
      cancelarAsis()
      cancelarEq()
      cancelarUsr()
    }
  }, [operativo.id])

  const filtradas = asistencias.filter((a) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      a.usuario_nombre.toLowerCase().includes(q) ||
      a.usuario_cuenta.toLowerCase().includes(q) ||
      a.rol_en_turno.toLowerCase().includes(q)
    )
  })

  const usuariosActivos = usuarios.filter((u) => u.estatus === 'Activo')

  async function manejarEscanearCredencial(codigo: string) {
    setProcesandoQr(true)
    setError(null)
    setAviso(null)
    try {
      const res = await registrarAsistenciaQR(encargado, codigo, operativo)
      setEscanerAbierto(false)

      if (res.accion === 'perfil_inactivo') {
        setAlertaInactivo(res.usuario)
      } else if (res.accion === 'candado_duro') {
        setCandadoPendientes(res.pendientes)
      } else if (res.accion === 'entrada') {
        setAviso(`Entrada registrada por QR para ${res.usuarioNombre}.`)
      } else if (res.accion === 'salida') {
        setAviso(`Salida registrada por QR para ${res.usuarioNombre} (${res.horasTotales} h).`)
      }
    } catch (err) {
      setEscanerAbierto(false)
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setProcesandoQr(false)
    }
  }

  async function manejarRegistroManual(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    const brigadista = usuarios.find((u) => u.uid === uidManual)
    if (!brigadista) {
      setError('Selecciona un brigadista del padrón.')
      return
    }
    setOcupadoId('manual')
    try {
      const res = await registrarAsistenciaManual(encargado, operativo, brigadista, rolManual)
      setModalManual(false)
      setUidManual('')
      if (res.accion === 'perfil_inactivo') {
        setAlertaInactivo(res.usuario)
      } else if (res.accion === 'entrada') {
        setAviso(`Entrada manual registrada para ${res.usuarioNombre}.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  function abrirModalVitales(a: AsistenciaPersonal) {
    setVitalesObjetivo(a)
    setSpo2(a.signos_vitales?.spo2 ?? '')
    setFc(a.signos_vitales?.fc ?? '')
    setFr(a.signos_vitales?.fr ?? '')
    setTa(a.signos_vitales?.ta ?? '')
    setTemp(a.signos_vitales?.temp ?? '')
  }

  async function manejarGuardarVitales(e: FormEvent) {
    e.preventDefault()
    if (!vitalesObjetivo) return
    setOcupadoId(vitalesObjetivo.id)
    setError(null)
    setAviso(null)
    try {
      await guardarSignosVitales(vitalesObjetivo.id, encargado, { spo2, fc, fr, ta, temp })
      setAviso(`Signos vitales guardados para ${vitalesObjetivo.usuario_nombre}.`)
      setVitalesObjetivo(null)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarAsignarEquipo(e: FormEvent) {
    e.preventDefault()
    if (!asignarObjetivo) return
    if (!articuloNombre.trim()) {
      setError('Indica el nombre del artículo BUPC.')
      return
    }
    setOcupadoId(asignarObjetivo.id)
    setError(null)
    setAviso(null)
    try {
      await asignarEquipoBupc(encargado, asignarObjetivo, {
        nombre_articulo: articuloNombre,
        codigo_inventario: articuloFolio,
      })
      setAviso(`Equipo "${articuloNombre}" asignado a ${asignarObjetivo.usuario_nombre}.`)
      setAsignarObjetivo(null)
      setArticuloFolio('')
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarDevolverOk(eq: EquipoTurno) {
    setOcupadoId(eq.id)
    setError(null)
    setAviso(null)
    try {
      await marcarEquipoDevueltoOk(encargado, eq)
      setAviso(`Devolución OK registrada: ${eq.nombre_articulo} (${eq.usuario_nombre}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarLevantarIncidencia(e: FormEvent) {
    e.preventDefault()
    if (!incidenciaObjetivo) return
    if (!motivoIncidencia.trim()) {
      setError('El motivo del Acta de Incidencia es obligatorio.')
      return
    }
    setOcupadoId(incidenciaObjetivo.id)
    setError(null)
    setAviso(null)
    try {
      await levantarActaIncidencia(
        encargado,
        incidenciaObjetivo,
        motivoIncidencia,
        archivoEvidencia,
      )
      setAviso(`Acta de Incidencia registrada para ${incidenciaObjetivo.nombre_articulo}.`)
      setIncidenciaObjetivo(null)
      setMotivoIncidencia('')
      setArchivoEvidencia(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarCerrarSalidaManual(a: AsistenciaPersonal) {
    setOcupadoId(a.id)
    setError(null)
    setAviso(null)
    try {
      const res = await cerrarSalidaConCandado(a.id, encargado, true)
      if (res.bloqueado) {
        setCandadoPendientes(res.pendientes)
      } else {
        setAviso(`Salida manual cerrada para ${a.usuario_nombre} (${res.horasTotales} h).`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  return (
    <section aria-label="Bitácora de Personal en Tiempo Real" className="tarjeta flex flex-col overflow-hidden">
      {/* Cabecera de Bitácora */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde p-4 dark:border-noche-borde">
        <div>
          <h3 className="text-lg font-bold text-tinta dark:text-noche-tinta">
            Bitácora de Personal · {operativo.nombre}
          </h3>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Control de asistencia en tiempo real, signos vitales y Candado Duro de material BUPC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:flex-initial">
            <Search
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
            />
            <input
              type="search"
              placeholder="Buscar brigadista o cuenta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="campo min-h-10 pl-9 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setEscanerAbierto(true)}
            className="btn-verde min-h-10 px-3 text-xs"
          >
            <QrCode size={16} strokeWidth={2} />
            <span>Escanear Credencial</span>
          </button>

          <button
            type="button"
            onClick={() => setModalManual(true)}
            className="btn-naranja min-h-10 px-3 text-xs"
          >
            <UserPlus size={16} strokeWidth={2} />
            <span>Registro Manual</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Tabla en tiempo real */}
      {cargando ? (
        <div className="flex flex-col gap-3 p-4">
          <div className="h-10 animate-pulse rounded bg-slate-200 dark:bg-noche-borde" />
          <div className="h-14 animate-pulse rounded bg-slate-200 dark:bg-noche-borde" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
            Sin personal registrado en este operativo
          </p>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Escanea la credencial QR de un brigadista o usa Registro Manual para dar entrada.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto pt-3">
          <table className="w-full border-collapse text-left">
            <thead className="bg-udec-oscuro text-white">
              <tr>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Brigadista
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Entrada
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Rol en Turno
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Signos Vitales
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Material BUPC
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold">
                  Salida
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde dark:divide-noche-borde">
              {filtradas.map((a) => {
                const cerrada = a.hora_salida !== null
                const equiposBupcPendientes = equipos.filter(
                  (e) =>
                    e.asistencia_id === a.id &&
                    e.origen_material === 'BUPC_Asignado' &&
                    !e.devuelto &&
                    e.acta_incidencia === null,
                )

                return (
                  <tr key={a.id} className="align-top">
                    <td className="min-w-44 px-4 py-3">
                      <span className="block text-sm font-bold text-tinta dark:text-noche-tinta">
                        {a.usuario_nombre}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="rounded bg-udec px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {a.grupo_operativo}
                        </span>
                        <span className="rounded border border-naranja bg-naranja-suave px-1.5 py-0.5 text-[11px] font-bold text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                          {a.ayudantia_slot}
                        </span>
                        <span className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {a.usuario_cuenta}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block text-sm font-bold tabular-nums text-tinta dark:text-noche-tinta">
                        {formatearHora24(a.hora_entrada?.toMillis())}
                      </span>
                      <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        {a.metodo_entrada.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        aria-label={`Rol en turno de ${a.usuario_nombre}`}
                        value={a.rol_en_turno}
                        disabled={cerrada}
                        onChange={(e) =>
                          void actualizarRolEnTurno(a.id, e.target.value as RolEnTurno).catch(
                            (err) => setError(mensajeDeError(err)),
                          )
                        }
                        className="campo min-h-9 w-auto py-1 text-xs"
                      >
                        {ROLES_EN_TURNO.map((rol) => (
                          <option key={rol} value={rol}>
                            {rol}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        aria-label={`Estado operativo de ${a.usuario_nombre}`}
                        value={a.estado_operativo}
                        disabled={cerrada}
                        onChange={(e) =>
                          void actualizarEstadoOperativo(
                            a.id,
                            e.target.value as EstadoOperativo,
                          ).catch((err) => setError(mensajeDeError(err)))
                        }
                        className="campo min-h-9 w-auto py-1 text-xs font-semibold"
                      >
                        {ESTADOS_OPERATIVOS.map((est) => (
                          <option key={est} value={est}>
                            {est}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => abrirModalVitales(a)}
                        className="btn-salvia min-h-9 px-2.5 text-xs whitespace-nowrap"
                      >
                        <Activity size={14} strokeWidth={2} />
                        <span>
                          {a.signos_vitales
                            ? `SpO2 ${a.signos_vitales.spo2 || '-'} · FC ${a.signos_vitales.fc || '-'}`
                            : 'SpO2 / FC / TA'}
                        </span>
                      </button>
                    </td>

                    <td className="min-w-60 px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              a.equipos_bupc_pendientes > 0
                                ? 'text-naranja-oscuro dark:text-naranja'
                                : 'text-activo dark:text-activo-claro'
                            }`}
                          >
                            Pendientes: {a.equipos_bupc_pendientes}
                          </span>
                          {!cerrada && (
                            <button
                              type="button"
                              onClick={() => {
                                setAsignarObjetivo(a)
                                setArticuloNombre(EQUIPO_BUPC_SUGERIDO[0])
                                setArticuloFolio('')
                              }}
                              className="btn-salvia min-h-8 px-2 text-[11px]"
                            >
                              <PackagePlus size={13} strokeWidth={2} />
                              <span>Asignar</span>
                            </button>
                          )}
                        </div>

                        {equiposBupcPendientes.map((eq) => (
                          <div
                            key={eq.id}
                            className="flex flex-col gap-1.5 rounded-lg border border-borde bg-fondo p-2 dark:border-noche-borde dark:bg-noche-campo"
                          >
                            <div className="flex items-center justify-between gap-1 text-xs">
                              <span className="font-semibold text-tinta dark:text-noche-tinta">
                                {eq.nombre_articulo}
                                {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                              </span>
                              {eq.estado_reporte === 'Con_Falla' && (
                                <span className="rounded bg-alerta-suave px-1.5 py-0.5 text-[10px] font-bold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
                                  Falla
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={ocupadoId === eq.id}
                                onClick={() => void manejarDevolverOk(eq)}
                                className="cursor-pointer rounded border border-activo bg-activo-suave px-2 py-1 text-[11px] font-bold text-activo hover:bg-emerald-100 disabled:opacity-50 dark:border-activo-claro dark:bg-noche-tarjeta dark:text-activo-claro"
                              >
                                Devolver OK
                              </button>
                              <button
                                type="button"
                                disabled={ocupadoId === eq.id}
                                onClick={() => {
                                  setIncidenciaObjetivo(eq)
                                  setMotivoIncidencia('')
                                  setArchivoEvidencia(null)
                                }}
                                className="cursor-pointer rounded border border-alerta bg-tarjeta px-2 py-1 text-[11px] font-bold text-alerta hover:bg-alerta-suave disabled:opacity-50 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                              >
                                Acta de Incidencia
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {cerrada ? (
                        <div>
                          <span className="block text-sm font-bold tabular-nums text-tinta dark:text-noche-tinta">
                            {formatearHora24(a.hora_salida?.toMillis())}
                          </span>
                          <span className="text-[11px] font-semibold tabular-nums text-activo dark:text-activo-claro">
                            {a.horas_totales ?? 0} hrs
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={ocupadoId === a.id}
                          onClick={() => void manejarCerrarSalidaManual(a)}
                          className="btn-salvia min-h-9 px-3 text-xs"
                        >
                          {ocupadoId === a.id ? 'Cerrando...' : 'Cerrar Salida'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Escáner QR de Credenciales */}
      {escanerAbierto && (
        <QrScannerModal
          titulo="Escanear Credencial QR"
          subtitulo={`Operativo: ${operativo.nombre}`}
          instruccion="Encuadra la Credencial Digital QR del Brigadista"
          procesando={procesandoQr}
          alDetectar={(codigo) => void manejarEscanearCredencial(codigo)}
          alCerrar={() => setEscanerAbierto(false)}
        />
      )}

      {/* Modal Alerta Roja INACTIVO */}
      {alertaInactivo && (
        <AlertaInactivoModal
          usuario={alertaInactivo}
          alCerrar={() => setAlertaInactivo(null)}
        />
      )}

      {/* Modal Candado Duro */}
      {candadoPendientes && (
        <CandadoDuroModal
          pendientes={candadoPendientes}
          alEntendido={() => setCandadoPendientes(null)}
        />
      )}

      {/* Modal Registro Manual */}
      {modalManual && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registro Manual de Asistencia"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Registro Manual · {operativo.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setModalManual(false)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarRegistroManual} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="manual-usr" className="etiqueta">
                  Brigadista activo
                </label>
                <select
                  id="manual-usr"
                  value={uidManual}
                  onChange={(e) => setUidManual(e.target.value)}
                  className="campo"
                  required
                >
                  <option value="">Selecciona un brigadista...</option>
                  {usuariosActivos.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {nombreCompleto(u)} ({u.numero_cuenta})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="manual-rol" className="etiqueta">
                  Rol en turno
                </label>
                <select
                  id="manual-rol"
                  value={rolManual}
                  onChange={(e) => setRolManual(e.target.value as RolEnTurno)}
                  className="campo"
                >
                  {ROLES_EN_TURNO.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalManual(false)}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupadoId === 'manual'}
                  className="btn-verde"
                >
                  {ocupadoId === 'manual' ? 'Registrando...' : 'Registrar Entrada'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}

      {/* Modal Signos Vitales */}
      {vitalesObjetivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Captura de Signos Vitales"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Captura de Signos Vitales
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  {vitalesObjetivo.usuario_nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVitalesObjetivo(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarGuardarVitales} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-spo2" className="etiqueta">
                    SpO2 (%)
                  </label>
                  <input
                    id="vit-spo2"
                    type="text"
                    placeholder="98"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-fc" className="etiqueta">
                    FC (lpm)
                  </label>
                  <input
                    id="vit-fc"
                    type="text"
                    placeholder="76"
                    value={fc}
                    onChange={(e) => setFc(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-fr" className="etiqueta">
                    FR (rpm)
                  </label>
                  <input
                    id="vit-fr"
                    type="text"
                    placeholder="16"
                    value={fr}
                    onChange={(e) => setFr(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-ta" className="etiqueta">
                    TA (mmHg)
                  </label>
                  <input
                    id="vit-ta"
                    type="text"
                    placeholder="120/80"
                    value={ta}
                    onChange={(e) => setTa(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor="vit-temp" className="etiqueta">
                    Temperatura (°C)
                  </label>
                  <input
                    id="vit-temp"
                    type="text"
                    placeholder="36.6"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={ocupadoId === vitalesObjetivo.id}
                className="btn-verde w-full"
              >
                {ocupadoId === vitalesObjetivo.id ? 'Guardando...' : 'Guardar Signos'}
              </button>
            </form>
          </article>
        </div>
      )}

      {/* Modal Asignar Material BUPC */}
      {asignarObjetivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Asignar Material BUPC"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Asignar Material BUPC
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Resguardo para {asignarObjetivo.usuario_nombre} (+1 al Candado Duro)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAsignarObjetivo(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarAsignarEquipo} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {EQUIPO_BUPC_SUGERIDO.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setArticuloNombre(sug)}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold ${
                      articuloNombre === sug
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="asig-nom" className="etiqueta">
                  Artículo BUPC
                </label>
                <input
                  id="asig-nom"
                  type="text"
                  maxLength={120}
                  value={articuloNombre}
                  onChange={(e) => setArticuloNombre(e.target.value)}
                  className="campo"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="asig-folio" className="etiqueta">
                  Folio / Código de inventario (opcional)
                </label>
                <input
                  id="asig-folio"
                  type="text"
                  maxLength={60}
                  placeholder="Ej. R-04, B-12"
                  value={articuloFolio}
                  onChange={(e) => setArticuloFolio(e.target.value)}
                  className="campo tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAsignarObjetivo(null)}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupadoId === asignarObjetivo.id}
                  className="btn-verde"
                >
                  {ocupadoId === asignarObjetivo.id ? 'Asignando...' : 'Asignar Material'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}

      {/* Modal Acta de Incidencia (válvula de escape con evidencia WebP opcional) */}
      {incidenciaObjetivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Levantar Acta de Incidencia"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col overflow-hidden border-2 border-alerta">
            <header className="flex items-center justify-between gap-2 bg-alerta px-4 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <FileWarning size={20} strokeWidth={2} />
                <h3 className="text-sm font-bold">Levantar Acta de Incidencia</h3>
              </div>
              <button
                type="button"
                onClick={() => setIncidenciaObjetivo(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/15"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <form onSubmit={manejarLevantarIncidencia} className="flex flex-col gap-3 p-5">
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Artículo:{' '}
                <strong className="text-tinta dark:text-noche-tinta">
                  {incidenciaObjetivo.nombre_articulo}
                </strong>{' '}
                · Brigadista: <strong>{incidenciaObjetivo.usuario_nombre}</strong>
              </p>

              <div className="flex flex-col gap-1">
                <label htmlFor="inc-motivo" className="etiqueta">
                  Motivo de la incidencia (obligatorio)
                </label>
                <textarea
                  id="inc-motivo"
                  rows={3}
                  maxLength={400}
                  placeholder="Ej. Extravío de antena, daño en carcasa, insumo consumido en atención..."
                  value={motivoIncidencia}
                  onChange={(e) => setMotivoIncidencia(e.target.value)}
                  className="campo min-h-24 py-2"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="inc-foto" className="etiqueta">
                  Evidencia fotográfica opcional (se comprime a WebP ~40–70 KB)
                </label>
                <label
                  htmlFor="inc-foto"
                  className="btn-salvia min-h-11 w-full cursor-pointer text-xs"
                >
                  <Upload size={16} strokeWidth={2} />
                  <span>
                    {archivoEvidencia ? archivoEvidencia.name : 'Adjuntar fotografía de evidencia'}
                  </span>
                </label>
                <input
                  id="inc-foto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setArchivoEvidencia(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIncidenciaObjetivo(null)}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupadoId === incidenciaObjetivo.id}
                  className="btn-rojo"
                >
                  {ocupadoId === incidenciaObjetivo.id
                    ? 'Registrando...'
                    : 'Registrar Acta y Liberar'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
    </section>
  )
}
