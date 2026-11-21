import { AlertCircle, CheckCircle2, LogOut, MailCheck, RefreshCw, Send } from 'lucide-react'
import type { User } from 'firebase/auth'
import { useState } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import {
  cerrarSesion,
  mensajeDeError,
  reenviarVerificacionCorreo,
  verificarEstadoCorreo,
} from '../services/authService'

interface VerificacionCorreoPageProps {
  usuarioAuth: User
  alConfirmarVerificacion: () => void
}

export function VerificacionCorreoPage({
  usuarioAuth,
  alConfirmarVerificacion,
}: VerificacionCorreoPageProps) {
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function manejarYaVerifique() {
    setOcupado(true)
    setAviso(null)
    setError(null)
    try {
      const verificado = await verificarEstadoCorreo(usuarioAuth)
      if (verificado) {
        alConfirmarVerificacion()
      } else {
        setError(
          'Tu correo aún aparece como no verificado. Abre el enlace en tu bandeja de entrada o spam e intenta de nuevo.',
        )
      }
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarReenviar() {
    setOcupado(true)
    setAviso(null)
    setError(null)
    try {
      await reenviarVerificacionCorreo(usuarioAuth)
      setAviso('Se envió un nuevo enlace de verificación a tu correo electrónico.')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-fondo dark:bg-noche">
      <BarraEstado etiquetaDerecha="Verificación de Correo" />

      <header className="flex items-center gap-3 border-b-3 border-naranja bg-udec px-4 py-4 text-white">
        <BupcLogo tamano="md" />
        <div>
          <p className="text-xs font-semibold text-white/85">Universidad de Colima</p>
          <h1 className="text-base font-bold">S.A.B.U.P.C</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 p-4">
        <article className="tarjeta flex flex-col items-center gap-5 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-udec bg-salvia text-udec dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro">
            <MailCheck size={32} strokeWidth={2} />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
              Verifica tu correo electrónico
            </h2>
            <p className="text-sm text-tinta-suave dark:text-noche-tinta-suave">
              Enviamos un enlace de confirmación a{' '}
              <strong className="text-tinta dark:text-noche-tinta">{usuarioAuth.email}</strong>.
              Ábrelo para activar tu solicitud y pasar a revisión por la Administración BUPC.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex w-full items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-left text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aviso && (
            <div
              role="status"
              className="flex w-full items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-left text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
            >
              <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          <div className="flex w-full flex-col gap-2.5 pt-1">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void manejarYaVerifique()}
              className="btn-verde w-full"
            >
              <RefreshCw size={18} strokeWidth={2} className={ocupado ? 'animate-spin' : ''} />
              <span>Ya verifiqué mi correo</span>
            </button>

            <button
              type="button"
              disabled={ocupado}
              onClick={() => void manejarReenviar()}
              className="btn-salvia w-full"
            >
              <Send size={16} strokeWidth={2} />
              <span>Reenviar enlace</span>
            </button>

            <button
              type="button"
              disabled={ocupado}
              onClick={() => void cerrarSesion()}
              className="btn w-full border border-borde bg-tarjeta text-tinta-suave hover:text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
            >
              <LogOut size={16} strokeWidth={2} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </article>
      </main>
    </div>
  )
}
