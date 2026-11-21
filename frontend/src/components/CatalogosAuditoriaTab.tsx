import {
  AlertCircle,
  CheckCircle2,
  Database,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ETIQUETAS_TABLAS_REBACE, TABLAS_REBACE_ORDEN } from '../constants/rebaceSeed'
import {
  eliminarClaveCatalogo,
  escucharAuditoriaEventos,
  guardarClaveCatalogo,
} from '../services/auditoriaService'
import { mensajeDeError } from '../services/authService'
import { escucharCatalogoRebace, poblarCatalogoRebace } from '../services/radioService'
import type { AuditoriaEvento, ClaveRebace, TablaRebace, Usuario } from '../types'

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
  const [tablaSel, setTablaSel] = useState<TablaRebace>('claves_personales')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [significado, setSignificado] = useState('')
  const [categoria, setCategoria] = useState('Unidad')
  const [esBasico, setEsBasico] = useState(true)

  const [busquedaAudit, setBusquedaAudit] = useState('')
  const [filtroTipoAudit, setFiltroTipoAudit] = useState('TODOS')

  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const c1 = escucharCatalogoRebace(setClaves, (err) => setError(mensajeDeError(err)))
    const c2 = escucharAuditoriaEventos(setEventos, (err) => setError(mensajeDeError(err)))
    return () => {
      c1()
      c2()
    }
  }, [])

  const clavesDeTabla = claves.filter((c) => c.tabla === tablaSel)

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

  function limpiarFormulario() {
    setEditandoId(null)
    setCodigo('')
    setSignificado('')
    setCategoria('Unidad')
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
      setAviso(editandoId ? 'Clave actualizada en Firestore.' : 'Nueva clave agregada al catálogo.')
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
      setAviso(`Clave "${c.codigo}" eliminada del catálogo.`)
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
      setAviso(`Catálogo ReBaCE v2 inicializado con ${total} claves.`)
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

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {/* Columna 1: Editor de Claves Personales y Catálogo ReBaCE v2 */}
        <article className="tarjeta flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3 dark:border-noche-borde">
            <div>
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Editor de Claves de Radio (ReBaCE v2)
              </h3>
              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Gestiona Claves Personales e indicadores oficiales en tiempo real.
              </p>
            </div>
            {claves.length === 0 && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void manejarSembrar()}
                className="btn-verde min-h-9 px-3 text-xs"
              >
                <Database size={14} strokeWidth={2} />
                <span>Sembrar ReBaCE v2</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TABLAS_REBACE_ORDEN.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTablaSel(t)
                  limpiarFormulario()
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

          {/* Formulario alta / edición */}
          <form
            onSubmit={manejarGuardarClave}
            className="flex flex-col gap-2.5 rounded-lg border border-borde bg-fondo p-3 dark:border-noche-borde dark:bg-noche-campo"
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
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Categoría"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="campo min-h-9 w-36 text-xs"
                />
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
                    onClick={limpiarFormulario}
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

          {/* Lista de claves */}
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {clavesDeTabla.length === 0 ? (
              <p className="py-4 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Sin claves en esta tabla. Agrega una nueva o siembra el catálogo ReBaCE v2.
              </p>
            ) : (
              clavesDeTabla.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-borde bg-fondo px-3 py-2 dark:border-noche-borde dark:bg-noche-campo"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-bold text-tinta dark:text-noche-tinta">
                      {c.codigo}
                    </span>{' '}
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
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void manejarEliminar(c)}
                      aria-label={`Eliminar ${c.codigo}`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-alerta/50 bg-tarjeta text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))
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
                  Bitácora inmutable de aprobaciones, bajas, actas y ediciones.
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

          <div className="flex max-h-[460px] flex-col gap-2 overflow-y-auto">
            {eventosFiltrados.length === 0 ? (
              <p className="py-6 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Sin eventos de auditoría registrados.
              </p>
            ) : (
              eventosFiltrados.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col gap-1 rounded-lg border border-borde bg-fondo p-3 dark:border-noche-borde dark:bg-noche-campo"
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
