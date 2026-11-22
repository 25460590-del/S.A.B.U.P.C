import { History, Home, IdCard, LogOut, Megaphone, Radio, Shield } from 'lucide-react'
import { useState } from 'react'
import { BarraEstado } from '../components/BarraEstado'
import { BupcLogo } from '../components/BupcLogo'
import { esEncargado as tieneRolEncargado, puedeUsarRadio } from '../lib/permisos'
import { cerrarSesion, nombreCompleto } from '../services/authService'
import type { Usuario } from '../types'
import { BrigadistaDashboardPage } from './BrigadistaDashboardPage'
import { CredencialDigitalPage } from './CredencialDigitalPage'
import { HistorialDualPage } from './HistorialDualPage'
import { OperativosPanelPage } from './OperativosPanelPage'
import { RadioConsolePage } from './RadioConsolePage'

interface PanelActivoPageProps {
  perfil: Usuario
}

type SeccionActiva = 'inicio' | 'operativos' | 'radio' | 'historial' | 'credencial' | 'perfil'

/**
 * Shell operativo para Encargado y Brigadista activos.
 * - Encargado: abre en Panel de Operativos, QR Dual y Bitácora de Personal.
 * - Brigadista: abre en Dashboard Brigadista (Escáner QR, Último registro, Reportar equipo).
 */
