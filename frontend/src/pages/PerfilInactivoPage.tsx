import { Ban, Mail } from 'lucide-react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import { nombreCompleto } from '../services/authService'
import type { Usuario } from '../types'

interface PerfilInactivoPageProps {
  perfil: Usuario
  alVolverALogin: () => void
}

export function PerfilInactivoPage({ perfil, alVolverALogin }: PerfilInactivoPageProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-alerta text-white dark:bg-noche-rojo dark:text-noche-tinta">
      <BarraEstado
        variante="alerta"
        etiquetaDerecha={`ID: ${perfil.numero_cuenta || '0'}`}
      />

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <BupcLogo tamano="md" variante="alerta" />

        <article className="flex w-full flex-col items-center gap-4 rounded-xl border-2 border-alerta bg-tarjeta p-6 text-tinta dark:bg-noche-tarjeta dark:text-noche-tinta">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-alerta bg-alerta-suave dark:bg-noche-rojo-suave">
            <Ban size={34} strokeWidth={2} className="text-alerta dark:text-noche-rojo-texto" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-alerta dark:text-noche-rojo-texto">
            PERFIL INACTIVO — REGISTRO BLOQUEADO
          </h1>

          <p className="text-sm text-tinta-suave dark:text-noche-tinta-suave">
            La cuenta de <strong className="text-tinta dark:text-noche-tinta">{nombreCompleto(perfil)}</strong>{' '}
            ha sido dada de baja del padrón operativo de la Brigada Universitaria de Protección
            Civil. No es posible registrar asistencias, generar credencial QR ni acceder a canales
            de radio.
          </p>

          <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-alerta bg-alerta-suave px-3 py-2.5 dark:bg-noche-rojo-suave">
            <span className="text-xs font-semibold text-tinta dark:text-noche-tinta">
              Estatus actual
            </span>
            <span className="rounded-full bg-alerta px-3 py-1 text-xs font-bold text-white">
              BAJA / INACTIVO
            </span>
          </div>

          <div className="flex w-full flex-col gap-2.5 pt-2">
            <a
              href={`mailto:bupc@ucol.mx?subject=${encodeURIComponent(
                `Consulta de baja operativa — Cuenta ${perfil.numero_cuenta}`,
              )}`}
              className="btn-rojo w-full"
            >
              <Mail size={18} strokeWidth={2} />
              <span>Contactar a Administración BUPC</span>
            </a>
            <button type="button" onClick={alVolverALogin} className="btn-salvia w-full">
              Volver al Inicio de Sesión
            </button>
          </div>
        </article>
      </main>
    </div>
  )
}
