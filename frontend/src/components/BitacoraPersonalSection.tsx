import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileWarning,
  Lock,
  Package,
  PackagePlus,
  QrCode,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { EQUIPO_BUPC_SUGERIDO, ESTADOS_OPERATIVOS, ROLES_EN_TURNO } from '../constants/catalogos'
import { normalizarNombrePropio } from '../lib/nombres'
import { etiquetaAyudantia } from '../lib/permisos'
import {
  actualizarEstadoOperativo,
  actualizarRolEnTurno,
  cerrarSalidaConCandado,
  escucharAsistenciasDeOperativo,
  escucharUsuariosParaBitacora,
  guardarSignosVitales,
  parsearQrEscaneado,
  registrarAsistenciaManual,
  registrarAsistenciaQR,
} from '../services/asistenciasService'
import { mensajeDeError, nombreCompleto } from '../services/authService'
import {
  asignarEquipoBupc,
  asignarEquipoBupcMultiple,
  escucharEquiposDeOperativo,
  levantarActaIncidencia,
  marcarEquipoDevueltoOk,
} from '../services/equiposService'
import {
  escucharPrerregistrosDeOperativo,
  quitarPrerregistroManual,
  registrarPrerregistroManual,
} from '../services/prerregistrosService'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  EstadoOperativo,
  Operativo,
  PrerregistroOperativo,
  RolEnTurno,
  Usuario,
} from '../types'
import { AlertaInactivoModal } from './AlertaInactivoModal'
import { CandadoDuroModal } from './CandadoDuroModal'
import { QrScannerModal } from './QrScannerModal'

interface BitacoraPersonalSectionProps {
  encargado: Usuario
  operativo: Operativo
}

type FiltroEstadoBitacora = 'todos' | 'en_turno' | 'con_adeudo' | 'salidos' | 'por_llegar'

