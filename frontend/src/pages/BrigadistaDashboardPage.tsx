import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Megaphone,
  Package,
  QrCode,
  Stethoscope,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BupcLogo } from '../components/BupcLogo'
import { CandadoDuroModal } from '../components/CandadoDuroModal'
import { QrScannerModal } from '../components/QrScannerModal'
import { ReportarEquipoModal } from '../components/ReportarEquipoModal'
import { rolOperativoPorAyudantia } from '../constants/catalogos'
import { etiquetaAyudantia } from '../lib/permisos'
import {
  escucharMisAsistencias,
  registrarAsistenciaQR,
} from '../services/asistenciasService'
import { mensajeDeError, nombreCompleto } from '../services/authService'
import {
  escucharEquiposDeAsistencia,
  escucharMisEquiposBupc,
} from '../services/equiposService'
import { escucharOperativosActivos } from '../services/operativosService'
import {
  apuntarseAOperativo,
  cancelarMiPrerregistro,
  obtenerConteoPrerregistros,
  obtenerMiPrerregistro,
} from '../services/prerregistrosService'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  Operativo,
  PrerregistroOperativo,
  Usuario,
} from '../types'

interface BrigadistaDashboardPageProps {
  perfil: Usuario
  enfoque?: 'escaner' | 'material'
}

