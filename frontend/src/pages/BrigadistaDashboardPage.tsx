import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Lock,
  Package,
  QrCode,
  Stethoscope,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { BupcLogo } from '../components/BupcLogo'
import { CandadoDuroModal } from '../components/CandadoDuroModal'
import { QrScannerModal } from '../components/QrScannerModal'
import { ReportarEquipoModal } from '../components/ReportarEquipoModal'
import {
  escucharMisAsistencias,
  registrarAsistenciaQR,
} from '../services/asistenciasService'
import { mensajeDeError, nombreCompleto } from '../services/authService'
import { escucharEquiposDeAsistencia } from '../services/equiposService'
import type { AsistenciaPersonal, EquipoTurno, Usuario } from '../types'

interface BrigadistaDashboardPageProps {
  perfil: Usuario
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

export function BrigadistaDashboardPage({ perfil }: BrigadistaDashboardPageProps) {
  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([])
  const [cargando, setCargando] = useState(true)
  const [equiposPorAsistencia, setEquiposPorAsistencia] = useState<{
    asistenciaId: string
    lista: EquipoTurno[]
  } | null>(null)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())

  const [abriendoEscaner, setAbriendoEscaner] = useState(false)
  const [procesandoQr, setProcesandoQr] = useState(false)
  const [abriendoEquipo, setAbriendoEquipo] = useState(false)
  const [candadoPendientes, setCandadoPendientes] = useState<EquipoTurno[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    return cancelar
  }, [perfil.uid])

  const turnoAbierto = asistencias.find((a) => a.hora_salida === null) ?? null
  const ultimoRegistro = turnoAbierto ?? asistencias[0] ?? null
  const turnoAbiertoId = turnoAbierto?.id ?? null

  useEffect(() => {
    if (!turnoAbiertoId) return
    const cancelar = escucharEquiposDeAsistencia(turnoAbiertoId, (lista) => {
      setEquiposPorAsistencia({ asistenciaId: turnoAbiertoId, lista })
    })
    return cancelar
  }, [turnoAbiertoId])

  useEffect(() => {
    if (!turnoAbiertoId) return
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [turnoAbiertoId])

  const equiposTurnoActual =
    equiposPorAsistencia?.asistenciaId === turnoAbiertoId ? equiposPorAsistencia.lista : []

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
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
              {perfil.grupo_operativo === 'Ninguno'
                ? 'Sin grupo'
                : `Grupo ${perfil.grupo_operativo}`}
            </span>
            <span className="rounded-full bg-naranja px-2.5 py-0.5 text-xs font-bold text-tinta">
              {perfil.ayudantia_slot}
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
        className="btn-naranja min-h-14 w-full text-sm shadow-xs"
      >
        <QrCode size={22} strokeWidth={2} className="shrink-0" />
        <span>Escanear QR para Registrar Entrada / Salida</span>
      </button>

      {/* Tarjeta "Último registro confirmado" */}
      {cargando ? (
        <div className="tarjeta flex flex-col gap-3 p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-noche-borde" />
          <div className="h-10 w-full animate-pulse rounded bg-slate-200 dark:bg-noche-borde" />
          <div className="h-12 w-full animate-pulse rounded bg-slate-200 dark:bg-noche-borde" />
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
                  : 'border-borde bg-slate-100 text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave'
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
            <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2.5 dark:bg-noche-campo">
              <div>
                <span className="block text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  Rol asignado en turno (solo lectura)
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

          <div className="flex items-center justify-between gap-2 border-t border-borde pt-3 dark:border-noche-borde">
            <div className="flex items-center gap-2">
              <Package
                size={18}
                strokeWidth={2}
                className={
                  ultimoRegistro.equipos_bupc_pendientes > 0
                    ? 'text-naranja-oscuro dark:text-naranja'
                    : 'text-activo dark:text-activo-claro'
                }
              />
              <span className="text-sm font-semibold tabular-nums text-tinta dark:text-noche-tinta">
                {ultimoRegistro.equipos_bupc_pendientes}{' '}
                {ultimoRegistro.equipos_bupc_pendientes === 1
                  ? 'artículo BUPC bajo resguardo'
                  : 'artículos BUPC bajo resguardo'}
              </span>
            </div>
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
