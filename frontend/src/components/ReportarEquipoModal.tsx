import { AlertCircle, CheckCircle2, Package, Plus, Wrench, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { mensajeDeError } from '../services/authService'
import { registrarEquipoPropio, reportarFallaEquipo } from '../services/equiposService'
import type { AsistenciaPersonal, EquipoTurno, Usuario } from '../types'
import { BupcLogo } from './BupcLogo'

interface ReportarEquipoModalProps {
  brigadista: Usuario
  asistencia: AsistenciaPersonal
  equipos: EquipoTurno[]
  alCerrar: () => void
}

const UNIFORME_SUGERIDO = [
  'Polo institucional BUPC',
  'Pantalón táctico y cinturón',
  'Botas dieléctricas / de campo',
  'Lámpara táctica personal',
]

export function ReportarEquipoModal({
  brigadista,
  asistencia,
  equipos,
  alCerrar,
}: ReportarEquipoModalProps) {
  const [pestana, setPestana] = useState<'bupc' | 'propio'>('bupc')
  const [equipoEnFallaId, setEquipoEnFallaId] = useState<string | null>(null)
  const [textoFalla, setTextoFalla] = useState('')
  const [nuevoArticulo, setNuevoArticulo] = useState('')
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const equiposBupc = equipos.filter((e) => e.origen_material === 'BUPC_Asignado')
  const equiposPropios = equipos.filter((e) => e.origen_material === 'Propio')

  async function manejarEnviarFalla(equipoId: string) {
    setError(null)
    setAviso(null)
    if (!textoFalla.trim()) {
      setError('Describe la falla o faltante encontrado.')
      return
    }
    setOcupado(true)
    try {
      await reportarFallaEquipo(equipoId, textoFalla)
      setAviso('Reporte de falla enviado al Encargado de turno.')
      setEquipoEnFallaId(null)
      setTextoFalla('')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function manejarAgregarPropio(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    if (!nuevoArticulo.trim()) {
      setError('Escribe el nombre del artículo o uniforme propio.')
      return
    }
    setOcupado(true)
    try {
      await registrarEquipoPropio(brigadista, asistencia, {
        nombre_articulo: nuevoArticulo,
        codigo_inventario: nuevoCodigo,
      })
      setNuevoArticulo('')
      setNuevoCodigo('')
      setAviso('Material propio registrado en tu turno.')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function agregarSugerido(nombre: string) {
    setError(null)
    setAviso(null)
    setOcupado(true)
    try {
      await registrarEquipoPropio(brigadista, asistencia, {
        nombre_articulo: nombre,
        codigo_inventario: '',
      })
      setAviso(`"${nombre}" registrado en tu equipo propio.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reportar equipo"
      className="fixed inset-0 z-50 flex flex-col bg-fondo md:items-center md:justify-center md:bg-black/75 md:p-4 dark:bg-noche md:dark:bg-black/80"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-fondo md:h-auto md:max-h-[90vh] md:rounded-xl md:border md:border-borde dark:bg-noche md:dark:border-noche-borde">
        {/* Encabezado Verde UdeC */}
        <header className="flex items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar reporte de equipo"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
            >
              <X size={20} strokeWidth={2} />
            </button>
            <div>
              <h2 className="text-base font-bold">Reportar Equipo</h2>
              <p className="text-xs font-medium text-white/85">Resguardo y revisión de turno</p>
            </div>
          </div>
          <BupcLogo tamano="sm" />
        </header>

        {/* 2 Pestañas */}
        <div className="border-b border-borde bg-tarjeta p-3 dark:border-noche-borde dark:bg-noche-tarjeta">
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 dark:bg-noche-campo">
            <button
              type="button"
              onClick={() => setPestana('bupc')}
              className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
                pestana === 'bupc'
                  ? 'bg-udec text-white'
                  : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
              }`}
            >
              Material BUPC ({equiposBupc.length})
            </button>
            <button
              type="button"
              onClick={() => setPestana('propio')}
              className={`min-h-10 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors ${
                pestana === 'propio'
                  ? 'bg-udec text-white'
                  : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
              }`}
            >
              Material Propio ({equiposPropios.length})
            </button>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
            >
              <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aviso && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-emerald-900 dark:bg-noche-campo dark:text-activo-claro"
            >
              <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          {/* PESTAÑA 1: Material BUPC Asignado (sin auto-devolución) */}
          {pestana === 'bupc' && (
            <section className="flex flex-col gap-3">
              {equiposBupc.length === 0 ? (
                <article className="tarjeta flex flex-col items-center gap-2 p-6 text-center">
                  <Package size={30} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
                  <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                    Sin material BUPC asignado en este turno
                  </p>
                  <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                    Cuando el Encargado te asigne radio, botiquín o chaleco, aparecerá aquí.
                  </p>
                </article>
              ) : (
                equiposBupc.map((eq) => {
                  const pendiente = !eq.devuelto && eq.acta_incidencia === null
                  const abriendoFalla = equipoEnFallaId === eq.id
                  return (
                    <article key={eq.id} className="tarjeta flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {eq.codigo_inventario && (
                            <span className="text-xs font-bold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                              FOLIO {eq.codigo_inventario}
                            </span>
                          )}
                          <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                            {eq.nombre_articulo}
                          </h3>
                          {eq.falla_reportada && (
                            <p className="mt-1 text-xs font-semibold text-alerta dark:text-noche-rojo-texto">
                              Falla reportada: {eq.falla_reportada}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            eq.devuelto
                              ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                              : eq.acta_incidencia
                                ? 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                                : eq.estado_reporte === 'Con_Falla'
                                  ? 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                                  : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta'
                          }`}
                        >
                          {eq.devuelto
                            ? 'Devuelto OK'
                            : eq.acta_incidencia
                              ? 'Con Acta'
                              : eq.estado_reporte === 'Con_Falla'
                                ? 'Con Falla'
                                : 'Bajo resguardo'}
                        </span>
                      </div>

                      {pendiente && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEquipoEnFallaId(abriendoFalla ? null : eq.id)
                              setTextoFalla(eq.falla_reportada)
                            }}
                            className="btn min-h-10 w-full border border-alerta bg-tarjeta text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                          >
                            <Wrench size={15} strokeWidth={2} />
                            <span>Reportar falla o faltante</span>
                          </button>

                          {abriendoFalla && (
                            <div className="flex flex-col gap-2">
                              <textarea
                                rows={2}
                                maxLength={400}
                                placeholder="Describe la falla (batería, antena, audio, insumo faltante...)"
                                value={textoFalla}
                                onChange={(e) => setTextoFalla(e.target.value)}
                                className="campo min-h-16 py-2 text-sm"
                              />
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() => void manejarEnviarFalla(eq.id)}
                                className="btn-naranja min-h-10 w-full text-xs"
                              >
                                {ocupado ? 'Enviando...' : 'Enviar reporte de falla'}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  )
                })
              )}
              <p className="text-center text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                La devolución de material BUPC solo puede ser validada por el Encargado en turno.
              </p>
            </section>
          )}

          {/* PESTAÑA 2: Material Propio / Uniforme */}
          {pestana === 'propio' && (
            <section className="flex flex-col gap-4">
              <article className="tarjeta flex flex-col gap-2.5 p-4">
                <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                  Registro rápido de uniforme y equipo propio
                </h3>
                <div className="flex flex-col gap-2">
                  {UNIFORME_SUGERIDO.map((item) => {
                    const yaRegistrado = equiposPropios.some(
                      (e) => e.nombre_articulo.toLowerCase() === item.toLowerCase(),
                    )
                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between gap-2 rounded-lg border border-borde bg-fondo px-3 py-2 dark:border-noche-borde dark:bg-noche-campo"
                      >
                        <span className="text-sm font-medium text-tinta dark:text-noche-tinta">
                          {item}
                        </span>
                        {yaRegistrado ? (
                          <span className="text-xs font-bold text-activo dark:text-activo-claro">
                            Registrado
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => void agregarSugerido(item)}
                            className="btn-salvia min-h-8 px-2.5 text-xs"
                          >
                            <Plus size={14} strokeWidth={2} />
                            <span>Agregar</span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>

              <form onSubmit={manejarAgregarPropio} className="tarjeta flex flex-col gap-3 p-4">
                <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                  Agregar otro equipo propio
                </h3>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ej. Estetoscopio, Baumanómetro, Radio personal"
                  value={nuevoArticulo}
                  onChange={(e) => setNuevoArticulo(e.target.value)}
                  className="campo"
                />
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Serie / marca (opcional)"
                  value={nuevoCodigo}
                  onChange={(e) => setNuevoCodigo(e.target.value)}
                  className="campo"
                />
                <button type="submit" disabled={ocupado} className="btn-verde w-full">
                  <Plus size={18} strokeWidth={2} />
                  <span>{ocupado ? 'Guardando...' : 'Registrar equipo propio'}</span>
                </button>
              </form>

              {equiposPropios.length > 0 && (
                <article className="tarjeta flex flex-col gap-2 p-4">
                  <h3 className="text-xs font-bold uppercase text-tinta-suave dark:text-noche-tinta-suave">
                    Tu material propio en este turno
                  </h3>
                  <ul className="divide-y divide-borde dark:divide-noche-borde">
                    {equiposPropios.map((eq) => (
                      <li key={eq.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium text-tinta dark:text-noche-tinta">
                          {eq.nombre_articulo}
                        </span>
                        {eq.codigo_inventario && (
                          <span className="text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                            {eq.codigo_inventario}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          )}
        </main>

        <footer className="border-t border-borde bg-tarjeta p-4 dark:border-noche-borde dark:bg-noche-tarjeta">
          <button type="button" onClick={alCerrar} className="btn-salvia w-full">
            Cerrar revisión de equipo
          </button>
        </footer>
      </div>
    </div>
  )
}
