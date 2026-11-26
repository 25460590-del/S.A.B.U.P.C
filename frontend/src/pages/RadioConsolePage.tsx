import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudOff,
  Download,
  Pencil,
  Plus,
  Radio,
  Send,
  Sun,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { RebacePanel } from '../components/RebacePanel'
import { CANALES_SUGERIDOS } from '../constants/rebaceSeed'
import { useWakeLock } from '../hooks/useWakeLock'
import { mensajeDeError } from '../services/authService'
import { escucharOperativosActivos } from '../services/operativosService'
import {
  agregarUnidadCanal,
  cargarCatalogoRebaceConCache,
  crearCanalRadio,
  editarRegistroBitacoraRadio,
  escucharCanalesOperativo,
  escucharRegistrosCanal,
  exportarBitacoraCsvLocal,
  generarIdBorradorRadio,
  LIMITE_REGISTROS_RADIO,
  obtenerRegistrosCanalAnteriores,
  poblarCatalogoRebace,
  registrarMensajeRadio,
} from '../services/radioService'
import type {
  CanalRadio,
  ClaveRebace,
  Operativo,
  RegistroBitacoraRadio,
  Usuario,
} from '../types'

interface RadioConsolePageProps {
  usuario: Usuario
}

const PREFIJO_PAR_RADIO = 'sabupc_radio_par_v1_'

interface ParRadioGuardado {
  origen: string
  destinos: string[]
}

