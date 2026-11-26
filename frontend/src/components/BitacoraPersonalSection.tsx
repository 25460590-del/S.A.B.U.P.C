import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Package,
  PackagePlus,
  QrCode,
  Search,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  EQUIPO_BUPC_SUGERIDO,
  resolverRolInicialOperativo,
} from '../constants/catalogos'
import { normalizarNombrePropio } from '../lib/nombres'
import {
  ayudantiaEfectiva,
  ayudantiaJefatura,
  esOperativoCerrado,
  etiquetaAyudantia,
} from '../lib/permisos'
import {
  actualizarEstadoOperativo,
  actualizarRolEnTurno,
  cerrarSalidaConCandado,
  guardarSignosVitales,
  nombreDePersona,
  parsearQrEscaneado,
  registrarAsistenciaManual,
  registrarAsistenciaQR,
} from '../services/asistenciasService'
import { mensajeDeError } from '../services/authService'
import {
  asignarEquipoBupc,
  asignarEquipoBupcMultiple,
  levantarActaIncidencia,
  marcarEquipoDevueltoOk,
} from '../services/equiposService'
import {
  actualizarRolPrerregistro,
  quitarPrerregistroManual,
  registrarPrerregistroManual,
} from '../services/prerregistrosService'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  EstadoOperativo,
  Operativo,
  PerfilOperativoMinimo,
  PrerregistroOperativo,
  RolEnTurno,
  Usuario,
} from '../types'
import { AlertaInactivoModal, type PersonaAlertaInactivo } from './AlertaInactivoModal'
import type { FiltroEstadoBitacora } from './bitacora/helpers'
import { ListaPorLlegar } from './bitacora/ListaPorLlegar'
import { ModalActaIncidenciaBitacora } from './bitacora/ModalActaIncidenciaBitacora'
import { ModalFichaEmergencia } from './bitacora/ModalFichaEmergencia'
import { ModalMaterialBitacora } from './bitacora/ModalMaterialBitacora'
import { ModalPrerregistroBitacora } from './bitacora/ModalPrerregistroBitacora'
import { ModalRegistroManual } from './bitacora/ModalRegistroManual'
import { ModalSignosVitales } from './bitacora/ModalSignosVitales'
import { TablaAsistencias } from './bitacora/TablaAsistencias'
import { useBitacoraDatos } from './bitacora/useBitacoraDatos'
import { CandadoDuroModal } from './CandadoDuroModal'
import { IndicadorAlcanceAyudantia } from './IndicadorAlcanceAyudantia'
import { QrScannerModal } from './QrScannerModal'

interface BitacoraPersonalSectionProps {
  encargado: Usuario
  operativo: Operativo
}

