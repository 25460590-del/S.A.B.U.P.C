import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Lock,
  MapPin,
  Megaphone,
  Package,
  QrCode,
  Stethoscope,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BupcLogo } from '../components/BupcLogo'
import { CandadoDuroModal } from '../components/CandadoDuroModal'
import { QrScannerModal } from '../components/QrScannerModal'
import { ReportarEquipoModal } from '../components/ReportarEquipoModal'
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
import { escucharOperativosConConvocatoriaAbierta } from '../services/operativosService'
import {
  apuntarseAOperativo,
  cancelarMiPrerregistro,
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
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Convocatorias abiertas y estado propio de prerregistro (getDoc puntual, 0 list)
  const [convocatoriasAbiertas, setConvocatoriasAbiertas] = useState<Operativo[]>([])
  const [misPrerregistros, setMisPrerregistros] = useState<
    Record<string, PrerregistroOperativo | null>
  >({})
  const [ocupadoConvocatoriaId, setOcupadoConvocatoriaId] = useState<string | null>(null)

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
    const cancelarConv = escucharOperativosConConvocatoriaAbierta(setConvocatoriasAbiertas)
    return () => {
      cancelar()
      cancelarBupc()
      cancelarConv()
    }
  }, [perfil.uid])

  const idsConvocatorias = useMemo(
    () => convocatoriasAbiertas.map((op) => op.id).join('|'),
    [convocatoriasAbiertas],
  )

  useEffect(() => {
    if (!idsConvocatorias) return
    let activo = true
    const ids = idsConvocatorias.split('|')
    void Promise.all(
      ids.map(async (opId) => {
        try {
          const docPre = await obtenerMiPrerregistro(opId, perfil.uid)
          return [opId, docPre] as const
        } catch {
          return [opId, null] as const
        }
      }),
    ).then((pares) => {
      if (!activo) return
      const mapa: Record<string, PrerregistroOperativo | null> = {}
      for (const [opId, docPre] of pares) {
        mapa[opId] = docPre
      }
      setMisPrerregistros(mapa)
    })
    return () => {
      activo = false
    }
  }, [idsConvocatorias, perfil.uid])

  const operativosConAsistenciaPropia = useMemo(
    () => new Set(asistencias.map((a) => a.operativo_id)),
    [asistencias],
  )

  async function manejarApuntarme(op: Operativo) {
    setOcupadoConvocatoriaId(op.id)
    setError(null)
    setAviso(null)
    try {
      await apuntarseAOperativo(op.id, perfil)
      const actualizado = await obtenerMiPrerregistro(op.id, perfil.uid).catch(() => null)
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
    if (operativosConAsistenciaPropia.has(op.id)) return
    setOcupadoConvocatoriaId(op.id)
    setError(null)
    setAviso(null)
    try {
      await cancelarMiPrerregistro(op.id, perfil.uid)
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
            <span className="rounded-full bg-naranja px-2.5 py-0.5 text-xs font-bold text-tinta">
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
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-sm font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-sm font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* CTA principal Naranja Protección Civil (#EA580C) */}
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
        <span>Escanear QR para Registrar Entrada / Salida</span>
      </button>

      {/* Próximos operativos con convocatoria abierta (autoregistro previo) */}
      {convocatoriasAbiertas.length > 0 && (
        <section
          aria-label="Próximos operativos con convocatoria abierta"
          className="tarjeta flex flex-col gap-3 p-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
            <div className="flex items-center gap-2">
              <Megaphone size={16} strokeWidth={2} className="shrink-0 text-udec dark:text-activo-claro" />
              <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                Próximos operativos con convocatoria
              </h3>
            </div>
            <span className="rounded-full bg-salvia px-2 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
              {convocatoriasAbiertas.length}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {convocatoriasAbiertas.map((op) => {
              const yaAsistio = operativosConAsistenciaPropia.has(op.id)
              const prerregistrado = Boolean(misPrerregistros[op.id])
              const apuntados = op.prerregistros_count ?? 0
              const cupo = op.cupo_sugerido ?? null
              const cupoLleno = cupo !== null && apuntados >= cupo
              const ocupado = ocupadoConvocatoriaId === op.id

              return (
                <div
                  key={op.id}
                  className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie-suave p-3 dark:border-noche-borde dark:bg-noche-campo"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                        {op.nombre}
                      </h4>
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
                    {cupo !== null && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                          cupoLleno
                            ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                            : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro'
                        }`}
                      >
                        {apuntados}/{cupo}
                      </span>
                    )}
                  </div>

                  {yaAsistio ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo dark:bg-noche-tarjeta dark:text-activo-claro">
                        <UserCheck size={13} strokeWidth={2} />
                        <span>Asistencia confirmada con QR</span>
                      </span>
                    </div>
                  ) : prerregistrado ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-salvia px-2.5 py-1 text-[11px] font-bold text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro">
                        <CheckCircle2 size={13} strokeWidth={2} />
                        <span>Prerregistrado · Confirma con QR al llegar</span>
                      </span>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void manejarCancelarPrerregistro(op)}
                        className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-2.5 text-[11px] font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                      >
                        <UserMinus size={12} strokeWidth={2} />
                        <span>{ocupado ? 'Cancelando...' : 'Cancelar registro'}</span>
                      </button>
                    </div>
                  ) : cupoLleno ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-ambar-texto dark:text-noche-ambar-texto">
                        Cupo sugerido completo ({apuntados}/{cupo})
                      </span>
                      <button
                        type="button"
                        disabled
                        className="btn-salvia min-h-8 px-3 text-[11px] opacity-55"
                      >
                        Cupo lleno
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void manejarApuntarme(op)}
                        className="btn-verde min-h-8 px-3.5 text-xs"
                      >
                        <UserPlus size={14} strokeWidth={2} />
                        <span>{ocupado ? 'Apuntando...' : 'Apuntarme'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Tarjeta "Último registro confirmado" */}
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
                Último registro confirmado
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
    </div>
  )
}