function leerParGuardado(canalId: string): ParRadioGuardado | null {
  try {
    const raw = window.sessionStorage.getItem(`${PREFIJO_PAR_RADIO}${canalId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ParRadioGuardado>
    if (typeof parsed.origen !== 'string' || !Array.isArray(parsed.destinos)) return null
    return {
      origen: parsed.origen,
      destinos: parsed.destinos.filter((d): d is string => typeof d === 'string' && d.trim().length > 0),
    }
  } catch {
    return null
  }
}

function guardarParRadio(canalId: string, origen: string, destinos: string[]): void {
  try {
    window.sessionStorage.setItem(
      `${PREFIJO_PAR_RADIO}${canalId}`,
      JSON.stringify({ origen, destinos }),
    )
  } catch {
    // Sin acceso a sessionStorage en navegación restringida
  }
}

/**
 * Calcula un indicador discreto de desfase horario cuando la hora local capturada
 * (`hora_original`) difiere en más de 60 s respecto a la recepción en servidor (`creado_en`).
 */
function etiquetaDesfaseHorario(r: RegistroBitacoraRadio): string | null {
  if (!r.creado_en || !r.hora_original) return null
  const partes = r.hora_original.split(':').map((n) => Number(n))
  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return null

  const fechaSrv = r.creado_en.toDate()
  const fechaOrig = new Date(
    fechaSrv.getFullYear(),
    fechaSrv.getMonth(),
    fechaSrv.getDate(),
    partes[0],
    partes[1],
    partes[2],
  )
  let diffSeg = Math.round((fechaSrv.getTime() - fechaOrig.getTime()) / 1000)
  // Ajuste ante cruce de medianoche (00:00)
  if (diffSeg > 43200) diffSeg -= 86400
  if (diffSeg < -43200) diffSeg += 86400

  if (Math.abs(diffSeg) <= 60) return null
  const mins = Math.max(1, Math.round(Math.abs(diffSeg) / 60))
  const signo = diffSeg > 0 ? '+' : '−'
  return `Desfase ${signo}${mins} min`
}

interface PropsFilaRadio {
  registro: RegistroBitacoraRadio
  alEditar: (r: RegistroBitacoraRadio) => void
}

const FilaRadioMovil = memo(function FilaRadioMovil({ registro: r, alEditar }: PropsFilaRadio) {
  const desfase = etiquetaDesfaseHorario(r)
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs">
          <span className="shrink-0 font-bold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
            {r.hora_original}
          </span>
          <span className="truncate font-bold text-udec dark:text-activo-claro">{r.origen}</span>
          <span className="shrink-0 text-tinta-suave">→</span>
          <span className="truncate font-semibold text-tinta dark:text-noche-tinta">
            {r.destinos.join(', ')}
          </span>
          {r.sync_status === 'pendiente' && (
            <span
              title="Pendiente de sincronizar"
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
            >
              <CloudOff size={11} strokeWidth={2} />
              <span>Pendiente de sincronizar</span>
            </span>
          )}
          {desfase && (
            <span
              title="Diferencia > 60 s entre la hora del dispositivo y la recepción en servidor"
              className="shrink-0 rounded bg-superficie-suave px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave"
            >
              {desfase}
            </span>
          )}
          {r.fue_editado && (
            <span className="shrink-0 rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
              Ed.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => alEditar(r)}
          aria-label={`Editar actividad de ${r.hora_original}`}
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-borde bg-fondo text-tinta-suave hover:border-udec hover:text-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
        >
          <Pencil size={15} strokeWidth={2} />
        </button>
      </div>

      <p className="text-[13px] leading-snug font-medium text-tinta dark:text-noche-tinta">
        {r.actividades}
      </p>
      {r.fue_editado && r.actividad_original_respaldo && (
        <p className="text-[11px] leading-tight text-tinta-suave dark:text-noche-tinta-suave">
          Original: &ldquo;{r.actividad_original_respaldo}&rdquo;
        </p>
      )}
    </div>
  )
})

const FilaRadioEscritorio = memo(function FilaRadioEscritorio({
  registro: r,
  alEditar,
}: PropsFilaRadio) {
  const desfase = etiquetaDesfaseHorario(r)
  return (
    <tr className="align-top hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50">
      <td className="px-3 py-1.5 whitespace-nowrap">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
            {r.hora_original}
          </span>
          {r.sync_status === 'pendiente' && (
            <span
              title="Guardado localmente; se sincronizará al recuperar señal"
              className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
            >
              <CloudOff size={11} strokeWidth={2} />
              <span>Pendiente de sincronizar</span>
            </span>
          )}
          {desfase && (
            <span
              title="Diferencia > 60 s entre la hora del dispositivo y la recepción en servidor"
              className="rounded bg-superficie-suave px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave"
            >
              {desfase}
            </span>
          )}
          {r.fue_editado && (
            <span
              title={`Original: ${r.actividad_original_respaldo ?? ''} · Editado por ${r.editado_por ?? ''}`}
              className="rounded bg-ambar-suave px-1.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
            >
              Editado
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 text-xs font-bold text-tinta dark:text-noche-tinta">{r.origen}</td>
      <td className="px-3 py-1.5 text-xs font-semibold text-tinta dark:text-noche-tinta">
        {r.destinos.join(', ')}
      </td>
      <td className="px-3 py-1.5 text-[13px] leading-snug text-tinta dark:text-noche-tinta">
        <p className="font-medium">{r.actividades}</p>
        {r.fue_editado && r.actividad_original_respaldo && (
          <p className="mt-0.5 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
            Original: &ldquo;{r.actividad_original_respaldo}&rdquo;
          </p>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <button
          type="button"
          onClick={() => alEditar(r)}
          aria-label={`Editar actividad de ${r.hora_original}`}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-borde bg-fondo text-tinta-suave hover:border-udec hover:text-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
      </td>
    </tr>
  )
})

export function RadioConsolePage({ usuario }: RadioConsolePageProps) {
  const wakeLock = useWakeLock()
  const claveOperador = (usuario.clave_radio || usuario.clave_personal_radio || '').trim()

  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [operativoIdSel, setOperativoIdSel] = useState<string>('')
  const [canalesPorOp, setCanalesPorOp] = useState<{ opId: string; lista: CanalRadio[] } | null>(
    null,
  )
  const [canalIdSel, setCanalIdSel] = useState<string>('')
  const [registrosPorCanal, setRegistrosPorCanal] = useState<{
    canalId: string
    lista: RegistroBitacoraRadio[]
    anteriores: RegistroBitacoraRadio[]
    hayMas: boolean
  } | null>(null)
  const [cargandoMasRadio, setCargandoMasRadio] = useState(false)
  const [claves, setClaves] = useState<ClaveRebace[]>([])
  const [cargandoClaves, setCargandoClaves] = useState(true)
  const [poblandoClaves, setPoblandoClaves] = useState(false)

  // Captura rápida con preselección inteligente y memoria por canal en sessionStorage
  const parPorDefecto = useMemo<ParRadioGuardado>(
    () => ({
      origen: claveOperador || 'CECOM',
      destinos: claveOperador ? ['CECOM'] : [],
    }),
    [claveOperador],
  )
  const [paresPorCanal, setParesPorCanal] = useState<Record<string, ParRadioGuardado>>({})
  const [destinoExtra, setDestinoExtra] = useState('')
  const [actividades, setActividades] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Idempotencia de envío: un ID determinista estable por borrador hasta que el envío sea exitoso
  const borradorIdRef = useRef<string>(generarIdBorradorRadio())
  const enviandoRef = useRef(false)

  // Colapso móvil de chips ORIGEN/DESTINO para dejar espacio al teclado virtual
  const [chipsColapsadosMovil, setChipsColapsadosMovil] = useState(true)
  const barraCapturaRef = useRef<HTMLDivElement>(null)
  const inputActividadesRef = useRef<HTMLInputElement>(null)
  const listaMovilRef = useRef<HTMLDivElement>(null)
  const ultimoIdRecienteRef = useRef<string | null>(null)

  // + Unidad en vivo
  const [mostrandoNuevaUnidad, setMostrandoNuevaUnidad] = useState(false)
  const [nuevaUnidad, setNuevaUnidad] = useState('')

  // + Canal nuevo
  const [mostrandoNuevoCanal, setMostrandoNuevoCanal] = useState(false)
  const [nombreCanalNuevo, setNombreCanalNuevo] = useState('')
  const [etiquetaCanalNuevo, setEtiquetaCanalNuevo] = useState('')

  // Edición de actividad (inmutabilidad hora_original)
  const [registroEditando, setRegistroEditando] = useState<RegistroBitacoraRadio | null>(null)
  const [textoEditado, setTextoEditado] = useState('')

  // Sheet móvil de Claves ReBaCE v2
  const [sheetClavesAbierto, setSheetClavesAbierto] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const opActivoRef = useRef<{ id: string; nombre: string } | null>(null)

  useEffect(() => {
    const cancelarOps = escucharOperativosActivos(
      (lista) => {
        const actual = opActivoRef.current
        if (actual && !lista.some((o) => o.id === actual.id)) {
          setOperativoIdSel('')
          setCanalIdSel('')
          setRegistroEditando(null)
          setTextoEditado('')
          setMostrandoNuevoCanal(false)
          setMostrandoNuevaUnidad(false)
          setAviso(
            `El operativo "${actual.nombre}" fue cerrado. Su bitácora de radio quedó disponible solo para consulta en Archivo Operativo Global.`,
          )
        }
        setOperativos(lista)
      },
      (err) => setError(mensajeDeError(err)),
    )
    let activo = true
    void cargarCatalogoRebaceConCache()
      .then((lista) => {
        if (!activo) return
        setClaves(lista)
        setCargandoClaves(false)
      })
      .catch(() => {
        if (!activo) return
        setCargandoClaves(false)
      })
    return () => {
      activo = false
      cancelarOps()
    }
  }, [])

  const operativosActivos = operativos

  const operativoActivo =
    operativosActivos.find((o) => o.id === operativoIdSel) ??
    operativosActivos.find((o) => o.recepcion_abierta) ??
    operativosActivos[0] ??
    null
  const opActivoId = operativoActivo?.id ?? null

  useEffect(() => {
    opActivoRef.current = operativoActivo
      ? { id: operativoActivo.id, nombre: operativoActivo.nombre }
      : null
  }, [operativoActivo])

  useEffect(() => {
    if (!opActivoId) return
    const cancelar = escucharCanalesOperativo(
      opActivoId,
      (lista) => setCanalesPorOp({ opId: opActivoId, lista }),
      (err) => setError(mensajeDeError(err)),
    )
    return cancelar
  }, [opActivoId])

  const canales = canalesPorOp?.opId === opActivoId ? canalesPorOp.lista : []
  const canalActivo = canales.find((c) => c.id === canalIdSel) ?? canales[0] ?? null
  const canalActivoId = canalActivo?.id ?? null

  const parActual: ParRadioGuardado = canalActivoId
    ? (paresPorCanal[canalActivoId] ?? leerParGuardado(canalActivoId) ?? parPorDefecto)
    : parPorDefecto
  const origen = parActual.origen
  const destinos = parActual.destinos

  function actualizarParCanal(nuevoOrigen: string, nuevosDestinos: string[]) {
    if (!canalActivoId) return
    const siguiente = { origen: nuevoOrigen, destinos: nuevosDestinos }
    setParesPorCanal((prev) => ({ ...prev, [canalActivoId]: siguiente }))
    guardarParRadio(canalActivoId, nuevoOrigen, nuevosDestinos)
  }

  function setOrigen(nuevoOrigen: string) {
    actualizarParCanal(nuevoOrigen, destinos)
  }

  // Reiniciar ID de borrador y referencia de scroll al cambiar de canal
  useEffect(() => {
    if (!canalActivoId) return
    borradorIdRef.current = generarIdBorradorRadio()
    ultimoIdRecienteRef.current = null
  }, [canalActivoId])

  useEffect(() => {
    if (!canalActivoId) return
    const cancelar = escucharRegistrosCanal(
      canalActivoId,
      (lista) =>
        setRegistrosPorCanal((prev) => ({
          canalId: canalActivoId,
          lista,
          anteriores: prev?.canalId === canalActivoId ? prev.anteriores : [],
          hayMas:
            prev?.canalId === canalActivoId && prev.anteriores.length > 0
              ? prev.hayMas
              : lista.length >= LIMITE_REGISTROS_RADIO,
        })),
      (err) => setError(mensajeDeError(err)),
      LIMITE_REGISTROS_RADIO,
    )
    return cancelar
  }, [canalActivoId])

  const registros = useMemo(() => {
    if (registrosPorCanal?.canalId !== canalActivoId) return []
    const mapa = new Map<string, RegistroBitacoraRadio>()
    for (const r of registrosPorCanal.lista) mapa.set(r.id, r)
    for (const r of registrosPorCanal.anteriores) {
      if (!mapa.has(r.id)) mapa.set(r.id, r)
    }
    return Array.from(mapa.values()).sort(
      (a, b) =>
        (b.creado_en?.toMillis() ?? Number.MAX_SAFE_INTEGER) -
        (a.creado_en?.toMillis() ?? Number.MAX_SAFE_INTEGER),
    )
  }, [registrosPorCanal, canalActivoId])

  // En móvil (< md) mostramos orden cronológico ascendente (último mensaje pegado a la barra de captura)
  const registrosMovil = useMemo(() => [...registros].reverse(), [registros])

  // Auto-scroll en móvil al último mensaje solo cuando cambia el mensaje más reciente o al abrir canal
  const idMasReciente = registros[0]?.id ?? null
  useEffect(() => {
    if (!idMasReciente) return
    if (ultimoIdRecienteRef.current === idMasReciente) return
    ultimoIdRecienteRef.current = idMasReciente
    const el = listaMovilRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [idMasReciente, canalActivoId])

  const hayMasRegistrosRadio =
    registrosPorCanal?.canalId === canalActivoId ? registrosPorCanal.hayMas : false

  async function cargarMasRegistrosRadio() {
    if (!canalActivoId || cargandoMasRadio) return
    const ultimo = registros[registros.length - 1]
    if (!ultimo?.creado_en) return
    setCargandoMasRadio(true)
    setError(null)
    try {
      const res = await obtenerRegistrosCanalAnteriores(
        canalActivoId,
        ultimo.creado_en,
        LIMITE_REGISTROS_RADIO,
      )
      setRegistrosPorCanal((prev) =>
        prev?.canalId === canalActivoId
          ? {
              ...prev,
              anteriores: [...prev.anteriores, ...res.registros],
              hayMas: res.hayMas,
            }
          : prev,
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoMasRadio(false)
    }
  }

  const unidadesCanal = canalActivo?.unidades_participantes ?? ['CECOM', '58A', 'BUPC 1']

  const resumenDestinos = [
    ...destinos,
    ...destinoExtra
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]

  function alternarDestino(unidad: string) {
    const siguientes = destinos.includes(unidad)
      ? destinos.filter((u) => u !== unidad)
      : [...destinos, unidad]
    actualizarParCanal(origen, siguientes)
  }

  function intercambiarOrigenDestino() {
    const primerDestino = destinos[0] || destinoExtra.trim()
    if (!primerDestino) return
    const origenAnterior = origen.trim()
    actualizarParCanal(primerDestino, origenAnterior ? [origenAnterior] : [])
    setDestinoExtra('')
  }

  function alEnfocarActividades() {
    // Si aún no hay destino seleccionado, desplegamos chips en móvil para evitar enviar sin destino.
    if (resumenDestinos.length === 0) {
      setChipsColapsadosMovil(false)
    } else {
      setChipsColapsadosMovil(true)
    }
    setMostrandoNuevaUnidad(false)
    window.setTimeout(() => {
      barraCapturaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 120)
  }

  async function manejarAgregarUnidad(e: FormEvent) {
    e.preventDefault()
    if (
      !operativoActivo ||
      operativoActivo.estatus === 'Finalizado' ||
      operativoActivo.estatus === 'Cancelado'
    ) {
      return
    }
    if (!canalActivo || !nuevaUnidad.trim()) return
    setError(null)
    try {
      await agregarUnidadCanal(canalActivo.id, nuevaUnidad.trim())
      setNuevaUnidad('')
      setMostrandoNuevaUnidad(false)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  async function manejarCrearCanal(
    nombre: string,
    etiqueta: string,
    unidadesBase: string[] = ['CECOM', '58A', 'BUPC 1'],
  ) {
    if (
      !operativoActivo ||
      operativoActivo.estatus === 'Finalizado' ||
      operativoActivo.estatus === 'Cancelado' ||
      !nombre.trim()
    ) {
      return
    }
    setError(null)
    setAviso(null)
    try {
      const id = await crearCanalRadio(usuario, {
        operativo_id: operativoActivo.id,
        nombre_canal: nombre,
        frecuencia_etiqueta: etiqueta,
        unidades_participantes: unidadesBase,
      })
      setCanalIdSel(id)
      setNombreCanalNuevo('')
      setEtiquetaCanalNuevo('')
      setMostrandoNuevoCanal(false)
      setAviso(`Canal "${nombre}" habilitado para ${operativoActivo.nombre}.`)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  async function manejarEnviarMensaje(e: FormEvent) {
    e.preventDefault()
    if (enviandoRef.current) return
    if (
      !operativoActivo ||
      operativoActivo.estatus === 'Finalizado' ||
      operativoActivo.estatus === 'Cancelado' ||
      !canalActivo
    ) {
      return
    }
    setError(null)
    setAviso(null)

    const listaDestinos = [
      ...destinos,
      ...destinoExtra
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ]

    if (listaDestinos.length === 0) {
      setChipsColapsadosMovil(false)
      setError('Selecciona al menos una unidad de DESTINO.')
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    try {
      await registrarMensajeRadio(usuario, {
        canal_id: canalActivo.id,
        operativo_id: operativoActivo.id,
        origen,
        destinos: listaDestinos,
        actividades,
        id_determinista: borradorIdRef.current,
      })
      borradorIdRef.current = generarIdBorradorRadio()
      setActividades('')
      setDestinoExtra('')
    } catch (err) {
      const tieneCodigo = Boolean((err as { code?: string })?.code)
      setError(!tieneCodigo && err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  const abrirEdicionRegistro = useCallback((r: RegistroBitacoraRadio) => {
    setRegistroEditando(r)
    setTextoEditado(r.actividades)
  }, [])

  async function manejarGuardarEdicion(e: FormEvent) {
    e.preventDefault()
    if (
      !operativoActivo ||
      operativoActivo.estatus === 'Finalizado' ||
      operativoActivo.estatus === 'Cancelado' ||
      !registroEditando
    ) {
      return
    }
    setError(null)
    setAviso(null)
    setEnviando(true)
    try {
      await editarRegistroBitacoraRadio(usuario, registroEditando.id, textoEditado)
      setAviso(`Registro ${registroEditando.hora_original} actualizado correctamente.`)
      setRegistroEditando(null)
      setTextoEditado('')
    } catch (err) {
      const tieneCodigo = Boolean((err as { code?: string })?.code)
      setError(!tieneCodigo && err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function manejarPoblarClaves() {
    setPoblandoClaves(true)
    setError(null)
    setAviso(null)
    try {
      const total = await poblarCatalogoRebace(usuario)
      setClaves(await cargarCatalogoRebaceConCache(true))
      setAviso(`Catálogo de claves cargado con ${total} registros.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setPoblandoClaves(false)
    }
  }

  function insertarCodigoEnActividad(codigo: string) {
    setActividades((prev) => (prev.trim() ? `${prev.trim()} ${codigo} ` : `${codigo} `))
    setSheetClavesAbierto(false)
    window.setTimeout(() => inputActividadesRef.current?.focus(), 60)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:gap-3">
      {/* Cabecera compacta de Consola + Wake Lock + Exportar CSV Local */}
      <article className="tarjeta flex shrink-0 flex-col gap-2 p-2.5 sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="hidden sm:block">
            <h2 className="text-base font-bold text-tinta lg:text-lg dark:text-noche-tinta">
              Consola de Radio Multi-Canal
            </h2>
            <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
              Registro cronológico de transmisiones y catálogo de claves
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
            <select
              aria-label="Seleccionar operativo activo"
              value={opActivoId ?? ''}
              disabled={operativosActivos.length === 0}
              onChange={(e) => {
                setOperativoIdSel(e.target.value)
                setCanalIdSel('')
                setRegistroEditando(null)
                setMostrandoNuevoCanal(false)
                setMostrandoNuevaUnidad(false)
              }}
              className="campo min-h-10 min-w-0 flex-1 text-xs font-semibold sm:w-52 sm:flex-none lg:min-h-9"
            >
              {operativosActivos.length === 0 ? (
                <option value="">Sin operativos activos</option>
              ) : (
                operativosActivos.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nombre}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={() => void wakeLock.alternar()}
              title={
                wakeLock.soportado
                  ? 'Evita que la pantalla se apague durante la guardia'
                  : 'Tu navegador no permite mantener la pantalla encendida'
              }
              className={`btn min-h-10 px-2.5 text-xs lg:min-h-9 ${
                wakeLock.activo
                  ? 'border border-activo bg-activo-suave text-activo dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro'
                  : 'border border-borde bg-fondo text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta'
              }`}
            >
              <Sun size={14} strokeWidth={2} />
              <span className="hidden sm:inline">
                Pantalla {wakeLock.activo ? 'activa' : wakeLock.soportado ? 'normal' : 'no disp.'}
              </span>
              <span className="sm:hidden">{wakeLock.activo ? 'Activa' : 'Normal'}</span>
            </button>

            <button
              type="button"
              disabled={!operativoActivo || !canalActivo || registros.length === 0}
              onClick={() => {
                if (operativoActivo && canalActivo) {
                  exportarBitacoraCsvLocal(
                    operativoActivo.nombre,
                    canalActivo.nombre_canal,
                    registros,
                  )
                }
              }}
              aria-label="Exportar bitácora a CSV"
              className="btn-salvia min-h-10 px-2.5 text-xs lg:min-h-9"
            >
              <Download size={14} strokeWidth={2} />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setSheetClavesAbierto(true)}
              className="btn-verde min-h-10 px-3 text-xs lg:hidden"
            >
              <BookOpen size={14} strokeWidth={2} />
              <span>Claves</span>
            </button>
          </div>
        </div>

        {wakeLock.error && (
          <p className="text-[11px] font-semibold text-ambar-texto dark:text-noche-ambar-texto">
            {wakeLock.error}
          </p>
        )}

        {/* Pestañas de Canales Multi-Canal (>= 40px en móvil) */}
        {operativoActivo && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-borde pt-2 dark:border-noche-borde">
            {canales.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCanalIdSel(c.id)}
                className={`min-h-10 shrink-0 cursor-pointer rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition-colors lg:min-h-8 lg:rounded-md lg:px-3 ${
                  canalActivo?.id === c.id
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:bg-noche-campo dark:text-noche-tinta-suave'
                }`}
              >
                {c.nombre_canal}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setMostrandoNuevoCanal((v) => !v)}
              className="btn-salvia min-h-10 shrink-0 px-3 text-xs whitespace-nowrap lg:min-h-8 lg:px-2.5"
            >
              <Plus size={14} strokeWidth={2} />
              <span>Canal</span>
            </button>
          </div>
        )}

        {/* Creador rápido de canal */}
        {mostrandoNuevoCanal && operativoActivo && (
          <div className="flex flex-col gap-2 rounded-lg border border-borde bg-fondo p-2.5 dark:border-noche-borde dark:bg-noche-campo">
            <div className="flex flex-wrap gap-1.5">
              {CANALES_SUGERIDOS.filter(
                (s) => !canales.some((c) => c.nombre_canal === s.nombre),
              ).map((sug) => (
                <button
                  key={sug.nombre}
                  type="button"
                  onClick={() => void manejarCrearCanal(sug.nombre, sug.etiqueta, sug.unidades)}
                  className="min-h-9 cursor-pointer rounded-full border border-udec bg-salvia px-3 text-xs font-semibold text-udec-oscuro hover:bg-salvia-hover dark:border-activo-claro dark:bg-noche-tarjeta dark:text-noche-tinta"
                >
                  + {sug.nombre}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                maxLength={80}
                placeholder="Nombre de canal personalizado"
                value={nombreCanalNuevo}
                onChange={(e) => setNombreCanalNuevo(e.target.value)}
                className="campo min-h-10 flex-1 text-xs"
              />
              <input
                type="text"
                maxLength={40}
                placeholder="Frecuencia / etiqueta"
                value={etiquetaCanalNuevo}
                onChange={(e) => setEtiquetaCanalNuevo(e.target.value)}
                className="campo min-h-10 w-40 text-xs"
              />
              <button
                type="button"
                onClick={() => void manejarCrearCanal(nombreCanalNuevo, etiquetaCanalNuevo)}
                className="btn-verde min-h-10 px-3.5 text-xs"
              >
                Crear
              </button>
            </div>
          </div>
        )}
      </article>

      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 rounded-lg border border-alerta bg-alerta-suave px-3 py-2 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 rounded-lg border border-activo bg-activo-suave px-3 py-2 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        {!operativoActivo ? (
          <div className="flex min-h-0 flex-col lg:col-span-8">
            <article className="tarjeta flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center">
              <Radio
                size={34}
                strokeWidth={2}
                className="text-tinta-suave dark:text-noche-tinta-suave"
              />
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Sin operativos activos para radio
              </h3>
              <p className="max-w-md text-xs text-tinta-suave dark:text-noche-tinta-suave">
                No hay operativos en curso disponibles para registrar transmisiones. Los operativos
                finalizados pueden consultarse en modo solo lectura desde Archivo Operativo Global.
                El catálogo de claves sigue disponible para consulta inmediata.
              </p>
            </article>
          </div>
        ) : !canalActivo ? (
          <div className="flex min-h-0 flex-col lg:col-span-8">
            <article className="tarjeta flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Radio size={32} strokeWidth={2} className="text-udec dark:text-activo-claro" />
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Sin canales de radio en {operativoActivo.nombre}
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Inicia el canal principal CECOM o cualquiera de los canales sugeridos para comenzar a
                registrar transmisiones.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {CANALES_SUGERIDOS.slice(0, 3).map((sug) => (
                  <button
                    key={sug.nombre}
                    type="button"
                    onClick={() => void manejarCrearCanal(sug.nombre, sug.etiqueta, sug.unidades)}
                    className="btn-verde min-h-10 px-4 text-xs"
                  >
                    + Abrir canal {sug.nombre}
                  </button>
                ))}
              </div>
            </article>
          </div>
        ) : (
          /* Columna izquierda: en móvil muestra tabla arriba (ascendente) y captura fija abajo; en PC captura arriba y tabla descendente debajo */
          <div className="flex min-h-0 flex-col-reverse gap-2.5 lg:col-span-8 lg:flex-col">
            {/* Barra de captura rápida */}
            <article
              ref={barraCapturaRef}
              className="tarjeta z-20 flex shrink-0 flex-col gap-2 p-2.5 sm:p-3"
            >
              <form onSubmit={manejarEnviarMensaje} className="flex flex-col gap-2">
                {/* Barra resumida de 1 línea en móvil para colapsar/expandir chips ORIGEN -> DESTINO (>= 40px) */}
                <div className="flex items-center justify-between gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setChipsColapsadosMovil((v) => !v)}
                    className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-lg border border-borde bg-fondo px-3 text-left text-xs font-bold text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                  >
                    <span className="truncate text-udec dark:text-activo-claro">
                      {origen.trim() || 'Origen'}
                    </span>
                    <span className="shrink-0 text-tinta-suave">→</span>
                    <span
                      className={`truncate ${
                        resumenDestinos.length === 0
                          ? 'text-ambar-texto dark:text-noche-ambar-texto'
                          : ''
                      }`}
                    >
                      {resumenDestinos.length > 0 ? resumenDestinos.join(', ') : 'Elegir destino'}
                    </span>
                    <span className="ml-auto shrink-0 text-tinta-suave dark:text-noche-tinta-suave">
                      {chipsColapsadosMovil ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={intercambiarOrigenDestino}
                    title="Invertir Origen y Destino"
                    aria-label="Invertir Origen y Destino"
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-borde bg-fondo text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                  >
                    <ArrowLeftRight size={16} strokeWidth={2} />
                  </button>
                </div>

                {/* Selector de chips ORIGEN / DESTINO (siempre visible en lg+, desplegable en móvil) */}
                <div
                  className={`${
                    chipsColapsadosMovil
                      ? 'hidden lg:grid'
                      : 'grid max-h-52 overflow-y-auto lg:max-h-none'
                  } grid-cols-1 items-start gap-2.5 md:grid-cols-11`}
                >
                  {/* ORIGEN */}
                  <div className="flex flex-col gap-1.5 md:col-span-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="etiqueta">ORIGEN</span>
                      <button
                        type="button"
                        onClick={() => setMostrandoNuevaUnidad((v) => !v)}
                        className="min-h-8 cursor-pointer px-1 text-xs font-bold text-udec underline dark:text-activo-claro"
                      >
                        + Unidad
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unidadesCanal.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setOrigen(u)}
                          className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors lg:min-h-7 lg:rounded lg:px-2 ${
                            origen === u
                              ? 'bg-udec text-white'
                              : 'bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:bg-noche-campo dark:text-noche-tinta-suave'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      aria-label="Unidad de origen"
                      placeholder="Ej. CECOM, 58A, TESLA"
                      value={origen}
                      onChange={(e) => setOrigen(e.target.value)}
                      className="campo min-h-10 text-xs font-semibold lg:min-h-9"
                    />
                  </div>

                  {/* Botón intercambio ⇄ en escritorio */}
                  <div className="hidden items-center justify-center md:col-span-1 md:flex md:pt-6">
                    <button
                      type="button"
                      onClick={intercambiarOrigenDestino}
                      title="Invertir Origen y Destino"
                      aria-label="Invertir Origen y Destino"
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-borde bg-fondo text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                    >
                      <ArrowLeftRight size={15} strokeWidth={2} />
                    </button>
                  </div>

                  {/* DESTINO */}
                  <div className="flex flex-col gap-1.5 md:col-span-5">
                    <span className="etiqueta">DESTINO</span>
                    <div className="flex flex-wrap gap-1.5">
                      {unidadesCanal.map((u) => {
                        const activo = destinos.includes(u)
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => alternarDestino(u)}
                            className={`min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors lg:min-h-7 lg:rounded lg:px-2 ${
                              activo
                                ? 'bg-udec text-white'
                                : 'bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:bg-noche-campo dark:text-noche-tinta-suave'
                            }`}
                          >
                            {u}
                          </button>
                        )
                      })}
                    </div>
                    <input
                      type="text"
                      aria-label="Otros destinos separados por coma"
                      placeholder="Otros destinos (ej. UCOL-01, Lince)"
                      value={destinoExtra}
                      onChange={(e) => setDestinoExtra(e.target.value)}
                      className="campo min-h-10 text-xs lg:min-h-9"
                    />
                  </div>
                </div>

                {/* Alta rápida de + Unidad */}
                {mostrandoNuevaUnidad && (
                  <div className="flex items-center gap-2 rounded-lg border border-borde bg-fondo p-2 dark:border-noche-borde dark:bg-noche-campo">
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="Nueva unidad / clave (ej. UCOL-01, Lince)"
                      value={nuevaUnidad}
                      onChange={(e) => setNuevaUnidad(e.target.value)}
                      className="campo min-h-10 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={(e) => void manejarAgregarUnidad(e)}
                      className="btn-verde min-h-10 px-3.5 text-xs"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {/* Actividades + botón naranja Enviar (>= 48px en móvil y escritorio) */}
                <div className="flex items-center gap-2">
                  <input
                    ref={inputActividadesRef}
                    type="text"
                    maxLength={1000}
                    placeholder="Actividades · Ej. 70 51R · 7 en su 19"
                    value={actividades}
                    onFocus={alEnfocarActividades}
                    onChange={(e) => setActividades(e.target.value)}
                    className="campo min-h-12 min-w-0 flex-1 text-sm font-medium"
                  />
                  <button
                    type="submit"
                    disabled={enviando}
                    className="btn-naranja min-h-12 shrink-0 px-4 sm:px-5"
                  >
                    <Send size={16} strokeWidth={2} />
                    <span>{enviando ? '...' : 'Enviar'}</span>
                  </button>
                </div>
              </form>
            </article>

            {/* Registros cronológicos: ascendente en móvil (reciente junto a captura) + tabla descendente en escritorio */}
            <article className="tarjeta flex min-h-0 flex-1 flex-col overflow-hidden">
              {registros.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <Clock size={28} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
                  <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                    Sin transmisiones en {canalActivo.nombre_canal}
                  </p>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Cada mensaje registra su hora exacta y se guarda incluso sin conexión.
                  </p>
                </div>
              ) : (
                <>
                  {/* Vista móvil (< md): orden cronológico ascendente con el último mensaje justo encima de la captura */}
                  <div
                    ref={listaMovilRef}
                    className="flex min-h-0 flex-1 flex-col divide-y divide-borde overflow-y-auto md:hidden dark:divide-noche-borde"
                  >
                    {hayMasRegistrosRadio && (
                      <div className="flex shrink-0 justify-center bg-superficie-suave px-3 py-2 dark:bg-noche-campo">
                        <button
                          type="button"
                          disabled={cargandoMasRadio}
                          onClick={() => void cargarMasRegistrosRadio()}
                          className="btn-salvia min-h-10 px-4 text-xs"
                        >
                          {cargandoMasRadio ? 'Cargando...' : 'Cargar mensajes anteriores'}
                        </button>
                      </div>
                    )}
                    {registrosMovil.map((r) => (
                      <FilaRadioMovil
                        key={r.id}
                        registro={r}
                        alEditar={abrirEdicionRegistro}
                      />
                    ))}
                  </div>

                  {/* Vista escritorio (md+): tabla compacta en orden descendente */}
                  <div className="hidden min-h-0 flex-1 overflow-auto md:block">
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-udec-oscuro text-white">
                        <tr>
                          <th scope="col" className="w-36 px-3 py-2 text-[11px] font-semibold">
                            Hora
                          </th>
                          <th scope="col" className="w-24 px-3 py-2 text-[11px] font-semibold">
                            ORIGEN
                          </th>
                          <th scope="col" className="w-32 px-3 py-2 text-[11px] font-semibold">
                            DESTINO
                          </th>
                          <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                            Actividades
                          </th>
                          <th scope="col" className="w-16 px-2 py-2 text-center text-[11px] font-semibold">
                            Ed.
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borde dark:divide-noche-borde">
                        {registros.map((r) => (
                          <FilaRadioEscritorio
                            key={r.id}
                            registro={r}
                            alEditar={abrirEdicionRegistro}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hayMasRegistrosRadio && (
                    <div className="hidden shrink-0 justify-center border-t border-borde bg-superficie-suave px-3 py-2 md:flex dark:border-noche-borde dark:bg-noche-campo">
                      <button
                        type="button"
                        disabled={cargandoMasRadio}
                        onClick={() => void cargarMasRegistrosRadio()}
                        className="btn-salvia min-h-9 px-3.5 text-xs"
                      >
                        {cargandoMasRadio ? 'Cargando...' : 'Cargar mensajes anteriores'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          </div>
        )}

        {/* Panel lateral derecho Claves de Radio (Escritorio, siempre usable incluso sin operativos activos) */}
        <aside className="tarjeta hidden min-h-0 overflow-hidden lg:col-span-4 lg:flex lg:flex-col">
          <RebacePanel
            claves={claves}
            cargando={cargandoClaves}
            usuario={usuario}
            poblando={poblandoClaves}
            alPoblar={() => void manejarPoblarClaves()}
            alInsertarCodigo={operativoActivo && canalActivo ? insertarCodigoEnActividad : undefined}
          />
        </aside>
      </div>

      {/* Bottom Sheet móvil de Claves de Radio */}
      {sheetClavesAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Claves de Radio"
          className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden"
        >
          <div className="h-[82dvh] w-full overflow-hidden rounded-t-2xl border-t border-borde dark:border-noche-borde">
            <RebacePanel
              claves={claves}
              cargando={cargandoClaves}
              usuario={usuario}
              poblando={poblandoClaves}
              alPoblar={() => void manejarPoblarClaves()}
              alInsertarCodigo={operativoActivo && canalActivo ? insertarCodigoEnActividad : undefined}
              alCerrarMovil={() => setSheetClavesAbierto(false)}
            />
          </div>
        </div>
      )}

      {/* Modal de edición de actividad (hora_original inmutable) */}
      {registroEditando &&
        operativoActivo &&
        operativoActivo.estatus !== 'Finalizado' &&
        operativoActivo.estatus !== 'Cancelado' && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editar registro de radio"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          >
            <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                    Editar actividad ·{' '}
                    <span className="tabular-nums">{registroEditando.hora_original}</span>
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    La hora original se conserva y el texto anterior queda guardado como respaldo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRegistroEditando(null)}
                  aria-label="Cerrar"
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-tinta-suave hover:bg-superficie-suave dark:hover:bg-noche-campo"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <form onSubmit={manejarGuardarEdicion} className="flex flex-col gap-3">
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={textoEditado}
                  onChange={(e) => setTextoEditado(e.target.value)}
                  className="campo min-h-24 py-2 text-sm"
                  required
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRegistroEditando(null)}
                    className="btn-salvia"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={enviando} className="btn-verde">
                    {enviando ? 'Guardando...' : 'Guardar corrección'}
                  </button>
                </div>
              </form>
            </article>
          </div>
        )}
    </div>
  )
}