export function PanelActivoPage({ perfil }: PanelActivoPageProps) {
  const esEncargado = tieneRolEncargado(perfil)
  const puedeRadio = puedeUsarRadio(perfil)
  const [seccion, setSeccion] = useState<SeccionActiva>(
    esEncargado ? 'operativos' : 'inicio',
  )

  return (
    <div className="flex min-h-screen flex-col bg-fondo md:flex-row dark:bg-noche">
      {/* Barra lateral en escritorio (Verde UdeC #1E5631 día / #08100B nocturno) */}
      <aside className="hidden shrink-0 flex-col justify-between bg-udec-oscuro p-4 text-white md:flex md:w-64 dark:border-r dark:border-noche-borde dark:bg-noche-sidebar">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-white/20 pb-4 dark:border-noche-borde">
            <BupcLogo tamano="md" />
            <div>
              <p className="text-xs font-semibold text-white/80 dark:text-noche-tinta-suave">
                Universidad de Colima
              </p>
              <h1 className="text-base font-bold">S.A.B.U.P.C</h1>
            </div>
          </div>

          <nav aria-label="Menú operativo" className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setSeccion('inicio')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                seccion === 'inicio'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Home size={18} strokeWidth={2} />
              <span>{esEncargado ? 'Mi Turno' : 'Inicio'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSeccion('operativos')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                seccion === 'operativos'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Megaphone size={18} strokeWidth={2} />
              <span>{esEncargado ? 'Operativos y Bitácora' : 'Operativos'}</span>
            </button>

            {puedeRadio && (
              <button
                type="button"
                onClick={() => setSeccion('radio')}
                className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                  seccion === 'radio'
                    ? 'bg-white/15 text-white dark:bg-udec'
                    : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
                }`}
              >
                <Radio size={18} strokeWidth={2} />
                <span>Radio CECOM</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSeccion('historial')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                seccion === 'historial'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <History size={18} strokeWidth={2} />
              <span>{esEncargado ? 'Historial y Archivo' : 'Mi Historial'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSeccion('credencial')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                seccion === 'credencial'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <IdCard size={18} strokeWidth={2} />
              <span>Credencial QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSeccion('perfil')}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                seccion === 'perfil'
                  ? 'bg-white/15 text-white dark:bg-udec'
                  : 'text-white/80 hover:bg-white/10 dark:text-noche-tinta-suave dark:hover:bg-noche-tarjeta'
              }`}
            >
              <Shield size={18} strokeWidth={2} />
              <span>Mi Perfil</span>
            </button>
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/20 pt-4 dark:border-noche-borde">
          <div>
            <span className="block text-xs font-semibold text-white/75 dark:text-noche-tinta-suave">
              {perfil.rol_sistema}
            </span>
            <span className="text-sm font-bold">{nombreCompleto(perfil)}</span>
          </div>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="btn min-h-10 w-full border border-white/25 bg-white/10 text-white hover:bg-white/20 dark:border-noche-borde dark:bg-noche-tarjeta"
          >
            <LogOut size={16} strokeWidth={2} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <BarraEstado etiquetaDerecha={perfil.rol_sistema} />

        {/* Encabezado móvil */}
        <header className="flex items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-3 text-white md:hidden">
          <div className="flex items-center gap-3">
            <BupcLogo tamano="sm" />
            <div>
              <p className="text-[11px] font-semibold text-white/85">Universidad de Colima</p>
              <h1 className="text-sm font-bold">S.A.B.U.P.C</h1>
            </div>
          </div>
          <span className="rounded-full bg-activo px-2.5 py-0.5 text-[11px] font-bold text-white">
            ACTIVO
          </span>
        </header>

        <main className="flex flex-1 flex-col gap-5 p-4 md:p-6">
          {seccion === 'inicio' && <BrigadistaDashboardPage perfil={perfil} />}
          {seccion === 'operativos' && <OperativosPanelPage usuario={perfil} />}
          {seccion === 'radio' && puedeRadio && <RadioConsolePage usuario={perfil} />}
          {seccion === 'historial' && <HistorialDualPage usuario={perfil} />}
          {seccion === 'credencial' && <CredencialDigitalPage perfil={perfil} />}
          {seccion === 'perfil' && (
            <article className="tarjeta mx-auto flex w-full max-w-md flex-col gap-4 p-5">
              <div className="border-b border-borde pb-3 dark:border-noche-borde">
                <h2 className="text-lg font-bold text-tinta dark:text-noche-tinta">
                  {nombreCompleto(perfil)}
                </h2>
                <p className="text-xs font-medium tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                  No. de cuenta: {perfil.numero_cuenta} · {perfil.correo}
                </p>
              </div>

              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Rol del sistema
                  </dt>
                  <dd className="font-semibold text-tinta dark:text-noche-tinta">
                    {perfil.rol_sistema}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Grupo Operativo
                  </dt>
                  <dd className="font-semibold text-tinta dark:text-noche-tinta">
                    {perfil.grupo_operativo === 'Ninguno'
                      ? 'Sin asignar'
                      : `Grupo ${perfil.grupo_operativo}`}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Ayudantía
                  </dt>
                  <dd className="font-semibold text-tinta dark:text-noche-tinta">
                    {perfil.ayudantia_slot}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-borde pt-2.5 dark:border-noche-borde">
                  <dt className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Radiocomunicación
                  </dt>
                  <dd className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-tinta dark:text-noche-tinta">
                    <Radio size={15} strokeWidth={2} className="text-udec dark:text-activo-claro" />
                    <span>
                      {perfil.autorizado_radio
                        ? `Autorizado (${perfil.clave_personal_radio ?? 'sin clave'})`
                        : 'No autorizado'}
                    </span>
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => void cerrarSesion()}
                className="btn-salvia mt-2 w-full"
              >
                <LogOut size={18} strokeWidth={2} />
                <span>Cerrar Sesión</span>
              </button>
            </article>
          )}
        </main>
      </div>

      {/* Barra inferior fija en móvil (máximo 5 destinos holgados con áreas táctiles ≥ 48px) */}
      <nav
        aria-label="Navegación móvil"
        className={`fixed right-0 bottom-0 left-0 z-30 grid border-t border-borde bg-tarjeta px-1 py-1.5 md:hidden dark:border-noche-borde dark:bg-noche-tarjeta ${
          puedeRadio ? 'grid-cols-5' : 'grid-cols-4'
        }`}
      >
        <button
          type="button"
          onClick={() => setSeccion('inicio')}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            seccion === 'inicio'
              ? 'text-udec dark:text-activo-claro'
              : 'text-tinta-suave dark:text-noche-tinta-suave'
          }`}
        >
          <Home size={20} strokeWidth={2} />
          <span>Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setSeccion('operativos')}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            seccion === 'operativos'
              ? 'text-udec dark:text-activo-claro'
              : 'text-tinta-suave dark:text-noche-tinta-suave'
          }`}
        >
          <Megaphone size={20} strokeWidth={2} />
          <span>Operativos</span>
        </button>

        {puedeRadio && (
          <button
            type="button"
            onClick={() => setSeccion('radio')}
            className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              seccion === 'radio'
                ? 'text-udec dark:text-activo-claro'
                : 'text-tinta-suave dark:text-noche-tinta-suave'
            }`}
          >
            <Radio size={20} strokeWidth={2} />
            <span>Radio</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setSeccion('credencial')}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            seccion === 'credencial'
              ? 'text-udec dark:text-activo-claro'
              : 'text-tinta-suave dark:text-noche-tinta-suave'
          }`}
        >
          <IdCard size={20} strokeWidth={2} />
          <span>Credencial</span>
        </button>

        <button
          type="button"
          onClick={() => setSeccion(seccion === 'historial' ? 'perfil' : 'historial')}
          className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
            seccion === 'historial' || seccion === 'perfil'
              ? 'text-udec dark:text-activo-claro'
              : 'text-tinta-suave dark:text-noche-tinta-suave'
          }`}
        >
          <History size={20} strokeWidth={2} />
          <span>{seccion === 'historial' ? 'Perfil' : 'Historial'}</span>
        </button>
      </nav>
    </div>
  )
}
