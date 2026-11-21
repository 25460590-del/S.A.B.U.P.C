import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import {
  cerrarSesion,
  mensajeDeError,
  nombreCompleto,
  verificarEstatusEnServidor,
} from '../services/authService'
import type { Usuario } from '../types'

interface CuentaEnRevisionPageProps {
  perfil: Usuario
}

export function CuentaEnRevisionPage({ perfil }: CuentaEnRevisionPageProps) {
  const [verificando, setVerificando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function manejarVerificar() {
    setVerificando(true)
    setMensaje(null)
    try {
      const estatus = await verificarEstatusEnServidor(perfil.uid)
      if (estatus === 'Pendiente') {
        setMensaje('Tu solicitud sigue en revisión por un Administrador de la BUPC.')
      }
    } catch (err) {
      setMensaje(mensajeDeError(err))
    } finally {
      setVerificando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-fondo dark:bg-noche">
      <BarraEstado etiquetaDerecha="Estatus de Acceso" />

      <header className="flex items-center gap-3 border-b-3 border-naranja bg-udec px-4 py-4 text-white">
        <BupcLogo tamano="md" />
        <div>
          <p className="text-xs font-semibold text-white/85">Universidad de Colima</p>
          <h1 className="text-base font-bold">S.A.B.U.P.C</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 p-4">
        <article className="flex flex-col items-center gap-5 rounded-xl border-2 border-ambar bg-ambar-suave p-6 text-center dark:bg-noche-ambar">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ambar bg-tarjeta dark:bg-noche-tarjeta">
            <Clock size={34} strokeWidth={2} className="text-ambar-texto dark:text-noche-ambar-texto" />
          </div>

          <div className="flex flex-col gap-2">
            <span className="inline-flex self-center rounded-full border border-ambar bg-tarjeta px-3 py-1 text-xs font-bold tracking-wide text-ambar-texto dark:bg-noche-tarjeta dark:text-noche-ambar-texto">
              PENDIENTE DE APROBACIÓN
            </span>
            <h2 className="text-2xl font-bold text-tinta dark:text-noche-tinta">
              Cuenta en Revisión
            </h2>
            <p className="text-sm text-tinta-suave dark:text-noche-tinta-suave">
              Tu registro fue recibido correctamente. Un Administrador de la BUPC revisará tu
              solicitud, aprobará tu acceso y te asignará grupo y ayudantía.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 rounded-lg border border-borde bg-tarjeta p-4 text-left dark:border-noche-borde dark:bg-noche-tarjeta">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Solicitante
              </span>
              <span className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                {nombreCompleto(perfil)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Grupo
              </span>
              <span className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                {perfil.grupo_operativo === 'Ninguno'
                  ? 'Alfa / Omega (pendiente)'
                  : `Grupo ${perfil.grupo_operativo}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Ayudantía
              </span>
              <span className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                {perfil.ayudantia_slot === 'Ninguna' ? 'Por asignar' : perfil.ayudantia_slot}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                No. de Cuenta
              </span>
              <span className="text-sm font-bold tabular-nums text-tinta dark:text-noche-tinta">
                {perfil.numero_cuenta}
              </span>
            </div>
          </div>

          {mensaje && (
            <p role="status" className="text-xs font-semibold text-ambar-texto dark:text-noche-ambar-texto">
              {mensaje}
            </p>
          )}

          <div className="flex w-full flex-col gap-2.5 pt-1">
            <button
              type="button"
              onClick={manejarVerificar}
              disabled={verificando}
              className="btn-verde w-full"
            >
              <RefreshCw
                size={18}
                strokeWidth={2}
                className={verificando ? 'animate-spin' : ''}
              />
              <span>{verificando ? 'Consultando...' : 'Verificar Estado de Aprobación'}</span>
            </button>
            <button type="button" onClick={() => void cerrarSesion()} className="btn-salvia w-full">
              <LogOut size={18} strokeWidth={2} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </article>
      </main>
    </div>
  )
}
