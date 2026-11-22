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
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { RebacePanel } from '../components/RebacePanel'
import { CANALES_SUGERIDOS } from '../constants/rebaceSeed'
import { useWakeLock } from '../hooks/useWakeLock'
import { mensajeDeError } from '../services/authService'
import { escucharOperativos } from '../services/operativosService'
import {
  actualizarUnidadesCanal,
  crearCanalRadio,
  editarRegistroBitacoraRadio,
  escucharCanalesOperativo,
  escucharCatalogoRebace,
  escucharRegistrosCanal,
  exportarBitacoraCsvLocal,
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

export function RadioConsolePage({ usuario }: RadioConsolePageProps) {
  const wakeLock = useWakeLock()

  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [operativoIdSel, setOperativoIdSel] = useState<string>('')
  const [canalesPorOp, setCanalesPorOp] = useState<{ opId: string; lista: CanalRadio[] } | null>(
    null,
  )
  const [canalIdSel, setCanalIdSel] = useState<string>('')
  const [registrosPorCanal, setRegistrosPorCanal] = useState<{
    canalId: string
    lista: RegistroBitacoraRadio[]
  } | null>(null)
  const [claves, setClaves] = useState<ClaveRebace[]>([])
  const [cargandoClaves, setCargandoClaves] = useState(true)
  const [poblandoClaves, setPoblandoClaves] = useState(false)

  // Captura rápida
  const [origen, setOrigen] = useState('CECOM')
  const [destinos, setDestinos] = useState<string[]>([])
  const [destinoExtra, setDestinoExtra] = useState('')
  const [actividades, setActividades] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Colapso móvil de chips ORIGEN/DESTINO para dejar espacio al teclado virtual
  const [chipsColapsadosMovil, setChipsColapsadosMovil] = useState(true)
  const barraCapturaRef = useRef<HTMLDivElement>(null)
  const inputActividadesRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    const cancelarOps = escucharOperativos(setOperativos, (err) => setError(mensajeDeError(err)))
    const cancelarClaves = escucharCatalogoRebace(
      (lista) => {
        setClaves(lista)
        setCargandoClaves(false)
      },
      () => setCargandoClaves(false),
    )
    return () => {
      cancelarOps()
      cancelarClaves()
    }
  }, [])

  const operativoActivo =
    operativos.find((o) => o.id === operativoIdSel) ??
    operativos.find((o) => o.recepcion_abierta) ??
    operativos[0] ??
    null
  const opActivoId = operativoActivo?.id ?? null

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

  useEffect(() => {
    if (!canalActivoId) return
    const cancelar = escucharRegistrosCanal(
      canalActivoId,
      (lista) => setRegistrosPorCanal({ canalId: canalActivoId, lista }),
      (err) => setError(mensajeDeError(err)),
    )
    return cancelar
  }, [canalActivoId])

  const registros =
    registrosPorCanal?.canalId === canalActivoId ? registrosPorCanal.lista : []

  const unidadesCanal = canalActivo?.unidades_participantes ?? ['CECOM', '58A', 'BUPC 1']

  const resumenDestinos = [
    ...destinos,
    ...destinoExtra
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ]

  function alternarDestino(unidad: string) {
    setDestinos((prev) =>
      prev.includes(unidad) ? prev.filter((u) => u !== unidad) : [...prev, unidad],
    )
  }

  function intercambiarOrigenDestino() {
    const primerDestino = destinos[0] || destinoExtra.trim()
    if (!primerDestino) return
    const origenAnterior = origen.trim()
    setOrigen(primerDestino)
    if (origenAnterior) {
      setDestinos([origenAnterior])
    } else {
      setDestinos([])
    }
    setDestinoExtra('')
  }

  function alEnfocarActividades() {
    // En móvil contraemos los chips para asegurar que el input y Enviar queden visibles sobre el teclado.
    setChipsColapsadosMovil(true)
    setMostrandoNuevaUnidad(false)
    window.setTimeout(() => {
      barraCapturaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 120)
  }

  async function manejarAgregarUnidad(e: FormEvent) {
    e.preventDefault()
    if (!canalActivo || !nuevaUnidad.trim()) return
    setError(null)
    try {
      await actualizarUnidadesCanal(canalActivo.id, [...unidadesCanal, nuevaUnidad.trim()])
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
    if (!operativoActivo || !nombre.trim()) return
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
    if (!operativoActivo || !canalActivo) return
    setError(null)
    setAviso(null)

    const listaDestinos = [
      ...destinos,
      ...destinoExtra
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ]

    setEnviando(true)
    try {
      await registrarMensajeRadio(usuario, {
        canal_id: canalActivo.id,
        operativo_id: operativoActivo.id,
        origen,
        destinos: listaDestinos,
        actividades,
      })
      setActividades('')
      setDestinoExtra('')
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function manejarGuardarEdicion(e: FormEvent) {
    e.preventDefault()
    if (!registroEditando) return
    setError(null)
    setAviso(null)
    setEnviando(true)
    try {
      await editarRegistroBitacoraRadio(usuario, registroEditando.id, textoEditado)
      setAviso(`Registro ${registroEditando.hora_original} actualizado con respaldo de auditoría.`)
      setRegistroEditando(null)
      setTextoEditado('')
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
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
      setAviso(`Catálogo ReBaCE v2 poblado con ${total} claves en 5 tablas oficiales.`)
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
    <div className="flex h-[calc(100dvh-8.25rem)] min-h-0 flex-col gap-2.5 lg:h-[calc(100dvh-3rem)] lg:gap-3">
      {/* Cabecera compacta de Consola + Wake Lock + Exportar CSV Local */}
      <article className="tarjeta flex shrink-0 flex-col gap-2 p-2.5 sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="hidden sm:block">
            <h2 className="text-base font-bold text-tinta lg:text-lg dark:text-noche-tinta">
              Consola de Radio Multi-Canal
            </h2>
            <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
              Registro cronológico inmutable (HH:MM:SS) · Claves oficiales ReBaCE v2
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
            <select
              aria-label="Seleccionar operativo"
              value={opActivoId ?? ''}
              onChange={(e) => {
                setOperativoIdSel(e.target.value)
                setCanalIdSel('')
              }}
              className="campo min-h-9 min-w-0 flex-1 text-xs font-semibold sm:w-52 sm:flex-none"
            >
              {operativos.length === 0 ? (
                <option value="">Sin operativos creados</option>
              ) : (
                operativos.map((op) => (
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
                  : 'Wake Lock no soportado en este navegador'
              }
              className={`btn min-h-9 px-2.5 text-xs ${
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
              aria-label="Exportar CSV Local"
              className="btn-salvia min-h-9 px-2.5 text-xs"
            >
              <Download size={14} strokeWidth={2} />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setSheetClavesAbierto(true)}
              className="btn-verde min-h-9 px-2.5 text-xs lg:hidden"
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

        {/* Pestañas de Canales Multi-Canal (scroll horizontal limpio en móvil) */}
        {operativoActivo && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-borde pt-2 dark:border-noche-borde">
            {canales.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCanalIdSel(c.id)}
                className={`min-h-8 shrink-0 cursor-pointer rounded-md px-3 text-xs font-bold whitespace-nowrap transition-colors ${
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
              className="btn-salvia min-h-8 shrink-0 px-2.5 text-xs whitespace-nowrap"
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
                  className="cursor-pointer rounded-full border border-udec bg-salvia px-2.5 py-0.5 text-xs font-semibold text-udec-oscuro hover:bg-salvia-hover dark:border-activo-claro dark:bg-noche-tarjeta dark:text-noche-tinta"
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
                className="campo min-h-9 flex-1 text-xs"
              />
              <input
                type="text"
                maxLength={40}
                placeholder="Frecuencia / etiqueta"
                value={etiquetaCanalNuevo}
                onChange={(e) => setEtiquetaCanalNuevo(e.target.value)}
                className="campo min-h-9 w-40 text-xs"
              />
              <button
                type="button"
                onClick={() => void manejarCrearCanal(nombreCanalNuevo, etiquetaCanalNuevo)}
                className="btn-verde min-h-9 px-3 text-xs"
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
          className="flex shrink-0 items-start gap-2 rounded-lg border border-alerta bg-alerta-suave px-3 py-2 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 rounded-lg border border-activo bg-activo-suave px-3 py-2 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {!operativoActivo ? (
        <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
          <Radio size={34} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Crea primero un operativo
          </h3>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            La bitácora de radio se asocia a un operativo activo para mantener trazabilidad por
            canal.
          </p>
        </article>
      ) : !canalActivo ? (
        <article className="tarjeta flex flex-col items-center gap-3 p-6 text-center">
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
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Columna izquierda: en móvil muestra tabla arriba y captura fija abajo sobre el teclado; en PC captura arriba y tabla compacta debajo */}
          <div className="flex min-h-0 flex-col-reverse gap-2.5 lg:col-span-8 lg:flex-col">
            {/* Barra de captura rápida */}
            <article
              ref={barraCapturaRef}
              className="tarjeta sticky bottom-0 z-20 flex shrink-0 flex-col gap-2 p-2.5 sm:p-3 lg:static"
            >
              <form onSubmit={manejarEnviarMensaje} className="flex flex-col gap-2">
                {/* Barra resumida de 1 línea en móvil para colapsar/expandir chips ORIGEN -> DESTINO */}
                <div className="flex items-center justify-between gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setChipsColapsadosMovil((v) => !v)}
                    className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-lg border border-borde bg-fondo px-2.5 text-left text-xs font-bold text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                  >
                    <span className="truncate text-udec dark:text-activo-claro">
                      {origen.trim() || 'Origen'}
                    </span>
                    <span className="shrink-0 text-tinta-suave">→</span>
                    <span className="truncate">
                      {resumenDestinos.length > 0 ? resumenDestinos.join(', ') : 'Sin destino'}
                    </span>
                    <span className="ml-auto shrink-0 text-tinta-suave dark:text-noche-tinta-suave">
                      {chipsColapsadosMovil ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={intercambiarOrigenDestino}
                    title="Invertir Origen y Destino"
                    aria-label="Invertir Origen y Destino"
                    className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-borde bg-fondo text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                  >
                    <ArrowLeftRight size={14} strokeWidth={2} />
                  </button>
                </div>

                {/* Selector de chips ORIGEN / DESTINO (siempre visible en lg+, desplegable en móvil) */}
                <div
                  className={`${
                    chipsColapsadosMovil ? 'hidden lg:grid' : 'grid max-h-44 overflow-y-auto lg:max-h-none'
                  } grid-cols-1 items-start gap-2.5 md:grid-cols-11`}
                >
                  {/* ORIGEN */}
                  <div className="flex flex-col gap-1 md:col-span-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="etiqueta">ORIGEN</span>
                      <button
                        type="button"
                        onClick={() => setMostrandoNuevaUnidad((v) => !v)}
                        className="cursor-pointer text-[11px] font-bold text-udec underline dark:text-activo-claro"
                      >
                        + Unidad
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {unidadesCanal.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setOrigen(u)}
                          className={`cursor-pointer rounded px-2 py-0.5 text-xs font-bold ${
                            origen === u
                              ? 'bg-udec text-white'
                              : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
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
                      className="campo min-h-9 text-xs font-semibold"
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

                  {/* DESTINO (Múltiple) */}
                  <div className="flex flex-col gap-1 md:col-span-5">
                    <span className="etiqueta">DESTINO (Múltiple)</span>
                    <div className="flex flex-wrap gap-1">
                      {unidadesCanal.map((u) => {
                        const activo = destinos.includes(u)
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => alternarDestino(u)}
                            className={`cursor-pointer rounded px-2 py-0.5 text-xs font-bold ${
                              activo
                                ? 'bg-udec text-white'
                                : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
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
                      className="campo min-h-9 text-xs"
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
                      className="campo min-h-9 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={(e) => void manejarAgregarUnidad(e)}
                      className="btn-verde min-h-9 px-3 text-xs"
                    >
                      Agregar
                    </button>
                  </div>
                )}

                {/* Actividades + botón naranja Enviar (siempre visible en una sola fila) */}
                <div className="flex items-center gap-2">
                  <input
                    ref={inputActividadesRef}
                    type="text"
                    maxLength={1000}
                    placeholder="Actividades · Ej. 70 51R · 7 en su 19"
                    value={actividades}
                    onFocus={alEnfocarActividades}
                    onChange={(e) => setActividades(e.target.value)}
                    className="campo min-h-10 min-w-0 flex-1 text-sm font-medium"
                  />
                  <button
                    type="submit"
                    disabled={enviando}
                    className="btn-naranja min-h-10 shrink-0 px-3.5 sm:px-5"
                  >
                    <Send size={15} strokeWidth={2} />
                    <span>{enviando ? '...' : 'Enviar'}</span>
                  </button>
                </div>
              </form>
            </article>

            {/* Registros cronológicos (denso en escritorio + tarjetas de 2 líneas en móvil sin scroll horizontal) */}
            <article className="tarjeta flex min-h-0 flex-1 flex-col overflow-hidden">
              {registros.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <Clock size={28} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
                  <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                    Sin transmisiones en {canalActivo.nombre_canal}
                  </p>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Cada mensaje queda sellado con hora exacta HH:MM:SS inmutable y se guarda
                    incluso sin conexión.
                  </p>
                </div>
              ) : (
                <>
                  {/* Vista móvil: filas densas de 2 líneas sin scroll horizontal */}
                  <div className="flex min-h-0 flex-1 flex-col divide-y divide-borde overflow-y-auto md:hidden dark:divide-noche-borde">
                    {registros.map((r) => (
                      <div key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
                            <span className="shrink-0 font-bold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                              {r.hora_original}
                            </span>
                            <span className="truncate font-bold text-udec dark:text-activo-claro">
                              {r.origen}
                            </span>
                            <span className="shrink-0 text-tinta-suave">→</span>
                            <span className="truncate font-semibold text-tinta dark:text-noche-tinta">
                              {r.destinos.join(', ')}
                            </span>
                            {r.sync_status === 'pendiente' && (
                              <span
                                title="Guardado localmente"
                                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-ambar-suave px-1 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                              >
                                <CloudOff size={10} strokeWidth={2} />
                              </span>
                            )}
                            {r.fue_editado && (
                              <span className="shrink-0 rounded bg-ambar-suave px-1 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                                Ed.
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRegistroEditando(r)
                              setTextoEditado(r.actividades)
                            }}
                            aria-label={`Editar actividad de ${r.hora_original}`}
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded border border-borde bg-fondo text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
                          >
                            <Pencil size={12} strokeWidth={2} />
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
                    ))}
                  </div>

                  {/* Vista escritorio: tabla compacta */}
                  <div className="hidden min-h-0 flex-1 overflow-auto md:block">
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-udec-oscuro text-white">
                        <tr>
                          <th scope="col" className="w-32 px-3 py-2 text-[11px] font-semibold">
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
                          <th scope="col" className="w-14 px-2 py-2 text-center text-[11px] font-semibold">
                            Ed.
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borde dark:divide-noche-borde">
                        {registros.map((r) => (
                          <tr
                            key={r.id}
                            className="align-top hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
                          >
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
                                  {r.hora_original}
                                </span>
                                {r.sync_status === 'pendiente' && (
                                  <span
                                    title="Guardado localmente; se sincronizará al recuperar señal"
                                    className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                                  >
                                    <CloudOff size={10} strokeWidth={2} />
                                    <span>Local</span>
                                  </span>
                                )}
                                {r.fue_editado && (
                                  <span
                                    title={`Original: ${r.actividad_original_respaldo ?? ''} · Editado por ${r.editado_por ?? ''}`}
                                    className="rounded bg-ambar-suave px-1 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                                  >
                                    Editado
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-xs font-bold text-tinta dark:text-noche-tinta">
                              {r.origen}
                            </td>
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
                                onClick={() => {
                                  setRegistroEditando(r)
                                  setTextoEditado(r.actividades)
                                }}
                                aria-label={`Editar actividad de ${r.hora_original}`}
                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-borde bg-fondo text-tinta-suave hover:border-udec hover:text-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
                              >
                                <Pencil size={13} strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </article>
          </div>

          {/* Panel lateral derecho Claves ReBaCE v2 (Escritorio) */}
          <aside className="tarjeta hidden min-h-0 overflow-hidden lg:col-span-4 lg:flex lg:flex-col">
            <RebacePanel
              claves={claves}
              cargando={cargandoClaves}
              usuario={usuario}
              poblando={poblandoClaves}
              alPoblar={() => void manejarPoblarClaves()}
              alInsertarCodigo={insertarCodigoEnActividad}
            />
          </aside>
        </div>
      )}

      {/* Bottom Sheet móvil de Claves ReBaCE v2 */}
      {sheetClavesAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Claves ReBaCE v2"
          className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden"
        >
          <div className="h-[82dvh] w-full overflow-hidden rounded-t-2xl border-t border-borde dark:border-noche-borde">
            <RebacePanel
              claves={claves}
              cargando={cargandoClaves}
              usuario={usuario}
              poblando={poblandoClaves}
              alPoblar={() => void manejarPoblarClaves()}
              alInsertarCodigo={insertarCodigoEnActividad}
              alCerrarMovil={() => setSheetClavesAbierto(false)}
            />
          </div>
        </div>
      )}

      {/* Modal de edición de actividad (hora_original inmutable) */}
      {registroEditando && (
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
                  La hora original es inmutable y el texto anterior se conserva en auditoría.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegistroEditando(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
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
