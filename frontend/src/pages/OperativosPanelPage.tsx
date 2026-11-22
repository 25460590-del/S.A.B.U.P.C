import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Lock,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BitacoraPersonalSection } from '../components/BitacoraPersonalSection'
import { CATEGORIAS_OPERATIVO } from '../constants/catalogos'
import { esAdmin, esEncargado } from '../lib/permisos'
import { mensajeDeError } from '../services/authService'
import {
  cambiarModoQrOperativo,
  cambiarRecepcionOperativo,
  construirPayloadQrEstatico,
  crearYConfigurarOperativo,
  eliminarOperativo,
  escucharOperativos,
  escucharSecretoTotp,
  finalizarOperativoConCierreAsistencias,
  generarEstadoTotpOffline,
  verificarPreCierreOperativo,
  type ResultadoPreCierreOperativo,
} from '../services/operativosService'
import type {
  CategoriaOperativo,
  ModoQrOperativo,
  Operativo,
  SecretoTotpOperativo,
  Usuario,
} from '../types'

interface OperativosPanelPageProps {
  usuario: Usuario
}

type FiltroEstadoOperativo = 'en_curso' | 'programados' | 'finalizados'
type SubVistaOperativo = 'resumen' | 'qr' | 'bitacora'

function estiloCategoria(cat: CategoriaOperativo): string {
  switch (cat) {
    case 'Operativos Masivos':
      return 'bg-naranja-suave text-naranja-oscuro border-naranja dark:bg-noche-campo dark:text-naranja'
    case 'Proyectos y Soporte Técnico':
      return 'bg-salvia text-udec-oscuro border-udec dark:bg-noche-campo dark:text-activo-claro'
    case 'Guardias Ordinarias':
      return 'bg-activo-suave text-activo border-activo dark:bg-noche-campo dark:text-activo-claro'
    case 'Capacitaciones, Simulacros y Difusión':
      return 'bg-superficie-suave text-tinta-suave border-borde-fuerte dark:bg-noche-campo dark:text-noche-tinta-suave dark:border-noche-borde'
  }
}

