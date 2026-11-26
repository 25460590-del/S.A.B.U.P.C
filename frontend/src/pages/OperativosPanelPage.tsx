import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Lock,
  MapPin,
  Megaphone,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BitacoraPersonalSection } from '../components/BitacoraPersonalSection'
import { IndicadorAlcanceAyudantia } from '../components/IndicadorAlcanceAyudantia'
import { CATEGORIAS_OPERATIVO } from '../constants/catalogos'
import { normalizarNombrePropio } from '../lib/nombres'
import {
  ayudantiaJefatura,
  esAdmin,
  esEncargado,
  esOperativoCerrado,
  puedeConfigurarOperativoActivo,
  puedeFinalizarOperativo,
} from '../lib/permisos'
import { mensajeDeError } from '../services/authService'
import {
  actualizarConvocatoriaOperativo,
  asegurarSecretoEstatico,
  cambiarModoQrOperativo,
  cambiarRecepcionOperativo,
  cancelarOperativo,
  construirPayloadQrDinamico,
  construirPayloadQrEstatico,
  crearYConfigurarOperativo,
  eliminarOperativo,
  ErrorDeudoresEnCierre,
  escucharOperativosActivos,
  escucharSecretoEstatico,
  escucharSecretoVigente,
  finalizarOperativoConCierreAsistencias,
  obtenerOperativosPaginados,
  PERIODO_QR_DINAMICO_SEG,
  rotarNonceOperativo,
  verificarOperativoVacioParaBorrado,
  verificarPreCierreOperativo,
  type PaginaOperativos,
  type ResultadoPreCierreOperativo,
  type VerificacionBorradoOperativo,
} from '../services/operativosService'
import { escucharContadorPrerregistros } from '../services/prerregistrosService'
import type {
  CategoriaOperativo,
  ModoQrOperativo,
  Operativo,
  SecretoEstaticoOperativo,
  SecretoVigenteOperativo,
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
  if (esOperativoCerrado(op)) return 'finalizados'
  const inicioMs = Date.parse(op.fecha_inicio)
  if (!op.recepcion_abierta && !Number.isNaN(inicioMs) && inicioMs > referenciaMs) {
    return 'programados'
  }
  return 'en_curso'
}

