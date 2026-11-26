import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileWarning,
  Mail,
  Phone,
  Radio,
  Save,
  User as UserIcon,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { AYUDANTIAS, ETAPAS_BRIGADISTA, ROLES } from '../constants/catalogos'
import { normalizarNombrePropio } from '../lib/nombres'
import {
  esAdmin,
  esEncargadoAP,
  puedeCambiarEstatusBrigadista,
  puedeGestionarBrigadista,
} from '../lib/permisos'
import { escucharMisAsistencias } from '../services/asistenciasService'
import {
  guardarEdicionExpediente,
  mensajeDeError,
  nombreCompleto,
} from '../services/authService'
import {
  escucharActasMaterialDeUsuario,
  obtenerEvidenciaEquipo,
} from '../services/equiposService'
import { escucharFotoPerfil } from '../services/fotosService'
import {
  escucharIncidenciasPersonalSegunRol,
  escucharIncidenciasPorUsuario,
} from '../services/incidenciasPersonalService'
import type {
  AsistenciaPersonal,
  AyudantiaSlot,
  EquipoTurno,
  EstatusUsuario,
  EtapaBrigadista,
  IncidenciaPersonal,
  RolSistema,
  Usuario,
} from '../types'

interface ExpedienteUnificadoModalProps {
  actor: Usuario
  usuario: Usuario
  subgruposActivos: string[]
  alCerrar: () => void
}

type PestanaExpediente = 'perfil' | 'asistencias' | 'incidencias'

function obtenerIniciales(u: Usuario): string {
  const n = (u.nombres.trim()[0] ?? '').toUpperCase()
  const a = (u.apellido_paterno.trim()[0] ?? '').toUpperCase()
  return `${n}${a}` || 'B'
}

