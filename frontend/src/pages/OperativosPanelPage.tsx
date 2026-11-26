import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileText,
  QrCode,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BitacoraPersonalSection } from '../components/BitacoraPersonalSection'
import { IndicadorAlcanceAyudantia } from '../components/IndicadorAlcanceAyudantia'
import { ControlQrOperativo } from '../components/operativos/ControlQrOperativo'
import {
  clasificarOperativo,
  type FiltroEstadoOperativo,
  type SubVistaOperativo,
} from '../components/operativos/helpers'
import { ListaOperativos } from '../components/operativos/ListaOperativos'
import { ModalEliminarOperativo } from '../components/operativos/ModalEliminarOperativo'
import { ModalFinalizarOperativo } from '../components/operativos/ModalFinalizarOperativo'
import { ResumenOperativo } from '../components/operativos/ResumenOperativo'
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
  type DatosNuevoOperativo,
  type PaginaOperativos,
  type ResultadoPreCierreOperativo,
  type VerificacionBorradoOperativo,
} from '../services/operativosService'
import { escucharContadorPrerregistros } from '../services/prerregistrosService'
import type {
  ModoQrOperativo,
  Operativo,
  SecretoEstaticoOperativo,
  SecretoVigenteOperativo,
  Usuario,
} from '../types'

interface OperativosPanelPageProps {
  usuario: Usuario
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
  const [contadorPorOp, setContadorPorOp] = useState<{
    opId: string
    conteo: number | null
  } | null>(null)
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

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [cupoEditadoPorOp, setCupoEditadoPorOp] = useState<{
    opId: string
    valor: string
  } | null>(null)
  const [confirmandoConvocatoria, setConfirmandoConvocatoria] = useState<boolean | null>(null)

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

  async function manejarCrearOperativo(datos: DatosNuevoOperativo) {
    setError(null)
    setAviso(null)
    setGuardando(true)
    try {
      const nuevoId = await crearYConfigurarOperativo(usuario, datos)
      setSeleccionadoId(nuevoId)
      setSubVista('resumen')
      setMostrarFormulario(false)
      setAviso('Operativo creado y listo para pase de lista con código QR.')
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
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

  // ── VISTA 1: LISTA COMPACTA DE OPERATIVOS ──────────────────────────────────
  if (!operativoActivo) {
    return (
      <ListaOperativos
        puedeGestionar={puedeGestionar}
        ayJefe={ayJefe}
        cargando={cargando}
        filtroEstado={filtroEstado}
        conteosEstado={conteosEstado}
        cerradosCargados={cerradosCargados}
        hayMasCerrados={hayMasCerrados}
        cargandoCerrados={cargandoCerrados}
        filtrados={filtrados}
        mostrarFormulario={mostrarFormulario}
        guardando={guardando}
        error={error}
        aviso={aviso}
        alAlternarFormulario={() => setMostrarFormulario((v) => !v)}
        alCerrarFormulario={() => setMostrarFormulario(false)}
        alCambiarFiltro={(filtro) => {
          setFiltroEstado(filtro)
          if (filtro === 'finalizados' && !cerradosCargados) {
            void cargarMasCerrados(true)
          }
        }}
        alCargarMasCerrados={() => void cargarMasCerrados(false)}
        alSeleccionarOperativo={(opId) => {
          setSeleccionadoId(opId)
          setSubVista('resumen')
          setConfirmandoConvocatoria(null)
          setError(null)
          setAviso(null)
        }}
        alCrearOperativo={manejarCrearOperativo}
        alErrorValidacion={setError}
      />
    )
  }

  // ── VISTA 2: DETALLE DE OPERATIVO SEGMENTADO EN 3 SUB-VISTAS ───────────────
  return (
    <div className="flex flex-col gap-4">
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
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {subVista === 'resumen' && (
        <ResumenOperativo
          operativo={operativoActivo}
          opEsCerrado={opEsCerrado}
          opEsCancelado={opEsCancelado}
          opRecepcionAbierta={opRecepcionAbierta}
          prerregistrosCount={prerregistrosCountActivo}
          puedeGestionar={puedeGestionar}
          puedeConfigurarGlobal={puedeConfigurarGlobal}
          puedeFinalizar={puedeFinalizar}
          soyAdmin={soyAdmin}
          cambiandoEstado={cambiandoEstado}
          verificandoCierre={verificandoCierre}
          cupoEdicionActual={cupoEdicionActual}
          confirmandoConvocatoria={confirmandoConvocatoria}
          alCambiarCupoEdicion={(valor) =>
            setCupoEditadoPorOp({ opId: operativoActivo.id, valor })
          }
          alGuardarCupo={(e) => void guardarCupoSugerido(e)}
          alPedirConfirmacionConvocatoria={setConfirmandoConvocatoria}
          alConfirmarConvocatoria={(sig) => void aplicarCambioConvocatoria(sig)}
          alAlternarRecepcion={() => void alternarRecepcion()}
          alIniciarFinalizar={() => void iniciarFlujoFinalizar()}
          alAbrirEliminarOCancelar={() => void abrirModalEliminarOCancelar()}
        />
      )}

      {subVista === 'qr' && (
        <ControlQrOperativo
          operativo={operativoActivo}
          opEsCerrado={opEsCerrado}
          opEsCancelado={opEsCancelado}
          opRecepcionAbierta={opRecepcionAbierta}
          puedeConfigurarGlobal={puedeConfigurarGlobal}
          cambiandoEstado={cambiandoEstado}
          payloadQrActual={payloadQrActual}
          secretoVigente={secretoVigente}
          segundosRestantesQr={segundosRestantesQr}
          alAlternarRecepcion={() => void alternarRecepcion()}
          alCambiarModoQr={(modo) => void cambiarModoQr(modo)}
        />
      )}

      {subVista === 'bitacora' && puedeGestionar && (
        <BitacoraPersonalSection encargado={usuario} operativo={operativoActivo} />
      )}

      {preCierre && (
        <ModalFinalizarOperativo
          operativoNombre={operativoActivo.nombre}
          preCierre={preCierre}
          opRecepcionAbierta={opRecepcionAbierta}
          opEsCerrado={opEsCerrado}
          puedeConfigurarGlobal={puedeConfigurarGlobal}
          cambiandoEstado={cambiandoEstado}
          finalizando={finalizando}
          alCerrar={() => setPreCierre(null)}
          alReabrirRecepcion={() => {
            setPreCierre(null)
            void alternarRecepcion()
          }}
          alIrABitacora={() => {
            setPreCierre(null)
            setSubVista('bitacora')
          }}
          alConfirmar={() => void confirmarFinalizacionIrreversible()}
        />
      )}

      {modalEliminarAbierto && soyAdmin && (
        <ModalEliminarOperativo
          operativoNombre={operativoActivo.nombre}
          opEsCerrado={opEsCerrado}
          etiquetaCerrado={etiquetaCerrado}
          verificandoBorrado={verificandoBorrado}
          estadoBorrado={estadoBorrado}
          motivoCancelacion={motivoCancelacion}
          confirmacionNombreEliminar={confirmacionNombreEliminar}
          eliminando={eliminando}
          alCambiarMotivo={setMotivoCancelacion}
          alCambiarConfirmacion={setConfirmacionNombreEliminar}
          alConfirmarEliminacion={(e) => void confirmarEliminacionOperativo(e)}
          alConfirmarCancelacion={(e) => void confirmarBajaLogicaCancelado(e)}
          alCerrar={() => setModalEliminarAbierto(false)}
        />
      )}
    </div>
  )
}
