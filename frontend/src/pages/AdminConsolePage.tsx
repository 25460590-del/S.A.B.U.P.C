import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Layers,
  Radio,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CatalogosAuditoriaTab } from '../components/CatalogosAuditoriaTab'
import { ExpedienteUnificadoModal } from '../components/ExpedienteUnificadoModal'
import { GruposVivosPanel } from '../components/GruposVivosPanel'
import { IndicadorAlcanceAyudantia } from '../components/IndicadorAlcanceAyudantia'
import {
  AYUDANTIAS,
  AYUDANTIAS_ACTIVAS,
  ETAPAS_BRIGADISTA,
  ROLES,
} from '../constants/catalogos'
import {
  ayudantiaJefatura,
  esAdmin,
  esAyudantiaValidaParaEtapa,
  esConfiguracionJefeAyudantia,
  etiquetaAyudantia,
  faltaAyudantiaOperativo,
  grupoDesdeEtapa,
  puedeAsignarRadio,
  subgruposDeEtapa,
} from '../lib/permisos'
import { useDirectorio } from '../context/DirectorioContext'
import {
  aprobarUsuario,
  mensajeDeError,
  nombreCompleto,
  rechazarUsuario,
  type AsignacionAlta,
} from '../services/authService'
import {
  combinarSubgruposConSierraInicial,
  escucharCatalogoSubgrupos,
  escucharSubgruposArchivados,
} from '../services/catalogosService'
import type {
  AyudantiaSlot,
  EstatusUsuario,
  EtapaBrigadista,
  RolSistema,
  Usuario,
} from '../types'

interface AdminConsolePageProps {
  admin: Usuario
  embebido?: boolean
  pestanaInicial?: 'directorio' | 'grupos' | 'pendientes' | 'catalogos'
}

type PestanaPersonal = 'directorio' | 'grupos' | 'pendientes' | 'catalogos'

function iniciales(u: Usuario): string {
  const n = (u.nombres.trim()[0] ?? '').toUpperCase()
  const a = (u.apellido_paterno.trim()[0] ?? '').toUpperCase()
  return `${n}${a}` || 'B'
}

