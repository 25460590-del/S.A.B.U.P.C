import { Check, Search, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { opcionesRolEnTurno, resolverRolInicialOperativo } from '../../constants/catalogos'
import { ayudantiaEfectiva, etiquetaAyudantia } from '../../lib/permisos'
import type { PerfilOperativoMinimo, PrerregistroOperativo, RolEnTurno } from '../../types'

interface ModalRegistroManualProps {
  operativoNombre: string
  perfilesActivos: PerfilOperativoMinimo[]
  uidsConAsisAbierta: Set<string>
  mapaPrerregistros: Map<string, PrerregistroOperativo>
  uidManual: string
  rolManual: RolEnTurno
  ocupado: boolean
  alCambiarUid: (uid: string) => void
  alCambiarRol: (rol: RolEnTurno) => void
  alEnviar: (e: FormEvent) => void
  alCerrar: () => void
}

export function ModalRegistroManual({
  operativoNombre,
  perfilesActivos,
  uidsConAsisAbierta,
  mapaPrerregistros,
  uidManual,
  rolManual,
  ocupado,
  alCambiarUid,
  alCambiarRol,
  alEnviar,
  alCerrar,
}: ModalRegistroManualProps) {
  const [busqueda, setBusqueda] = useState('')

  const disponibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return perfilesActivos.filter((p) => {
      if (uidsConAsisAbierta.has(p.uid)) return false
      if (!q) return true
      const grupo = (p.subgrupo || p.etapa || '').toLowerCase()
      return (
        p.nombre_completo.toLowerCase().includes(q) ||
        p.numero_cuenta.toLowerCase().includes(q) ||
        grupo.includes(q) ||
        etiquetaAyudantia(p.ayudantia).toLowerCase().includes(q)
      )
    })
  }, [perfilesActivos, uidsConAsisAbierta, busqueda])

  const seleccionado = perfilesActivos.find((p) => p.uid === uidManual) ?? null

  function elegirBrigadista(p: PerfilOperativoMinimo) {
    alCambiarUid(p.uid)
    alCambiarRol(
      resolverRolInicialOperativo(ayudantiaEfectiva(p), mapaPrerregistros.get(p.uid)),
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Registro Manual de Asistencia"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <article className="tarjeta flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl sm:rounded-xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-borde bg-udec px-4 py-3 text-white dark:border-noche-borde">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">Registro Manual · {operativoNombre}</h3>
            <p className="text-[11px] text-white/85 tabular-nums">
              Disponibles sin entrada abierta: {disponibles.length}
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <form onSubmit={alEnviar} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-busqueda" className="etiqueta">
              Brigadista activo
            </label>

            {seleccionado ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-udec bg-salvia/70 px-3 py-2 dark:border-activo-claro dark:bg-noche-campo">
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                    {seleccionado.nombre_completo}
                  </span>
                  <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    {seleccionado.subgrupo || seleccionado.etapa} ·{' '}
                    {etiquetaAyudantia(seleccionado.ayudantia)} ·{' '}
                    <span className="tabular-nums">{seleccionado.numero_cuenta}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    alCambiarUid('')
                    alCambiarRol('Sin definir')
                  }}
                  className="btn-salvia min-h-9 shrink-0 px-2.5 text-[11px]"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={15}
                    strokeWidth={2}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
                  />
                  <input
                    id="manual-busqueda"
                    type="search"
                    placeholder="Buscar por nombre, cuenta o grupo..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="campo min-h-11 pl-9 text-xs"
                  />
                </div>

                {disponibles.length === 0 ? (
                  <p className="rounded-lg border border-borde bg-superficie-suave py-4 text-center text-xs text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave">
                    {busqueda.trim()
                      ? 'Sin brigadistas disponibles con esa búsqueda.'
                      : 'Todos los brigadistas activos ya tienen turno abierto en este operativo.'}
                  </p>
                ) : (
                  <div className="flex max-h-52 flex-col divide-y divide-borde overflow-y-auto rounded-lg border border-borde dark:divide-noche-borde dark:border-noche-borde">
                    {disponibles.slice(0, 40).map((p) => {
                      const marcado = p.uid === uidManual
                      return (
                        <button
                          key={p.uid}
                          type="button"
                          onClick={() => elegirBrigadista(p)}
                          className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                            marcado
                              ? 'bg-salvia/70 dark:bg-noche-campo'
                              : 'hover:bg-superficie-suave dark:hover:bg-noche-campo/70'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                              {p.nombre_completo}
                            </span>
                            <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                              {p.subgrupo || p.etapa} · {etiquetaAyudantia(p.ayudantia)} ·{' '}
                              <span className="tabular-nums">{p.numero_cuenta}</span>
                            </span>
                          </div>
                          {marcado && (
                            <Check
                              size={16}
                              strokeWidth={2.2}
                              className="shrink-0 text-udec dark:text-activo-claro"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="manual-rol" className="etiqueta">
              Rol en turno
            </label>
            <select
              id="manual-rol"
              value={rolManual}
              onChange={(e) => alCambiarRol(e.target.value as RolEnTurno)}
              className="campo min-h-11"
            >
              {opcionesRolEnTurno(rolManual).map((rol) => (
                <option key={rol} value={rol}>
                  {rol}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={alCerrar} className="btn-salvia min-h-11">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={ocupado || !uidManual}
              className="btn-verde min-h-11"
            >
              {ocupado ? 'Registrando...' : 'Registrar Entrada'}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
