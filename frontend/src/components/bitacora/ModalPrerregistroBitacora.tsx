import { Search, Trash2, UserPlus, X } from 'lucide-react'
import { opcionesRolEnTurno, rolOperativoPorAyudantia } from '../../constants/catalogos'
import { normalizarNombrePropio } from '../../lib/nombres'
import { etiquetaAyudantia } from '../../lib/permisos'
import type {
  Operativo,
  PerfilOperativoMinimo,
  PrerregistroOperativo,
  RolEnTurno,
} from '../../types'

interface ModalPrerregistroBitacoraProps {
  operativo: Operativo
  totalApuntados: number
  confirmadosCount: number
  pendientesDeLlegar: PrerregistroOperativo[]
  candidatos: PerfilOperativoMinimo[]
  busqueda: string
  ocupadoId: string | null
  alCambiarBusqueda: (valor: string) => void
  alAgregar: (p: PerfilOperativoMinimo) => void
  alQuitar: (p: PrerregistroOperativo) => void
  alActualizarRol: (p: PrerregistroOperativo, rol: RolEnTurno) => void
  alCerrar: () => void
}

export function ModalPrerregistroBitacora({
  operativo,
  totalApuntados,
  confirmadosCount,
  pendientesDeLlegar,
  candidatos,
  busqueda,
  ocupadoId,
  alCambiarBusqueda,
  alAgregar,
  alQuitar,
  alActualizarRol,
  alCerrar,
}: ModalPrerregistroBitacoraProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prerregistro previo de asistentes"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <article className="tarjeta flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b-3 border-naranja bg-udec px-4 py-3 text-white">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">Prerregistro previo · {operativo.nombre}</h3>
            <p className="text-[11px] text-white/85 tabular-nums">
              Apuntados: {totalApuntados}
              {operativo.cupo_sugerido ? ` / ${operativo.cupo_sugerido}` : ''} · Confirmados:{' '}
              {confirmadosCount} · Por llegar: {pendientesDeLlegar.length}
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar prerregistro"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="relative">
            <Search
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
            />
            <input
              type="search"
              placeholder="Buscar integrante activo por nombre, cuenta o grupo..."
              value={busqueda}
              onChange={(e) => alCambiarBusqueda(e.target.value)}
              className="campo min-h-10 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave dark:text-noche-tinta-suave">
              Integrantes disponibles ({candidatos.length})
            </span>
            {candidatos.length === 0 ? (
              <p className="rounded-lg border border-borde bg-superficie-suave py-4 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                {busqueda.trim()
                  ? 'Sin integrantes disponibles con esa búsqueda.'
                  : 'Todos los integrantes activos disponibles ya están apuntados o en turno.'}
              </p>
            ) : (
              <div className="flex max-h-56 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde dark:divide-noche-borde dark:border-noche-borde">
                {candidatos.slice(0, 40).map((p) => (
                  <div key={p.uid} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                        {p.nombre_completo}
                      </span>
                      <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        {p.subgrupo || p.etapa} · {etiquetaAyudantia(p.ayudantia)} ·{' '}
                        <span className="tabular-nums">{p.numero_cuenta}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={ocupadoId === `pre-${p.uid}`}
                      onClick={() => alAgregar(p)}
                      className="btn-verde min-h-8 shrink-0 px-2.5 text-[11px]"
                    >
                      <UserPlus size={12} strokeWidth={2} />
                      <span>{ocupadoId === `pre-${p.uid}` ? '...' : 'Agregar'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendientesDeLlegar.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-borde pt-3 dark:border-noche-borde">
              <span className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave dark:text-noche-tinta-suave">
                Apuntados por llegar ({pendientesDeLlegar.length})
              </span>
              <div className="flex max-h-44 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde dark:divide-noche-borde dark:border-noche-borde">
                {pendientesDeLlegar.map((p) => {
                  const rolPre = p.rol_en_turno ?? rolOperativoPorAyudantia(p.ayudantia)
                  return (
                    <div
                      key={p.usuario_uid}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-tinta dark:text-noche-tinta">
                          {normalizarNombrePropio(p.usuario_nombre)}
                        </span>
                        <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          {p.subgrupo || p.etapa} ·{' '}
                          {p.origen === 'Autoregistro' ? 'Autoregistro' : 'Manual'}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <select
                          aria-label={`Rol preasignado de ${p.usuario_nombre}`}
                          value={rolPre}
                          onChange={(e) => alActualizarRol(p, e.target.value as RolEnTurno)}
                          className="campo min-h-8 w-auto py-0.5 text-[11px]"
                        >
                          {opcionesRolEnTurno(rolPre).map((rol) => (
                            <option key={rol} value={rol}>
                              {rol}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={ocupadoId === `delpre-${p.usuario_uid}`}
                          onClick={() => alQuitar(p)}
                          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-2 text-[11px] font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                        >
                          <Trash2 size={12} strokeWidth={2} />
                          <span>Quitar</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button type="button" onClick={alCerrar} className="btn-salvia min-h-9 px-4 text-xs">
              Listo
            </button>
          </div>
        </div>
      </article>
    </div>
  )
}
