import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Database,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ETAPAS_FORMATIVAS } from '../constants/catalogos'
import {
  combinarCatalogoRebaceConOffline,
  ETIQUETAS_TABLAS_REBACE,
  TABLAS_REBACE_ORDEN,
} from '../constants/rebaceSeed'
import { etapaDeSubgrupo } from '../lib/permisos'
import {
  eliminarClaveCatalogo,
  escucharAuditoriaEventos,
  guardarClaveCatalogo,
} from '../services/auditoriaService'
import { mensajeDeError } from '../services/authService'
import {
  combinarSubgruposConSierraInicial,
  escucharCatalogoSubgrupos,
  escucharSubgruposArchivados,
  formatearNombreGrupoFormativo,
  guardarCatalogoSubgrupos,
} from '../services/catalogosService'
import { cargarCatalogoRebaceConCache, poblarCatalogoRebace } from '../services/radioService'
import type {
  AuditoriaEvento,
  ClaveRebace,
  EtapaFormativa,
  TablaRebace,
  Usuario,
} from '../types'

interface CatalogosAuditoriaTabProps {
  admin: Usuario
}

function formatearHora(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function CatalogosAuditoriaTab({ admin }: CatalogosAuditoriaTabProps) {
  const [claves, setClaves] = useState<ClaveRebace[]>([])
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([])
  const [subgruposActivosRaw, setSubgruposActivosRaw] = useState<string[]>([])
  const [subgruposArchivados, setSubgruposArchivados] = useState<string[]>([])
  const [etapaNuevoSubgrupo, setEtapaNuevoSubgrupo] = useState<EtapaFormativa>('Alfa')
  const [nombreNuevoSubgrupo, setNombreNuevoSubgrupo] = useState('')
  const subgruposActivos = useMemo(
    () => combinarSubgruposConSierraInicial(subgruposActivosRaw, subgruposArchivados),
    [subgruposActivosRaw, subgruposArchivados],
  )
  const [tablaSel, setTablaSel] = useState<TablaRebace>('claves_personales')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [significado, setSignificado] = useState('')
  const [categoria, setCategoria] = useState('Personal')
  const [esBasico, setEsBasico] = useState(true)
  const [filtroCatPersonal, setFiltroCatPersonal] = useState<'Todos' | 'Personal' | 'Unidad'>('Todos')

  const [busquedaAudit, setBusquedaAudit] = useState('')
  const [filtroTipoAudit, setFiltroTipoAudit] = useState('TODOS')

  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    void cargarCatalogoRebaceConCache()
      .then((lista) => {
        if (activo) setClaves(lista)
      })
      .catch((err) => {
        if (activo) setError(mensajeDeError(err))
      })
    const c2 = escucharAuditoriaEventos(setEventos, (err) => setError(mensajeDeError(err)))
    const c3 = escucharCatalogoSubgrupos(setSubgruposActivosRaw, (err) =>
      setError(mensajeDeError(err)),
    )
    const c4 = escucharSubgruposArchivados(setSubgruposArchivados, () => undefined)
    return () => {
      activo = false
      c2()
      c3()
      c4()
    }
  }, [])

  const catalogoEfectivo = combinarCatalogoRebaceConOffline(claves)
  const clavesDeTabla = catalogoEfectivo.filter((c) => {
    if (c.tabla !== tablaSel) return false
    if (tablaSel === 'claves_personales' && filtroCatPersonal !== 'Todos') {
      return c.categoria === filtroCatPersonal
    }
    return true
  })

  const tiposUnicos = Array.from(new Set(eventos.map((e) => e.tipo)))
  const eventosFiltrados = eventos.filter((ev) => {
    if (filtroTipoAudit !== 'TODOS' && ev.tipo !== filtroTipoAudit) return false
    const q = busquedaAudit.trim().toLowerCase()
    if (!q) return true
    return (
      ev.actor_nombre.toLowerCase().includes(q) ||
      ev.objetivo_nombre.toLowerCase().includes(q) ||
      ev.detalle.toLowerCase().includes(q) ||
      ev.tipo.toLowerCase().includes(q)
    )
  })

  function cargarParaEditar(c: ClaveRebace) {
    setEditandoId(c.id)
    setTablaSel(c.tabla)
    setCodigo(c.codigo)
    setSignificado(c.significado)
    setCategoria(c.categoria)
    setEsBasico(c.es_basico)
  }

  function limpiarFormulario(tablaDestino: TablaRebace = tablaSel) {
    setEditandoId(null)
    setCodigo('')
    setSignificado('')
    setCategoria(tablaDestino === 'claves_personales' ? 'Personal' : 'General')
    setEsBasico(true)
  }

  async function manejarGuardarClave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!codigo.trim() || !significado.trim()) {
      setError('Ingresa el código y su significado.')
      return
    }
    setOcupado(true)
    try {
      const id =
        editandoId ??
        `${tablaSel.slice(0, 2)}_${codigo
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`

      await guardarClaveCatalogo(
        admin,
        {
          id,
          tabla: tablaSel,
          codigo: codigo.trim(),
          significado: significado.trim(),
          categoria: categoria.trim(),
          es_basico: esBasico,
          orden: editandoId
            ? (claves.find((x) => x.id === editandoId)?.orden ?? clavesDeTabla.length + 1)
            : clavesDeTabla.length + 1,
        },
        !editandoId,
      )
      setClaves(await cargarCatalogoRebaceConCache(true))
      setAviso(editandoId ? 'Clave actualizada en el catálogo.' : 'Nueva clave agregada al catálogo.')
      limpiarFormulario()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarEliminar(c: ClaveRebace) {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      await eliminarClaveCatalogo(admin, c)
      setClaves(await cargarCatalogoRebaceConCache(true))
      setAviso(`Clave "${c.codigo}" eliminada del catálogo.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarAgregarSubgrupo(e: FormEvent) {
    e.preventDefault()
    const etiqueta = formatearNombreGrupoFormativo(etapaNuevoSubgrupo, nombreNuevoSubgrupo)
    if (!etiqueta) return
    if (subgruposActivos.some((s) => s.toLowerCase() === etiqueta.toLowerCase())) {
      setError(`El grupo "${etiqueta}" ya está activo en el catálogo.`)
      return
    }
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      const nuevosActivos = [...subgruposActivos, etiqueta]
      const nuevosArchivados = subgruposArchivados.filter(
        (s) => s.toLowerCase() !== etiqueta.toLowerCase(),
      )
      await guardarCatalogoSubgrupos(
        admin,
        nuevosActivos,
        nuevosArchivados,
        `Grupo agregado: ${etiqueta}`,
      )
      setNombreNuevoSubgrupo('')
      setAviso(`Grupo "${etiqueta}" agregado al catálogo.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarArchivarSubgrupo(subgrupo: string) {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      const nuevosActivos = subgruposActivos.filter((s) => s !== subgrupo)
      const nuevosArchivados = Array.from(new Set([...subgruposArchivados, subgrupo]))
      await guardarCatalogoSubgrupos(
        admin,
        nuevosActivos,
        nuevosArchivados,
        `Subgrupo archivado (sin afectar históricos): ${subgrupo}`,
      )
      setAviso(`Subgrupo "${subgrupo}" archivado sin afectar historiales.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarRestaurarSubgrupo(subgrupo: string) {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      const nuevosActivos = Array.from(new Set([...subgruposActivos, subgrupo]))
      const nuevosArchivados = subgruposArchivados.filter((s) => s !== subgrupo)
      await guardarCatalogoSubgrupos(
        admin,
        nuevosActivos,
        nuevosArchivados,
        `Subgrupo restaurado: ${subgrupo}`,
      )
      setAviso(`Subgrupo "${subgrupo}" restaurado al catálogo activo.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarSembrar() {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      const total = await poblarCatalogoRebace(admin)
      setClaves(await cargarCatalogoRebaceConCache(true))
      setAviso(`Catálogo de claves actualizado con ${total} registros.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
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

      {/* Bloque superior: Catálogo Dinámico de Subgrupos por Etapa */}
      <article className="tarjeta flex flex-col gap-3.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
          <div className="flex items-center gap-2">
            <Layers size={18} strokeWidth={2} className="text-udec dark:text-activo-claro" />
            <div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Subgrupos por Etapa
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Agrega o archiva subgrupos (ej. Alfa 5, Omega 3) sin afectar el historial.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-salvia px-2.5 py-0.5 text-xs font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
            {subgruposActivos.length} activos
          </span>
        </div>

        <form onSubmit={manejarAgregarSubgrupo} className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Etapa del nuevo grupo"
            value={etapaNuevoSubgrupo}
            onChange={(e) => setEtapaNuevoSubgrupo(e.target.value as EtapaFormativa)}
            className="campo min-h-9 w-28 text-xs font-semibold"
          >
            {ETAPAS_FORMATIVAS.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
          <input
            type="text"
            maxLength={40}
            placeholder="Ej. 5 o Alfa 5 / Omega 3 / Sierra 2"
            value={nombreNuevoSubgrupo}
            onChange={(e) => setNombreNuevoSubgrupo(e.target.value)}
            className="campo min-h-9 min-w-44 flex-1 text-xs"
            required
          />
          <button type="submit" disabled={ocupado} className="btn-naranja min-h-9 px-3.5 text-xs">
            <Plus size={14} strokeWidth={2} />
            <span>Agregar Grupo</span>
          </button>
        </form>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ETAPAS_FORMATIVAS.map((etapaGrupo) => {
            const listaEtapa = subgruposActivos.filter((s) => etapaDeSubgrupo(s) === etapaGrupo)
            return (
              <div
                key={etapaGrupo}
                className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie-suave p-3 dark:border-noche-borde dark:bg-noche-campo"
              >
                <span className="text-xs font-bold text-tinta dark:text-noche-tinta">
                  {etapaGrupo === 'SIERRA' ? 'SIERRA' : `Etapa ${etapaGrupo}`} ({listaEtapa.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {listaEtapa.length === 0 ? (
                    <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      Sin grupos activos en {etapaGrupo}.
                    </span>
                  ) : (
                    listaEtapa.map((sg) => (
                      <span
                        key={sg}
                        className="inline-flex items-center gap-1.5 rounded-full border border-borde bg-tarjeta px-2.5 py-1 text-xs font-semibold text-tinta dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta"
                      >
                        <span>{sg}</span>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => void manejarArchivarSubgrupo(sg)}
                          title={`Archivar ${sg}`}
                          aria-label={`Archivar ${sg}`}
                          className="cursor-pointer text-tinta-suave hover:text-alerta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                        >
                          <Archive size={12} strokeWidth={2} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Otros grupos activos que no correspondan a Alfa/Omega/SIERRA */}
        {subgruposActivos.some((s) => etapaDeSubgrupo(s) === null) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-tinta-suave">Otros:</span>
            {subgruposActivos
              .filter((s) => etapaDeSubgrupo(s) === null)
              .map((sg) => (
                <span
                  key={sg}
                  className="inline-flex items-center gap-1.5 rounded-full border border-borde bg-tarjeta px-2.5 py-1 text-xs font-semibold text-tinta dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta"
                >
                  <span>{sg}</span>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void manejarArchivarSubgrupo(sg)}
                    aria-label={`Archivar ${sg}`}
                    className="cursor-pointer text-tinta-suave hover:text-alerta"
                  >
                    <Archive size={12} strokeWidth={2} />
                  </button>
                </span>
              ))}
          </div>
        )}

        {/* Archivados (restaurables) */}
        {subgruposArchivados.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-borde pt-2.5 dark:border-noche-borde">
            <span className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              Archivados:
            </span>
            {subgruposArchivados.map((sg) => (
              <button
                key={sg}
                type="button"
                disabled={ocupado}
                onClick={() => void manejarRestaurarSubgrupo(sg)}
                title={`Restaurar ${sg}`}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-borde-fuerte px-2.5 py-0.5 text-[11px] font-semibold text-tinta-suave hover:border-udec hover:text-udec dark:border-noche-borde dark:text-noche-tinta-suave dark:hover:text-activo-claro"
              >
                <RotateCcw size={11} strokeWidth={2} />
                <span>{sg}</span>
              </button>
            ))}
          </div>
        )}
      </article>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {/* Columna 1: Editor de Claves Personales y Catálogo ReBaCE v2 */}
        <article className="tarjeta flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
            <div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Editor de Claves de Radio
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Gestiona claves personales, unidades y códigos oficiales de radio.
              </p>
            </div>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void manejarSembrar()}
              className="btn-verde min-h-9 px-3 text-xs"
            >
              <Database size={14} strokeWidth={2} />
              <span>{claves.length === 0 ? 'Cargar claves oficiales' : 'Actualizar claves oficiales'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TABLAS_REBACE_ORDEN.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTablaSel(t)
                  limpiarFormulario(t)
                }}
                className={`cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                  tablaSel === t
                    ? 'bg-udec text-white'
                    : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                }`}
              >
                {ETIQUETAS_TABLAS_REBACE[t]}
              </button>
            ))}
          </div>

          {/* Formulario alta / edición (superficie plana sin card-ception) */}
          <form
            onSubmit={manejarGuardarClave}
            className="flex flex-col gap-2.5 rounded-lg bg-superficie-suave p-3 dark:bg-noche-campo"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                maxLength={30}
                placeholder="Código (ej. 58A, E7)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="campo min-h-10 text-xs font-bold"
                required
              />
              <input
                type="text"
                maxLength={250}
                placeholder="Significado o descripción"
                value={significado}
                onChange={(e) => setSignificado(e.target.value)}
                className="campo min-h-10 text-xs sm:col-span-2"
                required
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {tablaSel === 'claves_personales' ? (
                  <select
                    aria-label="Categoría de clave personal o unidad"
                    value={categoria === 'Unidad' ? 'Unidad' : 'Personal'}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="campo min-h-9 w-36 text-xs font-semibold"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Unidad">Unidad</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Categoría"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="campo min-h-9 w-36 text-xs"
                  />
                )}
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-tinta dark:text-noche-tinta">
                  <input
                    type="checkbox"
                    checked={esBasico}
                    onChange={(e) => setEsBasico(e.target.checked)}
                    className="h-4 w-4 rounded accent-ambar"
                  />
                  <span>Básico</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                {editandoId && (
                  <button
                    type="button"
                    onClick={() => limpiarFormulario()}
                    className="btn-salvia min-h-9 px-3 text-xs"
                  >
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={ocupado} className="btn-naranja min-h-9 px-3 text-xs">
                  <Plus size={14} strokeWidth={2} />
                  <span>{editandoId ? 'Actualizar' : 'Nueva Clave'}</span>
                </button>
              </div>
            </div>
          </form>

          {tablaSel === 'claves_personales' && (
            <div className="flex items-center gap-1.5">
              {(['Todos', 'Personal', 'Unidad'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCatPersonal(cat)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ${
                    filtroCatPersonal === cat
                      ? 'bg-udec text-white'
                      : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
                  }`}
                >
                  {cat === 'Unidad' ? 'Unidades Móviles' : cat}
                </button>
              ))}
            </div>
          )}

          {/* Lista de claves */}
          <div className="flex max-h-96 flex-col divide-y divide-borde overflow-y-auto border-t border-borde dark:divide-noche-borde dark:border-noche-borde">
            {clavesDeTabla.length === 0 ? (
              <p className="py-4 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Sin claves en esta tabla. Agrega una nueva o carga las claves oficiales.
              </p>
            ) : (
              clavesDeTabla.map((c) => {
                const estaEnNube = claves.some((x) => x.id === c.id)
                return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-tinta dark:text-noche-tinta">
                      {c.codigo}
                    </span>{' '}
                    {c.tabla === 'claves_personales' && (
                      <span
                        className={`mr-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          c.categoria === 'Unidad'
                            ? 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-campo dark:text-naranja'
                            : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro'
                        }`}
                      >
                        {c.categoria}
                      </span>
                    )}
                    <span className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      — {c.significado}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cargarParaEditar(c)}
                      aria-label={`Editar ${c.codigo}`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-borde bg-tarjeta text-tinta-suave hover:text-udec dark:border-noche-borde dark:bg-noche-tarjeta"
                    >
                      <Pencil size={14} strokeWidth={2} />
                    </button>
                    {estaEnNube && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void manejarEliminar(c)}
                        aria-label={`Eliminar ${c.codigo}`}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-alerta/50 bg-tarjeta text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
                )
              })
            )}
          </div>
        </article>

        {/* Columna 2: Auditoría de Eventos Críticos */}
        <article className="tarjeta flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} strokeWidth={2} className="text-udec dark:text-activo-claro" />
              <div>
                <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                  Auditoría de Eventos Críticos
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Historial de aprobaciones, bajas, actas y cambios.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-salvia px-2.5 py-0.5 text-xs font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta">
              {eventosFiltrados.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-44 flex-1">
              <Search
                size={15}
                strokeWidth={2}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
              />
              <input
                type="search"
                placeholder="Buscar actor, objetivo o detalle..."
                value={busquedaAudit}
                onChange={(e) => setBusquedaAudit(e.target.value)}
                className="campo min-h-10 pl-9 text-xs"
              />
            </div>

            <select
              aria-label="Filtrar por tipo de evento"
              value={filtroTipoAudit}
              onChange={(e) => setFiltroTipoAudit(e.target.value)}
              className="campo min-h-10 w-auto text-xs"
            >
              <option value="TODOS">Todos los tipos</option>
              {tiposUnicos.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="flex max-h-[460px] flex-col divide-y divide-borde overflow-y-auto border-t border-borde dark:divide-noche-borde dark:border-noche-borde">
            {eventosFiltrados.length === 0 ? (
              <p className="py-6 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Sin eventos de auditoría registrados.
              </p>
            ) : (
              eventosFiltrados.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col gap-1 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded bg-salvia px-2 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro">
                      {ev.tipo.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                      {formatearHora(ev.creado_en?.toMillis())}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-tinta dark:text-noche-tinta">
                    {ev.detalle}
                  </p>
                  {(ev.valor_anterior || ev.valor_nuevo) && (
                    <p className="rounded bg-superficie-suave px-2 py-1 text-[11px] font-medium text-tinta dark:bg-noche-campo dark:text-noche-tinta">
                      <span className="text-tinta-suave dark:text-noche-tinta-suave">Anterior:</span>{' '}
                      <strong>{ev.valor_anterior ?? '—'}</strong> ·{' '}
                      <span className="text-tinta-suave dark:text-noche-tinta-suave">Nuevo:</span>{' '}
                      <strong>{ev.valor_nuevo ?? '—'}</strong>
                    </p>
                  )}
                  <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    Por: {ev.actor_nombre} · Objetivo: {ev.objetivo_nombre}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  )
}
