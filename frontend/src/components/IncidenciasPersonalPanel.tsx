import { AlertCircle, CheckCircle2, ClipboardList, Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { GRAVEDADES_INCIDENCIA, TIPOS_INCIDENCIA_PERSONAL } from '../constants/catalogos'
import { esAdmin, esEncargadoAP, puedeGestionarBrigadista } from '../lib/permisos'
import {
  escucharUsuariosPorEstatus,
  mensajeDeError,
  nombreCompleto,
} from '../services/authService'
import { crearIncidenciaPersonal } from '../services/incidenciasPersonalService'
import { escucharOperativos } from '../services/operativosService'
import type {
  GravedadIncidencia,
  Operativo,
  TipoIncidenciaPersonal,
  Usuario,
} from '../types'

interface IncidenciasPersonalPanelProps {
  actor: Usuario
}

export function IncidenciasPersonalPanel({ actor }: IncidenciasPersonalPanelProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [objetivoUid, setObjetivoUid] = useState('')
  const [operativoId, setOperativoId] = useState('')
  const [tipo, setTipo] = useState<TipoIncidenciaPersonal>('Observación')
  const [gravedad, setGravedad] = useState<GravedadIncidencia>('Baja')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const puedeListarTodos = esAdmin(actor) || esEncargadoAP(actor)

  useEffect(() => {
    const cOps = escucharOperativos(
      (lista) => setOperativos(lista.filter((o) => o.estatus !== 'Finalizado')),
      (err) => setError(mensajeDeError(err)),
    )
    let cUsers = () => {}
    if (puedeListarTodos) {
      cUsers = escucharUsuariosPorEstatus(
        ['Activo'],
        (lista) => setUsuarios(lista.filter((u) => puedeGestionarBrigadista(actor, u))),
        (err) => setError(mensajeDeError(err)),
      )
    }
    return () => {
      cOps()
      cUsers()
    }
  }, [actor, puedeListarTodos])

  async function manejarRegistrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    const objetivo = usuarios.find((u) => u.uid === objetivoUid)
    if (!objetivo) {
      setError('Selecciona un integrante para registrar la incidencia.')
      return
    }
    setGuardando(true)
    try {
      await crearIncidenciaPersonal(actor, {
        objetivo,
        operativo_id: operativoId || null,
        tipo,
        gravedad,
        descripcion,
      })
      setDescripcion('')
      setAviso(`Incidencia registrada de forma inmutable para ${nombreCompleto(objetivo)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
          Incidencias de Personal
        </h2>
        <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
          Registro inmutable vinculado a auditoría de faltas, retardos, conducta o reconocimientos.
        </p>
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

      <article className="tarjeta flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
          <ClipboardList size={18} strokeWidth={2} className="text-udec dark:text-activo-claro" />
          <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
            Nueva incidencia de personal
          </h3>
        </div>

        <form onSubmit={manejarRegistrar} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="inc-usuario" className="etiqueta">
                Integrante
              </label>
              <select
                id="inc-usuario"
                value={objetivoUid}
                onChange={(e) => setObjetivoUid(e.target.value)}
                className="campo min-h-10 text-xs"
                required
              >
                <option value="">Selecciona un integrante...</option>
                {usuarios.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {nombreCompleto(u)} ({u.numero_cuenta})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="inc-op" className="etiqueta">
                Operativo vinculado (opcional)
              </label>
              <select
                id="inc-op"
                value={operativoId}
                onChange={(e) => setOperativoId(e.target.value)}
                className="campo min-h-10 text-xs"
              >
                <option value="">Sin operativo específico</option>
                {operativos.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="inc-tipo" className="etiqueta">
                Tipo
              </label>
              <select
                id="inc-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoIncidenciaPersonal)}
                className="campo min-h-10 text-xs"
              >
                {TIPOS_INCIDENCIA_PERSONAL.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="inc-grav" className="etiqueta">
                Gravedad
              </label>
              <select
                id="inc-grav"
                value={gravedad}
                onChange={(e) => setGravedad(e.target.value as GravedadIncidencia)}
                className="campo min-h-10 text-xs"
              >
                {GRAVEDADES_INCIDENCIA.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="inc-desc" className="etiqueta">
              Descripción de hechos
            </label>
            <textarea
              id="inc-desc"
              rows={3}
              maxLength={1000}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe brevemente la incidencia o reconocimiento..."
              className="campo min-h-20 py-2 text-sm"
              required
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={guardando} className="btn-naranja min-h-10 px-4 text-xs">
              <Plus size={15} strokeWidth={2} />
              <span>{guardando ? 'Registrando...' : 'Registrar incidencia'}</span>
            </button>
          </div>
        </form>
      </article>
    </section>
  )
}
