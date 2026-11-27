import { Lock, Package } from 'lucide-react'
import { normalizarNombrePropio } from '../lib/nombres'
import type { EquipoTurno } from '../types'

interface CandadoDuroModalProps {
  pendientes: EquipoTurno[]
  modo?: 'brigadista' | 'encargado'
  usuarioNombre?: string
  alEntendido: () => void
  alVerEquipo?: () => void
  alAbrirResguardo?: () => void
}

export function CandadoDuroModal({
  pendientes,
  modo = 'brigadista',
  usuarioNombre,
  alEntendido,
  alVerEquipo,
  alAbrirResguardo,
}: CandadoDuroModalProps) {
  const esMando = modo === 'encargado'
  const nombreMostrado = usuarioNombre ? normalizarNombrePropio(usuarioNombre) : 'Este brigadista'

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="candado-duro-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col overflow-hidden border-2 border-alerta">
        <header className="flex items-center gap-3 bg-alerta px-4 py-4 text-white">
          <Lock size={26} strokeWidth={2} className="shrink-0" />
          <div>
            <span className="block text-[11px] font-bold tracking-wider uppercase">
              DEVOLUCIÓN PENDIENTE
            </span>
            <h2 id="candado-duro-titulo" className="text-lg font-bold">
              Imposible Registrar Salida
            </h2>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-tinta dark:text-noche-tinta">
            {esMando
              ? `${nombreMostrado} tiene material BUPC bajo resguardo pendiente de devolución. Abre su resguardo para recibir el equipo OK o levantar un Acta de Incidencia antes de cerrar la salida.`
              : 'Tienes material BUPC bajo resguardo pendiente de entrega. Para liberar tu salida debes devolverlo con el Encargado o solicitar el levantamiento de un Acta de Incidencia.'}
          </p>

          <div className="flex flex-col gap-2 rounded-lg border border-alerta bg-alerta-suave p-4 dark:bg-noche-rojo-suave">
            <span className="text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
              Material pendiente de devolución ({pendientes.length}):
            </span>
            <ul className="flex flex-col gap-1.5">
              {pendientes.map((eq) => (
                <li
                  key={eq.id}
                  className="flex items-center justify-between gap-2 text-sm text-tinta dark:text-noche-tinta"
                >
                  <span className="font-semibold">
                    • {eq.cantidad && eq.cantidad > 1 ? `${eq.cantidad}× ` : ''}
                    {eq.nombre_articulo}
                  </span>
                  {eq.codigo_inventario && (
                    <span className="text-xs font-bold tabular-nums text-tinta-suave dark:text-noche-rojo-texto">
                      Folio {eq.codigo_inventario}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            {esMando && alAbrirResguardo ? (
              <>
                <button
                  type="button"
                  onClick={alAbrirResguardo}
                  className="btn-naranja min-h-12 w-full"
                >
                  <Package size={18} strokeWidth={2} />
                  <span>Abrir resguardo para recibir material</span>
                </button>
                <button type="button" onClick={alEntendido} className="btn-salvia min-h-11 w-full">
                  Entendido · Cerrar aviso
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={alEntendido} className="btn-naranja min-h-12 w-full">
                  Entendido · Entregar al Encargado
                </button>
                {alVerEquipo && (
                  <button type="button" onClick={alVerEquipo} className="btn-salvia min-h-11 w-full">
                    Ver material asignado
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