export function OperativosPanelPage({ usuario }: OperativosPanelPageProps) {
  const puedeGestionar = esEncargado(usuario)
  const puedeConfigurarGlobal = puedeConfigurarOperativoActivo(usuario)
  const puedeFinalizar = puedeFinalizarOperativo(usuario)
  const soyAdmin = esAdmin(usuario)
  const ayJefe = ayudantiaJefatura(usuario)

  const [operativosActivos, setOperativosActivos] = useState<Operativo[]>([])
  const [operativosCerrados, setOperativosCerrados] = useState<Operativo[]>([])
  const [cursorCerrados, setCursorCerrados] = useState<PaginaOperativos['ultimoDoc']>(null)
  const [hayMasCerrados, setHayMasCerrados] = useState(false)
  const [cerradosCargados, setCerradosCargados] = useState(false)
  const [cargandoCerrados, setCargandoCerrados] = useState(false)
  const [contadorPorOp, setContadorPorOp] = useState<{ opId: string; conteo: number | null } | null>(
    null,
  )
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoOperativo>('en_curso')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [subVista, setSubVista] = useState<SubVistaOperativo>('resumen')

  const [secretoEstaticoPorOp, setSecretoEstaticoPorOp] = useState<{
    opId: string
    secreto: SecretoEstaticoOperativo | null
  } | null>(null)
  const [secretoVigentePorOp, setSecretoVigentePorOp] = useState<{
    opId: string
    secreto: SecretoVigenteOperativo | null
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
  const [convocatoriaInicial, setConvocatoriaInicial] = useState(false)
  const [cupoInicial, setCupoInicial] = useState('')

  // Edición rápida de cupo sugerido en Resumen (sin sincronizar estado en useEffect)
  const [cupoEditadoPorOp, setCupoEditadoPorOp] = useState<{
    opId: string
    valor: string
  } | null>(null)
  // Confirmación ligera antes de abrir/cerrar convocatoria (evita clics accidentales)
  const [confirmandoConvocatoria, setConfirmandoConvocatoria] = useState<boolean | null>(null)

  // Modales de Finalizar Operativo (pre-verificación + confirmación irreversible) y Borrado/Baja lógica (Admin)
  const [preCierre, setPreCierre] = useState<ResultadoPreCierreOperativo | null>(null)
  const [verificandoCierre, setVerificandoCierre] = useState(false)
  const [finalizando, setFinalizando] = useState(false)

  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)
  const [verificandoBorrado, setVerificandoBorrado] = useState(false)
  const [estadoBorrado, setEstadoBorrado] = useState<VerificacionBorradoOperativo | null>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [confirmacionNombreEliminar, setConfirmacionNombreEliminar] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const qrOperativoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cancelar = escucharOperativosActivos(
      (lista) => {
        setOperativosActivos(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    return cancelar
  }, [])

  async function cargarMasCerrados(reiniciar = false) {
    if (cargandoCerrados) return
    setCargandoCerrados(true)
    setError(null)
    try {
      const pagina = await obtenerOperativosPaginados(20, reiniciar ? null : cursorCerrados)
      const soloCerrados = pagina.operativos.filter((op) => esOperativoCerrado(op))
      setOperativosCerrados((prev) => {
        const base = reiniciar ? [] : prev
        const mapa = new Map<string, Operativo>()
        for (const o of base) mapa.set(o.id, o)
        for (const o of soloCerrados) mapa.set(o.id, o)
        return Array.from(mapa.values())
      })
      setCursorCerrados(pagina.ultimoDoc)
      setHayMasCerrados(pagina.hayMas)
      setCerradosCargados(true)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoCerrados(false)
    }
  }

  const operativos = useMemo(() => {
    const mapa = new Map<string, Operativo>()
    for (const o of operativosActivos) mapa.set(o.id, o)
    for (const o of operativosCerrados) {
      if (!mapa.has(o.id)) mapa.set(o.id, o)
    }
    return Array.from(mapa.values())
  }, [operativosActivos, operativosCerrados])

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
  const opEsCerrado = esOperativoCerrado(operativoActivo)
  const opEsCancelado = operativoActivo?.estatus === 'Cancelado'
  const etiquetaCerrado = opEsCancelado ? 'Cancelado' : 'Finalizado'
  const opRecepcionAbierta = Boolean(operativoActivo?.recepcion_abierta && !opEsCerrado)
  // El QR SOLO se monta y rota cuando estamos en la sub-vista QR, con recepción abierta y operativo activo.
  const mostrarQrActivo = subVista === 'qr' && opRecepcionAbierta

  useEffect(() => {
    if (!opActivoId) return
    const cancelar = escucharContadorPrerregistros(opActivoId, (conteo) => {
      setContadorPorOp({ opId: opActivoId, conteo })
    })
    return cancelar
  }, [opActivoId])

  const prerregistrosCountActivo =
    contadorPorOp?.opId === opActivoId && contadorPorOp.conteo !== null
      ? contadorPorOp.conteo
      : (operativoActivo?.prerregistros_count ?? 0)

  useEffect(() => {
    if (!opActivoId || !puedeGestionar || !mostrarQrActivo) return
    if (opModoQr === 'estatico') {
      const cancelar = escucharSecretoEstatico(
        opActivoId,
        (secreto) => setSecretoEstaticoPorOp({ opId: opActivoId, secreto }),
        (err) => setError(mensajeDeError(err)),
      )
      void asegurarSecretoEstatico(opActivoId).catch((err) => setError(mensajeDeError(err)))
      return cancelar
    }
    if (opModoQr === 'dinamico') {
      const cancelar = escucharSecretoVigente(
        opActivoId,
        (secreto) => setSecretoVigentePorOp({ opId: opActivoId, secreto }),
        (err) => setError(mensajeDeError(err)),
      )
      void rotarNonceOperativo(opActivoId).catch((err) => setError(mensajeDeError(err)))
      const rotadorId = window.setInterval(() => {
        void rotarNonceOperativo(opActivoId).catch((err) => setError(mensajeDeError(err)))
      }, PERIODO_QR_DINAMICO_SEG * 1000)
      return () => {
        cancelar()
        window.clearInterval(rotadorId)
      }
    }
  }, [opActivoId, opModoQr, puedeGestionar, mostrarQrActivo])

  // El reloj visual de cuenta regresiva se detiene cuando recepcion_abierta === false,
  // el operativo está Finalizado/Cancelado, o fuera de la sub-vista QR.
  useEffect(() => {
    if (!opActivoId || opModoQr !== 'dinamico' || !mostrarQrActivo) return
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [opActivoId, opModoQr, mostrarQrActivo])

  const secretoEstatico =
    mostrarQrActivo && secretoEstaticoPorOp?.opId === opActivoId
      ? secretoEstaticoPorOp.secreto
      : null

  const secretoVigente =
    mostrarQrActivo && secretoVigentePorOp?.opId === opActivoId
      ? secretoVigentePorOp.secreto
      : null

  const segundosRestantesQr = (() => {
    if (!secretoVigente) return PERIODO_QR_DINAMICO_SEG
    const actualizadoMs = secretoVigente.actualizado_en?.toMillis() ?? ahoraMs
    const transcurridos = Math.floor(Math.max(0, ahoraMs - actualizadoMs) / 1000)
    return Math.max(1, PERIODO_QR_DINAMICO_SEG - (transcurridos % PERIODO_QR_DINAMICO_SEG))
  })()

  const payloadQrActual =
    operativoActivo && mostrarQrActivo
      ? operativoActivo.modo_qr === 'dinamico'
        ? secretoVigente?.nonce
          ? construirPayloadQrDinamico(operativoActivo.id, secretoVigente.nonce)
          : ''
        : secretoEstatico?.token
          ? construirPayloadQrEstatico(operativoActivo.id, secretoEstatico.token)
          : ''
      : ''

  async function manejarCrearOperativo(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    if (!nombre.trim()) return setError('Ingresa el nombre del operativo o actividad.')
    if (!sede.trim()) return setError('Ingresa la sede o ubicación.')
    if (!fechaInicio.trim()) return setError('Selecciona la fecha y hora de inicio.')

    const cupoNum = cupoInicial.trim() ? Number(cupoInicial.trim()) : null
    if (cupoNum !== null && (!Number.isInteger(cupoNum) || cupoNum < 1 || cupoNum > 1000)) {
      return setError('El cupo sugerido debe ser un número entero entre 1 y 1000.')
    }

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
        convocatoria_abierta: convocatoriaInicial,
        cupo_sugerido: cupoNum,
      })
      setSeleccionadoId(nuevoId)
      setSubVista('resumen')
      setMostrarFormulario(false)
      setNombre('')
      setSede('')
      setDescripcion('')
      setFechaInicio(valorDatetimeLocalActual())
      setFechaFin('')
      setConvocatoriaInicial(false)
      setCupoInicial('')
      setAviso('Operativo creado y listo para pase de lista con código QR.')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function aplicarCambioConvocatoria(siguiente: boolean) {
    if (!operativoActivo || !puedeConfigurarGlobal || opEsCerrado) return
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      await actualizarConvocatoriaOperativo(usuario, operativoActivo, {
        convocatoria_abierta: siguiente,
        cupo_sugerido: operativoActivo.cupo_sugerido ?? null,
      })
      setConfirmandoConvocatoria(null)
      setAviso(
        siguiente
          ? `Convocatoria abierta para "${operativoActivo.nombre}". Los brigadistas ya pueden apuntarse desde su panel.`
          : `Convocatoria cerrada para "${operativoActivo.nombre}". Ya no se reciben nuevos prerregistros abiertos; las altas manuales, edición de roles y confirmaciones por QR siguen activas.`,
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
  }

  const cupoEdicionActual =
    operativoActivo && cupoEditadoPorOp?.opId === operativoActivo.id
      ? cupoEditadoPorOp.valor
      : operativoActivo?.cupo_sugerido
        ? String(operativoActivo.cupo_sugerido)
        : ''

  async function guardarCupoSugerido(e: FormEvent) {
    e.preventDefault()
    if (!operativoActivo || !puedeConfigurarGlobal || opEsCerrado) return
    const limpio = cupoEdicionActual.trim()
    const cupoNum = limpio ? Number(limpio) : null
    if (cupoNum !== null && (!Number.isInteger(cupoNum) || cupoNum < 1 || cupoNum > 1000)) {
      setError('El cupo sugerido debe ser un número entero entre 1 y 1000 (o vacío para sin límite).')
      return
    }
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      await actualizarConvocatoriaOperativo(usuario, operativoActivo, {
        convocatoria_abierta: Boolean(operativoActivo.convocatoria_abierta),
        cupo_sugerido: cupoNum,
      })
      setCupoEditadoPorOp(null)
      setAviso(
        cupoNum !== null
          ? `Cupo sugerido actualizado a ${cupoNum} lugares.`
          : 'Cupo sugerido establecido sin límite.',
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function alternarRecepcion() {
    if (!operativoActivo || !puedeConfigurarGlobal || opEsCerrado) return
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
    if (
      !operativoActivo ||
      !puedeConfigurarGlobal ||
      opEsCerrado ||
      operativoActivo.modo_qr === modo
    ) {
      return
    }
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      await cambiarModoQrOperativo(usuario, operativoActivo, modo)
      setAviso(
        modo === 'dinamico'
          ? 'Modo QR cambiado a Dinámico (se renueva cada 30 segundos).'
          : 'Modo QR cambiado a Fijo (listo para descargar).',
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
    if (!operativoActivo || !puedeFinalizar || opEsCerrado) return
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
      if (err instanceof ErrorDeudoresEnCierre) {
        setPreCierre(err.preCierre)
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : mensajeDeError(err))
      }
    } finally {
      setFinalizando(false)
    }
  }

  async function abrirModalEliminarOCancelar() {
    if (!operativoActivo || !soyAdmin) return
    setModalEliminarAbierto(true)
    setConfirmacionNombreEliminar('')
    setMotivoCancelacion('')
    setEstadoBorrado(null)
    setVerificandoBorrado(true)
    setError(null)
    try {
      const verif = await verificarOperativoVacioParaBorrado(operativoActivo.id)
      setEstadoBorrado(verif)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setVerificandoBorrado(false)
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
      setEstadoBorrado(null)
      setSeleccionadoId(null)
      setAviso(`Operativo "${nombreEliminado}" eliminado físicamente y registrado en auditoría.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setEliminando(false)
    }
  }

  async function confirmarBajaLogicaCancelado(e: FormEvent) {
    e.preventDefault()
    if (!operativoActivo || !soyAdmin || opEsCerrado) return
    if (confirmacionNombreEliminar.trim() !== operativoActivo.nombre.trim()) {
      setError('Escribe el nombre exacto del operativo para confirmar su cancelación.')
      return
    }
    setEliminando(true)
    setError(null)
    setAviso(null)
    try {
      await cancelarOperativo(usuario, operativoActivo, motivoCancelacion)
      setModalEliminarAbierto(false)
      setConfirmacionNombreEliminar('')
      setMotivoCancelacion('')
      setEstadoBorrado(null)
      setAviso(
        `Operativo "${operativoActivo.nombre}" marcado como Cancelado (solo lectura) conservando intacto su historial.`,
      )
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

        {ayJefe && (
          <IndicadorAlcanceAyudantia
            ayudantia={ayJefe}
            descripcion={`En los operativos solo visualizarás, pasarás/aprobarás lista y asignarás roles a integrantes de ${ayJefe}.`}
          />
        )}

        {/* Chips de filtro con contador discreto: En curso, Programados, Finalizados / Cancelados */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'en_curso', label: 'En curso', count: conteosEstado.en_curso },
              { id: 'programados', label: 'Programados', count: conteosEstado.programados },
              { id: 'finalizados', label: 'Cerrados', count: conteosEstado.finalizados },
            ] as const
          ).map((chip) => {
            const activo = filtroEstado === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setFiltroEstado(chip.id)
                  if (chip.id === 'finalizados' && !cerradosCargados) {
                    void cargarMasCerrados(true)
                  }
                }}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  activo
                    ? 'bg-udec text-white'
                    : 'border border-borde bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                }`}
              >
                <span>{chip.label}</span>
                {chip.id !== 'finalizados' || cerradosCargados ? (
                  <span className="tabular-nums opacity-80">({chip.count})</span>
                ) : null}
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
                  Configura el pase de lista con código QR fijo o dinámico.
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
                    <option value="dinamico">QR Dinámico (se renueva cada 30 s)</option>
                    <option value="estatico">QR Fijo (para imprimir o proyectar)</option>
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-salvia px-3 dark:border-noche-borde dark:bg-noche-campo">
                  <input
                    type="checkbox"
                    checked={convocatoriaInicial}
                    onChange={(e) => setConvocatoriaInicial(e.target.checked)}
                    className="h-4 w-4 rounded accent-udec"
                  />
                  <span className="text-xs font-semibold text-udec-oscuro dark:text-noche-tinta">
                    Convocatoria abierta (permitir prerregistro previo)
                  </span>
                </label>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label htmlFor="op-cupo" className="etiqueta">
                    Cupo sugerido (opcional)
                  </label>
                  <input
                    id="op-cupo"
                    type="number"
                    min={1}
                    max={1000}
                    placeholder="Sin límite"
                    value={cupoInicial}
                    onChange={(e) => setCupoInicial(e.target.value)}
                    className="campo max-w-xs tabular-nums"
                  />
                </div>
              </div>

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
          <div className="flex flex-col gap-3">
            <div className="tarjeta divide-y divide-borde overflow-hidden dark:divide-noche-borde">
              {filtrados.map((op) => {
                const cerrado = esOperativoCerrado(op)
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setSeleccionadoId(op.id)
                      setSubVista('resumen')
                      setConfirmandoConvocatoria(null)
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

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {!cerrado && op.convocatoria_abierta && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-salvia px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                          <Megaphone size={11} strokeWidth={2} />
                          <span>
                            Convocatoria
                            {op.cupo_sugerido ? ` (cupo ${op.cupo_sugerido})` : ''}
                          </span>
                        </span>
                      )}
                      {cerrado ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-superficie-suave px-2.5 py-0.5 text-[11px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                          {op.estatus === 'Cancelado' ? (
                            <Ban size={11} strokeWidth={2} />
                          ) : (
                            <Lock size={11} strokeWidth={2} />
                          )}
                          <span>{op.estatus === 'Cancelado' ? 'Cancelado' : 'Finalizado'}</span>
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

            {filtroEstado === 'finalizados' && hayMasCerrados && (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={cargandoCerrados}
                  onClick={() => void cargarMasCerrados(false)}
                  className="btn-salvia min-h-9 px-4 text-xs"
                >
                  {cargandoCerrados ? 'Cargando...' : 'Cargar más operativos cerrados'}
                </button>
              </div>
            )}
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
                setConfirmandoConvocatoria(null)
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
              opEsCerrado
                ? 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                : opRecepcionAbierta
                  ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                  : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
            }`}
          >
            {opEsCerrado
              ? etiquetaCerrado
              : opRecepcionAbierta
                ? 'Recepción abierta'
                : 'Recepción cerrada'}
          </span>
        </div>

        {ayJefe && (
          <IndicadorAlcanceAyudantia
            ayudantia={ayJefe}
            descripcion={`Viendo y gestionando únicamente la participación operativa de ${ayJefe}.`}
          />
        )}

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

          {/* Convocatoria y Prerregistro previo */}
          <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie-suave p-4 dark:border-noche-borde dark:bg-noche-campo">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Megaphone
                  size={16}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-udec dark:text-activo-claro"
                />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-tinta dark:text-noche-tinta">
                    Convocatoria y prerregistro previo
                  </h4>
                  <p className="mt-0.5 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    {opEsCerrado
                      ? `Este operativo está ${opEsCancelado ? 'cancelado' : 'finalizado'} en modo solo lectura.`
                      : operativoActivo.convocatoria_abierta
                        ? 'Convocatoria abierta: los brigadistas pueden apuntarse por su cuenta antes del operativo y confirmar con QR al llegar.'
                        : 'Convocatoria cerrada: no admite nuevos prerregistros de brigadistas. Puedes seguir registrando altas manuales, editando roles y confirmando asistencias por QR.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-tarjeta px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-tinta dark:bg-noche-tarjeta dark:text-noche-tinta">
                  <Users size={11} strokeWidth={2} />
                  <span>
                    {prerregistrosCountActivo} apuntado
                    {prerregistrosCountActivo === 1 ? '' : 's'}
                    {operativoActivo.cupo_sugerido ? ` / ${operativoActivo.cupo_sugerido}` : ''}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    operativoActivo.convocatoria_abierta && !opEsCerrado
                      ? 'bg-activo-suave text-activo dark:bg-noche-tarjeta dark:text-activo-claro'
                      : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                  }`}
                >
                  {operativoActivo.convocatoria_abierta && !opEsCerrado
                    ? 'Convocatoria abierta'
                    : 'Convocatoria cerrada'}
                </span>
              </div>
            </div>

            {puedeConfigurarGlobal && !opEsCerrado && (
              <div className="flex flex-col gap-3 border-t border-borde pt-3 dark:border-noche-borde">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      Estado de la convocatoria (reversible)
                    </span>
                    <div
                      role="group"
                      aria-label="Estado de la convocatoria"
                      className="inline-flex rounded-lg border border-borde bg-tarjeta p-0.5 dark:border-noche-borde dark:bg-noche-tarjeta"
                    >
                      <button
                        type="button"
                        disabled={cambiandoEstado || Boolean(operativoActivo.convocatoria_abierta)}
                        onClick={() => setConfirmandoConvocatoria(true)}
                        className={`min-h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-default ${
                          operativoActivo.convocatoria_abierta
                            ? 'bg-udec text-white'
                            : 'text-tinta-suave hover:bg-salvia hover:text-udec-oscuro dark:text-noche-tinta-suave dark:hover:bg-noche-campo'
                        }`}
                      >
                        Convocatoria abierta
                      </button>
                      <button
                        type="button"
                        disabled={cambiandoEstado || !operativoActivo.convocatoria_abierta}
                        onClick={() => setConfirmandoConvocatoria(false)}
                        className={`min-h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-default ${
                          !operativoActivo.convocatoria_abierta
                            ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                            : 'text-tinta-suave hover:bg-salvia hover:text-udec-oscuro dark:text-noche-tinta-suave dark:hover:bg-noche-campo'
                        }`}
                      >
                        Convocatoria cerrada
                      </button>
                    </div>
                  </div>

                  <form onSubmit={guardarCupoSugerido} className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="resumen-cupo"
                        className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave"
                      >
                        Cupo sugerido (vacío = sin límite)
                      </label>
                      <input
                        id="resumen-cupo"
                        type="number"
                        min={1}
                        max={1000}
                        placeholder="Sin límite"
                        value={cupoEdicionActual}
                        onChange={(e) =>
                          setCupoEditadoPorOp({ opId: operativoActivo.id, valor: e.target.value })
                        }
                        className="campo min-h-9 w-36 text-xs tabular-nums"
                        disabled={cambiandoEstado}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={cambiandoEstado}
                      className="btn-salvia min-h-9 px-3 text-xs"
                    >
                      Guardar cupo
                    </button>
                  </form>
                </div>

                {confirmandoConvocatoria !== null && (
                  <div
                    role="region"
                    aria-label="Confirmar cambio de convocatoria"
                    className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-udec/35 bg-tarjeta p-3 dark:border-activo-claro/35 dark:bg-noche-tarjeta"
                  >
                    <p className="min-w-0 flex-1 text-xs font-medium text-tinta dark:text-noche-tinta">
                      {confirmandoConvocatoria
                        ? '¿Abrir la convocatoria ahora? Los brigadistas podrán apuntarse por su cuenta desde su panel.'
                        : '¿Cerrar la convocatoria ahora? Solo detiene nuevos prerregistros abiertos de brigadistas; podrás seguir dando altas manuales, editando roles y confirmando por QR.'}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={cambiandoEstado}
                        onClick={() => setConfirmandoConvocatoria(null)}
                        className="btn-salvia min-h-8 px-3 text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={cambiandoEstado}
                        onClick={() => void aplicarCambioConvocatoria(confirmandoConvocatoria)}
                        className={`min-h-8 px-3 text-xs ${
                          confirmandoConvocatoria ? 'btn-verde' : 'btn-naranja'
                        }`}
                      >
                        {cambiandoEstado
                          ? 'Guardando...'
                          : confirmandoConvocatoria
                            ? 'Sí, abrir convocatoria'
                            : 'Sí, cerrar convocatoria'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Acciones operativas */}
          {puedeGestionar && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-borde pt-4 dark:border-noche-borde">
              {!opEsCerrado ? (
                <>
                  {puedeConfigurarGlobal && (
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
                  )}

                  {puedeFinalizar ? (
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
                  ) : (
                    <span className="text-xs font-medium text-tinta-suave dark:text-noche-tinta-suave">
                      El cierre global definitivo del operativo corresponde a Administración.
                    </span>
                  )}
                </>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                  <Lock size={14} strokeWidth={2} />
                  <span>
                    Este operativo fue {opEsCancelado ? 'cancelado' : 'finalizado'} de forma
                    irreversible. Consulta su bitácora en modo solo lectura.
                  </span>
                </p>
              )}

              {soyAdmin && (
                <button
                  type="button"
                  onClick={() => void abrirModalEliminarOCancelar()}
                  className="btn ml-auto min-h-10 border border-alerta bg-tarjeta px-3.5 text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                >
                  <Trash2 size={15} strokeWidth={2} />
                  <span>Eliminar o Cancelar</span>
                </button>
              )}
            </div>
          )}
        </article>
      )}

      {/* SUB-VISTA B: CONTROL QR */}
      {subVista === 'qr' && (
        <article className="tarjeta mx-auto flex w-full max-w-2xl flex-col gap-4 p-5">
          {opEsCerrado ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                <Lock size={24} strokeWidth={2} />
              </div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Operativo {opEsCancelado ? 'cancelado' : 'finalizado'}
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
              {puedeConfigurarGlobal && (
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

                {puedeConfigurarGlobal && (
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

              {puedeConfigurarGlobal && (
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
                    QR Dinámico (30 s)
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
                    QR Fijo
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
                      Generando código...
                    </div>
                  )}
                </div>

                {operativoActivo.modo_qr === 'dinamico' ? (
                  <div className="flex w-full flex-1 flex-col gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      <RefreshCw size={14} strokeWidth={2} />
                      <span>Rotación automática verificada (cada 30 s)</span>
                    </span>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-3xl font-extrabold tracking-widest tabular-nums text-udec dark:text-activo-claro">
                        {secretoVigente ? secretoVigente.nonce : '--------'}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-naranja-oscuro dark:text-naranja">
                        00:{String(segundosRestantesQr).padStart(2, '0')}s
                      </span>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-esqueleto dark:bg-noche-campo">
                      <div
                        className="h-full rounded-full bg-naranja transition-all duration-300"
                        style={{
                          width: `${(segundosRestantesQr / PERIODO_QR_DINAMICO_SEG) * 100}%`,
                        }}
                      />
                    </div>

                    <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      El código cambia cada 30 segundos (con ventana de gracia de 60 s) y se valida
                      en el servidor. Al cerrar la recepción, se desactiva automáticamente.
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
                      disabled={!payloadQrActual}
                      onClick={descargarQrOperativoPng}
                      className="btn-salvia w-full text-xs"
                    >
                      <Download size={16} strokeWidth={2} />
                      <span>Descargar código QR</span>
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
                        {normalizarNombrePropio(asistencia.usuario_nombre)}{' '}
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

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPreCierre(null)}
                    className="btn-salvia text-xs"
                  >
                    Cerrar
                  </button>
                  {!opRecepcionAbierta && !opEsCerrado && puedeConfigurarGlobal && (
                    <button
                      type="button"
                      disabled={cambiandoEstado}
                      onClick={() => {
                        setPreCierre(null)
                        void alternarRecepcion()
                      }}
                      className="btn-salvia text-xs"
                    >
                      Reabrir recepción
                    </button>
                  )}
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
                    Al confirmar, primero se cerrará preventivamente la recepción y convocatoria, se
                    volverá a verificar que no existan entregas pendientes y el operativo quedará
                    finalizado de forma irreversible.
                  </p>
                  <p className="tabular-nums">
                    • Asistentes totales: <strong>{preCierre.totalAsistencias}</strong>
                    <br />• Salidas abiertas que se cerrarán automáticamente:{' '}
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

      {/* MODAL: PROTECCIÓN CONTRA HUÉRFANOS (BORRADO FÍSICO SI VACÍO / BAJA LÓGICA CANCELADO SI TIENE REGISTROS) */}
      {modalEliminarAbierto && soyAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Eliminar o cancelar operativo"
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
                    {estadoBorrado && !estadoBorrado.vacio
                      ? 'Borrado físico bloqueado por registros asociados'
                      : 'Eliminar Operativo'}
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Acción exclusiva de Administrador con trazabilidad en auditoría.
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

            {verificandoBorrado || !estadoBorrado ? (
              <p className="py-4 text-center text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Verificando registros asociados del operativo...
              </p>
            ) : estadoBorrado.vacio ? (
              <form onSubmit={confirmarEliminacionOperativo} className="flex flex-col gap-3">
                <p className="rounded-lg bg-superficie-suave p-2.5 text-xs text-tinta dark:bg-noche-campo dark:text-noche-tinta">
                  El operativo está completamente vacío (sin asistencias, material ni
                  prerregistros). Puede eliminarse físicamente sin dejar registros huérfanos.
                </p>
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
            ) : (
              <form onSubmit={confirmarBajaLogicaCancelado} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5 rounded-lg border border-ambar bg-ambar-suave p-3 text-xs text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                  <p className="font-bold">
                    No se permite borrar físicamente este operativo porque ya tiene actividad
                    registrada (evita registros huérfanos):
                  </p>
                  <ul className="list-inside list-disc text-[11px] font-medium">
                    {estadoBorrado.tieneAsistencias && <li>Asistencias de personal registradas</li>}
                    {estadoBorrado.tieneEquipos && <li>Material de turno registrado</li>}
                    {estadoBorrado.tienePrerregistros && <li>Prerregistros en convocatoria</li>}
                  </ul>
                </div>

                {opEsCerrado ? (
                  <>
                    <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      Este operativo ya se encuentra en estado <strong>{etiquetaCerrado}</strong>{' '}
                      (solo lectura) y su historial permanece resguardado.
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setModalEliminarAbierto(false)}
                        className="btn-salvia text-xs"
                      >
                        Entendido
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-tinta dark:text-noche-tinta">
                      Puedes darlo de <strong>baja lógica marcándolo como Cancelado</strong>:
                      quedará bloqueado en modo solo lectura igual que un operativo finalizado y
                      conservará sus registros históricos.
                    </p>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="op-motivo-cancelar" className="etiqueta">
                        Motivo de cancelación (opcional)
                      </label>
                      <input
                        id="op-motivo-cancelar"
                        type="text"
                        maxLength={200}
                        value={motivoCancelacion}
                        onChange={(e) => setMotivoCancelacion(e.target.value)}
                        placeholder="Ej. Suspendido por condiciones meteorológicas / creado por error"
                        className="campo text-xs"
                      />
                    </div>

                    <p className="text-xs text-tinta dark:text-noche-tinta">
                      Escribe exactamente <strong className="select-all">{operativoActivo.nombre}</strong>{' '}
                      para confirmar:
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
                        Volver
                      </button>
                      <button
                        type="submit"
                        disabled={
                          eliminando ||
                          confirmacionNombreEliminar.trim() !== operativoActivo.nombre.trim()
                        }
                        className="btn-rojo text-xs"
                      >
                        {eliminando ? 'Cancelando...' : 'Cancelar operativo (baja lógica)'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </article>
        </div>
      )}
    </div>
  )
}
