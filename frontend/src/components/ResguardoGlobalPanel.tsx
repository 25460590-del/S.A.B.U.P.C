import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Package,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { normalizarNombrePropio } from '../lib/nombres'
import { ayudantiaJefatura, esAdmin, esOperativoCerrado } from '../lib/permisos'
import { escucharDirectorioSegunRol, mensajeDeError } from '../services/authService'
import {
  escucharResguardoGlobalBupc,
  levantarActaIncidencia,
  marcarEquipoDevueltoOk,
} from '../services/equiposService'
import { escucharOperativos } from '../services/operativosService'
import type { EquipoTurno, Operativo, Usuario } from '../types'
import { IndicadorAlcanceAyudantia } from './IndicadorAlcanceAyudantia'

interface ResguardoGlobalPanelProps {
  encargado: Usuario
}

function formatearHoraCorta(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ResguardoGlobalPanel({ encargado }: ResguardoGlobalPanelProps) {
  const soyAdmin = esAdmin(encargado)
  const ayJefe = ayudantiaJefatura(encargado)
  const [equipos, setEquipos] = useState<EquipoTurno[]>([])
  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [usuariosAyudantia, setUsuariosAyudantia] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros 100% en cliente
  const [busqueda, setBusqueda] = useState('')
  const [filtroOperativo, setFiltroOperativo] = useState('TODOS')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [soloActivos, setSoloActivos] = useState(true)

  const [ocupadoId, setOcupadoId] = useState<string | null>(null)
  const [incidenciaObjetivo, setIncidenciaObjetivo] = useState<EquipoTurno | null>(null)
  const [motivoIncidencia, setMotivoIncidencia] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const cEq = escucharResguardoGlobalBupc(
      (lista) => {
        setEquipos(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
      ayJefe,
    )
    const cOps = escucharOperativos(setOperativos, () => undefined)
    const cUsr = ayJefe
      ? escucharDirectorioSegunRol(encargado, setUsuariosAyudantia, () => undefined)
      : () => undefined
    return () => {
      cEq()
      cOps()
      cUsr()
    }
  }, [encargado, ayJefe])

  const uidsAyudantia = useMemo(
    () => (ayJefe ? new Set(usuariosAyudantia.map((u) => u.uid)) : null),
    [ayJefe, usuariosAyudantia],
  )

  const equiposEnAlcance = useMemo(
    () =>
      uidsAyudantia
        ? equipos.filter((e) => e.ayudantia_slot === ayJefe || uidsAyudantia.has(e.usuario_uid))
        : equipos,
    [equipos, uidsAyudantia, ayJefe],
  )

  const mapaOperativos = useMemo(
    () => new Map(operativos.map((o) => [o.id, o])),
    [operativos],
  )

  const tiposDisponibles = useMemo(
    () =>
      Array.from(new Set(equiposEnAlcance.map((e) => e.nombre_articulo))).sort((a, b) =>
        a.localeCompare(b, 'es-MX'),
      ),
    [equiposEnAlcance],
  )

  const operativosEnResguardo = useMemo(() => {
    const ids = new Set(equiposEnAlcance.map((e) => e.operativo_id))
    return operativos.filter((o) => ids.has(o.id))
  }, [equiposEnAlcance, operativos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return equiposEnAlcance.filter((eq) => {
      const op = mapaOperativos.get(eq.operativo_id)
      if (soloActivos && esOperativoCerrado(op)) return false
      if (filtroOperativo !== 'TODOS' && eq.operativo_id !== filtroOperativo) return false
      if (filtroTipo !== 'TODOS' && eq.nombre_articulo !== filtroTipo) return false
      if (!q) return true
      const opNombre = (eq.operativo_nombre || op?.nombre || '').toLowerCase()
      return (
        eq.usuario_nombre.toLowerCase().includes(q) ||
        eq.nombre_articulo.toLowerCase().includes(q) ||
        eq.codigo_inventario.toLowerCase().includes(q) ||
        opNombre.includes(q)
      )
    })
  }, [equiposEnAlcance, mapaOperativos, soloActivos, filtroOperativo, filtroTipo, busqueda])

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
      setError('Describe el motivo del Acta de Incidencia.')
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
            {ayJefe ? `Resguardo de Material · ${ayJefe}` : 'Resguardo Global de Material BUPC'}
          </h2>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            {ayJefe
              ? `Equipo institucional en préstamo asignado a integrantes de ${ayJefe}.`
              : 'Control centralizado de equipo en préstamo a través de operativos activos.'}
          </p>
        </div>
        <span className="rounded-full bg-naranja-suave px-3 py-1 text-xs font-bold tabular-nums text-naranja-oscuro dark:bg-noche-campo dark:text-naranja">
          {filtrados.length} en préstamo
        </span>
      </div>

      {ayJefe && (
        <IndicadorAlcanceAyudantia
          ayudantia={ayJefe}
          descripcion={`Solo se muestra material BUPC en resguardo de integrantes pertenecientes a ${ayJefe}.`}
        />
      )}

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

      {/* Barra de búsqueda y filtros en cliente */}
      <div className="tarjeta flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-48 flex-1">
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
          />
          <input
            type="search"
            placeholder="Buscar brigadista, folio o artículo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="campo min-h-9 pl-9 text-xs"
          />
        </div>

        <select
          aria-label="Filtrar por operativo"
          value={filtroOperativo}
          onChange={(e) => setFiltroOperativo(e.target.value)}
          className="campo min-h-9 w-auto text-xs"
        >
          <option value="TODOS">Todos los operativos</option>
          {operativosEnResguardo.map((op) => (
            <option key={op.id} value={op.id}>
              {op.nombre}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por tipo de equipo"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="campo min-h-9 w-auto text-xs"
        >
          <option value="TODOS">Todos los equipos</option>
          {tiposDisponibles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-borde bg-fondo px-2.5 text-xs font-semibold text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="h-4 w-4 rounded accent-udec"
          />
          <span>Solo operativos activos</span>
        </label>
      </div>

      {/* Lista densa */}
      {cargando ? (
        <div className="tarjeta flex flex-col gap-2.5 p-4">
          <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : filtrados.length === 0 ? (
        <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
          <Package size={32} strokeWidth={2} className="text-activo dark:text-activo-claro" />
          <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
            Sin material BUPC pendiente de devolución
          </h3>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Todo el equipo institucional filtrado se encuentra devuelto o liberado.
          </p>
        </article>
      ) : (
        <article className="tarjeta overflow-hidden">
          {/* Móvil: filas compactas de 2 líneas */}
          <div className="divide-y divide-borde md:hidden dark:divide-noche-borde">
            {filtrados.map((eq) => {
              const op = mapaOperativos.get(eq.operativo_id)
              const opCerrado = esOperativoCerrado(op)
              const puedeLiberar = !opCerrado || soyAdmin
              const opNombre = eq.operativo_nombre || op?.nombre || 'Operativo'
              const cantidad = eq.cantidad ?? 1
              return (
                <div key={eq.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                        {cantidad > 1 ? `${cantidad}× ` : ''}
                        {eq.nombre_articulo}
                        {eq.codigo_inventario ? ` · ${eq.codigo_inventario}` : ''}
                      </p>
                      <p className="truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        {normalizarNombrePropio(eq.usuario_nombre)} · {opNombre}
                        {opCerrado ? ` (${op?.estatus})` : ''} ·{' '}
                        {formatearHoraCorta(eq.creado_en?.toMillis())}
                      </p>
                    </div>
                    {eq.estado_reporte === 'Con_Falla' && (
                      <span className="shrink-0 rounded bg-alerta-suave px-1.5 py-0.5 text-[10px] font-bold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
                        Falla
                      </span>
                    )}
                  </div>

                  {puedeLiberar && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={ocupadoId === eq.id}
                        onClick={() => void manejarDevolverOk(eq)}
                        className="cursor-pointer rounded border border-activo bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo disabled:opacity-50 dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro"
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
                        className="cursor-pointer rounded border border-alerta bg-tarjeta px-2.5 py-1 text-[11px] font-bold text-alerta disabled:opacity-50 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                      >
                        Acta de Incidencia
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Escritorio: tabla densa */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-udec-oscuro text-white">
                <tr>
                  <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                    Equipo / Serie
                  </th>
                  <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                    Brigadista
                  </th>
                  <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                    Operativo
                  </th>
                  <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                    Entrega
                  </th>
                  <th scope="col" className="px-3 py-2 text-right text-[11px] font-semibold">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde dark:divide-noche-borde">
                {filtrados.map((eq) => {
                  const op = mapaOperativos.get(eq.operativo_id)
                  const opCerrado = esOperativoCerrado(op)
                  const puedeLiberar = !opCerrado || soyAdmin
                  const opNombre = eq.operativo_nombre || op?.nombre || 'Operativo'
                  const cantidad = eq.cantidad ?? 1
                  return (
                    <tr
                      key={eq.id}
                      className="hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                            {cantidad > 1 ? `${cantidad}× ` : ''}
                            {eq.nombre_articulo}
                          </span>
                          {eq.codigo_inventario && (
                            <span className="rounded bg-superficie-suave px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                              {eq.codigo_inventario}
                            </span>
                          )}
                          {eq.estado_reporte === 'Con_Falla' && (
                            <span className="rounded bg-alerta-suave px-1.5 py-0.5 text-[10px] font-bold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
                              Falla
                            </span>
                          )}
                        </div>
                        {eq.falla_reportada && (
                          <p className="text-[11px] text-alerta dark:text-noche-rojo-texto">
                            {eq.falla_reportada}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-tinta dark:text-noche-tinta">
                        {normalizarNombrePropio(eq.usuario_nombre)}
                      </td>
                      <td className="px-3 py-2 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                        {opNombre}
                        {opCerrado ? ` (${op?.estatus})` : ''}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                        <span>{formatearHoraCorta(eq.creado_en?.toMillis())}</span>
                        {eq.creado_por_nombre && (
                          <span className="block text-[10px]">Por: {eq.creado_por_nombre}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {!puedeLiberar ? (
                          <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                            {op?.estatus === 'Cancelado' ? 'Cancelado' : 'Finalizado'}
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={ocupadoId === eq.id}
                              onClick={() => void manejarDevolverOk(eq)}
                              className="cursor-pointer rounded border border-activo bg-activo-suave px-2.5 py-1 text-[11px] font-bold text-activo hover:bg-emerald-100 disabled:opacity-50 dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro"
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
                              Acta
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Modal Acta de Incidencia con compresión WebP en evidencias_equipos */}
      {incidenciaObjetivo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Levantar Acta de Incidencia"
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
                    Acta de Incidencia
                  </h3>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    {incidenciaObjetivo.nombre_articulo} ·{' '}
                    {normalizarNombrePropio(incidenciaObjetivo.usuario_nombre)}
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
                <label htmlFor="resguardo-motivo" className="etiqueta">
                  Motivo de daño, pérdida o no devolución
                </label>
                <textarea
                  id="resguardo-motivo"
                  rows={3}
                  maxLength={400}
                  value={motivoIncidencia}
                  onChange={(e) => setMotivoIncidencia(e.target.value)}
                  placeholder="Describe lo sucedido con el material..."
                  className="campo min-h-20 py-2 text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="etiqueta">Evidencia fotográfica opcional (se comprime a WebP)</label>
                <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-borde-fuerte bg-superficie-suave px-3 text-xs font-semibold text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta">
                  <Upload size={15} strokeWidth={2} />
                  <span className="truncate">
                    {archivoEvidencia ? archivoEvidencia.name : 'Adjuntar fotografía'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setArchivoEvidencia(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={ocupadoId === incidenciaObjetivo.id}
                  onClick={() => setIncidenciaObjetivo(null)}
                  className="btn-salvia text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupadoId === incidenciaObjetivo.id}
                  className="btn-rojo text-xs"
                >
                  {ocupadoId === incidenciaObjetivo.id ? 'Registrando...' : 'Confirmar Acta'}
                </button>
              </div>
            </form>
          </article>
        </div>
      )}
    </section>
  )
}
