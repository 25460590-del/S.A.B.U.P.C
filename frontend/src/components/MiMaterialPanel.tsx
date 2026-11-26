import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { mensajeDeError } from '../services/authService'
import {
  escucharMisEquiposBupc,
  LIMITE_EQUIPOS_PAGINA,
  obtenerMasMisEquiposBupc,
  reportarFallaEquipo,
} from '../services/equiposService'
import { obtenerOperativoPorId } from '../services/operativosService'
import type { EquipoTurno, Usuario } from '../types'

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
  const [equiposVivo, setEquiposVivo] = useState<EquipoTurno[]>([])
  const [equiposExtra, setEquiposExtra] = useState<EquipoTurno[]>([])
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [nombresFallback, setNombresFallback] = useState<Record<string, string>>({})
  const consultadosRef = useRef<Set<string>>(new Set())

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
        setEquiposVivo(lista)
        setHayMas(lista.length >= LIMITE_EQUIPOS_PAGINA)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
      LIMITE_EQUIPOS_PAGINA,
    )
    return cEq
  }, [perfil.uid])

  const equipos = useMemo(() => {
    const mapa = new Map<string, EquipoTurno>()
    for (const e of equiposVivo) mapa.set(e.id, e)
    for (const e of equiposExtra) {
      if (!mapa.has(e.id)) mapa.set(e.id, e)
    }
    return Array.from(mapa.values()).sort(
      (a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0),
    )
  }, [equiposVivo, equiposExtra])

  // Respaldo puntual (getDoc) únicamente si algún registro antiguo carece de `operativo_nombre`
  useEffect(() => {
    const faltantes = Array.from(
      new Set(
        equipos
          .filter((e) => !e.operativo_nombre && !consultadosRef.current.has(e.operativo_id))
          .map((e) => e.operativo_id),
      ),
    )
    if (faltantes.length === 0) return
    for (const id of faltantes) consultadosRef.current.add(id)
    let activo = true
    void Promise.all(
      faltantes.map(async (opId) => {
        try {
          const op = await obtenerOperativoPorId(opId)
          return [opId, op?.nombre ?? 'Operativo BUPC'] as const
        } catch {
          return [opId, 'Operativo BUPC'] as const
        }
      }),
    ).then((pares) => {
      if (!activo) return
      setNombresFallback((prev) => {
        const copia = { ...prev }
        for (const [id, nombre] of pares) copia[id] = nombre
        return copia
      })
    })
    return () => {
      activo = false
    }
  }, [equipos])

  const bajoResguardo = equipos.filter((e) => !e.devuelto && e.acta_incidencia === null)
  const historial = equipos.filter((e) => e.devuelto || e.acta_incidencia !== null)

  async function cargarMasEquipos() {
    const ultimo = equipos[equipos.length - 1]
    if (!ultimo?.creado_en || cargandoMas) return
    setCargandoMas(true)
    setError(null)
    try {
      const res = await obtenerMasMisEquiposBupc(
        perfil.uid,
        ultimo.creado_en,
        LIMITE_EQUIPOS_PAGINA,
      )
      setEquiposExtra((prev) => [...prev, ...res.equipos])
      setHayMas(res.hayMas)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoMas(false)
    }
  }

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
          className="flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-3 text-xs font-semibold text-alerta-texto dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
        >
          <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-activo bg-activo-suave p-3 text-xs font-semibold text-activo-texto dark:bg-noche-campo dark:text-activo-claro"
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
                    eq.operativo_nombre || nombresFallback[eq.operativo_id] || 'Operativo BUPC'
                  const cantidad = eq.cantidad ?? 1
                  const abriendoFalla = fallaAbiertaId === eq.id

                  return (
                    <article
                      key={eq.id}
                      className="tarjeta flex flex-col gap-2.5 border-naranja/45 p-3.5 dark:border-naranja/40"
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

                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {eq.sync_status === 'pendiente' && (
                            <span className="rounded-full bg-ambar-suave px-2 py-0.5 text-[11px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                              Pendiente de sincronizar
                            </span>
                          )}
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
                    eq.operativo_nombre || nombresFallback[eq.operativo_id] || 'Operativo BUPC'
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

          {hayMas && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                disabled={cargandoMas}
                onClick={() => void cargarMasEquipos()}
                className="btn-salvia min-h-9 px-4 text-xs"
              >
                {cargandoMas ? 'Cargando...' : 'Cargar más entregas'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