function valorDatetimeLocalActual(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function clasificarOperativo(op: Operativo, referenciaMs: number): FiltroEstadoOperativo {
  if (op.estatus === 'Finalizado') return 'finalizados'
  const inicioMs = Date.parse(op.fecha_inicio)
  if (!op.recepcion_abierta && !Number.isNaN(inicioMs) && inicioMs > referenciaMs) {
    return 'programados'
  }
  return 'en_curso'
}

export function OperativosPanelPage({ usuario }: OperativosPanelPageProps) {
  const puedeGestionar = esEncargado(usuario)
  const soyAdmin = esAdmin(usuario)

  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoOperativo>('en_curso')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [subVista, setSubVista] = useState<SubVistaOperativo>('resumen')

  const [secretoPorOp, setSecretoPorOp] = useState<{
    opId: string
    secreto: SecretoTotpOperativo | null
  } | null>(null)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())

  // Formulario nuevo operativo
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState<CategoriaOperativo>('Operativos Masivos')
  const [sede, setSede] = useState('')
  const [fechaInicio, setFechaInicio] = useState(valorDatetimeLocalActual)
  const [fechaFin, setFechaFin] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modoQrInicial, setModoQrInicial] = useState<ModoQrOperativo>('dinamico')
  const [recepcionInicial, setRecepcionInicial] = useState(true)

  // Modales de Finalizar Operativo (pre-verificación + confirmación irreversible) y Borrado (Admin)
  const [preCierre, setPreCierre] = useState<ResultadoPreCierreOperativo | null>(null)
  const [verificandoCierre, setVerificandoCierre] = useState(false)
  const [finalizando, setFinalizando] = useState(false)

  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)
  const [confirmacionNombreEliminar, setConfirmacionNombreEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const qrOperativoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cancelar = escucharOperativos(
      (lista) => {
        setOperativos(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    return cancelar
  }, [])

  const referenciaClasificacionMs = useMemo(
    () => Date.now(),
    // Recalcular al cambiar la lista de operativos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operativos],
  )

  const conteosEstado = useMemo(() => {
    let en_curso = 0
    let programados = 0
    let finalizados = 0
    for (const op of operativos) {
      const c = clasificarOperativo(op, referenciaClasificacionMs)
      if (c === 'en_curso') en_curso++
      else if (c === 'programados') programados++
      else finalizados++
    }
    return { en_curso, programados, finalizados }
  }, [operativos, referenciaClasificacionMs])

  const filtrados = useMemo(
    () =>
      operativos.filter(
        (op) => clasificarOperativo(op, referenciaClasificacionMs) === filtroEstado,
      ),
    [operativos, filtroEstado, referenciaClasificacionMs],
  )

  const operativoActivo = operativos.find((op) => op.id === seleccionadoId) ?? null
  const opActivoId = operativoActivo?.id ?? null
  const opModoQr = operativoActivo?.modo_qr ?? null
  const opEsFinalizado = operativoActivo?.estatus === 'Finalizado'
  const opRecepcionAbierta = Boolean(operativoActivo?.recepcion_abierta && !opEsFinalizado)
  // El QR SOLO se monta y rota cuando estamos en la sub-vista QR, con recepción abierta y no finalizado.
  const mostrarQrActivo = subVista === 'qr' && opRecepcionAbierta

  useEffect(() => {
    if (!opActivoId || !puedeGestionar || !opRecepcionAbierta) return
    const cancelar = escucharSecretoTotp(
      opActivoId,
      (secreto) => setSecretoPorOp({ opId: opActivoId, secreto }),
      (err) => setError(mensajeDeError(err)),
    )
    return cancelar
  }, [opActivoId, puedeGestionar, opRecepcionAbierta])

  // FIX CRÍTICO: el setInterval TOTP se detiene y limpia completamente cuando
  // recepcion_abierta === false, estatus === 'Finalizado', o fuera de la sub-vista QR.
  useEffect(() => {
    if (!opActivoId || opModoQr !== 'dinamico' || !mostrarQrActivo) return
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [opActivoId, opModoQr, mostrarQrActivo])

  const secretoTotp =
    opRecepcionAbierta && secretoPorOp?.opId === opActivoId ? secretoPorOp.secreto : null

  const estadoTotp =
    operativoActivo && mostrarQrActivo && operativoActivo.modo_qr === 'dinamico' && secretoTotp
      ? generarEstadoTotpOffline(operativoActivo, secretoTotp.secreto_base32, ahoraMs)
      : null

  const payloadQrActual =
    operativoActivo && mostrarQrActivo
      ? operativoActivo.modo_qr === 'dinamico'
        ? (estadoTotp?.payloadQr ?? '')
        : construirPayloadQrEstatico(operativoActivo)
      : ''

  async function manejarCrearOperativo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    if (!nombre.trim()) return setError('Ingresa el nombre del operativo o actividad.')
    if (!sede.trim()) return setError('Ingresa la sede o ubicación.')
    if (!fechaInicio.trim()) return setError('Selecciona la fecha y hora de inicio.')

    setGuardando(true)
    try {
      const nuevoId = await crearYConfigurarOperativo(usuario, {
        nombre,
        categoria,
        sede,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        descripcion,
        modo_qr: modoQrInicial,
        recepcion_abierta: recepcionInicial,
      })
      setSeleccionadoId(nuevoId)
      setSubVista('resumen')
      setMostrarFormulario(false)
      setNombre('')
      setSede('')
      setDescripcion('')
      setFechaInicio(valorDatetimeLocalActual())
      setFechaFin('')
      setAviso('Operativo creado y configurado con QR dual (Estático + TOTP sin internet).')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function alternarRecepcion() {
    if (!operativoActivo || !puedeGestionar || opEsFinalizado) return
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      const siguiente = !operativoActivo.recepcion_abierta
      await cambiarRecepcionOperativo(usuario, operativoActivo, siguiente)
      setAviso(
        siguiente
          ? `Recepción abierta para "${operativoActivo.nombre}".`
          : `Recepción cerrada para "${operativoActivo.nombre}". Las salidas siguen habilitadas.`,
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function cambiarModoQr(modo: ModoQrOperativo) {
    if (!operativoActivo || !puedeGestionar || opEsFinalizado || operativoActivo.modo_qr === modo) {
      return
    }
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      await cambiarModoQrOperativo(usuario, operativoActivo, modo)
      setAviso(
        modo === 'dinamico'
          ? 'Modo QR cambiado a Dinámico TOTP (rotación cada 30 s sin internet).'
          : 'Modo QR cambiado a Estático (listo para descarga PNG).',
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
  }

  function descargarQrOperativoPng() {
    if (!operativoActivo || !opRecepcionAbierta) return
    const canvas = qrOperativoRef.current?.querySelector('canvas')
    if (!canvas) return
    const enlace = document.createElement('a')
    enlace.href = canvas.toDataURL('image/png')
    const slug = operativoActivo.nombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    enlace.download = `qr-operativo-${slug || operativoActivo.id}.png`
    enlace.click()
  }

  async function iniciarFlujoFinalizar() {
    if (!operativoActivo || !puedeGestionar || opEsFinalizado) return
    setVerificandoCierre(true)
    setError(null)
    setAviso(null)
    try {
      const resultado = await verificarPreCierreOperativo(operativoActivo.id)
      setPreCierre(resultado)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setVerificandoCierre(false)
    }
  }

  async function confirmarFinalizacionIrreversible() {
    if (!operativoActivo || !preCierre || preCierre.deudores.length > 0) return
    setFinalizando(true)
    setError(null)
    setAviso(null)
    try {
      const { salidasCerradas } = await finalizarOperativoConCierreAsistencias(
        usuario,
        operativoActivo,
      )
      setPreCierre(null)
      setAviso(
        `Operativo "${operativoActivo.nombre}" finalizado de forma definitiva (${salidasCerradas} salida${salidasCerradas === 1 ? '' : 's'} cerrada${salidasCerradas === 1 ? '' : 's'} automáticamente).`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setFinalizando(false)
    }
  }

  async function confirmarEliminacionOperativo(e: FormEvent) {
    e.preventDefault()
    if (!operativoActivo || !soyAdmin) return
    if (confirmacionNombreEliminar.trim() !== operativoActivo.nombre.trim()) {
      setError('Escribe el nombre exacto del operativo para confirmar su eliminación.')
      return
    }
    setEliminando(true)
    setError(null)
    setAviso(null)
    try {
      const nombreEliminado = operativoActivo.nombre
      await eliminarOperativo(usuario, operativoActivo)
      setModalEliminarAbierto(false)
      setConfirmacionNombreEliminar('')
      setSeleccionadoId(null)
      setAviso(`Operativo "${nombreEliminado}" eliminado y registrado en auditoría.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setEliminando(false)
    }
  }

  // ── VISTA 1: LISTA COMPACTA DE OPERATIVOS (SIN TARJETAS CONTADORAS) ────────
  if (!operativoActivo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">Operativos</h2>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              Selecciona un operativo para administrar su resumen, control QR y bitácora.
            </p>
          </div>
          {puedeGestionar && (
            <button
              type="button"
              onClick={() => setMostrarFormulario((v) => !v)}
              className="btn-naranja min-h-10 px-4 text-xs"
            >
              <Plus size={16} strokeWidth={2} />
              <span>Nuevo operativo</span>
            </button>
          )}
        </div>

        {/* Chips de filtro con contador discreto: En curso, Programados, Finalizados */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'en_curso', label: 'En curso', count: conteosEstado.en_curso },
              { id: 'programados', label: 'Programados', count: conteosEstado.programados },
              { id: 'finalizados', label: 'Finalizados', count: conteosEstado.finalizados },
            ] as const
          ).map((chip) => {
            const activo = filtroEstado === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFiltroEstado(chip.id)}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  activo
                    ? 'bg-udec text-white'
                    : 'border border-borde bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                }`}
              >
                <span>{chip.label}</span>
                <span className="tabular-nums opacity-80">({chip.count})</span>
              </button>
            )
          })}
        </div>

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

        {/* Formulario de creación */}
        {mostrarFormulario && puedeGestionar && (
          <article className="tarjeta flex flex-col gap-4 border-2 border-udec p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
              <div>
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Iniciar Nuevo Operativo o Actividad
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Genera automáticamente el token estático y el secreto TOTP de 30 s sin internet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                aria-label="Cerrar formulario"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-borde text-tinta-suave hover:text-tinta dark:border-noche-borde dark:text-noche-tinta-suave"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarCrearOperativo} className="flex flex-col gap-3.5" noValidate>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="op-nombre" className="etiqueta">
                    Nombre del operativo
                  </label>
                  <input
                    id="op-nombre"
                    type="text"
                    maxLength={120}
                    placeholder="Ej. Loromanía 2026 / Guardia Matutina"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="campo"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="op-categoria" className="etiqueta">
                    Categoría
                  </label>
                  <select
                    id="op-categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as CategoriaOperativo)}
                    className="campo"
                  >
                    {CATEGORIAS_OPERATIVO.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="op-sede" className="etiqueta">
                    Sede / Ubicación
                  </label>
                  <input
                    id="op-sede"
                    type="text"
                    maxLength={120}
                    placeholder="Ej. Campus Central / Base CECOM"
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                    className="campo"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="op-modo" className="etiqueta">
                    Modo de QR inicial
                  </label>
                  <select
                    id="op-modo"
                    value={modoQrInicial}
                    onChange={(e) => setModoQrInicial(e.target.value as ModoQrOperativo)}
                    className="campo"
                  >
                    <option value="dinamico">QR Dinámico TOTP (rotación cada 30 s sin internet)</option>
                    <option value="estatico">QR Estático (descargable en PNG)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="op-inicio" className="etiqueta">
                    Fecha y hora de inicio
                  </label>
                  <input
                    id="op-inicio"
                    type="datetime-local"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="campo tabular-nums"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="op-fin" className="etiqueta">
                    Fecha y hora de cierre (opcional)
                  </label>
                  <input
                    id="op-fin"
                    type="datetime-local"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="op-desc" className="etiqueta">
                  Indicaciones operativas (opcional)
                </label>
                <textarea
                  id="op-desc"
                  rows={2}
                  maxLength={500}
                  placeholder="Punto de reunión, uniforme o equipo requerido"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="campo min-h-20 py-2"
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-salvia px-3 dark:border-noche-borde dark:bg-noche-campo">
                <input
                  type="checkbox"
                  checked={recepcionInicial}
                  onChange={(e) => setRecepcionInicial(e.target.checked)}
                  className="h-4 w-4 rounded accent-udec"
                />
                <span className="text-xs font-semibold text-udec-oscuro dark:text-noche-tinta">
                  Abrir recepción de asistencias inmediatamente
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  disabled={guardando}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="btn-verde">
                  {guardando ? 'Guardando...' : 'Crear Operativo'}
                </button>
              </div>
            </form>
          </article>
        )}

        {/* Lista compacta de operativos */}
        {cargando ? (
          <div className="tarjeta flex flex-col divide-y divide-borde dark:divide-noche-borde">
            <div className="h-16 animate-pulse bg-esqueleto/40 p-4 dark:bg-noche-borde/40" />
            <div className="h-16 animate-pulse bg-esqueleto/40 p-4 dark:bg-noche-borde/40" />
          </div>
        ) : filtrados.length === 0 ? (
          <article className="tarjeta flex flex-col items-center gap-2.5 p-8 text-center">
            <QrCode size={32} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
            <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
              Sin operativos en esta sección
            </h3>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              {filtroEstado === 'en_curso' && puedeGestionar
                ? 'Crea un nuevo operativo para habilitar el control QR y la bitácora.'
                : 'Cambia de filtro para consultar otros operativos.'}
            </p>
          </article>
        ) : (
          <div className="tarjeta divide-y divide-borde overflow-hidden dark:divide-noche-borde">
            {filtrados.map((op) => {
              const finalizado = op.estatus === 'Finalizado'
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    setSeleccionadoId(op.id)
                    setSubVista('resumen')
                    setError(null)
                    setAviso(null)
                  }}
                  className="flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-superficie-suave sm:flex-row sm:items-center sm:justify-between dark:hover:bg-noche-campo/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-tinta dark:text-noche-tinta">
                        {op.nombre}
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${estiloCategoria(op.categoria)}`}
                      >
                        {op.categoria}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} strokeWidth={2} />
                        <span>{op.sede}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar size={12} strokeWidth={2} />
                        <span>{op.fecha_inicio.replace('T', ' ')}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {finalizado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-superficie-suave px-2.5 py-0.5 text-[11px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                        <Lock size={11} strokeWidth={2} />
                        <span>Finalizado</span>
                      </span>
                    ) : op.recepcion_abierta ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-activo-suave px-2.5 py-0.5 text-[11px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
                        <Unlock size={11} strokeWidth={2} />
                        <span>Recepción abierta</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ambar-suave px-2.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                        <Lock size={11} strokeWidth={2} />
                        <span>Recepción cerrada</span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── VISTA 2: DETALLE DE OPERATIVO SEGMENTADO EN 3 SUB-VISTAS ───────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de contexto + botón regresar + pestañas limpias */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSeleccionadoId(null)
                setError(null)
                setAviso(null)
              }}
              className="btn-salvia min-h-9 shrink-0 px-3 text-xs"
            >
              <ArrowLeft size={15} strokeWidth={2} />
              <span>Operativos</span>
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-tinta dark:text-noche-tinta">
                {operativoActivo.nombre}
              </h2>
              <p className="truncate text-xs text-tinta-suave dark:text-noche-tinta-suave">
                {operativoActivo.sede} · {operativoActivo.fecha_inicio.replace('T', ' ')}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              opEsFinalizado
                ? 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                : opRecepcionAbierta
                  ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                  : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
            }`}
          >
            {opEsFinalizado
              ? 'Finalizado (Solo lectura)'
              : opRecepcionAbierta
                ? 'Recepción abierta'
                : 'Recepción cerrada'}
          </span>
        </div>

        {/* Pestañas de sub-vistas */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-borde bg-superficie-suave p-1 dark:border-noche-borde dark:bg-noche-campo">
          <button
            type="button"
            onClick={() => setSubVista('resumen')}
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
              subVista === 'resumen'
                ? 'bg-udec text-white'
                : 'text-tinta-suave hover:bg-tarjeta hover:text-tinta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
            }`}
          >
            <FileText size={15} strokeWidth={2} />
            <span className="truncate">Resumen y Acciones</span>
          </button>

          <button
            type="button"
            onClick={() => setSubVista('qr')}
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
              subVista === 'qr'
                ? 'bg-udec text-white'
                : 'text-tinta-suave hover:bg-tarjeta hover:text-tinta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
            }`}
          >
            <QrCode size={15} strokeWidth={2} />
            <span className="truncate">Control QR</span>
          </button>

          <button
            type="button"
            onClick={() => setSubVista('bitacora')}
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
              subVista === 'bitacora'
                ? 'bg-udec text-white'
                : 'text-tinta-suave hover:bg-tarjeta hover:text-tinta dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
            }`}
          >
            <ClipboardList size={15} strokeWidth={2} />
            <span className="truncate">Bitácora y Material</span>
          </button>
        </div>
      </div>

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

      {/* SUB-VISTA A: RESUMEN Y ACCIONES */}
      {subVista === 'resumen' && (
        <article className="tarjeta flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borde pb-4 dark:border-noche-borde">
            <div>
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${estiloCategoria(operativoActivo.categoria)}`}
              >
                {operativoActivo.categoria}
              </span>
              <h3 className="mt-2 text-lg font-bold text-tinta dark:text-noche-tinta">
                {operativoActivo.nombre}
              </h3>
              {operativoActivo.descripcion && (
                <p className="mt-1 text-sm text-tinta-suave dark:text-noche-tinta-suave">
                  {operativoActivo.descripcion}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
              <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Sede
              </dt>
              <dd className="mt-0.5 font-bold text-tinta dark:text-noche-tinta">
                {operativoActivo.sede}
              </dd>
            </div>
            <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
              <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Inicio
              </dt>
              <dd className="mt-0.5 font-bold tabular-nums text-tinta dark:text-noche-tinta">
                {operativoActivo.fecha_inicio.replace('T', ' ')}
              </dd>
            </div>
            <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
              <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Cierre programado
              </dt>
              <dd className="mt-0.5 font-bold tabular-nums text-tinta dark:text-noche-tinta">
                {operativoActivo.fecha_fin ? operativoActivo.fecha_fin.replace('T', ' ') : 'Abierto'}
              </dd>
            </div>
            <div className="rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo">
              <dt className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Creado por
              </dt>
              <dd className="mt-0.5 font-bold text-tinta dark:text-noche-tinta">
                {operativoActivo.creado_por_nombre}
              </dd>
            </div>
          </dl>

          {/* Acciones operativas */}
          {puedeGestionar && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-borde pt-4 dark:border-noche-borde">
              {!opEsFinalizado ? (
                <>
                  <button
                    type="button"
                    onClick={() => void alternarRecepcion()}
                    disabled={cambiandoEstado}
                    className={`btn min-h-10 px-4 text-xs ${
                      opRecepcionAbierta
                        ? 'border border-ambar bg-ambar-suave text-ambar-texto hover:bg-amber-100 dark:bg-noche-ambar dark:text-noche-ambar-texto'
                        : 'btn-verde'
                    }`}
                  >
                    {opRecepcionAbierta ? (
                      <>
                        <Lock size={15} strokeWidth={2} />
                        <span>Cerrar Recepción</span>
                      </>
                    ) : (
                      <>
                        <Unlock size={15} strokeWidth={2} />
                        <span>Abrir Recepción</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={verificandoCierre}
                    onClick={() => void iniciarFlujoFinalizar()}
                    className="btn-naranja min-h-10 px-4 text-xs"
                  >
                    <ShieldAlert size={15} strokeWidth={2} />
                    <span>
                      {verificandoCierre ? 'Verificando pendientes...' : 'Finalizar Operativo'}
                    </span>
                  </button>
                </>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  <Lock size={14} strokeWidth={2} />
                  <span>
                    Este operativo fue finalizado de forma irreversible. Consulta su bitácora en modo
                    solo lectura.
                  </span>
                </p>
              )}

              {soyAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setModalEliminarAbierto(true)
                    setConfirmacionNombreEliminar('')
                  }}
                  className="btn ml-auto min-h-10 border border-alerta bg-tarjeta px-3.5 text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                >
                  <Trash2 size={15} strokeWidth={2} />
                  <span>Eliminar Operativo</span>
                </button>
              )}
            </div>
          )}
        </article>
      )}

      {/* SUB-VISTA B: CONTROL QR (CON FIX CRÍTICO DE RECEPCIÓN CERRADA / FINALIZADO) */}
      {subVista === 'qr' && (
        <article className="tarjeta mx-auto flex w-full max-w-2xl flex-col gap-4 p-5">
          {opEsFinalizado ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                <Lock size={24} strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Operativo finalizado
              </h3>
              <p className="max-w-md text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Los códigos QR de entrada y salida se encuentran deshabilitados de forma definitiva.
              </p>
            </div>
          ) : !opRecepcionAbierta ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                <Lock size={24} strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Recepción cerrada
              </h3>
              <p className="max-w-md text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Recepción cerrada — no se admiten nuevas entradas; las salidas siguen habilitadas
                desde el escáner de credenciales o la bitácora.
              </p>
              {puedeGestionar && (
                <button
                  type="button"
                  disabled={cambiandoEstado}
                  onClick={() => void alternarRecepcion()}
                  className="btn-verde mt-1 min-h-10 px-4 text-xs"
                >
                  <Unlock size={15} strokeWidth={2} />
                  <span>Reabrir recepción</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
                <div>
                  <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                    Control QR · {operativoActivo.nombre}
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Proyecta o imprime este código para el pase de lista en campo.
                  </p>
                </div>

                {puedeGestionar && (
                  <button
                    type="button"
                    disabled={cambiandoEstado}
                    onClick={() => void alternarRecepcion()}
                    className="btn min-h-9 border border-ambar bg-ambar-suave px-3 text-xs text-ambar-texto hover:bg-amber-100 dark:bg-noche-ambar dark:text-noche-ambar-texto"
                  >
                    <Lock size={14} strokeWidth={2} />
                    <span>Cerrar Recepción</span>
                  </button>
                )}
              </div>

              {puedeGestionar && (
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-superficie-suave p-1 dark:bg-noche-campo">
                  <button
                    type="button"
                    disabled={cambiandoEstado}
                    onClick={() => void cambiarModoQr('dinamico')}
                    className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
                      operativoActivo.modo_qr === 'dinamico'
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                    }`}
                  >
                    QR Dinámico TOTP (30 s)
                  </button>
                  <button
                    type="button"
                    disabled={cambiandoEstado}
                    onClick={() => void cambiarModoQr('estatico')}
                    className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
                      operativoActivo.modo_qr === 'estatico'
                        ? 'bg-udec text-white'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                    }`}
                  >
                    QR Estático (PNG)
                  </button>
                </div>
              )}

              {/* Visor QR SIEMPRE sobre fondo #FFFFFF puro con margen amplio */}
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div
                  ref={qrOperativoRef}
                  className="flex shrink-0 items-center justify-center rounded-xl border border-borde-fuerte bg-[#FFFFFF] p-4"
                >
                  {payloadQrActual ? (
                    <QRCodeCanvas
                      value={payloadQrActual}
                      size={180}
                      bgColor="#FFFFFF"
                      fgColor="#18181B"
                      level="M"
                      includeMargin
                    />
                  ) : (
                    <div className="flex h-[180px] w-[180px] items-center justify-center text-xs font-semibold text-tinta-suave">
                      Cargando TOTP...
                    </div>
                  )}
                </div>

                {operativoActivo.modo_qr === 'dinamico' ? (
                  <div className="flex w-full flex-1 flex-col gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      <RefreshCw size={14} strokeWidth={2} />
                      <span>Rotación automática sin internet</span>
                    </span>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-3xl font-extrabold tracking-widest tabular-nums text-udec dark:text-activo-claro">
                        {estadoTotp ? estadoTotp.codigo : '------'}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-naranja-oscuro dark:text-naranja">
                        00:{String(estadoTotp?.segundosRestantes ?? 30).padStart(2, '0')}s
                      </span>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-esqueleto dark:bg-noche-campo">
                      <div
                        className="h-full rounded-full bg-naranja transition-all duration-300"
                        style={{
                          width: `${((estadoTotp?.segundosRestantes ?? 30) / 30) * 100}%`,
                        }}
                      />
                    </div>

                    <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      Cada código caduca en 30 segundos. Al cerrar la recepción el QR se desmonta
                      inmediatamente y el temporizador se detiene.
                    </p>
                  </div>
                ) : (
                  <div className="flex w-full flex-1 flex-col gap-3">
                    <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      Código fijo para imprimir o proyectar en el punto de control. Si cierras la
                      recepción, las capturas previas ya no podrán registrar nuevas entradas.
                    </p>
                    <button
                      type="button"
                      onClick={descargarQrOperativoPng}
                      className="btn-salvia w-full text-xs"
                    >
                      <Download size={16} strokeWidth={2} />
                      <span>Descargar PNG</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </article>
      )}

      {/* SUB-VISTA C: BITÁCORA DE PERSONAL Y MATERIAL */}
      {subVista === 'bitacora' && puedeGestionar && (
        <BitacoraPersonalSection encargado={usuario} operativo={operativoActivo} />
      )}

      {/* MODAL: FINALIZAR OPERATIVO (BLOQUEO CON DEUDORES O CONFIRMACIÓN IRREVERSIBLE) */}
      {preCierre && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Finalizar Operativo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article
            className={`tarjeta flex max-h-[85dvh] w-full max-w-lg flex-col gap-4 overflow-hidden border-2 p-5 ${
              preCierre.deudores.length > 0 ? 'border-alerta' : 'border-naranja'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  size={22}
                  strokeWidth={2}
                  className={`mt-0.5 shrink-0 ${
                    preCierre.deudores.length > 0
                      ? 'text-alerta dark:text-noche-rojo-texto'
                      : 'text-naranja-oscuro dark:text-naranja'
                  }`}
                />
                <div>
                  <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                    {preCierre.deudores.length > 0
                      ? 'Cierre bloqueado por material BUPC pendiente'
                      : 'Confirmar cierre definitivo del operativo'}
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    {operativoActivo.nombre}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreCierre(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {preCierre.deudores.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-alerta dark:text-noche-rojo-texto">
                  {preCierre.deudores.length} brigadista
                  {preCierre.deudores.length === 1 ? '' : 's'} aún tienen equipo BUPC pendiente.
                  Registra la devolución o levanta un Acta de Incidencia antes de finalizar.
                </p>

                <div className="flex max-h-60 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde bg-fondo dark:divide-noche-borde dark:border-noche-borde dark:bg-noche-campo">
                  {preCierre.deudores.map(({ asistencia, equiposPendientes }) => (
                    <div key={asistencia.id} className="p-3">
                      <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                        {asistencia.usuario_nombre}{' '}
                        <span className="font-normal text-tinta-suave dark:text-noche-tinta-suave">
                          ({asistencia.equipos_bupc_pendientes} pendiente
                          {asistencia.equipos_bupc_pendientes === 1 ? '' : 's'})
                        </span>
                      </p>
                      <ul className="mt-1 flex flex-col gap-0.5 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        {equiposPendientes.map((eq) => (
                          <li key={eq.id}>
                            • {eq.cantidad && eq.cantidad > 1 ? `${eq.cantidad}× ` : ''}
                            {eq.nombre_articulo}
                            {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreCierre(null)}
                    className="btn-salvia text-xs"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreCierre(null)
                      setSubVista('bitacora')
                    }}
                    className="btn-verde text-xs"
                  >
                    Ir a Bitácora para resolver
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 rounded-lg bg-naranja-suave p-3 text-xs text-tinta dark:bg-noche-campo dark:text-noche-tinta">
                  <p className="font-bold">
                    Esta acción es definitiva e irreversible. Nadie podrá reabrir el operativo,
                    registrar nuevas asistencias ni asignar material posteriormente.
                  </p>
                  <p className="tabular-nums">
                    • Asistentes totales: <strong>{preCierre.totalAsistencias}</strong>
                    <br />• Salidas abiertas que se cerrarán automáticamente ahora:{' '}
                    <strong>{preCierre.asistenciasAbiertas.length}</strong>
                    <br />• Material BUPC pendiente: <strong>0</strong>
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={finalizando}
                    onClick={() => setPreCierre(null)}
                    className="btn-salvia text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={finalizando}
                    onClick={() => void confirmarFinalizacionIrreversible()}
                    className="btn-rojo text-xs"
                  >
                    {finalizando ? 'Finalizando...' : 'Confirmar Cierre Definitivo'}
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      )}

      {/* MODAL: BORRADO CONTROLADO (EXCLUSIVO ADMINISTRADOR CON CONFIRMACIÓN REFORZADA) */}
      {modalEliminarAbierto && soyAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Eliminar Operativo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 border-2 border-alerta p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Trash2
                  size={20}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-alerta dark:text-noche-rojo-texto"
                />
                <div>
                  <h3 className="text-base font-bold text-alerta dark:text-noche-rojo-texto">
                    Eliminar Operativo
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Acción exclusiva de Administrador. Quedará registrada en auditoría inmutable.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEliminarAbierto(false)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={confirmarEliminacionOperativo} className="flex flex-col gap-3">
              <p className="text-xs text-tinta dark:text-noche-tinta">
                Para confirmar, escribe exactamente el nombre del operativo:{' '}
                <strong className="select-all">{operativoActivo.nombre}</strong>
              </p>

              <input
                type="text"
                value={confirmacionNombreEliminar}
                onChange={(e) => setConfirmacionNombreEliminar(e.target.value)}
                placeholder={operativoActivo.nombre}
                className="campo text-sm"
                required
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={eliminando}
                  onClick={() => setModalEliminarAbierto(false)}
                  className="btn-salvia text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    eliminando ||
                    confirmacionNombreEliminar.trim() !== operativoActivo.nombre.trim()
                  }
                  className="btn-rojo text-xs"
                >
                  {eliminando ? 'Eliminando...' : 'Eliminar definitivamente'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
    </div>
  )
}
