import { Clock, Trash2, UserPlus } from 'lucide-react'
import { opcionesRolEnTurno, rolOperativoPorAyudantia } from '../../constants/catalogos'
import { normalizarNombrePropio } from '../../lib/nombres'
import { etiquetaAyudantia } from '../../lib/permisos'
import type { PrerregistroOperativo, RolEnTurno } from '../../types'

interface ListaPorLlegarProps {
  esFinalizado: boolean
  recepcionAbierta: boolean
  pendientesDeLlegar: PrerregistroOperativo[]
  pendientesFiltrados: PrerregistroOperativo[]
  ocupadoId: string | null
  alActualizarRol: (p: PrerregistroOperativo, rol: RolEnTurno) => void
  alConfirmarEntrada: (p: PrerregistroOperativo) => void
  alQuitar: (p: PrerregistroOperativo) => void
}

export function ListaPorLlegar({
  esFinalizado,
  recepcionAbierta,
  pendientesDeLlegar,
  pendientesFiltrados,
  ocupadoId,
  alActualizarRol,
  alConfirmarEntrada,
  alQuitar,
}: ListaPorLlegarProps) {
  if (pendientesFiltrados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 p-8 text-center">
        <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
          {pendientesDeLlegar.length === 0
            ? esFinalizado
              ? 'Todos los prerregistrados asistieron al operativo'
              : 'No hay integrantes pendientes por llegar'
            : 'Sin coincidencias con los filtros activos'}
        </p>
        <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
          {pendientesDeLlegar.length === 0 && !esFinalizado
            ? 'Usa "Prerregistrar" para apuntar integrantes previamente o abre la convocatoria en Resumen.'
            : 'Ajusta el buscador o los filtros de etapa y ayudantía.'}
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-borde dark:divide-noche-borde">
      {pendientesFiltrados.map((p) => {
        const grupo = p.subgrupo || p.etapa
        const rolActual = p.rol_en_turno ?? rolOperativoPorAyudantia(p.ayudantia)
        return (
          <div
            key={p.usuario_uid}
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                  {normalizarNombrePropio(p.usuario_nombre)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    esFinalizado
                      ? 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                      : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                  }`}
                >
                  <Clock size={10} strokeWidth={2} />
                  <span>{esFinalizado ? 'No asistió' : 'Por llegar'}</span>
                </span>
                <span className="rounded bg-superficie-suave px-1.5 py-0.5 text-[10px] font-semibold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                  {p.origen === 'Autoregistro' ? 'Autoregistro' : 'Manual'}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                {grupo} · {etiquetaAyudantia(p.ayudantia)} ·{' '}
                <span className="tabular-nums">{p.usuario_cuenta}</span>
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <select
                aria-label={`Rol preasignado de ${p.usuario_nombre}`}
                value={rolActual}
                disabled={esFinalizado}
                onChange={(e) => alActualizarRol(p, e.target.value as RolEnTurno)}
                className="campo min-h-8 w-auto py-0.5 text-[11px]"
              >
                {opcionesRolEnTurno(rolActual).map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
              {!esFinalizado && (
                <>
                  {recepcionAbierta && (
                    <button
                      type="button"
                      disabled={ocupadoId === `inpre-${p.usuario_uid}`}
                      onClick={() => alConfirmarEntrada(p)}
                      className="btn-verde min-h-8 px-2.5 text-[11px]"
                    >
                      <UserPlus size={12} strokeWidth={2} />
                      <span>
                        {ocupadoId === `inpre-${p.usuario_uid}`
                          ? 'Registrando...'
                          : 'Confirmar entrada'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={ocupadoId === `delpre-${p.usuario_uid}`}
                    onClick={() => alQuitar(p)}
                    title="Quitar de la lista previa"
                    aria-label={`Quitar a ${p.usuario_nombre} del prerregistro`}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-borde-fuerte bg-tarjeta px-2.5 text-[11px] font-semibold text-tinta-suave hover:border-alerta hover:text-alerta disabled:opacity-50 dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                  >
                    <Trash2 size={12} strokeWidth={2} />
                    <span>Quitar</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
