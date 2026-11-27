import {
  AlertCircle,
  Ban,
  Calendar,
  CheckCircle2,
  Lock,
  MapPin,
  Megaphone,
  Plus,
  QrCode,
  Unlock,
} from 'lucide-react'
import { esOperativoCerrado, type AyudantiaActiva } from '../../lib/permisos'
import type { DatosNuevoOperativo } from '../../services/operativosService'
import type { Operativo } from '../../types'
import { IndicadorAlcanceAyudantia } from '../IndicadorAlcanceAyudantia'
import { FormNuevoOperativo } from './FormNuevoOperativo'
import { estiloCategoria, type FiltroEstadoOperativo } from './helpers'

interface ListaOperativosProps {
  puedeGestionar: boolean
  ayJefe: AyudantiaActiva | null
  cargando: boolean
  filtroEstado: FiltroEstadoOperativo
  conteosEstado: { en_curso: number; programados: number; finalizados: number }
  cerradosCargados: boolean
  hayMasCerrados: boolean
  cargandoCerrados: boolean
  filtrados: Operativo[]
  mostrarFormulario: boolean
  guardando: boolean
  error: string | null
  aviso: string | null
  alAlternarFormulario: () => void
  alCerrarFormulario: () => void
  alCambiarFiltro: (filtro: FiltroEstadoOperativo) => void
  alCargarMasCerrados: () => void
  alSeleccionarOperativo: (opId: string) => void
  alCrearOperativo: (datos: DatosNuevoOperativo) => Promise<void>
  alErrorValidacion: (mensaje: string) => void
}

export function ListaOperativos({
  puedeGestionar,
  ayJefe,
  cargando,
  filtroEstado,
  conteosEstado,
  cerradosCargados,
  hayMasCerrados,
  cargandoCerrados,
  filtrados,
  mostrarFormulario,
  guardando,
  error,
  aviso,
  alAlternarFormulario,
  alCerrarFormulario,
  alCambiarFiltro,
  alCargarMasCerrados,
  alSeleccionarOperativo,
  alCrearOperativo,
  alErrorValidacion,
}: ListaOperativosProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">Operativos</h2>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Selecciona un operativo para administrar su resumen, control QR y bitácora.
          </p>
        </div>
        {puedeGestionar && (
          <button
            type="button"
            onClick={alAlternarFormulario}
            className="btn-naranja min-h-10 px-4 text-xs"
          >
            <Plus size={16} strokeWidth={2} />
            <span>Nuevo operativo</span>
          </button>
        )}
      </div>

      {ayJefe && (
        <IndicadorAlcanceAyudantia
          ayudantia={ayJefe}
          descripcion={`En los operativos solo visualizarás, pasarás/aprobarás lista y asignarás roles a integrantes de ${ayJefe}.`}
        />
      )}

      {/* Chips de filtro con contador discreto: En curso, Programados, Finalizados / Cancelados */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'en_curso', label: 'En curso', count: conteosEstado.en_curso },
            { id: 'programados', label: 'Programados', count: conteosEstado.programados },
            { id: 'finalizados', label: 'Cerrados', count: conteosEstado.finalizados },
          ] as const
        ).map((chip) => {
          const activo = filtroEstado === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => alCambiarFiltro(chip.id)}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                activo
                  ? 'bg-udec text-white'
                  : 'border border-borde bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
              }`}
            >
              <span>{chip.label}</span>
              {chip.id !== 'finalizados' || cerradosCargados ? (
                <span className="tabular-nums opacity-80">({chip.count})</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
        >
          <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {mostrarFormulario && puedeGestionar && (
        <FormNuevoOperativo
          guardando={guardando}
          alEnviar={alCrearOperativo}
          alErrorValidacion={alErrorValidacion}
          alCancelar={alCerrarFormulario}
        />
      )}

      {cargando ? (
        <div className="tarjeta flex flex-col divide-y divide-borde dark:divide-noche-borde">
          <div className="h-16 animate-pulse bg-esqueleto/40 p-4 dark:bg-noche-borde/40" />
          <div className="h-16 animate-pulse bg-esqueleto/40 p-4 dark:bg-noche-borde/40" />
        </div>
      ) : filtrados.length === 0 ? (
        <article className="tarjeta flex flex-col items-center gap-2.5 p-8 text-center">
          <QrCode size={32} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
          <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
            Sin operativos en esta sección
          </h3>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            {filtroEstado === 'en_curso' && puedeGestionar
              ? 'Crea un nuevo operativo para habilitar el control QR y la bitácora.'
              : 'Cambia de filtro para consultar otros operativos.'}
          </p>
        </article>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="tarjeta divide-y divide-borde overflow-hidden dark:divide-noche-borde">
            {filtrados.map((op) => {
              const cerrado = esOperativoCerrado(op)
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => alSeleccionarOperativo(op.id)}
                  className="flex w-full cursor-pointer flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-superficie-suave sm:flex-row sm:items-center sm:justify-between dark:hover:bg-noche-campo/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-tinta dark:text-noche-tinta">
                        {op.nombre}
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${estiloCategoria(op.categoria)}`}
                      >
                        {op.categoria}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} strokeWidth={2} />
                        <span>{op.sede}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar size={12} strokeWidth={2} />
                        <span>{op.fecha_inicio.replace('T', ' ')}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {!cerrado && op.convocatoria_abierta && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-salvia px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                        <Megaphone size={11} strokeWidth={2} />
                        <span>
                          Convocatoria
                          {op.cupo_sugerido ? ` (cupo ${op.cupo_sugerido})` : ''}
                        </span>
                      </span>
                    )}
                    {cerrado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-superficie-suave px-2.5 py-0.5 text-[11px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                        {op.estatus === 'Cancelado' ? (
                          <Ban size={11} strokeWidth={2} />
                        ) : (
                          <Lock size={11} strokeWidth={2} />
                        )}
                        <span>{op.estatus === 'Cancelado' ? 'Cancelado' : 'Finalizado'}</span>
                      </span>
                    ) : op.recepcion_abierta ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-activo-suave px-2.5 py-0.5 text-[11px] font-bold text-activo dark:bg-noche-campo dark:text-activo-claro">
                        <Unlock size={11} strokeWidth={2} />
                        <span>Recepción abierta</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ambar-suave px-2.5 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                        <Lock size={11} strokeWidth={2} />
                        <span>Recepción cerrada</span>
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {filtroEstado === 'finalizados' && hayMasCerrados && (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={cargandoCerrados}
                onClick={alCargarMasCerrados}
                className="btn-salvia min-h-9 px-4 text-xs"
              >
                {cargandoCerrados ? 'Cargando...' : 'Cargar más operativos cerrados'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
