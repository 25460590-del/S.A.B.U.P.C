import { AlertCircle, CheckCircle2, Radio, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { puedeAsignarRadio } from '../lib/permisos'
import {
  actualizarRadioUsuario,
  escucharUsuariosPorEstatus,
  mensajeDeError,
  nombreCompleto,
} from '../services/authService'
import type { Usuario } from '../types'

interface GestionTeslaPanelProps {
  actor: Usuario
}

export function GestionTeslaPanel({ actor }: GestionTeslaPanelProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [borradores, setBorradores] = useState<
    Record<string, { clave: string; autorizado: boolean }>
  >({})
  const [guardandoUid, setGuardandoUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const cancelar = escucharUsuariosPorEstatus(
      ['Activo'],
      (lista) => {
        setUsuarios(lista)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
    )
    return cancelar
  }, [])

  const filtrados = usuarios.filter((u) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      nombreCompleto(u).toLowerCase().includes(q) ||
      u.numero_cuenta.toLowerCase().includes(q) ||
      (u.clave_radio || '').toLowerCase().includes(q)
    )
  })

  function obtenerEstado(u: Usuario) {
    return (
      borradores[u.uid] ?? {
        clave: u.clave_radio || u.clave_personal_radio || '',
        autorizado: u.autorizado_radio,
      }
    )
  }

  async function guardar(u: Usuario) {
    const estado = obtenerEstado(u)
    setGuardandoUid(u.uid)
    setError(null)
    setAviso(null)
    try {
      await actualizarRadioUsuario(actor, u, {
        autorizado_radio: estado.autorizado,
        clave_radio: estado.clave,
      })
      setAviso(`Claves de radio actualizadas para ${nombreCompleto(u)}.`)
      setBorradores((prev) => {
        const copia = { ...prev }
        delete copia[u.uid]
        return copia
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setGuardandoUid(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-tinta dark:text-noche-tinta">
          Claves TESLA y Permisos de Radio
        </h2>
        <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
          Dominio exclusivo de TESLA y Administración. Las claves se normalizan automáticamente en
          mayúsculas.
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

      <div className="tarjeta p-3">
        <div className="relative">
          <Search
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
          />
          <input
            type="search"
            placeholder="Buscar por nombre, número de cuenta o clave de radio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="campo min-h-10 pl-9 text-xs"
          />
        </div>
      </div>

      {cargando ? (
        <div className="tarjeta flex flex-col gap-3 p-4">
          <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtrados.map((u) => {
            const estado = obtenerEstado(u)
            const permitido = puedeAsignarRadio(actor, u)
            const ocupado = guardandoUid === u.uid
            const sinCambios =
              estado.autorizado === u.autorizado_radio &&
              estado.clave.trim().toUpperCase() === (u.clave_radio || '')

            return (
              <article
                key={u.uid}
                className="tarjeta flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-tinta dark:text-noche-tinta">
                      {nombreCompleto(u)}
                      {u.uid === actor.uid ? ' (Tú)' : ''}
                    </span>
                    <span className="rounded bg-salvia px-2 py-0.5 text-[10px] font-bold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                      {u.rol_sistema}
                    </span>
                  </div>
                  <p className="text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                    {u.numero_cuenta} · {u.etapa}
                    {u.subgrupo ? ` (${u.subgrupo})` : ''} · {u.ayudantia}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    maxLength={20}
                    disabled={!permitido || ocupado}
                    placeholder="Ej. TESLA-205"
                    aria-label={`Clave de radio de ${nombreCompleto(u)}`}
                    value={estado.clave}
                    onChange={(e) =>
                      setBorradores((prev) => ({
                        ...prev,
                        [u.uid]: { ...estado, clave: e.target.value.toUpperCase() },
                      }))
                    }
                    className="campo min-h-9 w-36 text-xs font-bold uppercase tabular-nums"
                  />

                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-borde bg-fondo px-2.5 text-xs font-semibold text-tinta dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta">
                    <input
                      type="checkbox"
                      disabled={!permitido || ocupado}
                      checked={estado.autorizado}
                      onChange={(e) =>
                        setBorradores((prev) => ({
                          ...prev,
                          [u.uid]: { ...estado, autorizado: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded accent-udec"
                    />
                    <Radio size={13} strokeWidth={2} />
                    <span>Radio</span>
                  </label>

                  <button
                    type="button"
                    disabled={!permitido || ocupado || sinCambios}
                    onClick={() => void guardar(u)}
                    className="btn-verde min-h-9 px-3 text-xs"
                  >
                    {!permitido ? 'Bloqueado' : ocupado ? '...' : 'Guardar'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
