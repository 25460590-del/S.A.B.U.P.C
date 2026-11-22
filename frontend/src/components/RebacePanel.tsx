import { BookOpen, Database, Search, X } from 'lucide-react'
import { useState } from 'react'
import { ETIQUETAS_TABLAS_REBACE, TABLAS_REBACE_ORDEN } from '../constants/rebaceSeed'
import type { ClaveRebace, TablaRebace, Usuario } from '../types'

interface RebacePanelProps {
  claves: ClaveRebace[]
  cargando: boolean
  usuario: Usuario
  poblando: boolean
  alPoblar?: () => void
  alInsertarCodigo: (codigo: string) => void
  alCerrarMovil?: () => void
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
  const [soloBasicos, setSoloBasicos] = useState(true)

  const q = busqueda.trim().toLowerCase()
  const filtradas = claves.filter((c) => {
    if (!q && c.tabla !== tablaActiva) return false
    if (soloBasicos && !c.es_basico && !q) return false
    if (!q) return true
    return (
      c.codigo.toLowerCase().includes(q) ||
      c.significado.toLowerCase().includes(q) ||
      c.categoria.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full flex-col bg-tarjeta dark:bg-noche-tarjeta">
      <div className="flex flex-col gap-3 border-b border-borde p-4 dark:border-noche-borde">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen size={18} strokeWidth={2} className="text-udec dark:text-activo-claro" />
            <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
              Claves ReBaCE v2
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-salvia px-2 py-0.5 text-[11px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
              Oficial
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
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
          />
          <input
            type="search"
            placeholder="Buscar código o significado..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="campo min-h-10 pl-9 text-xs"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={soloBasicos}
            onChange={(e) => setSoloBasicos(e.target.checked)}
            className="h-4 w-4 rounded accent-ambar"
          />
          <span className="text-xs font-semibold text-tinta dark:text-noche-tinta">
            Solo básicos (resaltados)
          </span>
        </label>

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
      </div>

      {/* Lista de claves */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {cargando ? (
          <div className="flex flex-col gap-2">
            <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
            <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
            <div className="h-12 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
          </div>
        ) : claves.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <Database size={28} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
            <p className="text-xs font-semibold text-tinta dark:text-noche-tinta">
              Catálogo ReBaCE v2 vacío en Firestore
            </p>
            {usuario.rol_sistema === 'Administrador' && alPoblar ? (
              <button
                type="button"
                disabled={poblando}
                onClick={alPoblar}
                className="btn-verde min-h-10 w-full text-xs"
              >
                {poblando ? 'Poblando catálogo...' : 'Cargar 5 tablas ReBaCE v2'}
              </button>
            ) : (
              <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                Solicita a un Administrador que inicialice el catálogo oficial ReBaCE v2.
              </p>
            )}
          </div>
        ) : filtradas.length === 0 ? (
          <p className="py-6 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Sin coincidencias. Desactiva &ldquo;Solo básicos&rdquo; o cambia tu búsqueda.
          </p>
        ) : (
          filtradas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => alInsertarCodigo(c.codigo)}
              title="Clic para insertar en Actividades"
              className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                c.es_basico
                  ? 'border-ambar bg-ambar-suave hover:bg-amber-100/70 dark:border-ambar dark:bg-noche-ambar dark:hover:bg-amber-950/60'
                  : 'border-borde bg-fondo hover:border-udec dark:border-noche-borde dark:bg-noche-campo'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tabular-nums text-udec-oscuro dark:text-noche-tinta">
                    {c.codigo}
                  </span>
                  {c.es_basico && (
                    <span className="rounded bg-ambar/20 px-1.5 py-0.5 text-[10px] font-bold text-ambar-texto dark:text-noche-ambar-texto">
                      Básico
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-tinta dark:text-noche-tinta-suave">
                  {c.significado}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
