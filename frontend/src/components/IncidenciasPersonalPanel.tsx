import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileWarning,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import * as XLSX from 'xlsx'
import { GRAVEDADES_INCIDENCIA, TIPOS_INCIDENCIA_PERSONAL } from '../constants/catalogos'
import { normalizarNombrePropio } from '../lib/nombres'
import { ayudantiaJefatura, esAdmin, puedeGestionarBrigadista } from '../lib/permisos'
import {
  escucharDirectorioSegunRol,
  mensajeDeError,
  nombreCompleto,
} from '../services/authService'
import {
  escucharActasMaterialBupc,
  obtenerEvidenciaEquipo,
} from '../services/equiposService'
import {
  crearIncidenciaPersonal,
  escucharIncidenciasPersonalSegunRol,
} from '../services/incidenciasPersonalService'
import { escucharOperativos } from '../services/operativosService'
import type {
  EquipoTurno,
  GravedadIncidencia,
  IncidenciaPersonal,
  Operativo,
  TipoIncidenciaPersonal,
  Usuario,
} from '../types'
import { IndicadorAlcanceAyudantia } from './IndicadorAlcanceAyudantia'

interface IncidenciasPersonalPanelProps {
  actor: Usuario
}

type CategoriaFiltro = 'todas' | 'material' | 'personal'

interface IncidenciaUnificada {
  clave: string
  origen: 'material' | 'personal'
  fechaMs: number
  fechaIso: string
  usuarioUid: string
  usuarioNombre: string
  subgrupo: string
  etiquetaTipo: string
  severidad: string
  operativoNombre: string
  descripcion: string
  registradoPor: string
  evidenciaId: string | null
}

