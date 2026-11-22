import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  Lock,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Unlock,
  X,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CATEGORIAS_OPERATIVO } from '../constants/catalogos'
import { mensajeDeError } from '../services/authService'
import {
  cambiarModoQrOperativo,
  cambiarRecepcionOperativo,
  construirPayloadQrEstatico,
  crearYConfigurarOperativo,
  escucharOperativos,
  escucharSecretoTotp,
  generarEstadoTotpOffline,
} from '../services/operativosService'
import type {
  CategoriaOperativo,
  ModoQrOperativo,
  Operativo,
  SecretoTotpOperativo,
  Usuario,
} from '../types'
import { BitacoraPersonalSection } from '../components/BitacoraPersonalSection'

interface OperativosPanelPageProps {
  usuario: Usuario
}

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

export function OperativosPanelPage({ usuario }: OperativosPanelPageProps) {
  const puedeGestionar =
    usuario.rol_sistema === 'Encargado' || usuario.rol_sistema === 'Administrador'

  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroCategoria, setFiltroCategoria] = useState<'Todos' | CategoriaOperativo>('Todos')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [secretoPorOp, setSecretoPorOp] = useState<{
    opId: string
    secreto: SecretoTotpOperativo | null
  } | null>(null)
  const [ahoraMs, setAhoraMs] = useState(() => Date.now())

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState<CategoriaOperativo>('Operativos Masivos')
  const [sede, setSede] = useState('')
  const [fechaInicio, setFechaInicio] = useState(valorDatetimeLocalActual)
  const [fechaFin, setFechaFin] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modoQrInicial, setModoQrInicial] = useState<ModoQrOperativo>('dinamico')
  const [recepcionInicial, setRecepcionInicial] = useState(true)

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

  const filtrados = operativos.filter((op) =>
    filtroCategoria === 'Todos' ? true : op.categoria === filtroCategoria,
  )

  const operativoActivo =
    filtrados.find((op) => op.id === seleccionadoId) ?? filtrados[0] ?? null
  const opActivoId = operativoActivo?.id ?? null
  const opModoQr = operativoActivo?.modo_qr ?? null

  useEffect(() => {
    if (!opActivoId || !puedeGestionar) return
    const cancelar = escucharSecretoTotp(
      opActivoId,
      (secreto) => setSecretoPorOp({ opId: opActivoId, secreto }),
      (err) => {
        setError(mensajeDeError(err))
      },
    )
    return cancelar
  }, [opActivoId, puedeGestionar])

  // Ticker de 1 segundo para rotación TOTP offline
  useEffect(() => {
    if (!opActivoId || opModoQr !== 'dinamico') return
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [opActivoId, opModoQr])

  const secretoTotp = secretoPorOp?.opId === opActivoId ? secretoPorOp.secreto : null

  const estadoTotp =
    operativoActivo && operativoActivo.modo_qr === 'dinamico' && secretoTotp
      ? generarEstadoTotpOffline(operativoActivo, secretoTotp.secreto_base32, ahoraMs)
      : null

  const payloadQrActual = operativoActivo
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
      setMostrarFormulario(false)
      setNombre('')
      setSede('')
      setDescripcion('')
      setFechaInicio(valorDatetimeLocalActual())
      setFechaFin('')
      setAviso('Operativo creado y configurado con QR dual (Estático + TOTP offline).')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function alternarRecepcion() {
    if (!operativoActivo || !puedeGestionar) return
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      const siguiente = !operativoActivo.recepcion_abierta
      await cambiarRecepcionOperativo(usuario, operativoActivo, siguiente)
      setAviso(
        siguiente
          ? `Recepción abierta para "${operativoActivo.nombre}".`
          : `Recepción cerrada para "${operativoActivo.nombre}".`,
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function cambiarModoQr(modo: ModoQrOperativo) {
    if (!operativoActivo || !puedeGestionar || operativoActivo.modo_qr === modo) return
    setCambiandoEstado(true)
    setError(null)
    setAviso(null)
    try {
      await cambiarModoQrOperativo(usuario, operativoActivo, modo)
      setAviso(
        modo === 'dinamico'
          ? 'Modo QR cambiado a Dinámico TOTP (rotación cada 30 s offline).'
          : 'Modo QR cambiado a Estático (listo para descarga PNG).',
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCambiandoEstado(false)
    }
  }

  function descargarQrOperativoPng() {
    if (!operativoActivo) return
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

  const abiertosCount = operativos.filter((o) => o.recepcion_abierta).length
  const dinamicosCount = operativos.filter((o) => o.modo_qr === 'dinamico').length
  const estaticosCount = operativos.filter((o) => o.modo_qr === 'estatico').length

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs reales desde Firestore */}
      <section aria-label="Indicadores de operativos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="tarjeta flex flex-col justify-between gap-1 p-4">
          <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Operativos registrados
          </span>
          <span className="text-3xl font-bold tabular-nums text-udec dark:text-activo-claro">
            {operativos.length}
          </span>
        </article>
        <article className="tarjeta flex flex-col justify-between gap-1 p-4">
          <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Recepción abierta
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold tabular-nums text-activo dark:text-activo-claro">
              {abiertosCount}
            </span>
            <span className="rounded-full bg-activo-suave px-2 py-0.5 text-[11px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
              En curso
            </span>
          </div>
        </article>
        <article className="tarjeta flex flex-col justify-between gap-1 p-4">
          <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            QR Dinámico TOTP
          </span>
          <span className="text-3xl font-bold tabular-nums text-tinta dark:text-noche-tinta">
            {dinamicosCount}
          </span>
        </article>
        <article className="tarjeta flex flex-col justify-between gap-1 p-4">
          <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            QR Estático (PNG)
          </span>
          <span className="text-3xl font-bold tabular-nums text-tinta dark:text-noche-tinta">
            {estaticosCount}
          </span>
        </article>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-sm text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-sm text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Formulario de nuevo operativo */}
      {mostrarFormulario && puedeGestionar && (
        <article className="tarjeta flex flex-col gap-4 border-2 border-udec p-5">
          <div className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
            <div>
              <h3 className="text-lg font-bold text-tinta dark:text-noche-tinta">
                Iniciar Nuevo Operativo o Actividad
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Genera automáticamente el token estático y el secreto TOTP de 30 s offline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              aria-label="Cerrar formulario"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-borde text-tinta-suave hover:text-tinta dark:border-noche-borde dark:text-noche-tinta-suave"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={manejarCrearOperativo} className="flex flex-col gap-4" noValidate>
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
                  <option value="dinamico">QR Dinámico TOTP (rotación cada 30 s offline)</option>
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
                className="campo min-h-20 py-2.5"
              />
            </div>

            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-borde bg-salvia px-3 dark:border-noche-borde dark:bg-noche-campo">
              <input
                type="checkbox"
                checked={recepcionInicial}
                onChange={(e) => setRecepcionInicial(e.target.checked)}
                className="h-5 w-5 rounded accent-udec"
              />
              <span className="text-sm font-semibold text-udec-oscuro dark:text-noche-tinta">
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
                {guardando ? 'Guardando...' : 'Crear y Configurar Operativo'}
              </button>
            </div>
          </form>
        </article>
      )}

      {/* Actividades y Generador de QR Dual */}
      <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className={`flex flex-col gap-4 ${puedeGestionar ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
                Actividades y Operativos
              </h2>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Selecciona una actividad para administrar su recepción y código QR.
              </p>
            </div>
            {puedeGestionar && (
              <button
                type="button"
                onClick={() => setMostrarFormulario((v) => !v)}
                className="btn-naranja"
              >
                <Plus size={18} strokeWidth={2} />
                <span>Iniciar operativo</span>
              </button>
            )}
          </div>

          {/* Filtros por las 4 categorías institucionales */}
          <div className="flex flex-wrap items-center gap-2">
            {(['Todos', ...CATEGORIAS_OPERATIVO] as const).map((cat) => {
              const activo = filtroCategoria === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCategoria(cat)}
                  className={`min-h-9 cursor-pointer rounded-full px-3.5 text-xs font-semibold transition-colors ${
                    activo
                      ? 'bg-udec text-white'
                      : 'border border-borde bg-salvia text-udec-oscuro hover:bg-emerald-100/60 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Lista de operativos */}
          {cargando ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="tarjeta h-32 animate-pulse p-4" />
              <div className="tarjeta h-32 animate-pulse p-4" />
            </div>
          ) : filtrados.length === 0 ? (
            <article className="tarjeta flex flex-col items-center gap-3 p-8 text-center">
              <QrCode size={36} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
              <div>
                <h3 className="text-base font-semibold text-tinta dark:text-noche-tinta">
                  No hay operativos en esta categoría
                </h3>
                <p className="mt-1 text-sm text-tinta-suave dark:text-noche-tinta-suave">
                  {puedeGestionar
                    ? 'Inicia un operativo para generar su QR Estático o Dinámico TOTP.'
                    : 'Cuando un Encargado abra un operativo, aparecerá aquí.'}
                </p>
              </div>
              {puedeGestionar && (
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(true)}
                  className="btn-verde"
                >
                  <Plus size={18} strokeWidth={2} />
                  <span>Crear primer operativo</span>
                </button>
              )}
            </article>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtrados.map((op) => {
                const seleccionado = operativoActivo?.id === op.id
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setSeleccionadoId(op.id)}
                    className={`tarjeta flex cursor-pointer flex-col gap-2 p-4 text-left transition-colors ${
                      seleccionado
                        ? 'border-2 border-udec dark:border-activo-claro'
                        : 'hover:border-udec/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${estiloCategoria(op.categoria)}`}
                      >
                        {op.categoria}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          op.recepcion_abierta
                            ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                            : 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                        }`}
                      >
                        {op.recepcion_abierta ? 'Abierta' : 'Cerrada'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                      {op.nombre}
                    </h3>

                    <div className="flex flex-col gap-1 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} strokeWidth={2} className="shrink-0" />
                        <span>{op.sede}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Calendar size={14} strokeWidth={2} className="shrink-0" />
                        <span>{op.fecha_inicio.replace('T', ' ')}</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Tarjeta de Generador QR Dual (solo Encargado / Administrador) */}
        {puedeGestionar && (
          <article className="tarjeta flex flex-col gap-4 p-5 lg:col-span-5">
            {!operativoActivo ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <QrCode size={32} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
                <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                  Generador de QR Dual
                </p>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Crea o selecciona un operativo para mostrar su código QR.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
                  <div>
                    <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                      Generador QR · {operativoActivo.nombre}
                    </h3>
                    <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      Control de asistencia en campo
                    </p>
                  </div>

                  {/* Conmutador Recepción Abierta / Cerrada */}
                  <button
                    type="button"
                    onClick={alternarRecepcion}
                    disabled={cambiandoEstado}
                    className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors disabled:opacity-60 ${
                      operativoActivo.recepcion_abierta
                        ? 'border-activo bg-activo-suave text-activo dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro'
                        : 'border-alerta bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                    }`}
                  >
                    {operativoActivo.recepcion_abierta ? (
                      <>
                        <Unlock size={14} strokeWidth={2} />
                        <span>Recepción Abierta</span>
                      </>
                    ) : (
                      <>
                        <Lock size={14} strokeWidth={2} />
                        <span>Recepción Cerrada</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Alternador QR Dinámico TOTP vs QR Estático PNG */}
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
                    QR Dinámico TOTP
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

                {/* Visor QR siempre sobre fondo #FFFFFF puro con margen amplio */}
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div
                    ref={qrOperativoRef}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-borde-fuerte bg-[#FFFFFF] p-4"
                  >
                    {payloadQrActual ? (
                      <QRCodeCanvas
                        value={payloadQrActual}
                        size={148}
                        bgColor="#FFFFFF"
                        fgColor="#18181B"
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="flex h-[148px] w-[148px] items-center justify-center text-xs font-semibold text-tinta-suave">
                        Cargando TOTP...
                      </div>
                    )}
                  </div>

                  {operativoActivo.modo_qr === 'dinamico' ? (
                    <div className="flex w-full flex-1 flex-col gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                        <RefreshCw size={14} strokeWidth={2} />
                        <span>Rotación automática sin internet</span>
                      </span>

                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xl font-extrabold tracking-widest tabular-nums text-udec dark:text-activo-claro">
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

                      <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        Cada código caduca en 30 segundos para evitar capturas compartidas.
                      </p>
                    </div>
                  ) : (
                    <div className="flex w-full flex-1 flex-col gap-3">
                      <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                        Código fijo para imprimir o proyectar en el punto de control de este
                        operativo.
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
      </section>

      {/* Bitácora de Personal en Tiempo Real (Módulo 4 — Encargado / Administrador) */}
      {puedeGestionar && operativoActivo && (
        <BitacoraPersonalSection encargado={usuario} operativo={operativoActivo} />
      )}
    </div>
  )
}
