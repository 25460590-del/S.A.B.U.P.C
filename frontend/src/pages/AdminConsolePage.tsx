import {
  AlertCircle,
  CheckCircle2,
  History,
  IdCard,
  LogOut,
  Megaphone,
  Radio,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import { AYUDANTIAS, GRUPOS_OPERATIVOS, ROLES } from '../constants/catalogos'
import {
  aprobarUsuario,
  cambiarRolUsuario,
  cerrarSesion,
  darDeBajaUsuario,
  escucharUsuariosPorEstatus,
  mensajeDeError,
  nombreCompleto,
  rechazarUsuario,
  type AsignacionAlta,
} from '../services/authService'
import type { AyudantiaSlot, GrupoOperativo, RolSistema, Usuario } from '../types'
import { CatalogosAuditoriaTab } from '../components/CatalogosAuditoriaTab'
import { CredencialDigitalPage } from './CredencialDigitalPage'
import { HistorialDualPage } from './HistorialDualPage'
import { OperativosPanelPage } from './OperativosPanelPage'
import { RadioConsolePage } from './RadioConsolePage'

interface AdminConsolePageProps {
  admin: Usuario
}

type Pestana =
  | 'pendientes'
  | 'directorio'
  | 'catalogos'
  | 'operativos'
  | 'radio'
  | 'historial'
  | 'credencial'

function TarjetaPendiente({
  admin,
  usuario,
  alNotificar,
  alError,
}: {
  admin: Usuario
  usuario: Usuario
  alNotificar: (msg: string) => void
  alError: (msg: string) => void
}) {
  const [grupo, setGrupo] = useState<GrupoOperativo>('Alfa')
  const [ayudantia, setAyudantia] = useState<AyudantiaSlot>('Socorros')
  const [claveRadio, setClaveRadio] = useState('')
  const [autorizadoRadio, setAutorizadoRadio] = useState(false)
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function manejarAprobar() {
    setOcupado(true)
    alError('')
    try {
      const claveLimpia = claveRadio.trim()
      const asignacion: AsignacionAlta = {
        grupo_operativo: grupo,
        ayudantia_slot: ayudantia,
        autorizado_radio: autorizadoRadio,
        clave_personal_radio: claveLimpia ? claveLimpia : null,
      }
      await aprobarUsuario(admin, usuario, asignacion)
      alNotificar(`Alta aprobada para ${nombreCompleto(usuario)}.`)
    } catch (err) {
      alError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarRechazar() {
    setOcupado(true)
    alError('')
    try {
      await rechazarUsuario(admin, usuario)
      alNotificar(`Solicitud rechazada para ${nombreCompleto(usuario)}.`)
    } catch (err) {
      alError(mensajeDeError(err))
    } finally {
      setOcupado(false)
      setConfirmandoRechazo(false)
    }
  }

  return (
    <article className="tarjeta flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
        <div>
          <h3 className="text-base font-semibold text-tinta dark:text-noche-tinta">
            {nombreCompleto(usuario)}
          </h3>
          <p className="mt-0.5 text-xs font-medium tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
            Cuenta: {usuario.numero_cuenta} · {usuario.nivel_academico} ({usuario.escuela_carrera}) ·
            Sangre {usuario.tipo_sangre}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
            {usuario.correo} · Cel. {usuario.celular}
            {usuario.celular_con_whatsapp ? ' (WhatsApp)' : ''}
          </p>
        </div>
        <span className="rounded-full border border-ambar bg-ambar-suave px-3 py-1 text-xs font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
          PENDIENTE
        </span>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`grupo-${usuario.uid}`} className="etiqueta">
            Grupo Operativo
          </label>
          <select
            id={`grupo-${usuario.uid}`}
            value={grupo}
            onChange={(e) => setGrupo(e.target.value as GrupoOperativo)}
            className="campo"
            disabled={ocupado}
          >
            {GRUPOS_OPERATIVOS.map((g) => (
              <option key={g} value={g}>
                {g === 'Ninguno' ? 'Ninguno' : `Grupo ${g}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`ayu-${usuario.uid}`} className="etiqueta">
            Ayudantía (5 slots)
          </label>
          <select
            id={`ayu-${usuario.uid}`}
            value={ayudantia}
            onChange={(e) => setAyudantia(e.target.value as AyudantiaSlot)}
            className="campo"
            disabled={ocupado}
          >
            {AYUDANTIAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`clave-${usuario.uid}`} className="etiqueta">
            Clave de Radio
          </label>
          <input
            id={`clave-${usuario.uid}`}
            type="text"
            maxLength={10}
            placeholder="Ej. E7 (opcional)"
            value={claveRadio}
            onChange={(e) => setClaveRadio(e.target.value)}
            className="campo tabular-nums"
            disabled={ocupado}
          />
        </div>

        <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-borde bg-salvia px-3 dark:border-udec-brillo dark:bg-noche-campo">
          <input
            type="checkbox"
            checked={autorizadoRadio}
            onChange={(e) => setAutorizadoRadio(e.target.checked)}
            disabled={ocupado}
            className="h-5 w-5 rounded accent-udec"
          />
          <span className="text-xs font-semibold whitespace-nowrap text-udec-oscuro dark:text-noche-tinta">
            Autorizado Radio
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {confirmandoRechazo ? (
          <>
            <span className="mr-auto text-xs font-semibold text-alerta dark:text-noche-rojo-texto">
              ¿Confirmas rechazar esta solicitud? Quedará en estado Inactivo.
            </span>
            <button
              type="button"
              onClick={() => setConfirmandoRechazo(false)}
              disabled={ocupado}
              className="btn-salvia min-h-10 px-3"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={manejarRechazar}
              disabled={ocupado}
              className="btn-rojo min-h-10 px-4"
            >
              {ocupado ? 'Procesando...' : 'Confirmar Rechazo'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmandoRechazo(true)}
              disabled={ocupado}
              className="btn min-h-10 border border-alerta bg-tarjeta px-4 text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={manejarAprobar}
              disabled={ocupado}
              className="btn-verde min-h-10 px-5"
            >
              <UserCheck size={18} strokeWidth={2} />
              <span>{ocupado ? 'Aprobando...' : 'Aprobar Alta'}</span>
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export function AdminConsolePage({ admin }: AdminConsolePageProps) {
  const [pestana, setPestana] = useState<Pestana>('pendientes')
  const [pendientes, setPendientes] = useState<Usuario[]>([])
  const [directorio, setDirectorio] = useState<Usuario[]>([])
  const [cargandoPendientes, setCargandoPendientes] = useState(true)
  const [cargandoDirectorio, setCargandoDirectorio] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState<'Todos' | 'Activo' | 'Inactivo'>('Todos')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [bajaObjetivo, setBajaObjetivo] = useState<Usuario | null>(null)
  const [motivoBaja, setMotivoBaja] = useState('')
  const [procesandoUid, setProcesandoUid] = useState<string | null>(null)

  useEffect(() => {
    const cancelarPend = escucharUsuariosPorEstatus(
      ['Pendiente'],
      (lista) => {
        setPendientes(lista)
        setCargandoPendientes(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargandoPendientes(false)
      },
    )

    const cancelarDir = escucharUsuariosPorEstatus(
      ['Activo', 'Inactivo'],
      (lista) => {
        setDirectorio(lista)
        setCargandoDirectorio(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargandoDirectorio(false)
      },
    )

    return () => {
      cancelarPend()
      cancelarDir()
    }
  }, [])

  const directorioFiltrado = directorio.filter((u) => {
    if (filtroEstatus !== 'Todos' && u.estatus !== filtroEstatus) return false
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      nombreCompleto(u).toLowerCase().includes(q) ||
      u.numero_cuenta.toLowerCase().includes(q) ||
      u.correo.toLowerCase().includes(q)
    )
  })

  async function manejarCambioRol(usuario: Usuario, nuevoRol: RolSistema) {
    if (usuario.rol_sistema === nuevoRol) return
    setProcesandoUid(usuario.uid)
    setError(null)
    setAviso(null)
    try {
      await cambiarRolUsuario(admin, usuario, nuevoRol)
      setAviso(`Rol actualizado a ${nuevoRol} para ${nombreCompleto(usuario)}.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setProcesandoUid(null)
    }
  }

  async function confirmarBaja() {
    if (!bajaObjetivo) return
    setProcesandoUid(bajaObjetivo.uid)
    setError(null)
    setAviso(null)
    try {
      const motivo = motivoBaja.trim() || 'Baja operativa desde consola de administración'
      await darDeBajaUsuario(admin, bajaObjetivo, motivo)
      setAviso(`${nombreCompleto(bajaObjetivo)} fue dado de baja (Inactivo).`)
      setBajaObjetivo(null)
      setMotivoBaja('')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setProcesandoUid(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-fondo md:flex-row dark:bg-noche">
      {/* Barra lateral Verde UdeC (#1E5631 día / #08100B nocturno) */}
      <aside className="flex shrink-0 flex-col justify-between bg-udec-oscuro p-4 text-white md:w-64 dark:border-r dark:border-noche-borde dark:bg-noche-sidebar">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-white/20 pb-4 dark:border-noche-borde">
            <BupcLogo tamano="md" />
            <div>
              <p className="text-xs font-semibold text-white/80 dark:text-noche-tinta-suave">
                Universidad de Colima
              </p>
              <h1 className="text-base font-bold">S.A.B.U.P.C</h1>
            </div>
          </div>

          <nav aria-label="Menú Administrador" className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setPestana('pendientes')}
              className={`flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                pestana === 'pendientes'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <UserCheck size={18} strokeWidth={2} />
                <span>Aprobaciones</span>
              </span>
              {pendientes.length > 0 && (
                <span className="rounded-full bg-naranja px-2 py-0.5 text-xs font-bold tabular-nums text-tinta">
                  {pendientes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPestana('directorio')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                pestana === 'directorio'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Users size={18} strokeWidth={2} />
              <span>Directorio y Bajas</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('operativos')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                pestana === 'operativos'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Megaphone size={18} strokeWidth={2} />
              <span>Operativos y QR</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('radio')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                pestana === 'radio'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Radio size={18} strokeWidth={2} />
              <span>Radio CECOM</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('historial')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                pestana === 'historial'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <History size={18} strokeWidth={2} />
              <span>Historial Dual</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('credencial')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                pestana === 'credencial'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <IdCard size={18} strokeWidth={2} />
              <span>Mi Credencial QR</span>
            </button>
          </nav>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-white/20 pt-4 dark:border-noche-borde">
          <div>
            <span className="block text-xs font-semibold text-white/75 dark:text-noche-tinta-suave">
              Administrador Global
            </span>
            <span className="text-sm font-bold">{nombreCompleto(admin)}</span>
          </div>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="btn min-h-10 w-full border border-white/25 bg-white/10 text-white hover:bg-white/20 dark:border-noche-borde dark:bg-noche-tarjeta"
          >
            <LogOut size={16} strokeWidth={2} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraEstado
          etiquetaDerecha={`${pendientes.length} ${
            pendientes.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'
          }`}
        />

        <main className="flex flex-1 flex-col gap-5 p-4 md:p-6">
          {(pestana === 'pendientes' || pestana === 'directorio' || pestana === 'catalogos') && (
            <>
              {/* Cabecera y pestañas */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-tinta dark:text-noche-tinta">
                    Consola del Administrador Global
                  </h2>
                  <p className="mt-0.5 text-sm text-tinta-suave dark:text-noche-tinta-suave">
                    Gestión de altas, adscripciones, bajas operativas y catálogos de radio.
                  </p>
                </div>

                <div className="inline-flex flex-wrap gap-1.5 rounded-lg border border-borde bg-superficie-suave p-1 dark:border-noche-borde dark:bg-noche-campo">
                  <button
                    type="button"
                    onClick={() => setPestana('pendientes')}
                    className={`min-h-10 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors ${
                      pestana === 'pendientes'
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                    }`}
                  >
                    Aprobación de Usuarios ({pendientes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPestana('directorio')}
                    className={`min-h-10 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors ${
                      pestana === 'directorio'
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                    }`}
                  >
                    Directorio y Bajas ({directorio.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPestana('catalogos')}
                    className={`min-h-10 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors ${
                      pestana === 'catalogos'
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                    }`}
                  >
                    Catálogos y Auditoría
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-sm text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aviso && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-sm text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
            >
              <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          {/* PESTAÑA 1: Aprobación de Usuarios (Pendientes) */}
          {pestana === 'pendientes' && (
            <section aria-label="Solicitudes pendientes" className="flex flex-col gap-4">
              {cargandoPendientes ? (
                <div className="tarjeta flex flex-col gap-3 p-4">
                  <div className="h-5 w-48 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
                  <div className="h-4 w-72 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
                    <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
                    <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
                    <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
                  </div>
                </div>
              ) : pendientes.length === 0 ? (
                <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
                  <ShieldCheck
                    size={36}
                    strokeWidth={2}
                    className="text-activo dark:text-activo-claro"
                  />
                  <h3 className="text-base font-semibold text-tinta dark:text-noche-tinta">
                    Sin solicitudes pendientes
                  </h3>
                  <p className="text-sm text-tinta-suave dark:text-noche-tinta-suave">
                    Cuando un nuevo brigadista complete su registro, aparecerá aquí automáticamente
                    para su aprobación.
                  </p>
                </article>
              ) : (
                pendientes.map((u) => (
                  <TarjetaPendiente
                    key={u.uid}
                    admin={admin}
                    usuario={u}
                    alNotificar={(msg) => setAviso(msg)}
                    alError={(msg) => setError(msg || null)}
                  />
                ))
              )}
            </section>
          )}

          {/* PESTAÑA 2: Directorio y Bajas */}
          {pestana === 'directorio' && (
            <section aria-label="Directorio y Bajas" className="flex flex-col gap-4">
              {/* Barra de búsqueda y filtro */}
              <div className="tarjeta flex flex-wrap items-center gap-3 p-3">
                <div className="relative min-w-56 flex-1">
                  <Search
                    size={18}
                    strokeWidth={2}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
                  />
                  <input
                    type="search"
                    placeholder="Buscar por nombre, cuenta o correo..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="campo pl-10"
                  />
                </div>
                <div className="inline-flex gap-1">
                  {(['Todos', 'Activo', 'Inactivo'] as const).map((est) => (
                    <button
                      key={est}
                      type="button"
                      onClick={() => setFiltroEstatus(est)}
                      className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-semibold ${
                        filtroEstatus === est
                          ? 'bg-udec text-white'
                          : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                      }`}
                    >
                      {est === 'Todos' ? 'Todos' : est === 'Activo' ? 'Activos' : 'Inactivos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel de confirmación de baja */}
              {bajaObjetivo && (
                <article
                  role="alertdialog"
                  aria-label="Confirmar baja operativa"
                  className="flex flex-col gap-3 rounded-xl border-2 border-alerta bg-alerta-suave p-4 dark:bg-noche-rojo-suave"
                >
                  <div className="flex items-start gap-2.5">
                    <UserX
                      size={20}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-alerta dark:text-noche-rojo-texto"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-alerta dark:text-noche-rojo-texto">
                        Confirmar baja operativa — {nombreCompleto(bajaObjetivo)}
                      </h3>
                      <p className="mt-0.5 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                        Esta acción bloqueará su sesión al instante y registrará el evento en la
                        bitácora de auditoría.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Motivo de la baja (opcional)"
                      value={motivoBaja}
                      onChange={(e) => setMotivoBaja(e.target.value)}
                      className="campo min-w-56 flex-1 bg-tarjeta dark:bg-noche-tarjeta"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setBajaObjetivo(null)
                        setMotivoBaja('')
                      }}
                      disabled={procesandoUid === bajaObjetivo.uid}
                      className="btn-salvia"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmarBaja}
                      disabled={procesandoUid === bajaObjetivo.uid}
                      className="btn-rojo"
                    >
                      {procesandoUid === bajaObjetivo.uid
                        ? 'Aplicando baja...'
                        : 'Confirmar Baja Definitiva'}
                    </button>
                  </div>
                </article>
              )}

              {cargandoDirectorio ? (
                <div className="tarjeta flex flex-col gap-3 p-4">
                  <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
                  <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
                  <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
                </div>
              ) : directorioFiltrado.length === 0 ? (
                <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
                  <Users
                    size={34}
                    strokeWidth={2}
                    className="text-tinta-suave dark:text-noche-tinta-suave"
                  />
                  <h3 className="text-base font-semibold text-tinta dark:text-noche-tinta">
                    Sin brigadistas encontrados
                  </h3>
                  <p className="text-sm text-tinta-suave dark:text-noche-tinta-suave">
                    Ajusta tu búsqueda o aprueba solicitudes pendientes para verlas en el directorio.
                  </p>
                </article>
              ) : (
                <div className="tarjeta overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-udec-oscuro text-white">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                          Brigadista
                        </th>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                          Adscripción
                        </th>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                          Rol del Sistema
                        </th>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                          Estado
                        </th>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde dark:divide-noche-borde">
                      {directorioFiltrado.map((u) => {
                        const esPropio = u.uid === admin.uid
                        const ocupado = procesandoUid === u.uid
                        return (
                          <tr key={u.uid}>
                            <td className="px-4 py-3">
                              <span className="block text-sm font-semibold text-tinta dark:text-noche-tinta">
                                {nombreCompleto(u)}
                                {esPropio ? ' (Tú)' : ''}
                              </span>
                              <span className="text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                                {u.numero_cuenta}
                                {u.clave_personal_radio
                                  ? ` · Clave ${u.clave_personal_radio}`
                                  : ''}
                                {u.autorizado_radio ? ' · Radio' : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-tinta dark:text-noche-tinta">
                              {u.grupo_operativo === 'Ninguno'
                                ? 'Sin grupo'
                                : `Grupo ${u.grupo_operativo}`}{' '}
                              · {u.ayudantia_slot}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                aria-label={`Rol de ${nombreCompleto(u)}`}
                                value={u.rol_sistema}
                                disabled={esPropio || ocupado || u.estatus === 'Inactivo'}
                                onChange={(e) =>
                                  void manejarCambioRol(u, e.target.value as RolSistema)
                                }
                                className="campo min-h-10 w-auto py-1 text-sm"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              {u.estatus === 'Activo' ? (
                                <span className="inline-flex rounded-full bg-activo-suave px-3 py-1 text-xs font-bold text-activo dark:border dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro">
                                  ACTIVO
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-alerta-suave px-3 py-1 text-xs font-bold text-alerta dark:border dark:border-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
                                  INACTIVO
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {u.estatus === 'Activo' && !esPropio ? (
                                <button
                                  type="button"
                                  disabled={ocupado}
                                  onClick={() => {
                                    setBajaObjetivo(u)
                                    setMotivoBaja('')
                                  }}
                                  className="btn-rojo min-h-10 px-3 text-xs whitespace-nowrap"
                                >
                                  Dar de Baja (Inactivo)
                                </button>
                              ) : (
                                <span className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                                  {esPropio ? 'Sesión actual' : 'Baja aplicada'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {pestana === 'catalogos' && <CatalogosAuditoriaTab admin={admin} />}

          {pestana === 'operativos' && <OperativosPanelPage usuario={admin} />}

          {pestana === 'radio' && <RadioConsolePage usuario={admin} />}

          {pestana === 'historial' && <HistorialDualPage usuario={admin} />}

          {pestana === 'credencial' && <CredencialDigitalPage perfil={admin} />}
        </main>
      </div>
    </div>
  )
}
