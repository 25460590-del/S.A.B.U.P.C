import {
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
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
import { useEffect, useState, type FormEvent } from 'react'
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
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de Consola + Wake Lock + Exportar CSV Local */}
      <article className="tarjeta flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
              Consola de Bitácora de Radio Multi-Canal
            </h2>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              Registro cronológico inmutable (HH:MM:SS) · Claves oficiales ReBaCE v2
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Seleccionar operativo"
              value={opActivoId ?? ''}
              onChange={(e) => {
                setOperativoIdSel(e.target.value)
                setCanalIdSel('')
              }}
              className="campo min-h-10 w-auto text-xs font-semibold"
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
              className={`btn min-h-10 px-3 text-xs ${
                wakeLock.activo
                  ? 'border border-activo bg-activo-suave text-activo dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro'
                  : 'border border-borde bg-fondo text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta'
              }`}
            >
              <Sun size={15} strokeWidth={2} />
              <span>
                Pantalla Activa {wakeLock.activo ? '(ON)' : wakeLock.soportado ? '(OFF)' : '(N/D)'}
              </span>
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
              className="btn-salvia min-h-10 px-3 text-xs"
            >
              <Download size={15} strokeWidth={2} />
              <span>Exportar CSV Local</span>
            </button>
          </div>
        </div>

        {wakeLock.error && (
          <p className="text-xs font-semibold text-ambar-texto dark:text-noche-ambar-texto">
            {wakeLock.error}
          </p>
        )}

        {/* Pestañas de Canales Multi-Canal */}
        {operativoActivo && (
          <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-3 dark:border-noche-borde">
            {canales.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCanalIdSel(c.id)}
                className={`min-h-10 cursor-pointer rounded-lg px-3.5 text-xs font-bold transition-colors ${
                  canalActivo?.id === c.id
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro hover:bg-emerald-100/60 dark:bg-noche-campo dark:text-noche-tinta-suave'
                }`}
              >
                {c.nombre_canal}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setMostrandoNuevoCanal((v) => !v)}
              className="btn-salvia min-h-10 px-3 text-xs"
            >
              <Plus size={15} strokeWidth={2} />
              <span>Canal</span>
            </button>
          </div>
        )}

        {/* Creador rápido de canal */}
        {mostrandoNuevoCanal && operativoActivo && (
          <div className="flex flex-col gap-3 rounded-lg border border-borde bg-fondo p-3 dark:border-noche-borde dark:bg-noche-campo">
            <div className="flex flex-wrap gap-1.5">
              {CANALES_SUGERIDOS.filter(
                (s) => !canales.some((c) => c.nombre_canal === s.nombre),
              ).map((sug) => (
                <button
                  key={sug.nombre}
                  type="button"
                  onClick={() => void manejarCrearCanal(sug.nombre, sug.etiqueta, sug.unidades)}
                  className="cursor-pointer rounded-full border border-udec bg-salvia px-3 py-1 text-xs font-semibold text-udec-oscuro hover:bg-emerald-100 dark:border-activo-claro dark:bg-noche-tarjeta dark:text-noche-tinta"
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
                placeholder="Frecuencia / etiqueta (opcional)"
                value={etiquetaCanalNuevo}
                onChange={(e) => setEtiquetaCanalNuevo(e.target.value)}
                className="campo min-h-10 w-48 text-xs"
              />
              <button
                type="button"
                onClick={() => void manejarCrearCanal(nombreCanalNuevo, etiquetaCanalNuevo)}
                className="btn-verde min-h-10 px-4 text-xs"
              >
                Crear Canal
              </button>
            </div>
          </div>
        )}
      </article>

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
        <article className="tarjeta flex flex-col items-center gap-3 p-8 text-center">
          <Radio size={34} strokeWidth={2} className="text-udec dark:text-activo-claro" />
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
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          {/* Columna izquierda: Captura rápida + Tabla cronológica */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            {/* Barra fija de captura rápida */}
            <article className="tarjeta flex flex-col gap-3 p-4">
              <form onSubmit={manejarEnviarMensaje} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-11">
                  {/* ORIGEN */}
                  <div className="flex flex-col gap-1.5 md:col-span-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="etiqueta">ORIGEN</span>
                      <button
                        type="button"
                        onClick={() => setMostrandoNuevaUnidad((v) => !v)}
                        className="cursor-pointer text-xs font-bold text-udec underline dark:text-activo-claro"
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
                          className={`cursor-pointer rounded px-2 py-1 text-xs font-bold ${
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
                      placeholder="Ej. CECOM, 58A, E4"
                      value={origen}
                      onChange={(e) => setOrigen(e.target.value)}
                      className="campo min-h-10 text-xs font-semibold"
                    />
                  </div>

                  {/* Botón intercambio ⇄ */}
                  <div className="flex items-center justify-center md:col-span-1 md:pt-7">
                    <button
                      type="button"
                      onClick={intercambiarOrigenDestino}
                      title="Invertir Origen y Destino"
                      aria-label="Invertir Origen y Destino"
                      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-borde bg-fondo text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                    >
                      <ArrowLeftRight size={16} strokeWidth={2} />
                    </button>
                  </div>

                  {/* DESTINO (Múltiple) */}
                  <div className="flex flex-col gap-1.5 md:col-span-5">
                    <span className="etiqueta">DESTINO (Múltiple)</span>
                    <div className="flex flex-wrap gap-1">
                      {unidadesCanal.map((u) => {
                        const activo = destinos.includes(u)
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => alternarDestino(u)}
                            className={`cursor-pointer rounded px-2 py-1 text-xs font-bold ${
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
                      placeholder="Otros destinos (ej. E4, E5)"
                      value={destinoExtra}
                      onChange={(e) => setDestinoExtra(e.target.value)}
                      className="campo min-h-10 text-xs"
                    />
                  </div>
                </div>

                {/* Alta rápida de + Unidad */}
                {mostrandoNuevaUnidad && (
                  <div className="flex items-center gap-2 rounded-lg border border-borde bg-fondo p-2 dark:border-noche-borde dark:bg-noche-campo">
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="Nueva unidad / clave (ej. E7, Ambulancia 2)"
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

                {/* Actividades + botón naranja Enviar */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    maxLength={1000}
                    placeholder="Actividades · Ej. 70 51R · 7 en su 19"
                    value={actividades}
                    onChange={(e) => setActividades(e.target.value)}
                    className="campo flex-1 text-sm font-medium"
                  />
                  <button
                    type="submit"
                    disabled={enviando}
                    className="btn-naranja shrink-0 px-5"
                  >
                    <Send size={16} strokeWidth={2} />
                    <span>{enviando ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
              </form>
            </article>

            {/* Tabla cronológica inmutable */}
            <article className="tarjeta overflow-hidden">
              {registros.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <Clock size={30} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
                  <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                    Sin transmisiones registradas en {canalActivo.nombre_canal}
                  </p>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Cada mensaje queda sellado con hora exacta HH:MM:SS inmutable y se guarda
                    incluso sin conexión.
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-udec-oscuro text-white">
                      <tr>
                        <th scope="col" className="w-36 px-4 py-3 text-xs font-semibold">
                          Hora
                        </th>
                        <th scope="col" className="w-28 px-4 py-3 text-xs font-semibold">
                          ORIGEN
                        </th>
                        <th scope="col" className="w-32 px-4 py-3 text-xs font-semibold">
                          DESTINO
                        </th>
                        <th scope="col" className="px-4 py-3 text-xs font-semibold">
                          Actividades
                        </th>
                        <th scope="col" className="w-16 px-3 py-3 text-xs font-semibold">
                          Editar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde dark:divide-noche-borde">
                      {registros.map((r) => (
                        <tr key={r.id} className="align-top">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-bold tabular-nums text-tinta dark:text-noche-tinta">
                                {r.hora_original}
                              </span>
                              {r.sync_status === 'pendiente' && (
                                <span
                                  title="Guardado localmente; se sincronizará al recuperar señal"
                                  className="inline-flex items-center gap-0.5 rounded bg-ambar-suave px-1.5 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                                >
                                  <CloudOff size={11} strokeWidth={2} />
                                  <span>Local</span>
                                </span>
                              )}
                              {r.fue_editado && (
                                <span
                                  title={`Original: ${r.actividad_original_respaldo ?? ''} · Editado por ${r.editado_por ?? ''}`}
                                  className="rounded bg-ambar-suave px-1.5 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                                >
                                  Editado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-tinta dark:text-noche-tinta">
                            {r.origen}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-tinta dark:text-noche-tinta">
                            {r.destinos.join(', ')}
                          </td>
                          <td className="px-4 py-3 text-sm text-tinta dark:text-noche-tinta">
                            <p className="font-medium">{r.actividades}</p>
                            {r.fue_editado && r.actividad_original_respaldo && (
                              <p className="mt-1 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                                Respaldo original: &ldquo;{r.actividad_original_respaldo}&rdquo;
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setRegistroEditando(r)
                                setTextoEditado(r.actividades)
                              }}
                              aria-label={`Editar actividad de ${r.hora_original}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-borde bg-fondo text-tinta-suave hover:border-udec hover:text-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
                            >
                              <Pencil size={14} strokeWidth={2} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>

          {/* Panel lateral derecho Claves ReBaCE v2 (Escritorio) */}
          <aside className="tarjeta hidden max-h-[75vh] overflow-hidden lg:col-span-4 lg:flex lg:flex-col">
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

      {/* Botón flotante móvil [Claves] para abrir Bottom Sheet de ReBaCE v2 */}
      <button
        type="button"
        onClick={() => setSheetClavesAbierto(true)}
        className="btn-verde fixed right-4 bottom-20 z-40 rounded-full border border-white/25 px-4 lg:hidden"
      >
        <BookOpen size={18} strokeWidth={2} />
        <span>Claves</span>
      </button>

      {/* Bottom Sheet móvil de Claves ReBaCE v2 */}
      {sheetClavesAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Claves ReBaCE v2"
          className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden"
        >
          <div className="h-[80vh] w-full overflow-hidden rounded-t-2xl border-t border-borde dark:border-noche-borde">
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
