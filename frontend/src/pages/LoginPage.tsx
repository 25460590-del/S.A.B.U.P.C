import { AlertCircle, CheckCircle2, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import {
  iniciarSesion,
  iniciarSesionConGoogle,
  mensajeDeError,
  recuperarContrasena,
} from '../services/authService'

interface LoginPageProps {
  alIrARegistro: () => void
}

export function LoginPage({ alIrARegistro }: LoginPageProps) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    if (!correo.trim() || !contrasena) {
      setError('Ingresa tu correo electrónico y contraseña.')
      return
    }

    setCargando(true)
    try {
      await iniciarSesion(correo, contrasena)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  async function manejarRecuperar() {
    setError(null)
    setAviso(null)
    if (!correo.trim()) {
      setError('Escribe primero tu correo electrónico para enviarte el enlace de recuperación.')
      return
    }
    setCargando(true)
    try {
      await recuperarContrasena(correo)
      setAviso('Se envió un enlace de recuperación a tu correo registrado.')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  async function manejarGoogle() {
    setError(null)
    setAviso(null)
    setCargando(true)
    try {
      await iniciarSesionConGoogle()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-fondo dark:bg-noche">
      <BarraEstado etiquetaDerecha="S.A.B.U.P.C" />

      {/* Encabezado institucional Verde Universidad de Colima (sin azul marino) */}
      <header className="flex flex-col items-center gap-4 border-b-3 border-naranja bg-udec px-6 py-8 text-center text-white">
        <BupcLogo tamano="lg" />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wider text-white/85 uppercase">
            Universidad de Colima
          </p>
          <h1 className="text-2xl font-bold tracking-tight">S.A.B.U.P.C</h1>
          <p className="text-sm text-white/90">Brigada Universitaria de Protección Civil</p>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-between gap-6 px-4 py-6">
        <article className="tarjeta flex flex-col gap-5 p-6">
          <div>
            <h2 className="text-xl font-semibold text-tinta dark:text-noche-tinta">
              Acceso Operativo
            </h2>
            <p className="mt-1 text-sm text-tinta-suave dark:text-noche-tinta-suave">
              Ingresa con tu correo registrado en la brigada.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-sm text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aviso && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-sm text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
            >
              <CheckCircle2 size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          <form onSubmit={manejarEnvio} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="etiqueta">
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="nombre@ucol.mx"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="campo"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="login-pass" className="etiqueta">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={manejarRecuperar}
                  disabled={cargando}
                  className="cursor-pointer text-xs font-semibold text-udec-oscuro underline hover:text-udec dark:text-noche-tinta-suave dark:hover:text-noche-tinta"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  id="login-pass"
                  type={mostrarContrasena ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  className="campo pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarContrasena((v) => !v)}
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-tinta-suave hover:text-tinta dark:text-noche-tinta-suave dark:hover:text-noche-tinta"
                >
                  {mostrarContrasena ? (
                    <EyeOff size={20} strokeWidth={2} />
                  ) : (
                    <Eye size={20} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            <button type="submit" disabled={cargando} className="btn-verde w-full">
              <LogIn size={20} strokeWidth={2} aria-hidden="true" />
              <span>{cargando ? 'Ingresando...' : 'Iniciar Sesión'}</span>
            </button>
          </form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-borde dark:bg-noche-borde" />
            <span className="text-[11px] font-semibold uppercase text-tinta-suave dark:text-noche-tinta-suave">
              o accede con Google
            </span>
            <span className="h-px flex-1 bg-borde dark:bg-noche-borde" />
          </div>

          <button
            type="button"
            onClick={() => void manejarGoogle()}
            disabled={cargando}
            className="btn-salvia w-full text-xs sm:text-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.29A7.22 7.22 0 0 1 4.9 12c0-.79.14-1.56.38-2.29V6.62H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.09Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4 3.09c.95-2.84 3.6-4.95 6.72-4.95Z"
              />
            </svg>
            <span>Continuar con Google (@ucol.mx o @gmail.com)</span>
          </button>

          <div className="flex flex-col gap-3 border-t border-borde pt-4 dark:border-noche-borde">
            <p className="text-center text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
              ¿Aún no tienes cuenta operativa?
            </p>
            <button
              type="button"
              onClick={alIrARegistro}
              disabled={cargando}
              className="btn w-full border-2 border-naranja bg-tarjeta text-naranja-oscuro hover:bg-naranja-suave dark:bg-noche-campo dark:text-naranja dark:hover:bg-noche"
            >
              <UserPlus size={20} strokeWidth={2} className="shrink-0" aria-hidden="true" />
              <span>Registrarse como Nuevo Brigadista</span>
            </button>
          </div>
        </article>

        <footer className="pb-2 text-center">
          <p className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Control Operativo y Radiocomunicación · BUPC UdeC
          </p>
        </footer>
      </main>
    </div>
  )
}
