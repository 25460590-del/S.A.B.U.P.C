import { ShieldAlert, X } from 'lucide-react'
import { nombreCompleto } from '../services/authService'
import type { Usuario } from '../types'

interface AlertaInactivoModalProps {
  usuario: Usuario
  alCerrar: () => void
}

export function AlertaInactivoModal({ usuario, alCerrar }: AlertaInactivoModalProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-inactivo-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <article className="tarjeta flex w-full max-w-md flex-col overflow-hidden border-2 border-alerta">
        <header className="flex items-center justify-between gap-2 bg-alerta px-4 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert size={26} strokeWidth={2} className="shrink-0" />
            <h2 id="alerta-inactivo-titulo" className="text-base font-bold">
              PERFIL INACTIVO — REGISTRO BLOQUEADO
            </h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar alerta"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/15"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-tinta dark:text-noche-tinta">
            La credencial QR escaneada pertenece a{' '}
            <strong>{nombreCompleto(usuario)}</strong> (Cuenta{' '}
            <span className="tabular-nums font-bold">{usuario.numero_cuenta}</span>), cuenta dada de
            baja del padrón operativo de la BUPC.
          </p>

          <div className="rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
            El sistema bloqueó automáticamente el registro de entrada y generó una alerta en la
            bitácora de auditoría.
          </div>

          <button type="button" onClick={alCerrar} className="btn-rojo w-full">
            Cerrar Alerta
          </button>
        </div>
      </article>
    </div>
  )
}