function formatearHoraCorta(ms?: number): string {
  if (!ms) return '--:--'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function etiquetaMetodoEntrada(metodo: AsistenciaPersonal['metodo_entrada']): string {
  switch (metodo) {
    case 'QR_Operativo_TOTP':
      return 'QR Dinámico'
    case 'QR_Operativo_Estatico':
      return 'QR Fijo'
    case 'QR_Credencial':
      return 'Credencial QR'
    case 'Manual':
      return 'Manual'
  }
}

function etiquetaGrupoAsistencia(a: AsistenciaPersonal, mapaUsuarios: Map<string, Usuario>): string {
  const u = mapaUsuarios.get(a.usuario_uid)
  if (u?.subgrupo) return u.subgrupo
  if (u?.etapa) return u.etapa
  return a.grupo_operativo === 'Ninguno' ? 'Grupo Operativo' : a.grupo_operativo
}

export function BitacoraPersonalSection({ encargado, operativo }: BitacoraPersonalSectionProps) {
  const esFinalizado = operativo.estatus === 'Finalizado'
  const recepcionAbierta = operativo.recepcion_abierta && !esFinalizado

  const [asistencias, setAsistencias] = useState<AsistenciaPersonal[]>([])
  const [prerregistros, setPrerregistros] = useState<PrerregistroOperativo[]>([])
  const [equipos, setEquipos] = useState<EquipoTurno[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros 100% en cliente (cero lecturas extra en Firestore)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoBitacora>('todos')
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS')
  const [filtroAyudantia, setFiltroAyudantia] = useState('TODAS')

  // Modal Prerregistro Manual previo
  const [modalPrerregistro, setModalPrerregistro] = useState(false)
  const [busquedaPrerregistro, setBusquedaPrerregistro] = useState('')

  // Selección múltiple para asignación rápida de equipo repetitivo
  const [seleccionadosIds, setSeleccionadosIds] = useState<string[]>([])
  const [modoRapidoAbierto, setModoRapidoAbierto] = useState(false)
  const [rapidoArticulo, setRapidoArticulo] = useState(EQUIPO_BUPC_SUGERIDO[2])
  const [rapidoCantidad, setRapidoCantidad] = useState(1)

  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupadoId, setOcupadoId] = useState<string | null>(null)

  // Escáner QR dual: asistencia o acceso directo a material del brigadista
  const [modoEscaner, setModoEscaner] = useState<null | 'asistencia' | 'material'>(null)
  const [procesandoQr, setProcesandoQr] = useState(false)
  const [alertaInactivo, setAlertaInactivo] = useState<Usuario | null>(null)
  const [candadoPendientes, setCandadoPendientes] = useState<EquipoTurno[] | null>(null)

  // Modal Registro Manual
  const [modalManual, setModalManual] = useState(false)
  const [uidManual, setUidManual] = useState('')
  const [rolManual, setRolManual] = useState<RolEnTurno>('Primeros Auxilios')

  // Modal Signos Vitales
  const [vitalesObjetivo, setVitalesObjetivo] = useState<AsistenciaPersonal | null>(null)
  const [spo2, setSpo2] = useState('')
  const [fc, setFc] = useState('')
  const [fr, setFr] = useState('')
  const [ta, setTa] = useState('')
  const [temp, setTemp] = useState('')

  // Cajón/Modal de Material del Brigadista (entregar en cadena + devolver + incidencia)
  const [materialAsistenciaId, setMaterialAsistenciaId] = useState<string | null>(null)
  const [articuloNombre, setArticuloNombre] = useState(EQUIPO_BUPC_SUGERIDO[0])
  const [articuloFolio, setArticuloFolio] = useState('')
  const [articuloCantidad, setArticuloCantidad] = useState(1)
  const [mantenerEnCadena, setMantenerEnCadena] = useState(true)

  // Modal Acta de Incidencia
  const [incidenciaObjetivo, setIncidenciaObjetivo] = useState<EquipoTurno | null>(null)
  const [motivoIncidencia, setMotivoIncidencia] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null)

  useEffect(() => {
    const cancelarAsis = escucharAsistenciasDeOperativo(
      operativo.id,
      (lista) => {
        setAsistencias(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    const cancelarPre = escucharPrerregistrosDeOperativo(operativo.id, setPrerregistros)
    const cancelarEq = escucharEquiposDeOperativo(operativo.id, setEquipos, (err) =>
      setError(mensajeDeError(err)),
    )
    const cancelarUsr = escucharUsuariosParaBitacora(setUsuarios, () => undefined)

    return () => {
      cancelarAsis()
      cancelarPre()
      cancelarEq()
      cancelarUsr()
    }
  }, [operativo.id])

  const mapaUsuarios = useMemo(
    () => new Map(usuarios.map((u) => [u.uid, u])),
    [usuarios],
  )

  // Cruce en memoria prerregistros <-> asistencias_personal (0 escrituras extra al escanear QR)
  const { uidsPrerregistrados, pendientesDeLlegar, confirmadosCount } = useMemo(() => {
    const uidsAsis = new Set(asistencias.map((a) => a.usuario_uid))
    const uidsPre = new Set(prerregistros.map((p) => p.usuario_uid))
    const pendientes: PrerregistroOperativo[] = []
    let confirmados = 0
    for (const p of prerregistros) {
      if (uidsAsis.has(p.usuario_uid)) confirmados++
      else pendientes.push(p)
    }
    return {
      uidsPrerregistrados: uidsPre,
      pendientesDeLlegar: pendientes,
      confirmadosCount: confirmados,
    }
  }, [asistencias, prerregistros])

  const { equiposBupcPorAsistencia, equiposPropiosPorAsistencia } = useMemo(() => {
    const mapaBupc = new Map<string, EquipoTurno[]>()
    const mapaPropios = new Map<string, EquipoTurno[]>()
    for (const eq of equipos) {
      const destino = eq.origen_material === 'Propio' ? mapaPropios : mapaBupc
      const lista = destino.get(eq.asistencia_id) ?? []
      lista.push(eq)
      destino.set(eq.asistencia_id, lista)
    }
    return { equiposBupcPorAsistencia: mapaBupc, equiposPropiosPorAsistencia: mapaPropios }
  }, [equipos])

  const gruposDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const a of asistencias) {
      set.add(etiquetaGrupoAsistencia(a, mapaUsuarios))
    }
    for (const p of prerregistros) {
      set.add(p.subgrupo || p.etapa)
    }
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'es-MX'))
  }, [asistencias, prerregistros, mapaUsuarios])

  const ayudantiasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const a of asistencias) {
      set.add(a.ayudantia_slot)
    }
    for (const p of prerregistros) {
      set.add(p.ayudantia)
    }
    return Array.from(set).sort((x, y) => x.localeCompare(y, 'es-MX'))
  }, [asistencias, prerregistros])

  // Contadores discretos para chips de estatus
  const conteos = useMemo(() => {
    let enTurno = 0
    let conAdeudo = 0
    let salidos = 0
    for (const a of asistencias) {
      if (a.hora_salida !== null) salidos++
      else enTurno++
      if (a.equipos_bupc_pendientes > 0) conAdeudo++
    }
    return {
      todos: asistencias.length,
      enTurno,
      conAdeudo,
      salidos,
      porLlegar: pendientesDeLlegar.length,
    }
  }, [asistencias, pendientesDeLlegar.length])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return asistencias.filter((a) => {
      if (filtroEstado === 'en_turno' && a.hora_salida !== null) return false
      if (filtroEstado === 'con_adeudo' && a.equipos_bupc_pendientes <= 0) return false
      if (filtroEstado === 'salidos' && a.hora_salida === null) return false

      const grupo = etiquetaGrupoAsistencia(a, mapaUsuarios)
      if (filtroGrupo !== 'TODOS' && grupo !== filtroGrupo) return false
      if (filtroAyudantia !== 'TODAS' && a.ayudantia_slot !== filtroAyudantia) return false

      if (!q) return true
      const u = mapaUsuarios.get(a.usuario_uid)
      const claveRadio = (u?.clave_radio || u?.clave_personal_radio || '').toLowerCase()
      return (
        a.usuario_nombre.toLowerCase().includes(q) ||
        a.usuario_cuenta.toLowerCase().includes(q) ||
        a.rol_en_turno.toLowerCase().includes(q) ||
        grupo.toLowerCase().includes(q) ||
        claveRadio.includes(q)
      )
    })
  }, [asistencias, filtroEstado, filtroGrupo, filtroAyudantia, busqueda, mapaUsuarios])

  const pendientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return pendientesDeLlegar.filter((p) => {
      const grupo = p.subgrupo || p.etapa
      if (filtroGrupo !== 'TODOS' && grupo !== filtroGrupo) return false
      if (filtroAyudantia !== 'TODAS' && p.ayudantia !== filtroAyudantia) return false
      if (!q) return true
      return (
        p.usuario_nombre.toLowerCase().includes(q) ||
        p.usuario_cuenta.toLowerCase().includes(q) ||
        grupo.toLowerCase().includes(q)
      )
    })
  }, [pendientesDeLlegar, filtroGrupo, filtroAyudantia, busqueda])

  const usuariosActivos = useMemo(
    () => usuarios.filter((u) => u.estatus === 'Activo'),
    [usuarios],
  )

  const candidatosPrerregistro = useMemo(() => {
    const q = busquedaPrerregistro.trim().toLowerCase()
    const uidsConAsis = new Set(asistencias.map((a) => a.usuario_uid))
    return usuariosActivos.filter((u) => {
      if (uidsPrerregistrados.has(u.uid) || uidsConAsis.has(u.uid)) return false
      if (!q) return true
      const grupo = (u.subgrupo || u.etapa || '').toLowerCase()
      return (
        nombreCompleto(u).toLowerCase().includes(q) ||
        u.numero_cuenta.toLowerCase().includes(q) ||
        grupo.includes(q)
      )
    })
  }, [usuariosActivos, uidsPrerregistrados, asistencias, busquedaPrerregistro])
  const asistenciaMaterialActiva =
    asistencias.find((a) => a.id === materialAsistenciaId) ?? null
  const equiposBupcMaterialActivo = asistenciaMaterialActiva
    ? (equiposBupcPorAsistencia.get(asistenciaMaterialActiva.id) ?? [])
    : []
  const equiposPropiosMaterialActivo = asistenciaMaterialActiva
    ? (equiposPropiosPorAsistencia.get(asistenciaMaterialActiva.id) ?? [])
    : []

  const asistenciasSeleccionadasAbiertas = asistencias.filter(
    (a) => seleccionadosIds.includes(a.id) && a.hora_salida === null,
  )

  function alternarSeleccion(id: string) {
    setSeleccionadosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function seleccionarTodosEnTurnoFiltrados() {
    const idsAbiertos = filtradas.filter((a) => a.hora_salida === null).map((a) => a.id)
    const todosMarcados =
      idsAbiertos.length > 0 && idsAbiertos.every((id) => seleccionadosIds.includes(id))
    if (todosMarcados) {
      setSeleccionadosIds((prev) => prev.filter((id) => !idsAbiertos.includes(id)))
    } else {
      setSeleccionadosIds((prev) => Array.from(new Set([...prev, ...idsAbiertos])))
    }
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
        const abierta = asistencias.find(
          (a) => a.usuario_uid === parsed.uid && a.hora_salida === null,
        )
        const cualquierAsis =
          abierta ?? asistencias.find((a) => a.usuario_uid === parsed.uid) ?? null
        if (!cualquierAsis) {
          setError('Ese brigadista no tiene asistencia registrada en este operativo.')
          return
        }
        setMaterialAsistenciaId(cualquierAsis.id)
        setArticuloNombre(EQUIPO_BUPC_SUGERIDO[0])
        setArticuloFolio('')
        setArticuloCantidad(1)
        return
      }

      const res = await registrarAsistenciaQR(encargado, codigo, operativo)
      setModoEscaner(null)

      if (res.accion === 'perfil_inactivo') {
        setAlertaInactivo(res.usuario)
      } else if (res.accion === 'candado_duro') {
        setCandadoPendientes(res.pendientes)
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

  async function manejarRegistroManual(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    const brigadista = usuarios.find((u) => u.uid === uidManual)
    if (!brigadista) {
      setError('Selecciona un brigadista del padrón.')
      return
    }
    setOcupadoId('manual')
    try {
      const res = await registrarAsistenciaManual(encargado, operativo, brigadista, rolManual)
      setModalManual(false)
      setUidManual('')
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
    setOcupadoId('rapido')
    setError(null)
    setAviso(null)
    try {
      const total = await asignarEquipoBupcMultiple(encargado, asistenciasSeleccionadasAbiertas, {
        nombre_articulo: rapidoArticulo,
        codigo_inventario: '',
        cantidad: rapidoCantidad,
      })
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

  async function manejarAgregarPrerregistro(u: Usuario) {
    setOcupadoId(`pre-${u.uid}`)
    setError(null)
    setAviso(null)
    try {
      await registrarPrerregistroManual(operativo.id, encargado, u)
      setAviso(`${nombreCompleto(u)} agregado a la lista previa del operativo.`)
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

  async function manejarEntradaDesdePrerregistro(p: PrerregistroOperativo) {
    if (!recepcionAbierta) return
    const u = mapaUsuarios.get(p.usuario_uid)
    if (!u) {
      setError('No se encontró el perfil activo de este integrante para registrar entrada manual.')
      return
    }
    setOcupadoId(`inpre-${p.usuario_uid}`)
    setError(null)
    setAviso(null)
    try {
      const res = await registrarAsistenciaManual(encargado, operativo, u, 'Sin asignar')
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
      const res = await cerrarSalidaConCandado(a.id, encargado, true)
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

  return (
    <section
      aria-label="Bitácora de Personal y Material"
      className="tarjeta flex flex-col overflow-hidden"
    >
      {/* Banner solo lectura si Finalizado */}
      {esFinalizado && (
        <div className="flex items-center gap-2 border-b border-borde bg-superficie-suave px-4 py-2 text-xs font-semibold text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
          <Lock size={14} strokeWidth={2} />
          <span>Operativo finalizado — consulta en modo solo lectura.</span>
        </div>
      )}

      {/* Barra fija superior de acciones, búsqueda instantánea y filtros 100% en cliente */}
      <div className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-borde bg-tarjeta p-3 dark:border-noche-borde dark:bg-noche-tarjeta">
        {/* Fila 1: búsqueda + acciones principales */}
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
                onClick={() => setModalManual(true)}
                className="btn-naranja min-h-9 px-2.5 text-xs"
              >
                <UserPlus size={14} strokeWidth={2} />
                <span>Manual</span>
              </button>
            </div>
          )}
        </div>

        {/* Resumen rápido de convocatoria/prerregistro cuando aplica */}
        {(prerregistros.length > 0 || operativo.convocatoria_abierta) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borde bg-superficie-suave px-3 py-1.5 text-[11px] font-semibold text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums">
              <span className="inline-flex items-center gap-1 text-tinta dark:text-noche-tinta">
                <Users size={12} strokeWidth={2} className="text-udec dark:text-activo-claro" />
                <span>
                  Apuntados: <strong>{prerregistros.length}</strong>
                  {operativo.cupo_sugerido ? `/${operativo.cupo_sugerido}` : ''}
                </span>
              </span>
              <span className="text-activo dark:text-activo-claro">
                Confirmados: <strong>{confirmadosCount}</strong>
              </span>
              <span className={esFinalizado ? 'text-tinta-suave' : 'text-ambar-texto dark:text-noche-ambar-texto'}>
                {esFinalizado ? 'No asistió' : 'Por llegar'}:{' '}
                <strong>{pendientesDeLlegar.length}</strong>
              </span>
            </div>
            {!esFinalizado && (
              <span className="text-[10px]">
                {operativo.convocatoria_abierta ? 'Convocatoria abierta' : 'Convocatoria cerrada'}
              </span>
            )}
          </div>
        )}

        {/* Fila 2: chips de estatus + filtros por Etapa/Grupo y Ayudantía */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todos', count: conteos.todos },
              { id: 'en_turno', label: 'En turno', count: conteos.enTurno },
              { id: 'con_adeudo', label: 'Con adeudo', count: conteos.conAdeudo },
              { id: 'salidos', label: 'Salidos', count: conteos.salidos },
              {
                id: 'por_llegar',
                label: esFinalizado ? 'No asistió' : 'Por llegar',
                count: conteos.porLlegar,
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

          {gruposDisponibles.length > 1 && (
            <select
              aria-label="Filtrar por etapa o grupo"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
            >
              <option value="TODOS">Etapa / Grupo</option>
              {gruposDisponibles.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}

          {ayudantiasDisponibles.length > 1 && (
            <select
              aria-label="Filtrar por ayudantía"
              value={filtroAyudantia}
              onChange={(e) => setFiltroAyudantia(e.target.value)}
              className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
            >
              <option value="TODAS">Ayudantía</option>
              {ayudantiasDisponibles.map((ay) => (
                <option key={ay} value={ay}>
                  {etiquetaAyudantia(ay)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Barra de asignación rápida de material repetitivo en lote */}
        {!esFinalizado && modoRapidoAbierto && (
          <form
            onSubmit={manejarAsignacionRapidaMultiple}
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
          className="mx-3 mt-2.5 flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="mx-3 mt-2.5 flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-2.5 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Listado denso (40-80 personas): Por llegar / No asistió O Asistencias reales */}
      {cargando ? (
        <div className="flex flex-col gap-2 p-3">
          <div className="h-9 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-9 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-9 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : filtroEstado === 'por_llegar' ? (
        pendientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 p-8 text-center">
            <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
              {pendientesDeLlegar.length === 0
                ? esFinalizado
                  ? 'Todos los prerregistrados asistieron al operativo'
                  : 'No hay integrantes pendientes por llegar'
                : 'Sin coincidencias con los filtros activos'}
            </p>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              {pendientesDeLlegar.length === 0 && !esFinalizado
                ? 'Usa "Prerregistrar" para apuntar integrantes previamente o abre la convocatoria en Resumen.'
                : 'Ajusta el buscador o los filtros de etapa y ayudantía.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-borde dark:divide-noche-borde">
            {pendientesFiltrados.map((p) => {
              const grupo = p.subgrupo || p.etapa
              return (
                <div
                  key={p.usuario_uid}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                        {normalizarNombrePropio(p.usuario_nombre)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          esFinalizado
                            ? 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                            : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                        }`}
                      >
                        <Clock size={10} strokeWidth={2} />
                        <span>{esFinalizado ? 'No asistió' : 'Por llegar'}</span>
                      </span>
                      <span className="rounded bg-superficie-suave px-1.5 py-0.5 text-[10px] font-semibold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                        {p.origen === 'Autoregistro' ? 'Autoregistro' : 'Manual'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      {grupo} · {etiquetaAyudantia(p.ayudantia)} ·{' '}
                      <span className="tabular-nums">{p.usuario_cuenta}</span>
                    </p>
                  </div>

                  {!esFinalizado && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {recepcionAbierta && (
                        <button
                          type="button"
                          disabled={ocupadoId === `inpre-${p.usuario_uid}`}
                          onClick={() => void manejarEntradaDesdePrerregistro(p)}
                          className="btn-verde min-h-8 px-2.5 text-[11px]"
                        >
                          <UserPlus size={12} strokeWidth={2} />
                          <span>
                            {ocupadoId === `inpre-${p.usuario_uid}`
                              ? 'Registrando...'
                              : 'Confirmar entrada'}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={ocupadoId === `delpre-${p.usuario_uid}`}
                        onClick={() => void manejarQuitarPrerregistro(p)}
                        title="Quitar de la lista previa"
                        aria-label={`Quitar a ${p.usuario_nombre} del prerregistro`}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-2.5 text-[11px] font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                      >
                        <Trash2 size={12} strokeWidth={2} />
                        <span>Quitar</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 p-8 text-center">
          <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
            {asistencias.length === 0
              ? 'Sin personal registrado en este operativo'
              : 'Sin coincidencias con los filtros activos'}
          </p>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            {asistencias.length === 0
              ? 'Escanea una credencial QR o usa el registro manual para iniciar el pase de lista.'
              : 'Ajusta el buscador o los chips de estatus.'}
          </p>
        </div>
      ) : (
        <>
          {/* MÓVIL (< md): filas densas de 2 líneas sin scroll horizontal */}
          <div className="divide-y divide-borde md:hidden dark:divide-noche-borde">
            {filtradas.map((a) => {
              const cerrada = a.hora_salida !== null
              const grupo = etiquetaGrupoAsistencia(a, mapaUsuarios)
              const marcado = seleccionadosIds.includes(a.id)
              const propios = equiposPropiosPorAsistencia.get(a.id) ?? []
              const estabaPrerregistrado = uidsPrerregistrados.has(a.usuario_uid)

              return (
                <div key={a.id} className="flex flex-col gap-1.5 px-3 py-2">
                  {/* Línea 1: Selección + Nombre + Badge de estado + Material propio */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      {!esFinalizado && modoRapidoAbierto && !cerrada && (
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alternarSeleccion(a.id)}
                          aria-label={`Seleccionar a ${a.usuario_nombre}`}
                          className="h-4 w-4 shrink-0 rounded accent-udec"
                        />
                      )}
                      <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                        {normalizarNombrePropio(a.usuario_nombre)}
                      </span>
                      {estabaPrerregistrado ? (
                        <span className="shrink-0 rounded bg-salvia px-1.5 py-0.5 text-[9px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                          Confirmado
                        </span>
                      ) : (
                        <span className="shrink-0 rounded border border-borde px-1.5 py-0.5 text-[9px] font-semibold text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave">
                          Sin prerregistro
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {propios.length > 0 && (
                        <span
                          title={`Material propio: ${propios.map((p) => p.nombre_articulo).join(', ')}`}
                          className="rounded-full bg-salvia px-2 py-0.5 text-[10px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro"
                        >
                          Propio ({propios.length})
                        </span>
                      )}
                      {cerrada ? (
                        <span className="rounded-full bg-superficie-suave px-2 py-0.5 text-[10px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                          Salida {formatearHoraCorta(a.hora_salida?.toMillis())}
                        </span>
                      ) : a.equipos_bupc_pendientes > 0 ? (
                        <span className="rounded-full bg-naranja-suave px-2 py-0.5 text-[10px] font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                          BUPC ({a.equipos_bupc_pendientes})
                        </span>
                      ) : (
                        <span className="rounded-full bg-activo-suave px-2 py-0.5 text-[10px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
                          En turno
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Línea 2: Metadatos compactos + Acciones 1 toque */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      {grupo} · {etiquetaAyudantia(a.ayudantia_slot)} ·{' '}
                      {formatearHoraCorta(a.hora_entrada?.toMillis())}
                    </p>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMaterialAsistenciaId(a.id)
                          setArticuloNombre(EQUIPO_BUPC_SUGERIDO[0])
                          setArticuloFolio('')
                          setArticuloCantidad(1)
                        }}
                        className="cursor-pointer rounded border border-borde bg-salvia px-2 py-1 text-[11px] font-bold text-udec-oscuro dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                      >
                        Material
                        {a.equipos_bupc_pendientes + propios.length > 0
                          ? ` (${a.equipos_bupc_pendientes + propios.length})`
                          : ''}
                      </button>

                      {!esFinalizado && (
                        <button
                          type="button"
                          onClick={() => abrirModalVitales(a)}
                          aria-label={`Signos vitales de ${a.usuario_nombre}`}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-borde bg-fondo text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
                        >
                          <Activity size={13} strokeWidth={2} />
                        </button>
                      )}

                      {!esFinalizado && !cerrada && (
                        <button
                          type="button"
                          disabled={ocupadoId === a.id}
                          onClick={() => void manejarCerrarSalidaManual(a)}
                          className="cursor-pointer rounded border border-borde-fuerte bg-tarjeta px-2 py-1 text-[11px] font-bold text-tinta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta"
                        >
                          Salida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ESCRITORIO (md+): tabla densa sin tarjetas infladas */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-udec-oscuro text-white">
                <tr>
                  {!esFinalizado && modoRapidoAbierto && (
                    <th scope="col" className="w-9 px-2.5 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos en turno"
                        onChange={seleccionarTodosEnTurnoFiltrados}
                        checked={
                          filtradas.some((a) => a.hora_salida === null) &&
                          filtradas
                            .filter((a) => a.hora_salida === null)
                            .every((a) => seleccionadosIds.includes(a.id))
                        }
                        className="h-4 w-4 rounded accent-naranja"
                      />
                    </th>
                  )}
                  <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                    Brigadista
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                    Entrada
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                    Rol / Estado
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                    Estatus turno
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-[11px] font-semibold">
                    Material
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-[11px] font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde dark:divide-noche-borde">
                {filtradas.map((a) => {
                  const cerrada = a.hora_salida !== null
                  const grupo = etiquetaGrupoAsistencia(a, mapaUsuarios)
                  const u = mapaUsuarios.get(a.usuario_uid)
                  const claveRadio = u?.clave_radio || u?.clave_personal_radio || ''
                  const marcado = seleccionadosIds.includes(a.id)
                  const propios = equiposPropiosPorAsistencia.get(a.id) ?? []
                  const estabaPrerregistrado = uidsPrerregistrados.has(a.usuario_uid)

                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
                    >
                      {!esFinalizado && modoRapidoAbierto && (
                        <td className="px-2.5 py-1.5 text-center">
                          {!cerrada && (
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternarSeleccion(a.id)}
                              aria-label={`Seleccionar a ${a.usuario_nombre}`}
                              className="h-4 w-4 rounded accent-udec"
                            />
                          )}
                        </td>
                      )}

                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                            {normalizarNombrePropio(a.usuario_nombre)}
                          </span>
                          {estabaPrerregistrado ? (
                            <span className="rounded bg-salvia px-1.5 py-0.5 text-[9px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                              Confirmado
                            </span>
                          ) : (
                            <span className="rounded border border-borde px-1.5 py-0.5 text-[9px] font-semibold text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave">
                              Sin prerregistro
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          {grupo} · {etiquetaAyudantia(a.ayudantia_slot)} ·{' '}
                          <span className="tabular-nums">{a.usuario_cuenta}</span>
                          {claveRadio ? ` · ${claveRadio}` : ''}
                        </span>
                      </td>

                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="block text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
                          {formatearHoraCorta(a.hora_entrada?.toMillis())}
                        </span>
                        <span className="text-[10px] text-tinta-suave dark:text-noche-tinta-suave">
                          {etiquetaMetodoEntrada(a.metodo_entrada)}
                        </span>
                      </td>

                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Rol en turno de ${a.usuario_nombre}`}
                            value={a.rol_en_turno}
                            disabled={cerrada || esFinalizado}
                            onChange={(e) =>
                              void actualizarRolEnTurno(a.id, e.target.value as RolEnTurno).catch(
                                (err) => setError(mensajeDeError(err)),
                              )
                            }
                            className="campo min-h-8 w-auto py-0.5 text-[11px]"
                          >
                            {ROLES_EN_TURNO.map((rol) => (
                              <option key={rol} value={rol}>
                                {rol}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={`Estado operativo de ${a.usuario_nombre}`}
                            value={a.estado_operativo}
                            disabled={cerrada || esFinalizado}
                            onChange={(e) =>
                              void actualizarEstadoOperativo(
                                a.id,
                                e.target.value as EstadoOperativo,
                              ).catch((err) => setError(mensajeDeError(err)))
                            }
                            className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
                          >
                            {ESTADOS_OPERATIVOS.map((est) => (
                              <option key={est} value={est}>
                                {est}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        {cerrada ? (
                          <div>
                            <span className="inline-flex rounded-full bg-superficie-suave px-2 py-0.5 text-[10px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                              Salida registrada
                            </span>
                            <span className="mt-0.5 block text-[10px] font-semibold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                              {formatearHoraCorta(a.hora_salida?.toMillis())} ({a.horas_totales ?? 0} h)
                            </span>
                          </div>
                        ) : a.equipos_bupc_pendientes > 0 ? (
                          <span className="inline-flex rounded-full bg-naranja-suave px-2 py-0.5 text-[10px] font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
                            Con material ({a.equipos_bupc_pendientes})
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-activo-suave px-2 py-0.5 text-[10px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
                            En turno
                          </span>
                        )}
                      </td>

                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setMaterialAsistenciaId(a.id)
                              setArticuloNombre(EQUIPO_BUPC_SUGERIDO[0])
                              setArticuloFolio('')
                              setArticuloCantidad(1)
                            }}
                            className="btn-salvia min-h-8 px-2.5 text-[11px]"
                          >
                            <Package size={13} strokeWidth={2} />
                            <span>
                              {a.equipos_bupc_pendientes > 0
                                ? `BUPC (${a.equipos_bupc_pendientes})`
                                : esFinalizado
                                  ? 'Ver'
                                  : propios.length > 0
                                    ? 'Ver / Entregar'
                                    : 'Entregar'}
                            </span>
                          </button>

                          {propios.length > 0 && (
                            <button
                              type="button"
                              title={`Material propio: ${propios.map((p) => p.nombre_articulo).join(', ')}`}
                              onClick={() => {
                                setMaterialAsistenciaId(a.id)
                                setArticuloNombre(EQUIPO_BUPC_SUGERIDO[0])
                                setArticuloFolio('')
                                setArticuloCantidad(1)
                              }}
                              className="cursor-pointer rounded-full border border-udec/35 bg-salvia/70 px-2 py-0.5 text-[10px] font-bold tabular-nums text-udec-oscuro hover:bg-salvia dark:border-activo-claro/35 dark:bg-noche-campo dark:text-activo-claro"
                            >
                              Propio ({propios.length})
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {!esFinalizado && (
                            <button
                              type="button"
                              onClick={() => abrirModalVitales(a)}
                              title="Signos vitales"
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-borde bg-fondo px-2 text-[11px] font-semibold text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                            >
                              <Activity size={13} strokeWidth={2} />
                              <span>{a.signos_vitales?.spo2 ? `${a.signos_vitales.spo2}%` : 'SV'}</span>
                            </button>
                          )}
                          {!esFinalizado && !cerrada && (
                            <button
                              type="button"
                              disabled={ocupadoId === a.id}
                              onClick={() => void manejarCerrarSalidaManual(a)}
                              className="btn-salvia min-h-8 px-2.5 text-[11px]"
                            >
                              {ocupadoId === a.id ? '...' : 'Cerrar Salida'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Escáner QR (Asistencia o Directo a Material) */}
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

      {/* Modal Alerta Roja INACTIVO */}
      {alertaInactivo && (
        <AlertaInactivoModal usuario={alertaInactivo} alCerrar={() => setAlertaInactivo(null)} />
      )}

      {/* Modal Candado Duro */}
      {candadoPendientes && (
        <CandadoDuroModal
          pendientes={candadoPendientes}
          alEntendido={() => setCandadoPendientes(null)}
        />
      )}

      {/* Cajón / Modal de Material del Brigadista (Material BUPC + Material Propio) */}
      {asistenciaMaterialActiva && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Material del turno del Brigadista"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
        >
          <article className="tarjeta flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
            <header className="flex items-center justify-between gap-2 border-b border-borde bg-udec px-4 py-3 text-white dark:border-noche-borde">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">
                  Material del turno · {normalizarNombrePropio(asistenciaMaterialActiva.usuario_nombre)}
                </h3>
                <p className="text-[11px] text-white/85 tabular-nums">
                  BUPC pendientes: {asistenciaMaterialActiva.equipos_bupc_pendientes} · Propio
                  registrado: {equiposPropiosMaterialActivo.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaterialAsistenciaId(null)}
                aria-label="Cerrar cajón de material"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {/* Formulario de entrega rápida (solo si el turno sigue abierto y operativo no finalizado) */}
              {!esFinalizado && asistenciaMaterialActiva.hora_salida === null && (
                <form
                  onSubmit={manejarAsignarEquipoIndividual}
                  className="flex flex-col gap-2.5 rounded-lg border border-borde bg-superficie-suave p-3 dark:border-noche-borde dark:bg-noche-campo"
                >
                  <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                    Entregar nuevo artículo BUPC
                  </span>

                  <div className="flex flex-wrap gap-1">
                    {EQUIPO_BUPC_SUGERIDO.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setArticuloNombre(item)}
                        className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          articuloNombre === item
                            ? 'bg-udec text-white'
                            : 'border border-borde bg-tarjeta text-tinta dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Nombre del artículo"
                      value={articuloNombre}
                      onChange={(e) => setArticuloNombre(e.target.value)}
                      className="campo min-h-9 text-xs sm:col-span-6"
                      required
                    />
                    <input
                      type="text"
                      maxLength={60}
                      placeholder="Serie o folio (opcional)"
                      value={articuloFolio}
                      onChange={(e) => setArticuloFolio(e.target.value)}
                      className="campo min-h-9 text-xs tabular-nums sm:col-span-4"
                    />
                    <input
                      type="number"
                      min={1}
                      max={99}
                      aria-label="Cantidad"
                      value={articuloCantidad}
                      onChange={(e) =>
                        setArticuloCantidad(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="campo min-h-9 text-center text-xs font-bold tabular-nums sm:col-span-2"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                      <input
                        type="checkbox"
                        checked={mantenerEnCadena}
                        onChange={(e) => setMantenerEnCadena(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-udec"
                      />
                      <span>Mantener abierto para seguir entregando</span>
                    </label>
                    <button
                      type="submit"
                      disabled={ocupadoId === asistenciaMaterialActiva.id}
                      className="btn-naranja min-h-9 px-3.5 text-xs"
                    >
                      <PackagePlus size={14} strokeWidth={2} />
                      <span>
                        {ocupadoId === asistenciaMaterialActiva.id ? 'Asignando...' : 'Entregar'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* Sección 1: Material BUPC (sujeto a devolución) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase text-naranja-oscuro dark:text-naranja">
                    Material BUPC ({equiposBupcMaterialActivo.length})
                  </h4>
                  <span className="text-[11px] font-medium text-tinta-suave dark:text-noche-tinta-suave">
                    Sujeto a devolución
                  </span>
                </div>

                {equiposBupcMaterialActivo.length === 0 ? (
                  <p className="rounded-lg border border-borde bg-superficie-suave py-3.5 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                    Sin artículos BUPC asignados aún.
                  </p>
                ) : (
                  equiposBupcMaterialActivo.map((eq) => {
                    const pendiente = !eq.devuelto && eq.acta_incidencia === null
                    const cant = eq.cantidad ?? 1
                    return (
                      <div
                        key={eq.id}
                        className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-2.5 dark:border-noche-borde dark:bg-noche-campo"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                              {cant > 1 ? `${cant}× ` : ''}
                              {eq.nombre_articulo}
                              {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                            </p>
                            <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                              Entregado: {formatearHoraCorta(eq.creado_en?.toMillis())}
                              {eq.creado_por_nombre ? ` · Por ${eq.creado_por_nombre}` : ''}
                            </p>
                            {eq.falla_reportada && (
                              <p className="text-[11px] font-semibold text-alerta dark:text-noche-rojo-texto">
                                Falla: {eq.falla_reportada}
                              </p>
                            )}
                            {eq.acta_incidencia && (
                              <p className="text-[11px] font-semibold text-ambar-texto dark:text-noche-ambar-texto">
                                Acta: {eq.acta_incidencia.motivo}
                              </p>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              eq.devuelto
                                ? 'bg-activo-suave text-activo dark:bg-noche-tarjeta dark:text-activo-claro'
                                : eq.acta_incidencia
                                  ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                  : 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-tarjeta dark:text-naranja'
                            }`}
                          >
                            {eq.devuelto ? 'Devuelto OK' : eq.acta_incidencia ? 'Con Acta' : 'Pendiente'}
                          </span>
                        </div>

                        {pendiente && !esFinalizado && (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={ocupadoId === eq.id}
                              onClick={() => void manejarDevolverOk(eq)}
                              className="cursor-pointer rounded border border-activo bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo hover:bg-emerald-100 disabled:opacity-50 dark:border-activo-claro dark:bg-noche-tarjeta dark:text-activo-claro"
                            >
                              Devolver OK
                            </button>
                            <button
                              type="button"
                              disabled={ocupadoId === eq.id}
                              onClick={() => {
                                setIncidenciaObjetivo(eq)
                                setMotivoIncidencia('')
                                setArchivoEvidencia(null)
                              }}
                              className="cursor-pointer rounded border border-alerta bg-tarjeta px-2.5 py-1 text-[11px] font-bold text-alerta hover:bg-alerta-suave disabled:opacity-50 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                            >
                              Acta de Incidencia
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Sección 2: Material Propio (informativo, no bloquea salida) */}
              <div className="flex flex-col gap-2 border-t border-borde pt-3 dark:border-noche-borde">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase text-udec dark:text-activo-claro">
                    Material Propio ({equiposPropiosMaterialActivo.length})
                  </h4>
                  <span className="text-[11px] font-medium text-tinta-suave dark:text-noche-tinta-suave">
                    Informativo · no bloquea salida
                  </span>
                </div>

                {equiposPropiosMaterialActivo.length === 0 ? (
                  <p className="rounded-lg border border-borde bg-superficie-suave py-3.5 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                    Sin material propio registrado en este turno.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {equiposPropiosMaterialActivo.map((eq) => {
                      const cant = eq.cantidad ?? 1
                      return (
                        <div
                          key={eq.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-udec/25 bg-salvia/40 p-2.5 dark:border-activo-claro/25 dark:bg-noche-campo"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                              {cant > 1 ? `${cant}× ` : ''}
                              {eq.nombre_articulo}
                              {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                            </p>
                            <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                              Registrado: {formatearHoraCorta(eq.creado_en?.toMillis())}
                            </p>
                            {eq.falla_reportada && (
                              <p className="text-[11px] font-semibold text-alerta dark:text-noche-rojo-texto">
                                Observación: {eq.falla_reportada}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-salvia px-2 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro">
                            Propio
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </article>
        </div>
      )}

      {/* Modal Prerregistro Manual previo (buscar integrantes activos y agregar/quitar en 1 clic) */}
      {modalPrerregistro && !esFinalizado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Prerregistro previo de asistentes"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
        >
          <article className="tarjeta flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b-3 border-naranja bg-udec px-4 py-3 text-white">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold">
                  Prerregistro previo · {operativo.nombre}
                </h3>
                <p className="text-[11px] text-white/85 tabular-nums">
                  Apuntados: {prerregistros.length}
                  {operativo.cupo_sugerido ? ` / ${operativo.cupo_sugerido}` : ''} · Confirmados:{' '}
                  {confirmadosCount} · Por llegar: {pendientesDeLlegar.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalPrerregistro(false)}
                aria-label="Cerrar prerregistro"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
              >
                <X size={17} strokeWidth={2} />
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="relative">
                <Search
                  size={15}
                  strokeWidth={2}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
                />
                <input
                  type="search"
                  placeholder="Buscar integrante activo por nombre, cuenta o grupo..."
                  value={busquedaPrerregistro}
                  onChange={(e) => setBusquedaPrerregistro(e.target.value)}
                  className="campo min-h-10 pl-9 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave dark:text-noche-tinta-suave">
                  Integrantes disponibles ({candidatosPrerregistro.length})
                </span>
                {candidatosPrerregistro.length === 0 ? (
                  <p className="rounded-lg border border-borde bg-superficie-suave py-4 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                    {busquedaPrerregistro.trim()
                      ? 'Sin integrantes disponibles con esa búsqueda.'
                      : 'Todos los integrantes activos disponibles ya están apuntados o en turno.'}
                  </p>
                ) : (
                  <div className="flex max-h-56 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde dark:divide-noche-borde dark:border-noche-borde">
                    {candidatosPrerregistro.slice(0, 40).map((u) => (
                      <div
                        key={u.uid}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                            {nombreCompleto(u)}
                          </span>
                          <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                            {u.subgrupo || u.etapa} · {etiquetaAyudantia(u.ayudantia)} ·{' '}
                            <span className="tabular-nums">{u.numero_cuenta}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={ocupadoId === `pre-${u.uid}`}
                          onClick={() => void manejarAgregarPrerregistro(u)}
                          className="btn-verde min-h-8 shrink-0 px-2.5 text-[11px]"
                        >
                          <UserPlus size={12} strokeWidth={2} />
                          <span>{ocupadoId === `pre-${u.uid}` ? '...' : 'Agregar'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {pendientesDeLlegar.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-borde pt-3 dark:border-noche-borde">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave dark:text-noche-tinta-suave">
                    Apuntados por llegar ({pendientesDeLlegar.length})
                  </span>
                  <div className="flex max-h-44 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde dark:divide-noche-borde dark:border-noche-borde">
                    {pendientesDeLlegar.map((p) => (
                      <div
                        key={p.usuario_uid}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-tinta dark:text-noche-tinta">
                            {normalizarNombrePropio(p.usuario_nombre)}
                          </span>
                          <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                            {p.subgrupo || p.etapa} ·{' '}
                            {p.origen === 'Autoregistro' ? 'Autoregistro' : 'Manual'}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={ocupadoId === `delpre-${p.usuario_uid}`}
                          onClick={() => void manejarQuitarPrerregistro(p)}
                          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-2 text-[11px] font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                        >
                          <Trash2 size={12} strokeWidth={2} />
                          <span>Quitar</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setModalPrerregistro(false)}
                  className="btn-salvia min-h-9 px-4 text-xs"
                >
                  Listo
                </button>
              </div>
            </div>
          </article>
        </div>
      )}

      {/* Modal Registro Manual */}
      {modalManual && !esFinalizado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registro Manual de Asistencia"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Registro Manual · {operativo.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setModalManual(false)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarRegistroManual} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="manual-usr" className="etiqueta">
                  Brigadista activo
                </label>
                <select
                  id="manual-usr"
                  value={uidManual}
                  onChange={(e) => setUidManual(e.target.value)}
                  className="campo"
                  required
                >
                  <option value="">Selecciona un brigadista...</option>
                  {usuariosActivos.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {nombreCompleto(u)} ({u.numero_cuenta})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="manual-rol" className="etiqueta">
                  Rol en turno
                </label>
                <select
                  id="manual-rol"
                  value={rolManual}
                  onChange={(e) => setRolManual(e.target.value as RolEnTurno)}
                  className="campo"
                >
                  {ROLES_EN_TURNO.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalManual(false)}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={ocupadoId === 'manual'} className="btn-verde">
                  {ocupadoId === 'manual' ? 'Registrando...' : 'Registrar Entrada'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}

      {/* Modal Signos Vitales */}
      {vitalesObjetivo && !esFinalizado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Captura de Signos Vitales"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Captura de Signos Vitales
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  {vitalesObjetivo.usuario_nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVitalesObjetivo(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarGuardarVitales} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-spo2" className="etiqueta">
                    SpO2 (%)
                  </label>
                  <input
                    id="vit-spo2"
                    type="text"
                    placeholder="98"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-fc" className="etiqueta">
                    FC (lpm)
                  </label>
                  <input
                    id="vit-fc"
                    type="text"
                    placeholder="76"
                    value={fc}
                    onChange={(e) => setFc(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-fr" className="etiqueta">
                    FR (rpm)
                  </label>
                  <input
                    id="vit-fr"
                    type="text"
                    placeholder="16"
                    value={fr}
                    onChange={(e) => setFr(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="vit-ta" className="etiqueta">
                    TA (mmHg)
                  </label>
                  <input
                    id="vit-ta"
                    type="text"
                    placeholder="120/80"
                    value={ta}
                    onChange={(e) => setTa(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label htmlFor="vit-temp" className="etiqueta">
                    Temperatura (°C)
                  </label>
                  <input
                    id="vit-temp"
                    type="text"
                    placeholder="36.6"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="campo tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVitalesObjetivo(null)}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupadoId === vitalesObjetivo.id}
                  className="btn-verde"
                >
                  {ocupadoId === vitalesObjetivo.id ? 'Guardando...' : 'Guardar Signos'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}

      {/* Modal Acta de Incidencia (evidencia WebP bajo demanda en evidencias_equipos) */}
      {incidenciaObjetivo && !esFinalizado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Acta de Incidencia de Material"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <article className="tarjeta flex w-full max-w-md flex-col gap-4 border-2 border-alerta p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <FileWarning
                  size={20}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-alerta dark:text-noche-rojo-texto"
                />
                <div>
                  <h3 className="text-base font-bold text-alerta dark:text-noche-rojo-texto">
                    Acta de Incidencia · Material BUPC
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    {incidenciaObjetivo.nombre_articulo} · {incidenciaObjetivo.usuario_nombre}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncidenciaObjetivo(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={manejarLevantarIncidencia} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="inc-motivo" className="etiqueta">
                  Motivo de la incidencia (obligatorio)
                </label>
                <textarea
                  id="inc-motivo"
                  rows={3}
                  maxLength={400}
                  placeholder="Describe extravío, daño o faltante..."
                  value={motivoIncidencia}
                  onChange={(e) => setMotivoIncidencia(e.target.value)}
                  className="campo min-h-20 py-2 text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="etiqueta">Evidencia fotográfica (opcional)</span>
                <label className="btn-salvia min-h-10 cursor-pointer text-xs">
                  <Upload size={15} strokeWidth={2} />
                  <span>
                    {archivoEvidencia ? archivoEvidencia.name : 'Adjuntar fotografía'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setArchivoEvidencia(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIncidenciaObjetivo(null)}
                  className="btn-salvia"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupadoId === incidenciaObjetivo.id}
                  className="btn-rojo"
                >
                  {ocupadoId === incidenciaObjetivo.id
                    ? 'Guardando...'
                    : 'Levantar Acta y Liberar'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
    </section>
  )
}
