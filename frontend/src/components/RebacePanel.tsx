import { BookOpen, Database, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  combinarCatalogoRebaceConOffline,
  ETIQUETAS_TABLAS_REBACE,
  TABLAS_REBACE_ORDEN,
} from '../constants/rebaceSeed'
import type { ClaveRebace, TablaRebace, Usuario } from '../types'

interface RebacePanelProps {
  claves: ClaveRebace[]
  cargando: boolean
  usuario: Usuario
  poblando: boolean
  alPoblar?: () => void
  alInsertarCodigo?: (codigo: string) => void
  alCerrarMovil?: () => void
}

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function RebacePanel({
  claves,
  cargando,
  usuario,
  poblando,
  alPoblar,
  alInsertarCodigo,
  alCerrarMovil,
}: RebacePanelProps) {
  const [tablaActiva, setTablaActiva] = useState<TablaRebace>('codigos_1_100')
  const [busqueda, setBusqueda] = useState('')
  const [soloBasicos, setSoloBasicos] = useState(false)
  const [filtroPersonal, setFiltroPersonal] = useState<'Todos' | 'Personal' | 'Unidad'>('Todos')

  // Disponibilidad 100% offline instantánea combinada con personalizaciones en Firestore
  const catalogoEfectivo = useMemo(() => combinarCatalogoRebaceConOffline(claves), [claves])

  const q = normalizarTexto(busqueda.trim())
  const filtradas = useMemo(
    () =>
      catalogoEfectivo.filter((c) => {
        if (!q && c.tabla !== tablaActiva) return false
        if (!q && tablaActiva === 'claves_personales' && filtroPersonal !== 'Todos') {
          if (c.categoria !== filtroPersonal) return false
        }
        if (soloBasicos && !c.es_basico && !q) return false
        if (!q) return true
        return (
          normalizarTexto(c.codigo).includes(q) ||
          normalizarTexto(c.significado).includes(q) ||
          normalizarTexto(c.categoria).includes(q)
        )
      }),
    [catalogoEfectivo, q, tablaActiva, filtroPersonal, soloBasicos],
  )

  return (
    <div className="flex h-full flex-col bg-tarjeta dark:bg-noche-tarjeta">
      <div className="flex flex-col gap-2.5 border-b border-borde p-3 dark:border-noche-borde">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen size={17} strokeWidth={2} className="text-udec dark:text-activo-claro" />
            <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
              Claves de Radio
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-salvia px-2 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
              {filtradas.length}
            </span>
            {alCerrarMovil && (
              <button
                type="button"
                onClick={alCerrarMovil}
                aria-label="Cerrar panel de claves"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-borde text-tinta-suave dark:border-noche-borde dark:text-noche-tinta-suave"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
          />
          <input
            type="search"
            placeholder="Buscar código, nombre o unidad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="campo min-h-9 pl-9 text-xs"
          />
        </div>

        {/* 5 pestañas de tablas ReBaCE v2 */}
        <div className="flex flex-wrap gap-1">
          {TABLAS_REBACE_ORDEN.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTablaActiva(t)
                setBusqueda('')
              }}
              className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                tablaActiva === t && !q
                  ? 'bg-udec text-white'
                  : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
              }`}
            >
              {ETIQUETAS_TABLAS_REBACE[t]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {!q && tablaActiva === 'claves_personales' ? (
            <div className="flex items-center gap-1">
              {(['Todos', 'Personal', 'Unidad'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroPersonal(cat)}
                  className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    filtroPersonal === cat
                      ? 'bg-udec text-white'
                      : 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                  }`}
                >
                  {cat === 'Unidad' ? 'Unidades' : cat}
                </button>
              ))}
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={soloBasicos}
                onChange={(e) => setSoloBasicos(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-ambar"
              />
              <span className="text-[11px] font-semibold text-tinta dark:text-noche-tinta">
                Solo básicos
              </span>
            </label>
          )}

          {claves.length === 0 && !cargando && usuario.rol_sistema === 'Administrador' && alPoblar && (
            <button
              type="button"
              disabled={poblando}
              onClick={alPoblar}
              className="inline-flex cursor-pointer items-center gap-1 rounded bg-salvia px-2 py-0.5 text-[11px] font-semibold text-udec-oscuro hover:bg-salvia-hover dark:bg-noche-campo dark:text-activo-claro"
            >
              <Database size={12} strokeWidth={2} />
              <span>{poblando ? 'Sincronizando...' : 'Sincronizar catálogo'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de claves */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
        {filtradas.length === 0 ? (
          <p className="py-6 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Sin coincidencias. Desactiva &ldquo;Solo básicos&rdquo; o cambia tu búsqueda.
          </p>
        ) : (
          filtradas.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={!alInsertarCodigo}
              onClick={() => alInsertarCodigo?.(c.codigo)}
              title={
                alInsertarCodigo
                  ? 'Clic para insertar en Actividades'
                  : 'Consulta de catálogo de claves'
              }
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                alInsertarCodigo ? 'cursor-pointer' : 'cursor-default'
              } ${
                c.es_basico
                  ? 'border-ambar/70 bg-ambar-suave/70 hover:bg-amber-100/70 dark:border-ambar/70 dark:bg-noche-ambar dark:hover:bg-amber-950/60'
                  : 'border-borde bg-fondo hover:border-udec dark:border-noche-borde dark:bg-noche-campo'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-extrabold tabular-nums text-udec-oscuro dark:text-noche-tinta">
                    {c.codigo}
                  </span>
                  {c.tabla === 'claves_personales' && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        c.categoria === 'Unidad'
                          ? 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-tarjeta dark:text-naranja'
                          : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-activo-claro'
                      }`}
                    >
                      {c.categoria}
                    </span>
                  )}
                </div>
                <p className="text-xs text-tinta dark:text-noche-tinta-suave">{c.significado}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