function formatearFechaHora(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fechaHoyIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Concentrador de Incidencias (Material BUPC + Personal):
 * - Actas de Material BUPC con carga de evidencia WebP estrictamente bajo demanda.
 * - Incidencias de Personal con alta inmutable y auditoría.
 * - Filtros en cliente + exportación CSV local (SheetJS).
 */
export function IncidenciasPersonalPanel({ actor }: IncidenciasPersonalPanelProps) {
  const soyAdmin = esAdmin(actor)
  const ayJefe = ayudantiaJefatura(actor)

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [incidenciasPers, setIncidenciasPers] = useState<IncidenciaPersonal[]>([])
  const [actasMaterial, setActasMaterial] = useState<EquipoTurno[]>([])

  // Filtros en cliente
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaFiltro>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroSubgrupo, setFiltroSubgrupo] = useState('TODOS')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Formulario de nueva incidencia de personal
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [objetivoUid, setObjetivoUid] = useState('')
  const [operativoId, setOperativoId] = useState('')
  const [tipo, setTipo] = useState<TipoIncidenciaPersonal>('Observación')
  const [gravedad, setGravedad] = useState<GravedadIncidencia>('Baja')
  const [fechaReferencia, setFechaReferencia] = useState(fechaHoyIso)
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Visor bajo demanda de evidencia WebP
  const [cargandoEvId, setCargandoEvId] = useState<string | null>(null)
  const [evidenciaModal, setEvidenciaModal] = useState<{
    titulo: string
    imagen: string
  } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const cOps = escucharOperativos(setOperativos, (err) => setError(mensajeDeError(err)))
    const cUsers = escucharDirectorioSegunRol(actor, setUsuarios, () => undefined)
    const cPers = escucharIncidenciasPersonalSegunRol(actor, setIncidenciasPers, (err) =>
      setError(mensajeDeError(err)),
    )
    const cMat = escucharActasMaterialBupc(setActasMaterial, (err) => setError(mensajeDeError(err)))

    return () => {
      cOps()
      cUsers()
      cPers()
      cMat()
    }
  }, [actor])

  const mapaUsuarios = useMemo(() => new Map(usuarios.map((u) => [u.uid, u])), [usuarios])
  const mapaOperativos = useMemo(() => new Map(operativos.map((o) => [o.id, o])), [operativos])

  const personasSeleccionables = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.estatus === 'Activo' &&
          (soyAdmin ||
            (ayJefe ? puedeGestionarBrigadista(actor, u) : puedeGestionarBrigadista(actor, u) || operativoId !== '')),
      ),
    [usuarios, soyAdmin, ayJefe, actor, operativoId],
  )

  const unificadas = useMemo<IncidenciaUnificada[]>(() => {
    const items: IncidenciaUnificada[] = []

    for (const inc of incidenciasPers) {
      const u = mapaUsuarios.get(inc.usuario_uid)
      if (ayJefe && !u) continue
      const ms = inc.creado_en?.toMillis() ?? 0
      items.push({
        clave: `p_${inc.id}`,
        origen: 'personal',
        fechaMs: ms,
        fechaIso: ms ? formatearFechaHora(ms).slice(0, 10) : '',
        usuarioUid: inc.usuario_uid,
        usuarioNombre: normalizarNombrePropio(inc.usuario_nombre),
        subgrupo: u?.subgrupo || u?.etapa || 'Sin subgrupo',
        etiquetaTipo: inc.tipo,
        severidad: inc.gravedad,
        operativoNombre: inc.operativo_id
          ? (mapaOperativos.get(inc.operativo_id)?.nombre ?? 'Operativo')
          : 'Administrativa',
        descripcion: inc.descripcion,
        registradoPor: normalizarNombrePropio(inc.creado_por_nombre),
        evidenciaId: null,
      })
    }

    for (const eq of actasMaterial) {
      if (!eq.acta_incidencia) continue
      const u = mapaUsuarios.get(eq.usuario_uid)
      if (ayJefe && !u) continue
      // Si es Encargado sin ayudantía, solo mostrar actas vinculadas a sus brigadistas o registradas por él
      if (
        !soyAdmin &&
        !ayJefe &&
        eq.acta_incidencia.registrado_por_uid !== actor.uid &&
        !mapaUsuarios.has(eq.usuario_uid)
      ) {
        continue
      }
      const ms = eq.actualizado_en?.toMillis() ?? eq.creado_en?.toMillis() ?? 0
      items.push({
        clave: `m_${eq.id}`,
        origen: 'material',
        fechaMs: ms,
        fechaIso: ms ? formatearFechaHora(ms).slice(0, 10) : '',
        usuarioUid: eq.usuario_uid,
        usuarioNombre: normalizarNombrePropio(eq.usuario_nombre),
        subgrupo: u?.subgrupo || u?.etapa || 'Sin subgrupo',
        etiquetaTipo: `${eq.nombre_articulo}${eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}`,
        severidad: 'Material BUPC',
        operativoNombre:
          eq.operativo_nombre || mapaOperativos.get(eq.operativo_id)?.nombre || 'Operativo',
        descripcion: eq.acta_incidencia.motivo,
        registradoPor: normalizarNombrePropio(eq.acta_incidencia.registrado_por_nombre),
        evidenciaId: eq.acta_incidencia.evidencia_id,
      })
    }

    items.sort((a, b) => b.fechaMs - a.fechaMs)
    return items
  }, [incidenciasPers, actasMaterial, mapaUsuarios, mapaOperativos, soyAdmin, ayJefe, actor.uid])

  const subgruposDisponibles = useMemo(
    () =>
      Array.from(new Set(unificadas.map((i) => i.subgrupo))).sort((a, b) =>
        a.localeCompare(b, 'es-MX'),
      ),
    [unificadas],
  )

  const conteos = useMemo(() => {
    let material = 0
    let personal = 0
    for (const i of unificadas) {
      if (i.origen === 'material') material++
      else personal++
    }
    return { todas: unificadas.length, material, personal }
  }, [unificadas])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return unificadas.filter((item) => {
      if (categoriaFiltro !== 'todas' && item.origen !== categoriaFiltro) return false
      if (filtroSubgrupo !== 'TODOS' && item.subgrupo !== filtroSubgrupo) return false
      if (fechaDesde && item.fechaIso && item.fechaIso < fechaDesde) return false
      if (fechaHasta && item.fechaIso && item.fechaIso > fechaHasta) return false
      if (!q) return true
      return (
        item.usuarioNombre.toLowerCase().includes(q) ||
        item.etiquetaTipo.toLowerCase().includes(q) ||
        item.descripcion.toLowerCase().includes(q) ||
        item.operativoNombre.toLowerCase().includes(q)
      )
    })
  }, [unificadas, categoriaFiltro, filtroSubgrupo, fechaDesde, fechaHasta, busqueda])

  async function manejarRegistrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    const objetivo = usuarios.find((u) => u.uid === objetivoUid)
    if (!objetivo) {
      setError('Selecciona un integrante para registrar la incidencia.')
      return
    }
    setGuardando(true)
    try {
      const prefijoFecha =
        fechaReferencia && fechaReferencia !== fechaHoyIso() ? `[Fecha: ${fechaReferencia}] ` : ''
      await crearIncidenciaPersonal(actor, {
        objetivo,
        operativo_id: operativoId || null,
        tipo,
        gravedad,
        descripcion: `${prefijoFecha}${descripcion.trim()}`.slice(0, 1000),
      })
      setDescripcion('')
      setObjetivoUid('')
      setMostrarFormulario(false)
      setAviso(`Incidencia registrada para ${nombreCompleto(objetivo)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function verEvidencia(item: IncidenciaUnificada) {
    if (!item.evidenciaId) return
    setCargandoEvId(item.clave)
    setError(null)
    try {
      const ev = await obtenerEvidenciaEquipo(item.evidenciaId)
      if (!ev) {
        setError('No se encontró la fotografía de evidencia.')
      } else {
        setEvidenciaModal({
          titulo: `${item.etiquetaTipo} · ${item.usuarioNombre}`,
          imagen: ev.imagen_webp_base64,
        })
      }
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoEvId(null)
    }
  }

  function exportarCsv() {
    if (filtradas.length === 0) return
    const filas = filtradas.map((i) => ({
      Fecha: formatearFechaHora(i.fechaMs),
      Categoría: i.origen === 'material' ? 'Material BUPC' : 'Personal',
      Integrante: i.usuarioNombre,
      Subgrupo: i.subgrupo,
      Tipo: i.etiquetaTipo,
      Severidad: i.severidad,
      Operativo: i.operativoNombre,
      Descripción: i.descripcion,
      'Registrado por': i.registradoPor,
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const csv = XLSX.utils.sheet_to_csv(hoja)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incidencias-sabupc-${fechaHoyIso()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
            {ayJefe ? `Incidencias · ${ayJefe}` : 'Concentrador de Incidencias'}
          </h2>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            {ayJefe
              ? `Actas de material e incidencias de personal de la ayudantía ${ayJefe}.`
              : 'Actas de material BUPC e incidencias de personal.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={filtradas.length === 0}
            onClick={exportarCsv}
            className="btn-salvia min-h-9 px-3 text-xs"
          >
            <Download size={14} strokeWidth={2} />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setMostrarFormulario((v) => !v)}
            className="btn-naranja min-h-9 px-3.5 text-xs"
          >
            <Plus size={15} strokeWidth={2} />
            <span>Nueva incidencia personal</span>
          </button>
        </div>
      </div>

      {ayJefe && (
        <IndicadorAlcanceAyudantia
          ayudantia={ayJefe}
          descripcion={`Solo puedes consultar y registrar incidencias para integrantes de ${ayJefe}.`}
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

      {/* Formulario desplegable de nueva incidencia de personal */}
      {mostrarFormulario && (
        <article className="tarjeta flex flex-col gap-3.5 border-2 border-udec p-4">
          <div className="flex items-center justify-between gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
            <div className="flex items-center gap-2">
              <ClipboardList size={17} strokeWidth={2} className="text-udec dark:text-activo-claro" />
              <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                Registrar Incidencia de Personal
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              aria-label="Cerrar formulario"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
            >
              <X size={17} strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={manejarRegistrar} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="inc-usuario" className="etiqueta">
                  Integrante
                </label>
                <select
                  id="inc-usuario"
                  value={objetivoUid}
                  onChange={(e) => setObjetivoUid(e.target.value)}
                  className="campo min-h-10 text-xs"
                  required
                >
                  <option value="">Selecciona un integrante...</option>
                  {personasSeleccionables.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {nombreCompleto(u)} ({u.subgrupo || u.etapa})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="inc-tipo" className="etiqueta">
                  Categoría
                </label>
                <select
                  id="inc-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoIncidenciaPersonal)}
                  className="campo min-h-10 text-xs"
                >
                  {TIPOS_INCIDENCIA_PERSONAL.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="inc-grav" className="etiqueta">
                  Severidad
                </label>
                <select
                  id="inc-grav"
                  value={gravedad}
                  onChange={(e) => setGravedad(e.target.value as GravedadIncidencia)}
                  className="campo min-h-10 text-xs"
                >
                  {GRAVEDADES_INCIDENCIA.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="inc-op" className="etiqueta">
                  Operativo (opcional)
                </label>
                <select
                  id="inc-op"
                  value={operativoId}
                  onChange={(e) => setOperativoId(e.target.value)}
                  className="campo min-h-10 text-xs"
                >
                  <option value="">Sin operativo específico</option>
                  {operativos
                    .filter((o) => o.estatus !== 'Finalizado')
                    .map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="inc-fecha" className="etiqueta">
                  Fecha de los hechos
                </label>
                <input
                  id="inc-fecha"
                  type="date"
                  value={fechaReferencia}
                  onChange={(e) => setFechaReferencia(e.target.value)}
                  className="campo min-h-10 text-xs tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="etiqueta">Registrado por</span>
                <div className="campo flex min-h-10 items-center text-xs font-semibold opacity-80">
                  {nombreCompleto(actor)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="inc-desc" className="etiqueta">
                Descripción detallada
              </label>
              <textarea
                id="inc-desc"
                rows={3}
                maxLength={1000}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe hechos, contexto o nota administrativa..."
                className="campo min-h-20 py-2 text-sm"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarFormulario(false)}
                className="btn-salvia min-h-9 text-xs"
              >
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="btn-verde min-h-9 px-4 text-xs">
                {guardando ? 'Registrando...' : 'Guardar Incidencia'}
              </button>
            </div>
          </form>
        </article>
      )}

      {/* Barra de filtros unificada */}
      <div className="tarjeta flex flex-col gap-2.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'todas', label: 'Todas', count: conteos.todas },
                { id: 'material', label: 'Material BUPC', count: conteos.material },
                { id: 'personal', label: 'Personal', count: conteos.personal },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCategoriaFiltro(chip.id)}
                className={`min-h-8 cursor-pointer rounded-full px-3 text-[11px] font-semibold ${
                  categoriaFiltro === chip.id
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                }`}
              >
                {chip.label} <span className="tabular-nums opacity-80">({chip.count})</span>
              </button>
            ))}
          </div>

          <div className="relative min-w-44 flex-1">
            <Search
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
            />
            <input
              type="search"
              placeholder="Buscar persona, equipo o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="campo min-h-9 pl-9 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por subgrupo"
            value={filtroSubgrupo}
            onChange={(e) => setFiltroSubgrupo(e.target.value)}
            className="campo min-h-8 w-auto py-0.5 text-[11px] font-semibold"
          >
            <option value="TODOS">Todos los subgrupos</option>
            {subgruposDisponibles.map((sg) => (
              <option key={sg} value={sg}>
                {sg}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            <span>Desde:</span>
            <input
              type="date"
              aria-label="Fecha desde"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="campo min-h-8 w-auto py-0.5 text-[11px] tabular-nums"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            <span>Hasta:</span>
            <input
              type="date"
              aria-label="Fecha hasta"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="campo min-h-8 w-auto py-0.5 text-[11px] tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Listado unificado */}
      {filtradas.length === 0 ? (
        <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
          <ClipboardList size={30} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
          <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
            Sin incidencias en el filtro seleccionado
          </p>
        </article>
      ) : (
        <article className="tarjeta divide-y divide-borde overflow-hidden dark:divide-noche-borde">
          {filtradas.map((item) => (
            <div key={item.clave} className="flex flex-col gap-1.5 px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.origen === 'material'
                        ? 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-campo dark:text-naranja'
                        : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro'
                    }`}
                  >
                    {item.origen === 'material' ? (
                      <FileWarning size={11} strokeWidth={2} />
                    ) : (
                      <ClipboardList size={11} strokeWidth={2} />
                    )}
                    <span>{item.origen === 'material' ? 'Material BUPC' : 'Personal'}</span>
                  </span>

                  <span className="font-bold text-tinta dark:text-noche-tinta">
                    {item.usuarioNombre}
                  </span>
                  <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    ({item.subgrupo})
                  </span>
                  <span className="rounded bg-superficie-suave px-1.5 py-0.5 text-[10px] font-semibold text-tinta dark:bg-noche-campo dark:text-noche-tinta">
                    {item.etiquetaTipo}
                  </span>
                  {item.origen === 'personal' && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        item.severidad === 'Alta'
                          ? 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                          : item.severidad === 'Media'
                            ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                            : 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                      }`}
                    >
                      {item.severidad}
                    </span>
                  )}
                </div>

                <span className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                  {formatearFechaHora(item.fechaMs)}
                </span>
              </div>

              <p className="font-medium text-tinta dark:text-noche-tinta">{item.descripcion}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                <span>
                  Operativo: <strong>{item.operativoNombre}</strong> · Por: {item.registradoPor}
                </span>

                {item.evidenciaId && (
                  <button
                    type="button"
                    disabled={cargandoEvId === item.clave}
                    onClick={() => void verEvidencia(item)}
                    className="btn-salvia min-h-8 px-2.5 text-[11px]"
                  >
                    <Eye size={13} strokeWidth={2} />
                    <span>{cargandoEvId === item.clave ? 'Cargando...' : 'Ver evidencia'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </article>
      )}

      {/* Visor bajo demanda de evidencia WebP */}
      {evidenciaModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Evidencia de acta de material"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <article className="tarjeta flex max-h-[90dvh] w-full max-w-lg flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="truncate text-sm font-bold text-tinta dark:text-noche-tinta">
                Evidencia · {evidenciaModal.titulo}
              </h4>
              <button
                type="button"
                onClick={() => setEvidenciaModal(null)}
                aria-label="Cerrar"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <img
              src={evidenciaModal.imagen}
              alt={evidenciaModal.titulo}
              className="max-h-[70dvh] w-full rounded-lg border border-borde object-contain dark:border-noche-borde"
            />
          </article>
        </div>
      )}
    </section>
  )
}