function formatearFecha(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ExpedienteUnificadoModal({
  actor,
  usuario,
  subgruposActivos,
  alCerrar,
}: ExpedienteUnificadoModalProps) {
  const soyAdmin = esAdmin(actor)
  const soyAP = esEncargadoAP(actor)
  const puedoEditar = puedeGestionarBrigadista(actor, usuario)
  const puedoEstatus = puedeCambiarEstatusBrigadista(actor, usuario)

  const [pestana, setPestana] = useState<PestanaExpediente>('perfil')

  // Carga estrictamente bajo demanda de la foto WebP (solo si tiene_foto === true)
  const [fotoBase64, setFotoBase64] = useState<string | null>(null)

  // Datos cargados bajo demanda por pestaña
  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([])
  const [cargandoAsis, setCargandoAsis] = useState(false)
  const [incidenciasPers, setIncidenciasPers] = useState<IncidenciaPersonal[]>([])
  const [actasMaterial, setActasMaterial] = useState<EquipoTurno[]>([])
  const [evidenciaAbierta, setEvidenciaAbierta] = useState<{
    titulo: string
    imagen: string
  } | null>(null)
  const [cargandoEvidenciaId, setCargandoEvidenciaId] = useState<string | null>(null)

  // Estado del formulario de edición post-incorporación
  const [etapa, setEtapa] = useState<EtapaBrigadista>(usuario.etapa)
  const [subgrupo, setSubgrupo] = useState<string>(usuario.subgrupo || '')
  const [ayudantia, setAyudantia] = useState<AyudantiaSlot>(usuario.ayudantia)
  const [estatus, setEstatus] = useState<EstatusUsuario>(usuario.estatus)
  const [rol, setRol] = useState<RolSistema>(usuario.rol_sistema)
  const [gruposACargo, setGruposACargo] = useState<string[]>(usuario.grupos_a_cargo ?? [])
  const [autorizadoRadio, setAutorizadoRadio] = useState<boolean>(usuario.autorizado_radio)
  const [claveRadio, setClaveRadio] = useState<string>(
    usuario.clave_radio || usuario.clave_personal_radio || '',
  )

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!usuario.tiene_foto) return
    const cancelar = escucharFotoPerfil(usuario.uid, (foto) => {
      setFotoBase64(foto?.imagen_webp_base64 ?? null)
    })
    return cancelar
  }, [usuario.uid, usuario.tiene_foto])

  useEffect(() => {
    if (pestana !== 'asistencias') return
    const cancelar = escucharMisAsistencias(
      usuario.uid,
      (lista) => {
        setAsistencias(lista)
        setCargandoAsis(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargandoAsis(false)
      },
    )
    return cancelar
  }, [pestana, usuario.uid])

  useEffect(() => {
    if (pestana !== 'incidencias') return
    const manejarErr = (err: Parameters<typeof mensajeDeError>[0]) =>
      setError(mensajeDeError(err))
    const cMat = escucharActasMaterialDeUsuario(usuario.uid, setActasMaterial, manejarErr)
    const cPers =
      soyAdmin || soyAP
        ? escucharIncidenciasPorUsuario(usuario.uid, setIncidenciasPers, manejarErr)
        : escucharIncidenciasPersonalSegunRol(
            actor,
            (lista) => setIncidenciasPers(lista.filter((i) => i.usuario_uid === usuario.uid)),
            manejarErr,
          )
    return () => {
      cMat()
      cPers()
    }
  }, [pestana, usuario.uid, soyAdmin, soyAP, actor])

  const opcionesSubgrupo = Array.from(
    new Set([
      ...subgruposActivos,
      ...(usuario.subgrupo && !subgruposActivos.includes(usuario.subgrupo)
        ? [usuario.subgrupo]
        : []),
    ]),
  )

  const opcionesGruposACargo = Array.from(
    new Set([
      ...subgruposActivos,
      ...AYUDANTIAS.filter((a) => a !== 'Ninguna'),
      ...ETAPAS_BRIGADISTA,
      ...gruposACargo,
    ]),
  )

  const totalHoras = asistencias.reduce(
    (acc, a) => acc + (typeof a.horas_totales === 'number' ? a.horas_totales : 0),
    0,
  )

  function alternarGrupoACargo(valor: string) {
    setGruposACargo((prev) =>
      prev.includes(valor) ? prev.filter((x) => x !== valor) : [...prev, valor],
    )
  }

  async function manejarVerEvidencia(eq: EquipoTurno) {
    const evId = eq.acta_incidencia?.evidencia_id
    if (!evId) return
    setCargandoEvidenciaId(eq.id)
    setError(null)
    try {
      const ev = await obtenerEvidenciaEquipo(evId)
      if (!ev) {
        setError('No se encontró la evidencia fotográfica solicitada.')
      } else {
        setEvidenciaAbierta({
          titulo: `${eq.nombre_articulo} · ${eq.usuario_nombre}`,
          imagen: ev.imagen_webp_base64,
        })
      }
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoEvidenciaId(null)
    }
  }

  async function manejarGuardar(e: FormEvent) {
    e.preventDefault()
    if (!puedoEditar) return
    setGuardando(true)
    setError(null)
    setAviso(null)
    try {
      await guardarEdicionExpediente(actor, usuario, {
        etapa,
        subgrupo: etapa === 'Grupo Operativo' ? '' : subgrupo,
        ayudantia,
        estatus: puedoEstatus ? estatus : undefined,
        rol_sistema: soyAdmin ? rol : undefined,
        grupos_a_cargo: soyAdmin ? gruposACargo : undefined,
        autorizado_radio: soyAdmin ? autorizadoRadio : undefined,
        clave_radio: soyAdmin ? claveRadio : undefined,
      })
      setAviso('Expediente actualizado y registrado en la bitácora de auditoría.')
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Expediente de ${nombreCompleto(usuario)}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <article className="tarjeta flex h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-xl">
        {/* Cabecera del expediente */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-3.5 text-white">
          <div className="flex min-w-0 items-center gap-3">
            {fotoBase64 ? (
              <img
                src={fotoBase64}
                alt={nombreCompleto(usuario)}
                className="h-12 w-12 shrink-0 rounded-full border-2 border-white/40 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-udec-oscuro text-sm font-extrabold text-white">
                {obtenerIniciales(usuario)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold">{nombreCompleto(usuario)}</h3>
              <p className="truncate text-xs text-white/85 tabular-nums">
                Cuenta {usuario.numero_cuenta} · {usuario.rol_sistema} · {usuario.estatus}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar expediente"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {/* 3 Pestañas del Expediente Unificado */}
        <div className="shrink-0 border-b border-borde bg-superficie-suave p-2 dark:border-noche-borde dark:bg-noche-campo">
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setPestana('perfil')}
              className={`flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${
                pestana === 'perfil'
                  ? 'bg-udec text-white'
                  : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <UserIcon size={14} strokeWidth={2} />
              <span className="truncate">Perfil y Adscripción</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCargandoAsis(true)
                setPestana('asistencias')
              }}
              className={`flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${
                pestana === 'asistencias'
                  ? 'bg-udec text-white'
                  : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Clock size={14} strokeWidth={2} />
              <span className="truncate">Asistencias y Horas</span>
            </button>
            <button
              type="button"
              onClick={() => setPestana('incidencias')}
              className={`flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${
                pestana === 'incidencias'
                  ? 'bg-udec text-white'
                  : 'text-tinta-suave hover:bg-tarjeta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <ClipboardList size={14} strokeWidth={2} />
              <span className="truncate">Incidencias</span>
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aviso && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-2.5 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
            >
              <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          {/* PESTAÑA A: PERFIL Y ADSCRIPCIÓN */}
          {pestana === 'perfil' && (
            <div className="flex flex-col gap-4">
              {/* Datos generales de contacto y académico */}
              <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-borde bg-superficie-suave p-3.5 text-xs sm:grid-cols-2 dark:border-noche-borde dark:bg-noche-campo">
                <div className="flex items-center gap-2 text-tinta dark:text-noche-tinta">
                  <Mail size={14} strokeWidth={2} className="shrink-0 text-udec dark:text-activo-claro" />
                  <span className="truncate">{usuario.correo}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums text-tinta dark:text-noche-tinta">
                  <Phone size={14} strokeWidth={2} className="shrink-0 text-udec dark:text-activo-claro" />
                  <span>
                    {usuario.celular}
                    {usuario.celular_con_whatsapp ? ' (WhatsApp)' : ''}
                  </span>
                </div>
                <div className="sm:col-span-2 text-tinta-suave dark:text-noche-tinta-suave">
                  <strong className="text-tinta dark:text-noche-tinta">Académico:</strong>{' '}
                  {usuario.nivel_academico} · {usuario.escuela_carrera}
                </div>
              </div>

              {/* Bloque Ficha de Emergencia (contacto en 3 campos + aviso legal discreto) */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-borde bg-superficie-suave p-3.5 text-xs dark:border-noche-borde dark:bg-noche-campo">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold tracking-wider uppercase text-tinta dark:text-noche-tinta">
                    Ficha de Emergencia
                  </h4>
                  <span className="rounded-full bg-alerta-suave px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
                    Sangre: {usuario.tipo_sangre}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="text-tinta-suave dark:text-noche-tinta-suave">
                    <strong className="text-tinta dark:text-noche-tinta">Alergias:</strong>{' '}
                    {usuario.alergias || 'Ninguna'}
                  </div>
                  <div className="text-tinta-suave dark:text-noche-tinta-suave">
                    <strong className="text-tinta dark:text-noche-tinta">
                      Condiciones / medicamentos:
                    </strong>{' '}
                    {usuario.padecimientos_medicamentos || 'Ninguno'}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 border-t border-borde pt-2.5 sm:grid-cols-3 dark:border-noche-borde">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-tinta-suave dark:text-noche-tinta-suave">
                      Contacto de emergencia
                    </span>
                    <span className="font-bold text-tinta dark:text-noche-tinta">
                      {normalizarNombrePropio(usuario.contacto_emergencia_nombre)}
                    </span>
                  </div>
                  {usuario.contacto_emergencia_parentesco && (
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-tinta-suave dark:text-noche-tinta-suave">
                        Parentesco
                      </span>
                      <span className="font-semibold text-tinta dark:text-noche-tinta">
                        {usuario.contacto_emergencia_parentesco}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-tinta-suave dark:text-noche-tinta-suave">
                      Teléfono de emergencia
                    </span>
                    <span className="font-bold tabular-nums text-tinta dark:text-noche-tinta">
                      {usuario.contacto_emergencia_telefono}
                    </span>
                  </div>
                </div>

                <p className="border-t border-borde pt-2 text-[11px] leading-snug text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave">
                  Información declarada voluntariamente por el integrante únicamente como referencia
                  en caso de emergencia.
                </p>
              </div>

              {/* Formulario de edición post-incorporación */}
              <form onSubmit={manejarGuardar} className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold tracking-wider uppercase text-tinta-suave dark:text-noche-tinta-suave">
                    Adscripción operativa y permisos
                  </h4>
                  {!puedoEditar && (
                    <span className="rounded bg-superficie-suave px-2 py-0.5 text-[11px] font-semibold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                      Solo lectura
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="exp-etapa" className="etiqueta">
                      Etapa
                    </label>
                    <select
                      id="exp-etapa"
                      value={etapa}
                      disabled={!puedoEditar || guardando}
                      onChange={(e) => {
                        const nueva = e.target.value as EtapaBrigadista
                        setEtapa(nueva)
                        if (nueva === 'Grupo Operativo') setSubgrupo('')
                      }}
                      className="campo min-h-10 text-xs"
                    >
                      {ETAPAS_BRIGADISTA.map((et) => (
                        <option key={et} value={et}>
                          {et}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="exp-subgrupo" className="etiqueta">
                      Subgrupo
                    </label>
                    <select
                      id="exp-subgrupo"
                      value={etapa === 'Grupo Operativo' ? '' : subgrupo}
                      disabled={!puedoEditar || guardando || etapa === 'Grupo Operativo'}
                      onChange={(e) => setSubgrupo(e.target.value)}
                      className="campo min-h-10 text-xs"
                    >
                      <option value="">
                        {etapa === 'Grupo Operativo' ? 'No aplica' : 'Sin subgrupo'}
                      </option>
                      {opcionesSubgrupo.map((sg) => (
                        <option key={sg} value={sg}>
                          {sg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="exp-ayudantia" className="etiqueta">
                      Ayudantía
                    </label>
                    <select
                      id="exp-ayudantia"
                      value={ayudantia}
                      disabled={!puedoEditar || guardando}
                      onChange={(e) => setAyudantia(e.target.value as AyudantiaSlot)}
                      className="campo min-h-10 text-xs"
                    >
                      {AYUDANTIAS.map((ay) => (
                        <option key={ay} value={ay}>
                          {ay}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="exp-estatus" className="etiqueta">
                      Estatus de cuenta
                    </label>
                    <select
                      id="exp-estatus"
                      value={estatus}
                      disabled={!puedoEstatus || guardando || usuario.uid === actor.uid}
                      onChange={(e) => setEstatus(e.target.value as EstatusUsuario)}
                      className="campo min-h-10 text-xs font-semibold"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>

                {/* Controles exclusivos de Administrador: Rol, Grupos a cargo y Radio */}
                <div className="grid grid-cols-1 gap-3 border-t border-borde pt-3 sm:grid-cols-2 dark:border-noche-borde">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="exp-rol" className="etiqueta">
                      Rol del sistema
                    </label>
                    <select
                      id="exp-rol"
                      value={rol}
                      disabled={!soyAdmin || guardando || usuario.uid === actor.uid}
                      onChange={(e) => setRol(e.target.value as RolSistema)}
                      className="campo min-h-10 text-xs font-semibold"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="exp-radio" className="etiqueta">
                      Clave de Radio
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="exp-radio"
                        type="text"
                        maxLength={20}
                        disabled={!soyAdmin || guardando}
                        placeholder="Sin clave"
                        value={claveRadio}
                        onChange={(e) => setClaveRadio(e.target.value.toUpperCase())}
                        className="campo min-h-10 flex-1 text-xs font-bold uppercase tabular-nums"
                      />
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-borde bg-fondo px-2.5 text-xs font-semibold text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta">
                        <input
                          type="checkbox"
                          disabled={!soyAdmin || guardando}
                          checked={autorizadoRadio}
                          onChange={(e) => setAutorizadoRadio(e.target.checked)}
                          className="h-4 w-4 rounded accent-udec"
                        />
                        <Radio size={13} strokeWidth={2} />
                        <span>Radio</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Selector múltiple de grupos_a_cargo (para Encargado / Admin, editable solo por Admin) */}
                {(rol === 'Encargado' || gruposACargo.length > 0) && (
                  <div className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie-suave p-3 dark:border-noche-borde dark:bg-noche-campo">
                    <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                      Grupos o ayudantías a cargo
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {opcionesGruposACargo.map((item) => {
                        const seleccionado = gruposACargo.includes(item)
                        return (
                          <button
                            key={item}
                            type="button"
                            disabled={!soyAdmin || guardando}
                            onClick={() => alternarGrupoACargo(item)}
                            className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-default ${
                              seleccionado
                                ? 'bg-udec text-white'
                                : 'border border-borde bg-tarjeta text-tinta-suave hover:border-udec dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {puedoEditar && (
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={alCerrar} className="btn-salvia min-h-10 text-xs">
                      Cerrar
                    </button>
                    <button type="submit" disabled={guardando} className="btn-verde min-h-10 px-4 text-xs">
                      <Save size={15} strokeWidth={2} />
                      <span>{guardando ? 'Guardando...' : 'Guardar cambios'}</span>
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* PESTAÑA B: ASISTENCIAS Y HORAS */}
          {pestana === 'asistencias' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borde bg-salvia/70 p-3 dark:border-noche-borde dark:bg-noche-campo">
                <div>
                  <p className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Total acumulado en plataforma
                  </p>
                  <p className="text-xl font-extrabold tabular-nums text-udec dark:text-activo-claro">
                    {totalHoras.toFixed(2)} horas
                  </p>
                </div>
                <span className="rounded-full bg-tarjeta px-3 py-1 text-xs font-bold tabular-nums text-tinta dark:bg-noche-tarjeta dark:text-noche-tinta">
                  {asistencias.length} operativo{asistencias.length === 1 ? '' : 's'}
                </span>
              </div>

              {cargandoAsis ? (
                <div className="h-20 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
              ) : asistencias.length === 0 ? (
                <p className="py-6 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Sin asistencias registradas para este integrante.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-borde dark:border-noche-borde">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-udec-oscuro text-white">
                      <tr>
                        <th className="px-3 py-2 text-[11px] font-semibold">Operativo</th>
                        <th className="px-2.5 py-2 text-[11px] font-semibold">Entrada</th>
                        <th className="px-2.5 py-2 text-[11px] font-semibold">Salida</th>
                        <th className="px-2.5 py-2 text-[11px] font-semibold">Rol</th>
                        <th className="px-2.5 py-2 text-right text-[11px] font-semibold">Horas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde dark:divide-noche-borde">
                      {asistencias.map((a) => (
                        <tr key={a.id} className="text-xs">
                          <td className="px-3 py-1.5 font-semibold text-tinta dark:text-noche-tinta">
                            {a.operativo_nombre}
                          </td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                            {formatearFecha(a.hora_entrada?.toMillis())}
                          </td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                            {a.hora_salida ? formatearFecha(a.hora_salida.toMillis()) : 'En turno'}
                          </td>
                          <td className="px-2.5 py-1.5 text-tinta-suave dark:text-noche-tinta-suave">
                            {a.rol_en_turno}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-bold tabular-nums text-tinta dark:text-noche-tinta">
                            {a.horas_totales !== null ? `${a.horas_totales} h` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA C: INCIDENCIAS (PERSONAL + ACTAS DE MATERIAL) */}
          {pestana === 'incidencias' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold tracking-wider uppercase text-tinta-suave dark:text-noche-tinta-suave">
                  Incidencias de Personal ({incidenciasPers.length})
                </h4>
                {incidenciasPers.length === 0 ? (
                  <p className="rounded-lg border border-borde bg-superficie-suave py-4 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                    Sin incidencias de personal registradas.
                  </p>
                ) : (
                  <div className="divide-y divide-borde rounded-xl border border-borde dark:divide-noche-borde dark:border-noche-borde">
                    {incidenciasPers.map((inc) => (
                      <div key={inc.id} className="flex flex-col gap-1 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-salvia px-2 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                              {inc.tipo}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                inc.gravedad === 'Alta'
                                  ? 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                                  : inc.gravedad === 'Media'
                                    ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                    : 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                              }`}
                            >
                              {inc.gravedad}
                            </span>
                          </div>
                          <span className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                            {formatearFecha(inc.creado_en?.toMillis())}
                          </span>
                        </div>
                        <p className="font-medium text-tinta dark:text-noche-tinta">
                          {inc.descripcion}
                        </p>
                        <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          Registrado por: {inc.creado_por_nombre}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold tracking-wider uppercase text-tinta-suave dark:text-noche-tinta-suave">
                  Actas de Material BUPC ({actasMaterial.length})
                </h4>
                {actasMaterial.length === 0 ? (
                  <p className="rounded-lg border border-borde bg-superficie-suave py-4 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                    Sin actas de incidencia de material.
                  </p>
                ) : (
                  <div className="divide-y divide-borde rounded-xl border border-borde dark:divide-noche-borde dark:border-noche-borde">
                    {actasMaterial.map((eq) => (
                      <div key={eq.id} className="flex flex-col gap-1.5 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-bold text-tinta dark:text-noche-tinta">
                            <FileWarning
                              size={14}
                              strokeWidth={2}
                              className="text-alerta dark:text-noche-rojo-texto"
                            />
                            <span>
                              {eq.nombre_articulo}
                              {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                            </span>
                          </span>
                          <span className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                            {formatearFecha(eq.actualizado_en?.toMillis())}
                          </span>
                        </div>
                        <p className="text-tinta dark:text-noche-tinta">
                          {eq.acta_incidencia?.motivo}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                            Por: {eq.acta_incidencia?.registrado_por_nombre ?? 'Encargado'}
                          </span>
                          {eq.acta_incidencia?.evidencia_id && (
                            <button
                              type="button"
                              disabled={cargandoEvidenciaId === eq.id}
                              onClick={() => void manejarVerEvidencia(eq)}
                              className="btn-salvia min-h-8 px-2.5 text-[11px]"
                            >
                              <Eye size={13} strokeWidth={2} />
                              <span>
                                {cargandoEvidenciaId === eq.id ? 'Cargando...' : 'Ver evidencia'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Visor bajo demanda de evidencia WebP */}
      {evidenciaAbierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Evidencia fotográfica"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4"
        >
          <article className="tarjeta flex max-h-[90dvh] w-full max-w-lg flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="truncate text-sm font-bold text-tinta dark:text-noche-tinta">
                Evidencia · {evidenciaAbierta.titulo}
              </h4>
              <button
                type="button"
                onClick={() => setEvidenciaAbierta(null)}
                aria-label="Cerrar evidencia"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <img
              src={evidenciaAbierta.imagen}
              alt={evidenciaAbierta.titulo}
              className="max-h-[70dvh] w-full rounded-lg border border-borde object-contain dark:border-noche-borde"
            />
          </article>
        </div>
      )}
    </div>
  )
}