export function BitacoraPersonalSection({ encargado, operativo }: BitacoraPersonalSectionProps) {
  const esFinalizado = esOperativoCerrado(operativo)
  const recepcionAbierta = operativo.recepcion_abierta && !esFinalizado
  const ayJefe = ayudantiaJefatura(encargado)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoBitacora>('todos')
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS')
  const [filtroAyudantia, setFiltroAyudantia] = useState('TODAS')

  const [modalPrerregistro, setModalPrerregistro] = useState(false)
  const [busquedaPrerregistro, setBusquedaPrerregistro] = useState('')

  const [seleccionadosIds, setSeleccionadosIds] = useState<string[]>([])
  const [modoRapidoAbierto, setModoRapidoAbierto] = useState(false)
  const [rapidoArticulo, setRapidoArticulo] = useState(EQUIPO_BUPC_SUGERIDO[2])
  const [rapidoCantidad, setRapidoCantidad] = useState(1)
  const nonceLoteRef = useRef<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)

  const [modoEscaner, setModoEscaner] = useState<null | 'asistencia' | 'material'>(null)
  const [procesandoQr, setProcesandoQr] = useState(false)
  const [alertaInactivo, setAlertaInactivo] = useState<PersonaAlertaInactivo | null>(null)
  const [candadoPendientes, setCandadoPendientes] = useState<EquipoTurno[] | null>(null)
  const [salidaAnticipadaPendiente, setSalidaAnticipadaPendiente] = useState<{
    asistenciaId: string
    operativoNombre: string
    usuarioNombre: string
    horaEntradaTexto: string
    qrOriginal: string
  } | null>(null)
  const [confirmandoSalidaAnticipada, setConfirmandoSalidaAnticipada] = useState(false)

  const [modalManual, setModalManual] = useState(false)
  const [uidManual, setUidManual] = useState('')
  const [rolManual, setRolManual] = useState<RolEnTurno>('Sin definir')

  const [vitalesObjetivo, setVitalesObjetivo] = useState<AsistenciaPersonal | null>(null)
  const [spo2, setSpo2] = useState('')
  const [fc, setFc] = useState('')
  const [fr, setFr] = useState('')
  const [ta, setTa] = useState('')
  const [temp, setTemp] = useState('')

  const [materialAsistenciaId, setMaterialAsistenciaId] = useState<string | null>(null)
  const [articuloNombre, setArticuloNombre] = useState(EQUIPO_BUPC_SUGERIDO[0])
  const [articuloFolio, setArticuloFolio] = useState('')
  const [articuloCantidad, setArticuloCantidad] = useState(1)
  const [mantenerEnCadena, setMantenerEnCadena] = useState(true)

  const [incidenciaObjetivo, setIncidenciaObjetivo] = useState<EquipoTurno | null>(null)
  const [motivoIncidencia, setMotivoIncidencia] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null)

  const [fichaEmergenciaUid, setFichaEmergenciaUid] = useState<string | null>(null)

  const datos = useBitacoraDatos({
    encargado,
    operativoId: operativo.id,
    ayJefe,
    busqueda,
    filtroEstado,
    filtroGrupo,
    filtroAyudantia,
    busquedaPrerregistro,
    alError: setError,
  })

  useEffect(() => {
    nonceLoteRef.current = null
  }, [seleccionadosIds, rapidoArticulo, rapidoCantidad])

  const asistenciaMaterialActiva =
    datos.asistencias.find((a) => a.id === materialAsistenciaId) ?? null
  const equiposBupcMaterialActivo = asistenciaMaterialActiva
    ? (datos.equiposBupcPorAsistencia.get(asistenciaMaterialActiva.id) ?? [])
    : []
  const equiposPropiosMaterialActivo = asistenciaMaterialActiva
    ? (datos.equiposPropiosPorAsistencia.get(asistenciaMaterialActiva.id) ?? [])
    : []

  const asistenciasSeleccionadasAbiertas = datos.asistencias.filter(
    (a) => seleccionadosIds.includes(a.id) && a.hora_salida === null,
  )

  function alternarSeleccion(id: string) {
    setSeleccionadosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function seleccionarTodosEnTurnoFiltrados() {
    const idsAbiertos = datos.filtradas.filter((a) => a.hora_salida === null).map((a) => a.id)
    const todosMarcados =
      idsAbiertos.length > 0 && idsAbiertos.every((id) => seleccionadosIds.includes(id))
    if (todosMarcados) {
      setSeleccionadosIds((prev) => prev.filter((id) => !idsAbiertos.includes(id)))
    } else {
      setSeleccionadosIds((prev) => Array.from(new Set([...prev, ...idsAbiertos])))
    }
  }

  function abrirCajonMaterial(asistenciaId: string) {
    setMaterialAsistenciaId(asistenciaId)
    setArticuloNombre(EQUIPO_BUPC_SUGERIDO[0])
    setArticuloFolio('')
    setArticuloCantidad(1)
  }

  async function manejarEscanerQr(codigo: string) {
    setProcesandoQr(true)
    setError(null)
    setAviso(null)
    try {
      if (modoEscaner === 'material') {
        const parsed = parsearQrEscaneado(codigo)
        setModoEscaner(null)
        if (!parsed || parsed.tipo !== 'credencial_bupc') {
          setError('Escanea la Credencial Digital QR de un brigadista para gestionar su material.')
          return
        }
        const abierta = datos.asistencias.find(
          (a) => a.usuario_uid === parsed.uid && a.hora_salida === null,
        )
        const cualquierAsis =
          abierta ?? datos.asistencias.find((a) => a.usuario_uid === parsed.uid) ?? null
        if (!cualquierAsis) {
          setError('Ese brigadista no tiene asistencia registrada en este operativo.')
          return
        }
        abrirCajonMaterial(cualquierAsis.id)
        return
      }

      const res = await registrarAsistenciaQR(encargado, codigo, operativo)
      setModoEscaner(null)

      if (res.accion === 'perfil_inactivo') {
        setAlertaInactivo(res.usuario)
      } else if (res.accion === 'candado_duro') {
        setCandadoPendientes(res.pendientes)
      } else if (res.accion === 'confirmar_salida_anticipada') {
        setSalidaAnticipadaPendiente({
          asistenciaId: res.asistenciaId,
          operativoNombre: res.operativoNombre,
          usuarioNombre: res.usuarioNombre,
          horaEntradaTexto: res.horaEntradaTexto,
          qrOriginal: res.qrOriginal,
        })
      } else if (res.accion === 'entrada') {
        setAviso(`Entrada registrada por QR para ${res.usuarioNombre}.`)
      } else if (res.accion === 'salida') {
        setAviso(`Salida registrada por QR para ${res.usuarioNombre} (${res.horasTotales} h).`)
      }
    } catch (err) {
      setModoEscaner(null)
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
      const res = await registrarAsistenciaQR(
        encargado,
        salidaAnticipadaPendiente.qrOriginal,
        operativo,
        { confirmarSalidaAnticipada: true },
      )
      setSalidaAnticipadaPendiente(null)
      if (res.accion === 'candado_duro') {
        setCandadoPendientes(res.pendientes)
      } else if (res.accion === 'salida') {
        setAviso(`Salida registrada por QR para ${res.usuarioNombre} (${res.horasTotales} h).`)
      }
    } catch (err) {
      setSalidaAnticipadaPendiente(null)
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setConfirmandoSalidaAnticipada(false)
    }
  }

  async function manejarRegistroManual(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    const brigadista = datos.mapaPerfiles.get(uidManual) ?? datos.mapaUsuarios.get(uidManual)
    if (!brigadista) {
      setError('Selecciona un brigadista del padrón.')
      return
    }
    setOcupadoId('manual')
    try {
      const res = await registrarAsistenciaManual(encargado, operativo, brigadista, rolManual)
      setModalManual(false)
      setUidManual('')
      setRolManual('Sin definir')
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

  async function manejarAsignarEquipoIndividual(e: FormEvent) {
    e.preventDefault()
    if (!asistenciaMaterialActiva) return
    if (!articuloNombre.trim()) {
      setError('Indica el nombre del artículo BUPC.')
      return
    }
    setOcupadoId(asistenciaMaterialActiva.id)
    setError(null)
    setAviso(null)
    try {
      await asignarEquipoBupc(encargado, asistenciaMaterialActiva, {
        nombre_articulo: articuloNombre,
        codigo_inventario: articuloFolio,
        cantidad: articuloCantidad,
      })
      setAviso(
        `Asignado: ${articuloCantidad > 1 ? `${articuloCantidad}× ` : ''}${articuloNombre.trim()} a ${asistenciaMaterialActiva.usuario_nombre}.`,
      )
      setArticuloFolio('')
      setArticuloCantidad(1)
      if (!mantenerEnCadena) {
        setMaterialAsistenciaId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarAsignacionRapidaMultiple(e: FormEvent) {
    e.preventDefault()
    if (asistenciasSeleccionadasAbiertas.length === 0) {
      setError('Selecciona al menos un brigadista en turno para asignar material.')
      return
    }
    if (!nonceLoteRef.current) {
      nonceLoteRef.current = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    }
    setOcupadoId('rapido')
    setError(null)
    setAviso(null)
    try {
      const total = await asignarEquipoBupcMultiple(encargado, asistenciasSeleccionadasAbiertas, {
        nombre_articulo: rapidoArticulo,
        codigo_inventario: '',
        cantidad: rapidoCantidad,
        operacion_nonce: nonceLoteRef.current,
      })
      nonceLoteRef.current = null
      setAviso(
        `"${rapidoArticulo.trim()}" asignado en lote a ${total} brigadista${total === 1 ? '' : 's'}.`,
      )
      setSeleccionadosIds([])
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

  async function manejarAgregarPrerregistro(p: PerfilOperativoMinimo) {
    setOcupadoId(`pre-${p.uid}`)
    setError(null)
    setAviso(null)
    try {
      await registrarPrerregistroManual(operativo.id, encargado, p)
      setAviso(`${nombreDePersona(p)} agregado a la lista previa del operativo.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarQuitarPrerregistro(p: PrerregistroOperativo) {
    setOcupadoId(`delpre-${p.usuario_uid}`)
    setError(null)
    setAviso(null)
    try {
      await quitarPrerregistroManual(operativo.id, p.usuario_uid)
      setAviso(`${normalizarNombrePropio(p.usuario_nombre)} fue retirado de la lista previa.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  async function manejarActualizarRolPrerregistro(
    p: PrerregistroOperativo,
    nuevoRol: RolEnTurno,
  ) {
    setError(null)
    try {
      await actualizarRolPrerregistro(operativo.id, p.usuario_uid, nuevoRol)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  async function manejarEntradaDesdePrerregistro(p: PrerregistroOperativo) {
    if (!recepcionAbierta) return
    const integrante = datos.mapaPerfiles.get(p.usuario_uid) ?? datos.mapaUsuarios.get(p.usuario_uid)
    if (!integrante) {
      setError('No se encontró el perfil activo de este integrante para registrar entrada manual.')
      return
    }
    setOcupadoId(`inpre-${p.usuario_uid}`)
    setError(null)
    setAviso(null)
    try {
      const rolInicial = resolverRolInicialOperativo(ayudantiaEfectiva(integrante), p)
      const res = await registrarAsistenciaManual(encargado, operativo, integrante, rolInicial)
      if (res.accion === 'perfil_inactivo') {
        setAlertaInactivo(res.usuario)
      } else if (res.accion === 'entrada') {
        setAviso(`Asistencia confirmada para ${res.usuarioNombre}.`)
      }
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
      const res = await cerrarSalidaConCandado(a.id, encargado, true, a)
      if (res.bloqueado) {
        setCandadoPendientes(res.pendientes)
      } else {
        setAviso(`Salida cerrada para ${a.usuario_nombre} (${res.horasTotales} h).`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoId(null)
    }
  }

  const integranteFichaEmergencia = fichaEmergenciaUid
    ? (datos.mapaUsuarios.get(fichaEmergenciaUid) ?? null)
    : null

  return (
    <section
      aria-label="Bitácora de Personal y Material"
      className="tarjeta flex flex-col overflow-hidden"
    >
      {esFinalizado && (
        <div className="flex items-center gap-2 border-b border-borde bg-superficie-suave px-4 py-2 text-xs font-semibold text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
          <Lock size={14} strokeWidth={2} />
          <span>Operativo finalizado — consulta en modo solo lectura.</span>
        </div>
      )}

      {ayJefe && (
        <div className="border-b border-borde p-3 dark:border-noche-borde">
          <IndicadorAlcanceAyudantia
            ayudantia={ayJefe}
            descripcion={`Pase y aprobación de lista, roles en turno, Ficha de Emergencia y material propio acotados a ${ayJefe}.`}
          />
        </div>
      )}

      {/* Barra fija superior de acciones, búsqueda y filtros */}
      <div className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-borde bg-tarjeta p-3 dark:border-noche-borde dark:bg-noche-tarjeta">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1">
            <Search
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
            />
            <input
              type="search"
              placeholder="Buscar nombre, cuenta o clave de radio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="campo min-h-9 pl-9 text-xs"
            />
          </div>

          {!esFinalizado && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModoEscaner('asistencia')}
                className="btn-verde min-h-9 px-2.5 text-xs"
              >
                <QrCode size={14} strokeWidth={2} />
                <span>{recepcionAbierta ? 'QR Entrada/Salida' : 'QR Salida'}</span>
              </button>

              <button
                type="button"
                onClick={() => setModoEscaner('material')}
                className="btn-salvia min-h-9 px-2.5 text-xs"
              >
                <Package size={14} strokeWidth={2} />
                <span>QR → Material</span>
              </button>

              <button
                type="button"
                onClick={() => setModoRapidoAbierto((v) => !v)}
                className={`btn min-h-9 px-2.5 text-xs ${
                  modoRapidoAbierto
                    ? 'bg-udec text-white'
                    : 'border border-borde-fuerte bg-salvia text-udec-oscuro dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta'
                }`}
              >
                <Zap size={14} strokeWidth={2} />
                <span>Entrega rápida</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBusquedaPrerregistro('')
                  setModalPrerregistro(true)
                }}
                title="Agregar o gestionar asistentes prerregistrados antes del operativo"
                className="btn-salvia min-h-9 px-2.5 text-xs"
              >
                <ClipboardCheck size={14} strokeWidth={2} />
                <span>Prerregistrar</span>
              </button>

              <button
                type="button"
                disabled={!recepcionAbierta}
                title={
                  recepcionAbierta
                    ? 'Registrar entrada manualmente'
                    : 'Recepción cerrada: reábrela para registrar nuevas entradas'
                }
                onClick={() => {
                  setUidManual('')
                  setRolManual('Sin definir')
                  setModalManual(true)
                }}
                className="btn-naranja min-h-9 px-2.5 text-xs"
              >
                <UserPlus size={14} strokeWidth={2} />
                <span>Manual</span>
              </button>
            </div>
          )}
        </div>

        {(datos.prerregistros.length > 0 || operativo.convocatoria_abierta) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-superficie-suave px-3 py-1.5 text-[11px] font-semibold text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
              <span className="inline-flex items-center gap-1 text-tinta dark:text-noche-tinta">
                <Users size={12} strokeWidth={2} className="text-udec dark:text-activo-claro" />
                <span>
                  Apuntados: <strong>{datos.prerregistros.length}</strong>
                  {operativo.cupo_sugerido ? `/${operativo.cupo_sugerido}` : ''}
                </span>
              </span>
              <span className="text-activo dark:text-activo-claro">
                Confirmados: <strong>{datos.confirmadosCount}</strong>
              </span>
              <span
                className={
                  esFinalizado ? 'text-tinta-suave' : 'text-ambar-texto dark:text-noche-ambar-texto'
                }
              >
                {esFinalizado ? 'No asistió' : 'Por llegar'}:{' '}
                <strong>{datos.pendientesDeLlegar.length}</strong>
              </span>
            </div>
            {!esFinalizado && (
              <span className="text-[11px]">
                {operativo.convocatoria_abierta ? 'Convocatoria abierta' : 'Convocatoria cerrada'}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todos', count: datos.conteos.todos },
              { id: 'en_turno', label: 'En turno', count: datos.conteos.enTurno },
              { id: 'con_adeudo', label: 'Con adeudo', count: datos.conteos.conAdeudo },
              { id: 'salidos', label: 'Salidos', count: datos.conteos.salidos },
              {
                id: 'por_llegar',
                label: esFinalizado ? 'No asistió' : 'Por llegar',
                count: datos.conteos.porLlegar,
              },
            ] as const
          ).map((chip) => {
            const activo = filtroEstado === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFiltroEstado(chip.id)}
                className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors ${
                  activo
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:bg-noche-campo dark:text-noche-tinta-suave'
                }`}
              >
                <span>{chip.label}</span>
                <span className="tabular-nums opacity-80">({chip.count})</span>
              </button>
            )
          })}

          {datos.gruposDisponibles.length > 1 && (
            <select
              aria-label="Filtrar por etapa o grupo"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
            >
              <option value="TODOS">Etapa / Grupo</option>
              {datos.gruposDisponibles.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}

          {!ayJefe && datos.ayudantiasDisponibles.length > 1 && (
            <select
              aria-label="Filtrar por ayudantía"
              value={filtroAyudantia}
              onChange={(e) => setFiltroAyudantia(e.target.value)}
              className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
            >
              <option value="TODAS">Ayudantía</option>
              {datos.ayudantiasDisponibles.map((ay) => (
                <option key={ay} value={ay}>
                  {etiquetaAyudantia(ay)}
                </option>
              ))}
            </select>
          )}
        </div>

        {!esFinalizado && modoRapidoAbierto && (
          <form
            onSubmit={(e) => void manejarAsignacionRapidaMultiple(e)}
            className="flex flex-col gap-2 rounded-lg border border-udec/40 bg-salvia/70 p-2.5 dark:border-activo-claro/40 dark:bg-noche-campo"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-udec-oscuro dark:text-activo-claro">
                Entrega rápida en lote ({asistenciasSeleccionadasAbiertas.length} seleccionado
                {asistenciasSeleccionadasAbiertas.length === 1 ? '' : 's'})
              </span>
              <button
                type="button"
                onClick={seleccionarTodosEnTurnoFiltrados}
                className="cursor-pointer text-[11px] font-bold text-udec underline dark:text-activo-claro"
              >
                Marcar/desmarcar visibles en turno
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {EQUIPO_BUPC_SUGERIDO.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRapidoArticulo(item)}
                  className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    rapidoArticulo === item
                      ? 'bg-udec text-white'
                      : 'border border-borde bg-tarjeta text-tinta dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                maxLength={120}
                value={rapidoArticulo}
                onChange={(e) => setRapidoArticulo(e.target.value)}
                placeholder="Artículo a entregar"
                className="campo min-h-9 flex-1 text-xs"
                required
              />
              <input
                type="number"
                min={1}
                max={99}
                aria-label="Cantidad"
                value={rapidoCantidad}
                onChange={(e) => setRapidoCantidad(Math.max(1, Number(e.target.value) || 1))}
                className="campo min-h-9 w-16 text-center text-xs font-bold tabular-nums"
              />
              <button
                type="submit"
                disabled={ocupadoId === 'rapido' || asistenciasSeleccionadasAbiertas.length === 0}
                className="btn-naranja min-h-9 px-3 text-xs"
              >
                <PackagePlus size={14} strokeWidth={2} />
                <span>
                  {ocupadoId === 'rapido'
                    ? 'Asignando...'
                    : `Asignar (${asistenciasSeleccionadasAbiertas.length})`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mx-3 mt-2.5 flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="mx-3 mt-2.5 flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-2.5 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {datos.cargando ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="h-9 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-9 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-9 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : filtroEstado === 'por_llegar' ? (
        <ListaPorLlegar
          esFinalizado={esFinalizado}
          recepcionAbierta={recepcionAbierta}
          pendientesDeLlegar={datos.pendientesDeLlegar}
          pendientesFiltrados={datos.pendientesFiltrados}
          ocupadoId={ocupadoId}
          alActualizarRol={(p, rol) => void manejarActualizarRolPrerregistro(p, rol)}
          alConfirmarEntrada={(p) => void manejarEntradaDesdePrerregistro(p)}
          alQuitar={(p) => void manejarQuitarPrerregistro(p)}
        />
      ) : (
        <TablaAsistencias
          asistenciasTotales={datos.asistencias.length}
          filtradas={datos.filtradas}
          esFinalizado={esFinalizado}
          modoRapidoAbierto={modoRapidoAbierto}
          seleccionadosIds={seleccionadosIds}
          ocupadoId={ocupadoId}
          mapaPerfiles={datos.mapaPerfiles}
          mapaUsuarios={datos.mapaUsuarios}
          uidsPrerregistrados={datos.uidsPrerregistrados}
          equiposPropiosPorAsistencia={datos.equiposPropiosPorAsistencia}
          alAlternarSeleccion={alternarSeleccion}
          alSeleccionarTodosEnTurno={seleccionarTodosEnTurnoFiltrados}
          alCambiarRol={(id, rol) =>
            void actualizarRolEnTurno(id, rol).catch((err) => setError(mensajeDeError(err)))
          }
          alCambiarEstado={(id, est: EstadoOperativo) =>
            void actualizarEstadoOperativo(id, est).catch((err) => setError(mensajeDeError(err)))
          }
          alAbrirFichaEmergencia={setFichaEmergenciaUid}
          alAbrirMaterial={abrirCajonMaterial}
          alAbrirVitales={abrirModalVitales}
          alCerrarSalidaManual={(a) => void manejarCerrarSalidaManual(a)}
        />
      )}

      {modoEscaner && (
        <QrScannerModal
          titulo={
            modoEscaner === 'material'
              ? 'Escanear Credencial → Material'
              : recepcionAbierta
                ? 'Escanear Credencial QR'
                : 'Escanear Credencial (Solo Salidas)'
          }
          subtitulo={`Operativo: ${operativo.nombre}`}
          instruccion={
            modoEscaner === 'material'
              ? 'Encuadra la credencial del brigadista para abrir su resguardo de material'
              : 'Encuadra la Credencial Digital QR del Brigadista'
          }
          procesando={procesandoQr}
          alDetectar={(codigo) => void manejarEscanerQr(codigo)}
          alCerrar={() => setModoEscaner(null)}
        />
      )}

      {alertaInactivo && (
        <AlertaInactivoModal usuario={alertaInactivo} alCerrar={() => setAlertaInactivo(null)} />
      )}

      {candadoPendientes && (
        <CandadoDuroModal
          pendientes={candadoPendientes}
          alEntendido={() => setCandadoPendientes(null)}
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
              <Clock
                size={20}
                strokeWidth={2}
                className="mt-0.5 shrink-0 text-naranja-oscuro dark:text-naranja"
              />
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Confirmar salida anticipada
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  <strong className="text-tinta dark:text-noche-tinta">
                    {salidaAnticipadaPendiente.usuarioNombre}
                  </strong>{' '}
                  ya registró entrada a las{' '}
                  <strong className="tabular-nums text-tinta dark:text-noche-tinta">
                    {salidaAnticipadaPendiente.horaEntradaTexto}
                  </strong>
                  . ¿Confirmar salida anticipada?
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

      {integranteFichaEmergencia && (
        <ModalFichaEmergencia
          integrante={integranteFichaEmergencia}
          alCerrar={() => setFichaEmergenciaUid(null)}
        />
      )}

      {asistenciaMaterialActiva && (
        <ModalMaterialBitacora
          asistencia={asistenciaMaterialActiva}
          equiposBupc={equiposBupcMaterialActivo}
          equiposPropios={equiposPropiosMaterialActivo}
          esFinalizado={esFinalizado}
          ocupadoId={ocupadoId}
          articuloNombre={articuloNombre}
          articuloFolio={articuloFolio}
          articuloCantidad={articuloCantidad}
          mantenerEnCadena={mantenerEnCadena}
          alCambiarNombre={setArticuloNombre}
          alCambiarFolio={setArticuloFolio}
          alCambiarCantidad={setArticuloCantidad}
          alCambiarMantener={setMantenerEnCadena}
          alAsignar={(e) => void manejarAsignarEquipoIndividual(e)}
          alDevolverOk={(eq) => void manejarDevolverOk(eq)}
          alAbrirIncidencia={(eq) => {
            setIncidenciaObjetivo(eq)
            setMotivoIncidencia('')
            setArchivoEvidencia(null)
          }}
          alCerrar={() => setMaterialAsistenciaId(null)}
        />
      )}

      {modalPrerregistro && !esFinalizado && (
        <ModalPrerregistroBitacora
          operativo={operativo}
          totalApuntados={datos.prerregistros.length}
          confirmadosCount={datos.confirmadosCount}
          pendientesDeLlegar={datos.pendientesDeLlegar}
          candidatos={datos.candidatosPrerregistro}
          busqueda={busquedaPrerregistro}
          ocupadoId={ocupadoId}
          alCambiarBusqueda={setBusquedaPrerregistro}
          alAgregar={(p) => void manejarAgregarPrerregistro(p)}
          alQuitar={(p) => void manejarQuitarPrerregistro(p)}
          alActualizarRol={(p, rol) => void manejarActualizarRolPrerregistro(p, rol)}
          alCerrar={() => setModalPrerregistro(false)}
        />
      )}

      {modalManual && !esFinalizado && (
        <ModalRegistroManual
          operativoNombre={operativo.nombre}
          perfilesActivos={datos.perfilesActivos}
          mapaPrerregistros={datos.mapaPrerregistros}
          uidManual={uidManual}
          rolManual={rolManual}
          ocupado={ocupadoId === 'manual'}
          alCambiarUid={setUidManual}
          alCambiarRol={setRolManual}
          alEnviar={(e) => void manejarRegistroManual(e)}
          alCerrar={() => setModalManual(false)}
        />
      )}

      {vitalesObjetivo && !esFinalizado && (
        <ModalSignosVitales
          objetivo={vitalesObjetivo}
          spo2={spo2}
          fc={fc}
          fr={fr}
          ta={ta}
          temp={temp}
          ocupado={ocupadoId === vitalesObjetivo.id}
          alCambiarSpo2={setSpo2}
          alCambiarFc={setFc}
          alCambiarFr={setFr}
          alCambiarTa={setTa}
          alCambiarTemp={setTemp}
          alGuardar={(e) => void manejarGuardarVitales(e)}
          alCerrar={() => setVitalesObjetivo(null)}
        />
      )}

      {incidenciaObjetivo && !esFinalizado && (
        <ModalActaIncidenciaBitacora
          objetivo={incidenciaObjetivo}
          motivo={motivoIncidencia}
          archivoEvidencia={archivoEvidencia}
          ocupado={ocupadoId === incidenciaObjetivo.id}
          alCambiarMotivo={setMotivoIncidencia}
          alCambiarArchivo={setArchivoEvidencia}
          alEnviar={(e) => void manejarLevantarIncidencia(e)}
          alCerrar={() => setIncidenciaObjetivo(null)}
        />
      )}
    </section>
  )
}