function TarjetaPendiente({
  actor,
  usuario,
  subgruposActivos,
  alNotificar,
  alError,
}: {
  actor: Usuario
  usuario: Usuario
  subgruposActivos: string[]
  alNotificar: (msg: string) => void
  alError: (msg: string) => void
}) {
  const puedoRadio = puedeAsignarRadio(actor, usuario)
  const [etapa, setEtapa] = useState<EtapaBrigadista>('Alfa')
  const [subgrupo, setSubgrupo] = useState<string>(
    () => subgruposDeEtapa(subgruposActivos, 'Alfa')[0] ?? '',
  )
  const [ayudantia, setAyudantia] = useState<AyudantiaSlot>('Ninguna')
  const [claveRadio, setClaveRadio] = useState('')
  const [autorizadoRadio, setAutorizadoRadio] = useState(false)
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const esOperativo = etapa === 'Grupo Operativo'
  const opcionesGrupo = subgruposDeEtapa(subgruposActivos, etapa)
  const grupoEfectivo = esOperativo
    ? ''
    : opcionesGrupo.includes(subgrupo)
      ? subgrupo
      : (opcionesGrupo[0] ?? '')
  const ayudantiaInvalida = !esAyudantiaValidaParaEtapa(etapa, ayudantia)

  function manejarCambioEtapa(nueva: EtapaBrigadista) {
    setEtapa(nueva)
    if (nueva === 'Grupo Operativo') {
      setSubgrupo('')
    } else {
      const opciones = subgruposDeEtapa(subgruposActivos, nueva)
      setSubgrupo(opciones[0] ?? '')
    }
  }

  async function manejarAprobar() {
    if (ayudantiaInvalida) {
      alError('Para asignar a Grupo Operativo es obligatorio seleccionar una ayudantía.')
      return
    }
    setOcupado(true)
    alError('')
    try {
      const claveLimpia = claveRadio.trim().toUpperCase()
      const asignacion: AsignacionAlta = {
        grupo_operativo: grupoDesdeEtapa(etapa),
        ayudantia_slot: ayudantia,
        etapa,
        subgrupo: grupoEfectivo,
        ayudantia,
        ...(puedoRadio
          ? {
              autorizado_radio: autorizadoRadio,
              clave_radio: claveLimpia,
              clave_personal_radio: claveLimpia ? claveLimpia.slice(0, 10) : null,
            }
          : {}),
      }
      await aprobarUsuario(actor, usuario, asignacion)
      alNotificar(`Alta aprobada para ${nombreCompleto(usuario)}.`)
    } catch (err) {
      alError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarRechazar() {
    setOcupado(true)
    alError('')
    try {
      await rechazarUsuario(actor, usuario)
      alNotificar(`Solicitud rechazada para ${nombreCompleto(usuario)}.`)
    } catch (err) {
      alError(mensajeDeError(err))
    } finally {
      setOcupado(false)
      setConfirmandoRechazo(false)
    }
  }

  return (
    <article className="tarjeta flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-salvia text-xs font-extrabold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
            {iniciales(usuario)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
              {nombreCompleto(usuario)}
            </h3>
            <p className="text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
              Cuenta {usuario.numero_cuenta} · {usuario.nivel_academico} ({usuario.escuela_carrera})
              · {usuario.correo}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-ambar bg-ambar-suave px-2.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
          PENDIENTE
        </span>
      </div>

      <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label htmlFor={`etapa-${usuario.uid}`} className="etiqueta">
            Etapa
          </label>
          <select
            id={`etapa-${usuario.uid}`}
            value={etapa}
            onChange={(e) => manejarCambioEtapa(e.target.value as EtapaBrigadista)}
            className="campo min-h-10 text-xs"
            disabled={ocupado}
          >
            {ETAPAS_BRIGADISTA.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </div>

        {!esOperativo && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`sub-${usuario.uid}`} className="etiqueta">
              Grupo formativo
            </label>
            <select
              id={`sub-${usuario.uid}`}
              value={grupoEfectivo}
              onChange={(e) => setSubgrupo(e.target.value)}
              className="campo min-h-10 text-xs"
              disabled={ocupado}
            >
              <option value="">Sin grupo</option>
              {opcionesGrupo.map((sg) => (
                <option key={sg} value={sg}>
                  {sg}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={`ayu-${usuario.uid}`} className="etiqueta">
            {esOperativo ? 'Ayudantía (obligatoria)' : 'Ayudantía (opcional)'}
          </label>
          <select
            id={`ayu-${usuario.uid}`}
            value={ayudantia}
            onChange={(e) => setAyudantia(e.target.value as AyudantiaSlot)}
            className={`campo min-h-10 text-xs ${
              ayudantiaInvalida ? 'border-ambar dark:border-noche-ambar-texto' : ''
            }`}
            disabled={ocupado}
          >
            {esOperativo ? (
              <>
                {ayudantia === 'Ninguna' && (
                  <option value="Ninguna">Selecciona una ayudantía...</option>
                )}
                {AYUDANTIAS_ACTIVAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="Ninguna">Sin ayudantía</option>
                {AYUDANTIAS_ACTIVAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {puedoRadio && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={`clave-${usuario.uid}`} className="etiqueta">
                Clave de radio (opcional)
              </label>
              <input
                id={`clave-${usuario.uid}`}
                type="text"
                maxLength={20}
                placeholder="Ej. TESLA-205"
                value={claveRadio}
                onChange={(e) => setClaveRadio(e.target.value.toUpperCase())}
                className="campo min-h-10 text-xs font-bold uppercase tabular-nums"
                disabled={ocupado}
              />
            </div>

            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-borde bg-salvia px-2.5 dark:border-noche-borde dark:bg-noche-campo">
              <input
                type="checkbox"
                checked={autorizadoRadio}
                onChange={(e) => setAutorizadoRadio(e.target.checked)}
                disabled={ocupado}
                className="h-4 w-4 rounded accent-udec"
              />
              <span className="text-xs font-semibold text-udec-oscuro dark:text-noche-tinta">
                Radio
              </span>
            </label>
          </>
        )}
      </div>

      {ayudantiaInvalida && (
        <p className="text-[11px] font-semibold text-ambar-texto dark:text-noche-ambar-texto">
          Selecciona una ayudantía para aprobar el ingreso directo a Grupo Operativo.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {confirmandoRechazo ? (
          <>
            <span className="mr-auto text-xs font-semibold text-alerta dark:text-noche-rojo-texto">
              ¿Confirmas rechazar esta solicitud?
            </span>
            <button
              type="button"
              onClick={() => setConfirmandoRechazo(false)}
              disabled={ocupado}
              className="btn-salvia min-h-9 px-3 text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={manejarRechazar}
              disabled={ocupado}
              className="btn-rojo min-h-9 px-3.5 text-xs"
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
              className="btn min-h-9 border border-alerta bg-tarjeta px-3.5 text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={manejarAprobar}
              disabled={ocupado || ayudantiaInvalida}
              className="btn-verde min-h-9 px-4 text-xs disabled:opacity-55"
            >
              <UserCheck size={15} strokeWidth={2} />
              <span>{ocupado ? 'Aprobando...' : 'Aprobar Alta'}</span>
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export function AdminConsolePage({
  admin,
  pestanaInicial = 'directorio',
}: AdminConsolePageProps) {
  const soyAdmin = esAdmin(admin)
  const ayJefe = ayudantiaJefatura(admin)
  const puedeVerPendientes = soyAdmin

  const [pestana, setPestana] = useState<PestanaPersonal>(
    pestanaInicial === 'pendientes' && !puedeVerPendientes ? 'directorio' : pestanaInicial,
  )
  const { usuarios, cargando, error: errorDirectorio } = useDirectorio()
  const [subgruposActivosRaw, setSubgruposActivosRaw] = useState<string[]>([])
  const [subgruposArchivados, setSubgruposArchivados] = useState<string[]>([])

  // Filtros 100% en cliente (cero lecturas extra en Firestore)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState<'Todos' | EstatusUsuario>('Todos')
  const [filtroEtapa, setFiltroEtapa] = useState<'Todas' | EtapaBrigadista>('Todas')
  const [filtroSubgrupo, setFiltroSubgrupo] = useState('TODOS')
  const [filtroAyudantia, setFiltroAyudantia] = useState<'Todas' | AyudantiaSlot>('Todas')
  const [filtroRol, setFiltroRol] = useState<'Todos' | RolSistema>('Todos')

  // Expediente Unificado abierto bajo demanda
  const [expedienteUid, setExpedienteUid] = useState<string | null>(null)

  const [errorLocal, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const error = errorLocal ?? errorDirectorio

  useEffect(() => {
    const cSub = escucharCatalogoSubgrupos(setSubgruposActivosRaw)
    const cArch = escucharSubgruposArchivados(setSubgruposArchivados, () => undefined)
    return () => {
      cSub()
      cArch()
    }
  }, [])

  const subgruposActivos = useMemo(
    () => combinarSubgruposConSierraInicial(subgruposActivosRaw, subgruposArchivados),
    [subgruposActivosRaw, subgruposArchivados],
  )

  const pendientes = useMemo(() => usuarios.filter((u) => u.estatus === 'Pendiente'), [usuarios])

  const subgruposEnDirectorio = useMemo(() => {
    const set = new Set<string>(subgruposActivos)
    for (const u of usuarios) {
      if (u.subgrupo) set.add(u.subgrupo)
    }
    const lista = Array.from(set).sort((a, b) => a.localeCompare(b, 'es-MX'))
    if (filtroEtapa === 'Todas') return lista
    return subgruposDeEtapa(lista, filtroEtapa)
  }, [usuarios, subgruposActivos, filtroEtapa])

  const directorioFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      if (filtroEstatus !== 'Todos' && u.estatus !== filtroEstatus) return false
      if (filtroEtapa !== 'Todas' && u.etapa !== filtroEtapa) return false
      if (filtroSubgrupo !== 'TODOS' && (u.subgrupo || '') !== filtroSubgrupo) return false
      if (filtroAyudantia !== 'Todas' && u.ayudantia !== filtroAyudantia) return false
      if (filtroRol !== 'Todos' && u.rol_sistema !== filtroRol) return false
      if (!q) return true
      return (
        nombreCompleto(u).toLowerCase().includes(q) ||
        u.numero_cuenta.toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q) ||
        (u.clave_radio || u.clave_personal_radio || '').toLowerCase().includes(q) ||
        (u.subgrupo || '').toLowerCase().includes(q) ||
        u.etapa.toLowerCase().includes(q)
      )
    })
  }, [usuarios, busqueda, filtroEstatus, filtroEtapa, filtroSubgrupo, filtroAyudantia, filtroRol])

  const usuarioExpediente = usuarios.find((u) => u.uid === expedienteUid) ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera contextual según rol */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-tinta dark:text-noche-tinta">
            {soyAdmin
              ? 'Administración de Personal'
              : ayJefe
                ? `Jefatura de Ayudantía · ${ayJefe}`
                : 'Mi Personal a Cargo'}
          </h2>
          {soyAdmin ? (
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              Directorio completo ({usuarios.length} registros) · Asignar rol Encargado en Grupo
              Operativo con ayudantía activa automáticamente el mando como Jefe de Ayudantía.
            </p>
          ) : ayJefe ? (
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              Padrón operativo de {ayJefe} ({usuarios.length} integrante
              {usuarios.length === 1 ? '' : 's'}) · Consulta de Ficha de Emergencia, material propio
              y edición operativa.
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Grupos bajo tu mando:
              </span>
              {(admin.grupos_a_cargo ?? []).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-salvia px-2.5 py-0.5 text-[11px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pestañas internas */}
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-borde bg-superficie-suave p-1 dark:border-noche-borde dark:bg-noche-campo">
          <button
            type="button"
            onClick={() => setPestana('directorio')}
            className={`min-h-9 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-colors ${
              pestana === 'directorio'
                ? 'bg-udec text-white'
                : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
            }`}
          >
            Directorio ({usuarios.length})
          </button>
          <button
            type="button"
            onClick={() => setPestana('grupos')}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
              pestana === 'grupos'
                ? 'bg-udec text-white'
                : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
            }`}
          >
            <Layers size={13} strokeWidth={2} />
            <span>Grupos</span>
          </button>
          {puedeVerPendientes && (
            <button
              type="button"
              onClick={() => setPestana('pendientes')}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                pestana === 'pendientes'
                  ? 'bg-udec text-white'
                  : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <span>Pendientes</span>
              {pendientes.length > 0 && (
                <span className="rounded-full bg-naranja px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-tinta">
                  {pendientes.length}
                </span>
              )}
            </button>
          )}
          {soyAdmin && (
            <button
              type="button"
              onClick={() => setPestana('catalogos')}
              className={`min-h-9 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-colors ${
                pestana === 'catalogos'
                  ? 'bg-udec text-white'
                  : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              Catálogos y Auditoría
            </button>
          )}
        </div>
      </div>

      {ayJefe && (
        <IndicadorAlcanceAyudantia
          ayudantia={ayJefe}
          descripcion={`Estás viendo únicamente a los integrantes que pertenecen a la ayudantía ${ayJefe}.`}
        />
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* PESTAÑA: GRUPOS VIVOS Y PROMOCIÓN EN LOTE */}
      {pestana === 'grupos' && (
        <GruposVivosPanel
          actor={admin}
          usuarios={usuarios}
          subgruposActivos={subgruposActivos}
          subgruposArchivados={subgruposArchivados}
          alAbrirExpediente={(uid) => setExpedienteUid(uid)}
          alNotificar={(msg) => setAviso(msg)}
          alError={(msg) => setError(msg || null)}
        />
      )}

      {/* PESTAÑA 1: DIRECTORIO DE ALTA DENSIDAD (150 -> 300 personas, sin fotos en listado) */}
      {pestana === 'directorio' && (
        <section aria-label="Directorio de Personal" className="flex flex-col gap-3">
          {/* Barra de búsqueda + chips/selects 100% en cliente */}
          <div className="tarjeta flex flex-col gap-2.5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-52 flex-1">
                <Search
                  size={15}
                  strokeWidth={2}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
                />
                <input
                  type="search"
                  placeholder="Buscar por nombre, cuenta, correo o clave de radio..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="campo min-h-9 pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(['Todos', 'Activo', 'Pendiente', 'Inactivo'] as const).map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => setFiltroEstatus(est)}
                    className={`min-h-8 cursor-pointer rounded-full px-2.5 text-[11px] font-semibold ${
                      filtroEstatus === est
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                    }`}
                  >
                    {est}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {(['Todas', ...ETAPAS_BRIGADISTA] as const).map((et) => (
                  <button
                    key={et}
                    type="button"
                    onClick={() => {
                      setFiltroEtapa(et)
                      setFiltroSubgrupo('TODOS')
                    }}
                    className={`min-h-8 cursor-pointer rounded-md px-2.5 text-[11px] font-semibold ${
                      filtroEtapa === et
                        ? 'bg-udec-oscuro text-white'
                        : 'border border-borde bg-fondo text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave'
                    }`}
                  >
                    {et === 'Todas' ? 'Todas las etapas' : et}
                  </button>
                ))}
              </div>

              {filtroEtapa !== 'Grupo Operativo' && (
                <select
                  aria-label="Filtrar por grupo"
                  value={filtroSubgrupo}
                  onChange={(e) => setFiltroSubgrupo(e.target.value)}
                  className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
                >
                  <option value="TODOS">Todos los grupos</option>
                  {subgruposEnDirectorio.map((sg) => (
                    <option key={sg} value={sg}>
                      {sg}
                    </option>
                  ))}
                </select>
              )}

              {!ayJefe && (
                <select
                  aria-label="Filtrar por ayudantía"
                  value={filtroAyudantia}
                  onChange={(e) => setFiltroAyudantia(e.target.value as 'Todas' | AyudantiaSlot)}
                  className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
                >
                  <option value="Todas">Todas las ayudantías</option>
                  {AYUDANTIAS.map((ay) => (
                    <option key={ay} value={ay}>
                      {etiquetaAyudantia(ay)}
                    </option>
                  ))}
                </select>
              )}

              {(soyAdmin || Boolean(ayJefe)) && (
                <select
                  aria-label="Filtrar por rol"
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value as 'Todos' | RolSistema)}
                  className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
                >
                  <option value="Todos">Todos los roles</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}

              <span className="ml-auto text-[11px] font-semibold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                {directorioFiltrado.length} resultado{directorioFiltrado.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Listado denso (avatares con iniciales, cero descargas de fotos_perfiles) */}
          {cargando ? (
            <div className="tarjeta flex flex-col gap-2 p-4">
              <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
              <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
              <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
            </div>
          ) : directorioFiltrado.length === 0 ? (
            <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
              <Users size={30} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
              <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                Sin integrantes encontrados
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Ajusta los filtros de etapa, grupo, ayudantía o búsqueda.
              </p>
            </article>
          ) : (
            <article className="tarjeta overflow-hidden">
              {/* Móvil (< md): filas limpias de 2 líneas */}
              <div className="divide-y divide-borde md:hidden dark:divide-noche-borde">
                {directorioFiltrado.map((u) => {
                  const clave = u.clave_radio || u.clave_personal_radio || ''
                  const sinAyuOp = faltaAyudantiaOperativo(u)
                  return (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => setExpedienteUid(u.uid)}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left hover:bg-superficie-suave dark:hover:bg-noche-campo/60"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salvia text-[11px] font-extrabold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                        {iniciales(u)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                            {nombreCompleto(u)}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              u.estatus === 'Activo'
                                ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                                : u.estatus === 'Pendiente'
                                  ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                  : 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                            }`}
                          >
                            {u.estatus}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          {u.etapa}
                          {u.subgrupo ? ` · ${u.subgrupo}` : ''} · {etiquetaAyudantia(u.ayudantia)} ·{' '}
                          {esConfiguracionJefeAyudantia(u.rol_sistema, u.etapa, u.ayudantia)
                            ? `Jefe de Ayudantía (${u.ayudantia})`
                            : u.rol_sistema}
                          {clave ? ` · ${clave}` : ''}
                        </p>
                        {sinAyuOp && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ambar-suave px-2 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                            <AlertTriangle size={10} strokeWidth={2} />
                            <span>Falta asignar ayudantía</span>
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Escritorio (md+): tabla compacta */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-udec-oscuro text-white">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Integrante
                      </th>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Etapa / Grupo
                      </th>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Ayudantía
                      </th>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Rol
                      </th>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Radio
                      </th>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Estatus
                      </th>
                      <th scope="col" className="px-3 py-2 text-right text-[11px] font-semibold">
                        Expediente
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde dark:divide-noche-borde">
                    {directorioFiltrado.map((u) => {
                      const clave = u.clave_radio || u.clave_personal_radio || ''
                      const sinAyuOp = faltaAyudantiaOperativo(u)
                      return (
                        <tr
                          key={u.uid}
                          className="hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salvia text-[11px] font-extrabold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                                {iniciales(u)}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                                  {nombreCompleto(u)}
                                  {u.uid === admin.uid ? ' (Tú)' : ''}
                                </span>
                                <span className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                                  {u.numero_cuenta}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-tinta dark:text-noche-tinta">
                            <span className="font-semibold">{u.etapa}</span>
                            {u.subgrupo && (
                              <span className="ml-1 rounded bg-salvia px-1.5 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                                {u.subgrupo}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                            {sinAyuOp ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-ambar-suave px-2 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                                <AlertTriangle size={11} strokeWidth={2} />
                                <span>Falta asignar ayudantía</span>
                              </span>
                            ) : (
                              etiquetaAyudantia(u.ayudantia)
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold text-tinta dark:text-noche-tinta">
                            <div className="flex flex-wrap items-center gap-1">
                              <span>{u.rol_sistema}</span>
                              {esConfiguracionJefeAyudantia(u.rol_sistema, u.etapa, u.ayudantia) && (
                                <span className="rounded-full bg-salvia px-2 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                                  Jefe de Ayudantía
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                            {clave || u.autorizado_radio ? (
                              <span className="inline-flex items-center gap-1 rounded bg-superficie-suave px-2 py-0.5 text-[11px] font-bold tabular-nums text-udec dark:bg-noche-campo dark:text-activo-claro">
                                <Radio size={11} strokeWidth={2} />
                                <span>{clave || 'Autorizado'}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                u.estatus === 'Activo'
                                  ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                                  : u.estatus === 'Pendiente'
                                    ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                    : 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                              }`}
                            >
                              {u.estatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setExpedienteUid(u.uid)}
                              className="btn-salvia min-h-8 px-2.5 text-[11px]"
                            >
                              <Eye size={13} strokeWidth={2} />
                              <span>Abrir</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          )}
        </section>
      )}

      {/* PESTAÑA 2: SOLICITUDES PENDIENTES DE APROBACIÓN */}
      {pestana === 'pendientes' && puedeVerPendientes && (
        <section aria-label="Solicitudes pendientes" className="flex flex-col gap-3">
          {pendientes.length === 0 ? (
            <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
              <ShieldCheck size={34} strokeWidth={2} className="text-activo dark:text-activo-claro" />
              <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                Sin solicitudes pendientes
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Cuando un nuevo brigadista complete su registro, aparecerá aquí para asignar etapa,
                subgrupo y ayudantía.
              </p>
            </article>
          ) : (
            pendientes.map((u) => (
              <TarjetaPendiente
                key={u.uid}
                actor={admin}
                usuario={u}
                subgruposActivos={subgruposActivos}
                alNotificar={(msg) => setAviso(msg)}
                alError={(msg) => setError(msg || null)}
              />
            ))
          )}
        </section>
      )}

      {/* PESTAÑA 3: CATÁLOGOS Y AUDITORÍA (EXCLUSIVO ADMIN) */}
      {pestana === 'catalogos' && soyAdmin && <CatalogosAuditoriaTab admin={admin} />}

      {/* EXPEDIENTE UNIFICADO (FOTO Y SUBCONSULTAS BAJO DEMANDA) */}
      {usuarioExpediente && (
        <ExpedienteUnificadoModal
          key={usuarioExpediente.uid}
          actor={admin}
          usuario={usuarioExpediente}
          subgruposActivos={subgruposActivos}
          alCerrar={() => setExpedienteUid(null)}
        />
      )}
    </div>
  )
}
