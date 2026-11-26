import { X } from 'lucide-react'
import type { FormEvent } from 'react'
import { opcionesRolEnTurno, resolverRolInicialOperativo } from '../../constants/catalogos'
import { ayudantiaEfectiva } from '../../lib/permisos'
import type { PerfilOperativoMinimo, PrerregistroOperativo, RolEnTurno } from '../../types'

interface ModalRegistroManualProps {
  operativoNombre: string
  perfilesActivos: PerfilOperativoMinimo[]
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
  mapaPrerregistros,
  uidManual,
  rolManual,
  ocupado,
  alCambiarUid,
  alCambiarRol,
  alEnviar,
  alCerrar,
}: ModalRegistroManualProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Registro Manual de Asistencia"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
            Registro Manual · {operativoNombre}
          </h3>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-tinta-suave"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={alEnviar} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="manual-usr" className="etiqueta">
              Brigadista activo
            </label>
            <select
              id="manual-usr"
              value={uidManual}
              onChange={(e) => {
                const uid = e.target.value
                alCambiarUid(uid)
                const seleccionado = perfilesActivos.find((p) => p.uid === uid)
                if (seleccionado) {
                  alCambiarRol(
                    resolverRolInicialOperativo(
                      ayudantiaEfectiva(seleccionado),
                      mapaPrerregistros.get(seleccionado.uid),
                    ),
                  )
                } else {
                  alCambiarRol('Sin definir')
                }
              }}
              className="campo"
              required
            >
              <option value="">Selecciona un brigadista...</option>
              {perfilesActivos.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.nombre_completo} ({p.numero_cuenta})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="manual-rol" className="etiqueta">
              Rol en turno
            </label>
            <select
              id="manual-rol"
              value={rolManual}
              onChange={(e) => alCambiarRol(e.target.value as RolEnTurno)}
              className="campo"
            >
              {opcionesRolEnTurno(rolManual).map((rol) => (
                <option key={rol} value={rol}>
                  {rol}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={alCerrar} className="btn-salvia">
              Cancelar
            </button>
            <button type="submit" disabled={ocupado} className="btn-verde">
              {ocupado ? 'Registrando...' : 'Registrar Entrada'}
            </button>
          </div>
        </form>
      </article>
    </div>
  )
}