function formatearHora(ms?: number): string {
  if (!ms) return '--:--:--'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatearDuracion(ms: number): string {
  const seg = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function BrigadistaDashboardPage({ perfil, enfoque }: BrigadistaDashboardPageProps) {
  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([])
  const [cargando, setCargando] = useState(true)
  const [equiposPorAsistencia, setEquiposPorAsistencia] = useState<{
    asistenciaId: string
    lista: EquipoTurno[]
  } | null>(null)
  const [misEquiposBupc, setMisEquiposBupc] = useState<EquipoTurno[]>([])
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())

  const [abriendoEscaner, setAbriendoEscaner] = useState(false)
  const [procesandoQr, setProcesandoQr] = useState(false)
  const [abriendoEquipo, setAbriendoEquipo] = useState(enfoque === 'material')
  const [candadoPendientes, setCandadoPendientes] = useState<EquipoTurno[] | null>(null)
  const [salidaAnticipadaPendiente, setSalidaAnticipadaPendiente] = useState<{
    asistenciaId: string
    operativoNombre: string
    horaEntradaTexto: string
    qrOriginal: string
  } | null>(null)
  const [confirmandoSalidaAnticipada, setConfirmandoSalidaAnticipada] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Operativos activos y estado propio de prerregistro + contador dedicado `meta/contador`
  const [operativosActivos, setOperativosActivos] = useState<Operativo[]>([])
  const [misPrerregistros, setMisPrerregistros] = useState<
    Record<string, PrerregistroOperativo | null>
  >({})
  const [conteosPorOp, setConteosPorOp] = useState<Record<string, number>>({})
  const [ocupadoConvocatoriaId, setOcupadoConvocatoriaId] = useState<string | null>(null)
  const [operativoDetalleId, setOperativoDetalleId] = useState<string | null>(null)

  useEffect(() => {
    const cancelar = escucharMisAsistencias(
      perfil.uid,
      (lista) => {
        setAsistencias(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    const cancelarBupc = escucharMisEquiposBupc(perfil.uid, setMisEquiposBupc, (err) =>
      setError(mensajeDeError(err)),
    )
    const cancelarOps = escucharOperativosActivos((lista) => {
      const ordenados = [...lista].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
      setOperativosActivos(ordenados)
    })
    return () => {
      cancelar()
      cancelarBupc()
      cancelarOps()
    }
  }, [perfil.uid])

  const idsOperativosActivos = useMemo(
    () => operativosActivos.map((op) => op.id).join('|'),
    [operativosActivos],
  )

  useEffect(() => {
    let activo = true
    if (!idsOperativosActivos) {
      void Promise.resolve().then(() => {
        if (!activo) return
        setMisPrerregistros({})
        setConteosPorOp({})
      })
      return () => {
        activo = false
      }
    }
    const ids = idsOperativosActivos.split('|')
    const mapaFallback = new Map(operativosActivos.map((op) => [op.id, op.prerregistros_count ?? 0]))
    void Promise.all(
      ids.map(async (opId) => {
        const [docPre, conteo] = await Promise.all([
          obtenerMiPrerregistro(opId, perfil.uid).catch(() => null),
          obtenerConteoPrerregistros(opId, mapaFallback.get(opId) ?? 0).catch(
            () => mapaFallback.get(opId) ?? 0,
          ),
        ])
        return [opId, docPre, conteo] as const
      }),
    ).then((resultados) => {
      if (!activo) return
      const mapaPre: Record<string, PrerregistroOperativo | null> = {}
      const mapaCont: Record<string, number> = {}
      for (const [opId, docPre, conteo] of resultados) {
        mapaPre[opId] = docPre
        mapaCont[opId] = conteo
      }
      setMisPrerregistros(mapaPre)
      setConteosPorOp(mapaCont)
    })
    return () => {
      activo = false
    }
  }, [idsOperativosActivos, perfil.uid, operativosActivos])

  const asistenciaPorOperativo = useMemo(() => {
    const mapa = new Map<string, AsistenciaPersonal>()
    for (const a of asistencias) {
      if (!mapa.has(a.operativo_id)) {
        mapa.set(a.operativo_id, a)
      }
    }
    return mapa
  }, [asistencias])

  // Mostrar operativos con convocatoria abierta Y aquellos con convocatoria cerrada en los que el
  // brigadista ya está prerregistrado o tiene asistencia confirmada (4A A-1).
  const operativosVisibles = useMemo(
    () =>
      operativosActivos.filter(
        (op) =>
          Boolean(op.convocatoria_abierta) ||
          Boolean(misPrerregistros[op.id]) ||
          asistenciaPorOperativo.has(op.id),
      ),
    [operativosActivos, misPrerregistros, asistenciaPorOperativo],
  )

  const operativoDetalle = operativoDetalleId
    ? (operativosVisibles.find((op) => op.id === operativoDetalleId) ?? null)
    : null

  async function manejarApuntarme(op: Operativo) {
    setOcupadoConvocatoriaId(op.id)
    setError(null)
    setAviso(null)
    try {
      const nuevoConteo = await apuntarseAOperativo(op.id, perfil)
      const actualizado = await obtenerMiPrerregistro(op.id, perfil.uid).catch(() => null)
      setConteosPorOp((prev) => ({ ...prev, [op.id]: nuevoConteo }))
      setMisPrerregistros((prev) => ({
        ...prev,
        [op.id]:
          actualizado ??
          ({
            usuario_uid: perfil.uid,
            usuario_nombre: nombreCompleto(perfil),
            usuario_cuenta: perfil.numero_cuenta,
            etapa: perfil.etapa,
            subgrupo: perfil.subgrupo,
            ayudantia: perfil.ayudantia,
            ayudantia_slot: perfil.ayudantia,
            rol_en_turno: rolOperativoPorAyudantia(perfil.ayudantia),
            rol_editado_manual: false,
            origen: 'Autoregistro',
            registrado_por_uid: perfil.uid,
          } as PrerregistroOperativo),
      }))
      setAviso(`Te apuntaste a "${op.nombre}". Confirma tu asistencia escaneando el QR al llegar.`)
    } catch (err) {
      const tieneCodigoFirebase = Boolean((err as { code?: string })?.code)
      setError(!tieneCodigoFirebase && err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoConvocatoriaId(null)
    }
  }

  async function manejarCancelarPrerregistro(op: Operativo) {
    if (asistenciaPorOperativo.has(op.id)) return
    setOcupadoConvocatoriaId(op.id)
    setError(null)
    setAviso(null)
    try {
      const nuevoConteo = await cancelarMiPrerregistro(op.id, perfil.uid)
      setConteosPorOp((prev) => ({ ...prev, [op.id]: nuevoConteo }))
      setMisPrerregistros((prev) => ({ ...prev, [op.id]: null }))
      setAviso(`Se canceló tu prerregistro en "${op.nombre}".`)
    } catch (err) {
      const tieneCodigoFirebase = Boolean((err as { code?: string })?.code)
      setError(!tieneCodigoFirebase && err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoConvocatoriaId(null)
    }
  }

  const turnoAbierto = asistencias.find((a) => a.hora_salida === null) ?? null
  const ultimoRegistro = turnoAbierto ?? asistencias[0] ?? null
  const turnoAbiertoId = turnoAbierto?.id ?? null

  useEffect(() => {
    if (!turnoAbiertoId) return
    const cancelar = escucharEquiposDeAsistencia(
      turnoAbiertoId,
      (lista) => {
        setEquiposPorAsistencia({ asistenciaId: turnoAbiertoId, lista })
      },
      (err) => {
        // Lectura secundaria del detalle de equipo: nunca interrumpir ni pintar error de permisos en el escáner
        console.warn('[SABUPC] Error secundario al leer equipos de asistencia:', err.code)
      },
      perfil.uid,
    )
    return cancelar
  }, [turnoAbiertoId, perfil.uid])

  useEffect(() => {
    if (!turnoAbiertoId) return
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [turnoAbiertoId])

  const equiposTurnoActual =
    equiposPorAsistencia?.asistenciaId === turnoAbiertoId ? equiposPorAsistencia.lista : []
  const bupcPendientesActivos = misEquiposBupc.filter(
    (e) => !e.devuelto && e.acta_incidencia === null,
  )

  // Acumulado real de horas del mes actual
  const ahoraFecha = new Date(ahoraMs)
  const mesActual = ahoraFecha.getMonth()
  const anioActual = ahoraFecha.getFullYear()
  const horasMes = asistencias.reduce((acc, a) => {
    const ms = a.hora_entrada?.toMillis()
    if (!ms) return acc
    const f = new Date(ms)
    if (f.getMonth() !== mesActual || f.getFullYear() !== anioActual) return acc
    if (typeof a.horas_totales === 'number') return acc + a.horas_totales
    return acc
  }, 0)

  const duracionTurnoActual = turnoAbierto?.hora_entrada
    ? formatearDuracion(ahoraMs - turnoAbierto.hora_entrada.toMillis())
    : '00:00:00'

  async function manejarDeteccionQr(codigo: string) {
    setProcesandoQr(true)
    setError(null)
    setAviso(null)
    try {
      const resultado = await registrarAsistenciaQR(perfil, codigo)
      setAbriendoEscaner(false)

      if (resultado.accion === 'entrada') {
        setAviso(`Entrada confirmada en "${resultado.operativoNombre}".`)
      } else if (resultado.accion === 'salida') {
        setAviso(
          `Salida registrada en "${resultado.operativoNombre}" (${resultado.horasTotales} h acumuladas).`,
        )
      } else if (resultado.accion === 'confirmar_salida_anticipada') {
        setSalidaAnticipadaPendiente({
          asistenciaId: resultado.asistenciaId,
          operativoNombre: resultado.operativoNombre,
          horaEntradaTexto: resultado.horaEntradaTexto,
          qrOriginal: resultado.qrOriginal,
        })
      } else if (resultado.accion === 'candado_duro') {
        setCandadoPendientes(resultado.pendientes)
      }
    } catch (err) {
      setAbriendoEscaner(false)
      const tieneCodigoFirebase = Boolean((err as { code?: string })?.code)
      setError(
        !tieneCodigoFirebase && err instanceof Error ? err.message : mensajeDeError(err),
      )
    } finally {
      setProcesandoQr(false)
    }
  }

  async function manejarConfirmarSalidaAnticipada() {
    if (!salidaAnticipadaPendiente) return
    setConfirmandoSalidaAnticipada(true)
    setError(null)
    setAviso(null)
    try {
      const resultado = await registrarAsistenciaQR(
        perfil,
        salidaAnticipadaPendiente.qrOriginal,
        undefined,
        { confirmarSalidaAnticipada: true },
      )
      setSalidaAnticipadaPendiente(null)
      if (resultado.accion === 'salida') {
        setAviso(
          `Salida registrada en "${resultado.operativoNombre}" (${resultado.horasTotales} h acumuladas).`,
        )
      } else if (resultado.accion === 'candado_duro') {
        setCandadoPendientes(resultado.pendientes)
      }
    } catch (err) {
      setSalidaAnticipadaPendiente(null)
      const tieneCodigoFirebase = Boolean((err as { code?: string })?.code)
      setError(
        !tieneCodigoFirebase && err instanceof Error ? err.message : mensajeDeError(err),
      )
    } finally {
      setConfirmandoSalidaAnticipada(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* Encabezado Verde UdeC con logo BUPC y adscripción simultánea */}
      <article className="overflow-hidden rounded-xl border border-borde bg-udec text-white dark:border-noche-borde">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <BupcLogo tamano="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white/85">Universidad de Colima</p>
            <h2 className="truncate text-base font-bold">{nombreCompleto(perfil)}</h2>
          </div>
          <span className="rounded-full bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo">
            {turnoAbierto ? turnoAbierto.estado_operativo : 'Disponible'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/20 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-udec-oscuro">
              {perfil.subgrupo || perfil.etapa}
            </span>
            <span className="badge-ayudantia bg-salvia text-udec-oscuro">
              {etiquetaAyudantia(perfil.ayudantia)}
            </span>
          </div>
          <span className="text-xs font-semibold tabular-nums text-white/90">
            Cuenta: {perfil.numero_cuenta}
          </span>
        </div>
      </article>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-sm font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-sm font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Encabezado de sección: Mi Turno */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-bold text-tinta dark:text-noche-tinta">
          {turnoAbierto ? 'Operativo Activo' : 'Mi Turno'}
        </h2>
        <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
          {turnoAbierto
            ? 'Consulta tu participación actual, tu rol asignado y registra tu salida con QR.'
            : 'Consulta tus convocatorias disponibles, tu participación y escanea el QR para ingresar.'}
        </p>
      </div>

      {/* CTA principal Naranja Protección Civil: acción directa de escaneo */}
      <button
        type="button"
        onClick={() => {
          setError(null)
          setAviso(null)
          setAbriendoEscaner(true)
        }}
        className="btn-naranja min-h-14 w-full text-sm"
      >
        <QrCode size={22} strokeWidth={2} className="shrink-0" />
        <span>
          {turnoAbierto
            ? 'Escanear QR para Registrar Salida'
            : 'Escanear QR para Registrar Entrada'}
        </span>
      </button>

      {/* Próximos operativos (sin card-in-card: filas separadas por divide-y) */}
      {operativosVisibles.length > 0 && (
        <section
          aria-label="Próximos operativos"
          className="tarjeta flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-borde px-4 py-3 dark:border-noche-borde">
            <div className="flex items-center gap-2">
              <Megaphone size={16} strokeWidth={2} className="shrink-0 text-udec dark:text-activo-claro" />
              <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                Próximos operativos
              </h3>
            </div>
            <span className="rounded-full bg-salvia px-2 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
              {operativosVisibles.length}
            </span>
          </div>

          <div className="divide-y divide-borde dark:divide-noche-borde">
            {operativosVisibles.map((op) => {
              const asistenciaPropia = asistenciaPorOperativo.get(op.id) ?? null
              const miPre = misPrerregistros[op.id] ?? null
              const yaAsistio = Boolean(asistenciaPropia)
              const prerregistrado = Boolean(miPre)
              const convocatoriaAbierta = Boolean(op.convocatoria_abierta)
              const apuntados = conteosPorOp[op.id] ?? op.prerregistros_count ?? 0
              const cupo = op.cupo_sugerido ?? null
              const cupoLleno = cupo !== null && apuntados >= cupo
              const ocupado = ocupadoConvocatoriaId === op.id

              return (
                <div key={op.id} className="flex flex-col gap-2.5 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOperativoDetalleId(op.id)}
                    className="flex w-full cursor-pointer items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                          {op.nombre}
                        </h4>
                        {cupo !== null && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                              cupoLleno
                                ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro'
                            }`}
                          >
                            {apuntados}/{cupo}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Calendar size={11} strokeWidth={2} />
                          <span>{op.fecha_inicio.replace('T', ' ')}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} strokeWidth={2} />
                          <span className="truncate">{op.sede}</span>
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-udec dark:text-activo-claro">
                      <span>Detalle</span>
                      <ChevronRight size={14} strokeWidth={2} />
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {yaAsistio ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo-texto dark:bg-noche-campo dark:text-activo-claro">
                        <UserCheck size={13} strokeWidth={2} />
                        <span>Asistencia confirmada con QR</span>
                      </span>
                    ) : prerregistrado ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-salvia px-2.5 py-1 text-[11px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                          <CheckCircle2 size={13} strokeWidth={2} />
                          <span>
                            {convocatoriaAbierta
                              ? 'Prerregistrado'
                              : 'Convocatoria cerrada — sigues inscrito'}
                          </span>
                        </span>
                        {convocatoriaAbierta && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={(e) => {
                              e.stopPropagation()
                              void manejarCancelarPrerregistro(op)
                            }}
                            className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-2.5 text-[11px] font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                          >
                            <UserMinus size={12} strokeWidth={2} />
                            <span>{ocupado ? 'Cancelando...' : 'Cancelar registro'}</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar-suave px-2.5 py-1 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                          <Clock size={12} strokeWidth={2} />
                          <span>Aún no inscrito</span>
                        </span>
                        {cupoLleno ? (
                          <button
                            type="button"
                            disabled
                            className="btn-salvia min-h-9 px-3 text-[11px] opacity-55"
                          >
                            Cupo lleno
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={(e) => {
                              e.stopPropagation()
                              void manejarApuntarme(op)
                            }}
                            className="btn-verde min-h-9 px-3.5 text-xs"
                          >
                            <UserPlus size={14} strokeWidth={2} />
                            <span>{ocupado ? 'Apuntando...' : 'Apuntarme'}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Tarjeta "Operativo en curso" / "Último operativo registrado" */}
      {cargando ? (
        <div className="tarjeta flex flex-col gap-3 p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-10 w-full animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 w-full animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : ultimoRegistro ? (
        <article className="tarjeta flex flex-col gap-4 p-4">
          <header className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
            <div>
              <p className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                {ultimoRegistro.hora_salida === null
                  ? 'Operativo en curso'
                  : 'Último operativo registrado'}
              </p>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                {ultimoRegistro.operativo_nombre}
              </h3>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                ultimoRegistro.hora_salida === null
                  ? 'border-activo bg-activo-suave text-activo dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro'
                  : 'border-borde bg-superficie-suave text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave'
              }`}
            >
              {ultimoRegistro.hora_salida === null && (
                <span className="h-2 w-2 rounded-full bg-activo dark:bg-activo-claro" />
              )}
              <span>{ultimoRegistro.estado_operativo}</span>
            </span>
          </header>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Hora exacta
              </span>
              <span className="text-xl font-bold tabular-nums text-tinta dark:text-noche-tinta">
                {formatearHora(
                  ultimoRegistro.hora_salida?.toMillis() ??
                    ultimoRegistro.hora_entrada?.toMillis(),
                )}
              </span>
            </div>
            <div>
              <span className="block text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Tipo de registro
              </span>
              <span className="text-base font-bold text-activo dark:text-activo-claro">
                {ultimoRegistro.hora_salida === null ? 'Entrada' : 'Salida cerrada'}
              </span>
            </div>

            {/* Rol asignado en turno (solo lectura con candado) */}
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg bg-superficie-suave px-3 py-2.5 dark:bg-noche-campo">
              <div>
                <span className="block text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  Rol asignado en turno
                </span>
                <span className="text-sm font-bold text-tinta dark:text-noche-tinta">
                  {ultimoRegistro.rol_en_turno}
                </span>
              </div>
              <Lock
                size={18}
                strokeWidth={2}
                aria-label="Solo editable por Encargado"
                className="shrink-0 text-tinta-suave dark:text-noche-tinta-suave"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-borde pt-3 dark:border-noche-borde">
            <div className="flex items-center gap-2">
              <Package
                size={18}
                strokeWidth={2}
                className={
                  bupcPendientesActivos.length > 0
                    ? 'text-naranja-oscuro dark:text-naranja'
                    : 'text-activo dark:text-activo-claro'
                }
              />
              <span className="text-sm font-semibold tabular-nums text-tinta dark:text-noche-tinta">
                {bupcPendientesActivos.length}{' '}
                {bupcPendientesActivos.length === 1
                  ? 'artículo BUPC bajo resguardo'
                  : 'artículos BUPC bajo resguardo'}
              </span>
            </div>
            {bupcPendientesActivos.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg bg-superficie-suave p-2.5 text-xs dark:bg-noche-campo">
                {bupcPendientesActivos.map((eq) => (
                  <li key={eq.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-tinta dark:text-noche-tinta">
                      {eq.cantidad && eq.cantidad > 1 ? `${eq.cantidad}× ` : ''}
                      {eq.nombre_articulo}
                      {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                    </span>
                    <span className="shrink-0 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      {eq.creado_por_nombre || 'Encargado'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      ) : (
        <article className="tarjeta flex flex-col items-center gap-2 p-6 text-center">
          <QrCode size={32} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
          <h3 className="text-base font-semibold text-tinta dark:text-noche-tinta">
            Sin registros de asistencia aún
          </h3>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Escanea el QR del Puesto de Mando para registrar tu entrada al operativo.
          </p>
        </article>
      )}

      {/* Botón ancho verde salvia (#EDF5EB) "Reportar equipo" */}
      <button
        type="button"
        disabled={!turnoAbierto}
        onClick={() => setAbriendoEquipo(true)}
        className="btn-salvia min-h-14 w-full justify-between px-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Stethoscope size={22} strokeWidth={2} className="shrink-0" />
          <div>
            <span className="block text-sm font-bold">Reportar equipo</span>
            <span className="block text-xs font-medium opacity-80">
              {turnoAbierto
                ? 'Material BUPC asignado y uniforme propio'
                : 'Registra tu entrada primero para reportar equipo'}
            </span>
          </div>
        </div>
        <ChevronRight size={20} strokeWidth={2} className="shrink-0" />
      </button>

      {/* Resumen real de horas */}
      <article className="tarjeta flex items-center justify-between gap-4 p-4">
        <div>
          <span className="block text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Horas del turno actual
          </span>
          <span className="text-xl font-bold tabular-nums text-tinta dark:text-noche-tinta">
            {duracionTurnoActual}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Acumulado del mes
          </span>
          <span className="text-base font-bold tabular-nums text-udec-oscuro dark:text-activo-claro">
            {horasMes.toFixed(1)} hrs
          </span>
        </div>
      </article>

      {/* Modal detalle de operativo */}
      {operativoDetalle && (() => {
        const asistenciaDet = asistenciaPorOperativo.get(operativoDetalle.id) ?? null
        const preDet = misPrerregistros[operativoDetalle.id] ?? null
        const convAbiertaDet = Boolean(operativoDetalle.convocatoria_abierta)
        const apuntadosDet =
          conteosPorOp[operativoDetalle.id] ?? operativoDetalle.prerregistros_count ?? 0
        const cupoDet = operativoDetalle.cupo_sugerido ?? null
        const cupoLlenoDet = cupoDet !== null && apuntadosDet >= cupoDet
        const ocupadoDet = ocupadoConvocatoriaId === operativoDetalle.id
        const rolAsignadoDet =
          asistenciaDet?.rol_en_turno ??
          preDet?.rol_en_turno ??
          rolOperativoPorAyudantia(perfil.ayudantia)

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle del operativo ${operativoDetalle.nombre}`}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
          >
            <article className="tarjeta flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
              <header className="flex items-start justify-between gap-2 border-b-3 border-naranja bg-udec px-4 py-3 text-white">
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold text-white/80">
                    {operativoDetalle.categoria}
                  </span>
                  <h3 className="truncate text-sm font-bold">{operativoDetalle.nombre}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOperativoDetalleId(null)}
                  aria-label="Cerrar detalle del operativo"
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
                >
                  <X size={17} strokeWidth={2} />
                </button>
              </header>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                {/* Estado actual del brigadista en este operativo */}
                <div
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 ${
                    asistenciaDet
                      ? 'border-activo bg-activo-suave dark:border-activo-claro/40 dark:bg-noche-campo'
                      : preDet
                        ? 'border-udec/40 bg-salvia dark:border-activo-claro/40 dark:bg-noche-campo'
                        : 'border-ambar bg-ambar-suave dark:border-noche-ambar dark:bg-noche-ambar/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Tu estado en este operativo
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        asistenciaDet
                          ? 'bg-tarjeta text-activo dark:bg-noche-tarjeta dark:text-activo-claro'
                          : preDet
                            ? 'bg-tarjeta text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro'
                            : 'bg-tarjeta text-ambar-texto dark:bg-noche-tarjeta dark:text-noche-ambar-texto'
                      }`}
                    >
                      {asistenciaDet ? (
                        <>
                          <UserCheck size={12} strokeWidth={2} />
                          <span>Asistencia confirmada con QR</span>
                        </>
                      ) : preDet ? (
                        <>
                          <CheckCircle2 size={12} strokeWidth={2} />
                          <span>
                            {convAbiertaDet
                              ? 'Prerregistrado'
                              : 'Convocatoria cerrada — sigues inscrito'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock size={12} strokeWidth={2} />
                          <span>Aún no inscrito</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-tinta dark:text-noche-tinta">
                    {asistenciaDet
                      ? 'Tu asistencia ya quedó registrada en este operativo.'
                      : preDet
                        ? convAbiertaDet
                          ? 'Ya quedaste apuntado en la lista previa. Al llegar, escanea el código QR del Puesto de Mando para confirmar tu asistencia.'
                          : 'La convocatoria cerró, pero sigues inscrito en la lista previa. Al llegar, escanea el código QR del Puesto de Mando para confirmar tu asistencia.'
                        : 'Todavía no te has apuntado a este operativo. Puedes prerregistrarte ahora para asegurar tu lugar.'}
                  </p>
                  {(asistenciaDet || preDet) && (
                    <p className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Rol asignado: <strong className="text-tinta dark:text-noche-tinta">{rolAsignadoDet}</strong>
                    </p>
                  )}
                </div>

                {/* Datos generales del operativo */}
                <dl className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Sede
                    </dt>
                    <dd className="text-right font-bold text-tinta dark:text-noche-tinta">
                      {operativoDetalle.sede}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                    <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Inicio
                    </dt>
                    <dd className="text-right font-bold tabular-nums text-tinta dark:text-noche-tinta">
                      {operativoDetalle.fecha_inicio.replace('T', ' ')}
                    </dd>
                  </div>
                  {operativoDetalle.fecha_fin && (
                    <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                      <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                        Cierre programado
                      </dt>
                      <dd className="text-right font-bold tabular-nums text-tinta dark:text-noche-tinta">
                        {operativoDetalle.fecha_fin.replace('T', ' ')}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                    <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Apuntados
                    </dt>
                    <dd className="text-right font-bold tabular-nums text-tinta dark:text-noche-tinta">
                      {apuntadosDet}
                      {cupoDet !== null ? ` / ${cupoDet}` : ' (sin límite)'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                    <dt className="font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Recepción con QR
                    </dt>
                    <dd className="text-right font-bold text-tinta dark:text-noche-tinta">
                      {operativoDetalle.recepcion_abierta ? 'Abierta' : 'Cerrada por ahora'}
                    </dd>
                  </div>
                </dl>

                {operativoDetalle.descripcion && (
                  <div className="rounded-lg bg-superficie-suave p-3 text-xs dark:bg-noche-campo">
                    <span className="block text-[11px] font-bold text-tinta-suave dark:text-noche-tinta-suave">
                      Indicaciones operativas
                    </span>
                    <p className="mt-1 whitespace-pre-line text-tinta dark:text-noche-tinta">
                      {operativoDetalle.descripcion}
                    </p>
                  </div>
                )}

                {/* Acciones desde el detalle */}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde pt-3 dark:border-noche-borde">
                  <button
                    type="button"
                    onClick={() => setOperativoDetalleId(null)}
                    className="btn-salvia min-h-9 px-3 text-xs"
                  >
                    Cerrar
                  </button>

                  {!asistenciaDet && preDet && convAbiertaDet && (
                    <button
                      type="button"
                      disabled={ocupadoDet}
                      onClick={() => void manejarCancelarPrerregistro(operativoDetalle)}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-3 text-xs font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                    >
                      <UserMinus size={14} strokeWidth={2} />
                      <span>{ocupadoDet ? 'Cancelando...' : 'Cancelar registro'}</span>
                    </button>
                  )}

                  {!asistenciaDet && !preDet && convAbiertaDet && !cupoLlenoDet && (
                    <button
                      type="button"
                      disabled={ocupadoDet}
                      onClick={() => void manejarApuntarme(operativoDetalle)}
                      className="btn-verde min-h-9 px-4 text-xs"
                    >
                      <UserPlus size={14} strokeWidth={2} />
                      <span>{ocupadoDet ? 'Apuntando...' : 'Apuntarme'}</span>
                    </button>
                  )}

                  {operativoDetalle.recepcion_abierta && !asistenciaDet && (
                    <button
                      type="button"
                      onClick={() => {
                        setOperativoDetalleId(null)
                        setError(null)
                        setAviso(null)
                        setAbriendoEscaner(true)
                      }}
                      className="btn-naranja min-h-9 px-3.5 text-xs"
                    >
                      <QrCode size={14} strokeWidth={2} />
                      <span>Escanear QR</span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          </div>
        )
      })()}

      {/* Modales */}
      {abriendoEscaner && (
        <QrScannerModal
          procesando={procesandoQr}
          alDetectar={(codigo) => void manejarDeteccionQr(codigo)}
          alCerrar={() => setAbriendoEscaner(false)}
        />
      )}

      {abriendoEquipo && turnoAbierto && (
        <ReportarEquipoModal
          brigadista={perfil}
          asistencia={turnoAbierto}
          equipos={equiposTurnoActual}
          alCerrar={() => setAbriendoEquipo(false)}
        />
      )}

      {candadoPendientes && (
        <CandadoDuroModal
          pendientes={candadoPendientes}
          alEntendido={() => setCandadoPendientes(null)}
          alVerEquipo={
            turnoAbierto
              ? () => {
                  setCandadoPendientes(null)
                  setAbriendoEquipo(true)
                }
              : undefined
          }
        />
      )}

      {salidaAnticipadaPendiente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar salida anticipada"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-sm flex-col gap-4 border-2 border-naranja p-5">
            <div className="flex items-start gap-2.5">
              <Clock size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-naranja-oscuro dark:text-naranja" />
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Confirmar salida anticipada
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Ya registraste entrada a las{' '}
                  <strong className="tabular-nums text-tinta dark:text-noche-tinta">
                    {salidaAnticipadaPendiente.horaEntradaTexto}
                  </strong>{' '}
                  en {salidaAnticipadaPendiente.operativoNombre}. ¿Confirmar salida anticipada?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={confirmandoSalidaAnticipada}
                onClick={() => setSalidaAnticipadaPendiente(null)}
                className="btn-salvia text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirmandoSalidaAnticipada}
                onClick={() => void manejarConfirmarSalidaAnticipada()}
                className="btn-naranja text-xs"
              >
                {confirmandoSalidaAnticipada ? 'Cerrando salida...' : 'Sí, confirmar salida'}
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}
