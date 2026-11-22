import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { mensajeDeError } from '../services/authService'
import { escucharMisEquiposBupc, reportarFallaEquipo } from '../services/equiposService'
import { escucharOperativos } from '../services/operativosService'
import type { EquipoTurno, Operativo, Usuario } from '../types'

interface MiMaterialPanelProps {
  perfil: Usuario
}

function formatearFechaHora(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MiMaterialPanel({ perfil }: MiMaterialPanelProps) {
  const [equipos, setEquipos] = useState<EquipoTurno[]>([])
  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [cargando, setCargando] = useState(true)
  const [fallaAbiertaId, setFallaAbiertaId] = useState<string | null>(null)
  const [textoFalla, setTextoFalla] = useState('')
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const cEq = escucharMisEquiposBupc(
      perfil.uid,
      (lista) => {
        setEquipos(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    const cOps = escucharOperativos(setOperativos, () => undefined)
    return () => {
      cEq()
      cOps()
    }
  }, [perfil.uid])

  const mapaOperativos = new Map(operativos.map((o) => [o.id, o]))
  const bajoResguardo = equipos.filter((e) => !e.devuelto && e.acta_incidencia === null)
  const historial = equipos.filter((e) => e.devuelto || e.acta_incidencia !== null)

  async function enviarFalla(equipoId: string) {
    setError(null)
    setAviso(null)
    if (!textoFalla.trim()) {
      setError('Describe la falla o faltante encontrado.')
      return
    }
    setEnviandoId(equipoId)
    try {
      await reportarFallaEquipo(equipoId, textoFalla)
      setAviso('Reporte de falla enviado al Encargado en turno.')
      setFallaAbiertaId(null)
      setTextoFalla('')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">Mi Material BUPC</h2>
          <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
            Desglose en tiempo real del equipo BUPC asignado bajo tu resguardo y devoluciones.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
            bajoResguardo.length > 0
              ? 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-campo dark:text-naranja'
              : 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
          }`}
        >
          {bajoResguardo.length === 0
            ? 'Sin adeudos pendientes'
            : `${bajoResguardo.length} pendiente${bajoResguardo.length === 1 ? '' : 's'} de devolución`}
        </span>
      </div>

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

      {cargando ? (
        <div className="tarjeta flex flex-col gap-3 p-4">
          <div className="h-16 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
          <div className="h-16 animate-pulse rounded-lg bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : (
        <>
          {/* Bloque 1: Bajo resguardo actual */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold tracking-wider uppercase text-tinta-suave dark:text-noche-tinta-suave">
              En mi resguardo actualmente ({bajoResguardo.length})
            </h3>

            {bajoResguardo.length === 0 ? (
              <article className="tarjeta flex flex-col items-center gap-2 p-6 text-center">
                <Package
                  size={28}
                  strokeWidth={2}
                  className="text-activo dark:text-activo-claro"
                />
                <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                  No tienes material BUPC pendiente de devolución
                </p>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Cuando un Encargado te entregue radio, chaleco, botiquín o lámpara, aparecerá aquí
                  al instante con su serie y hora de entrega.
                </p>
              </article>
            ) : (
              <div className="flex flex-col gap-2.5">
                {bajoResguardo.map((eq) => {
                  const opNombre =
                    eq.operativo_nombre ||
                    mapaOperativos.get(eq.operativo_id)?.nombre ||
                    'Operativo BUPC'
                  const cantidad = eq.cantidad ?? 1
                  const abriendoFalla = fallaAbiertaId === eq.id

                  return (
                    <article
                      key={eq.id}
                      className="tarjeta flex flex-col gap-2.5 border-l-4 border-l-naranja p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                              {cantidad > 1 ? `${cantidad}× ` : ''}
                              {eq.nombre_articulo}
                            </h4>
                            {eq.codigo_inventario && (
                              <span className="rounded bg-superficie-suave px-2 py-0.5 text-[11px] font-bold tabular-nums text-tinta dark:bg-noche-campo dark:text-noche-tinta">
                                Serie/Folio: {eq.codigo_inventario}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-udec dark:text-activo-claro">
                            Operativo: {opNombre}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            eq.estado_reporte === 'Con_Falla'
                              ? 'bg-alerta-suave text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto'
                              : 'bg-naranja-suave text-naranja-oscuro dark:bg-noche-campo dark:text-naranja'
                          }`}
                        >
                          {eq.estado_reporte === 'Con_Falla' ? 'Con falla' : 'Bajo resguardo'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock size={13} strokeWidth={2} />
                          <span>Entregado: {formatearFechaHora(eq.creado_en?.toMillis())}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserCheck size={13} strokeWidth={2} />
                          <span>Por: {eq.creado_por_nombre || 'Encargado de turno'}</span>
                        </span>
                      </div>

                      {eq.falla_reportada && (
                        <p className="rounded-md bg-alerta-suave px-2.5 py-1.5 text-xs font-semibold text-alerta dark:bg-noche-rojo-suave dark:text-noche-rojo-texto">
                          Falla reportada: {eq.falla_reportada}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-2 dark:border-noche-borde">
                        <span className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          Solo un Encargado puede validar su devolución para liberar tu salida.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFallaAbiertaId(abriendoFalla ? null : eq.id)
                            setTextoFalla(eq.falla_reportada)
                          }}
                          className="btn min-h-8 border border-alerta/70 bg-tarjeta px-2.5 text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                        >
                          <Wrench size={13} strokeWidth={2} />
                          <span>{abriendoFalla ? 'Cerrar' : 'Reportar falla'}</span>
                        </button>
                      </div>

                      {abriendoFalla && (
                        <div className="flex flex-col gap-2">
                          <textarea
                            rows={2}
                            maxLength={400}
                            placeholder="Describe la falla o faltante detectado..."
                            value={textoFalla}
                            onChange={(e) => setTextoFalla(e.target.value)}
                            className="campo min-h-16 py-2 text-xs"
                          />
                          <button
                            type="button"
                            disabled={enviandoId === eq.id}
                            onClick={() => void enviarFalla(eq.id)}
                            className="btn-naranja min-h-9 self-end px-4 text-xs"
                          >
                            {enviandoId === eq.id ? 'Enviando...' : 'Enviar reporte'}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bloque 2: Historial de devoluciones y actas */}
          {historial.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold tracking-wider uppercase text-tinta-suave dark:text-noche-tinta-suave">
                Historial de devoluciones ({historial.length})
              </h3>
              <div className="tarjeta divide-y divide-borde dark:divide-noche-borde">
                {historial.map((eq) => {
                  const opNombre =
                    eq.operativo_nombre ||
                    mapaOperativos.get(eq.operativo_id)?.nombre ||
                    'Operativo BUPC'
                  const cantidad = eq.cantidad ?? 1
                  return (
                    <div
                      key={eq.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-tinta dark:text-noche-tinta">
                          {cantidad > 1 ? `${cantidad}× ` : ''}
                          {eq.nombre_articulo}
                          {eq.codigo_inventario ? ` (${eq.codigo_inventario})` : ''}
                        </p>
                        <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                          {opNombre} · Entregado: {formatearFechaHora(eq.creado_en?.toMillis())}
                          {eq.creado_por_nombre ? ` por ${eq.creado_por_nombre}` : ''}
                        </p>
                        {eq.acta_incidencia && (
                          <p className="mt-0.5 text-[11px] font-semibold text-ambar-texto dark:text-noche-ambar-texto">
                            Acta: {eq.acta_incidencia.motivo}
                          </p>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          eq.devuelto
                            ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                            : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                        }`}
                      >
                        {eq.devuelto ? 'Devuelto OK' : 'Con Acta'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
