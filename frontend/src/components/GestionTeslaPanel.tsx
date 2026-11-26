import { AlertCircle, CheckCircle2, Lock, Radio, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDirectorio } from '../context/DirectorioContext'
import { ayudantiaJefatura, esAdmin, puedeAsignarRadio } from '../lib/permisos'
import {
  actualizarRadioUsuario,
  mensajeDeError,
  nombreCompleto,
} from '../services/authService'
import type { Usuario } from '../types'
import { IndicadorAlcanceAyudantia } from './IndicadorAlcanceAyudantia'

interface GestionTeslaPanelProps {
  actor: Usuario
}

function iniciales(u: Usuario): string {
  const n = (u.nombres.trim()[0] ?? '').toUpperCase()
  const a = (u.apellido_paterno.trim()[0] ?? '').toUpperCase()
  return `${n}${a}` || 'B'
}

/**
 * Vista dedicada "Claves TESLA" (Dominio exclusivo de Radio):
 * - Consume el directorio centralizado de sesión (`DirectorioContext`, cero listeners extra).
 * - Bloquea autoasignación en UI cuando el actor no es Administrador.
 * - Si el actor es Jefe de Ayudantía Tesla, filtra estrictamente a su ayudantía.
 */
export function GestionTeslaPanel({ actor }: GestionTeslaPanelProps) {
  const soyAdmin = esAdmin(actor)
  const ayJefe = ayudantiaJefatura(actor)
  const { usuarios: directorio, cargando, error: errorDirectorio } = useDirectorio()
  const [busqueda, setBusqueda] = useState('')
  const [filtroRadio, setFiltroRadio] = useState<'todos' | 'autorizados' | 'sin_radio'>('todos')
  const [borradores, setBorradores] = useState<
    Record<string, { clave: string; autorizado: boolean }>
  >({})
  const [guardandoUid, setGuardandoUid] = useState<string | null>(null)
  const [errorLocal, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const error = errorLocal ?? errorDirectorio

  const usuarios = useMemo(
    () =>
      directorio
        .filter((u) => u.estatus === 'Activo')
        .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es-MX')),
    [directorio],
  )

  const conteos = useMemo(() => {
    let autorizados = 0
    for (const u of usuarios) {
      if (u.autorizado_radio || u.rol_sistema === 'Administrador') autorizados++
    }
    return {
      todos: usuarios.length,
      autorizados,
      sinRadio: usuarios.length - autorizados,
    }
  }, [usuarios])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => {
      const tieneAcceso = u.autorizado_radio || u.rol_sistema === 'Administrador'
      if (filtroRadio === 'autorizados' && !tieneAcceso) return false
      if (filtroRadio === 'sin_radio' && tieneAcceso) return false
      if (!q) return true
      return (
        nombreCompleto(u).toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q) ||
        u.numero_cuenta.toLowerCase().includes(q) ||
        (u.subgrupo || '').toLowerCase().includes(q) ||
        (u.clave_radio || u.clave_personal_radio || '').toLowerCase().includes(q)
      )
    })
  }, [usuarios, busqueda, filtroRadio])

  function obtenerEstado(u: Usuario) {
    return (
      borradores[u.uid] ?? {
        clave: u.clave_radio || u.clave_personal_radio || '',
        autorizado: u.autorizado_radio,
      }
    )
  }

  async function guardar(u: Usuario, override?: { clave: string; autorizado: boolean }) {
    const estado = override ?? obtenerEstado(u)
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
          Claves TESLA{ayJefe ? ` · ${ayJefe}` : ''}
        </h2>
        <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
          Asigna, edita o revoca claves de radio y permisos de acceso a la consola.
        </p>
      </div>

      {ayJefe && (
        <IndicadorAlcanceAyudantia
          ayudantia={ayJefe}
          descripcion="Solo puedes consultar y gestionar claves de radio de los integrantes adscritos a Tesla."
        />
      )}

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

      <div className="tarjeta flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave dark:text-noche-tinta-suave"
          />
          <input
            type="search"
            placeholder="Buscar por nombre, correo, subgrupo o clave (ej. TESLA-205)..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="campo min-h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'todos', label: 'Todos', count: conteos.todos },
              { id: 'autorizados', label: 'Con Radio', count: conteos.autorizados },
              { id: 'sin_radio', label: 'Sin Radio', count: conteos.sinRadio },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFiltroRadio(chip.id)}
              className={`min-h-8 cursor-pointer rounded-full px-2.5 text-[11px] font-semibold ${
                filtroRadio === chip.id
                  ? 'bg-udec text-white'
                  : 'bg-salvia text-udec-oscuro dark:bg-noche-campo dark:text-noche-tinta-suave'
              }`}
            >
              {chip.label} <span className="tabular-nums opacity-80">({chip.count})</span>
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="tarjeta flex flex-col gap-2.5 p-4">
          <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
          <div className="h-12 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
        </div>
      ) : filtrados.length === 0 ? (
        <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
          <Radio size={28} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
          <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
            Sin integrantes coincidentes
          </p>
        </article>
      ) : (
        <article className="tarjeta divide-y divide-borde overflow-hidden dark:divide-noche-borde">
          {filtrados.map((u) => {
            const estado = obtenerEstado(u)
            const esMiCuenta = u.uid === actor.uid
            const bloqueoAutoasignacion = esMiCuenta && !soyAdmin
            const permitido = puedeAsignarRadio(actor, u)
            const ocupado = guardandoUid === u.uid
            const claveActual = u.clave_radio || u.clave_personal_radio || ''
            const sinCambios =
              estado.autorizado === u.autorizado_radio &&
              estado.clave.trim().toUpperCase() === claveActual

            return (
              <div
                key={u.uid}
                className="flex flex-col gap-2.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salvia text-[11px] font-extrabold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                    {iniciales(u)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                        {nombreCompleto(u)}
                        {esMiCuenta ? ' (Tú)' : ''}
                      </span>
                      <span className="rounded bg-superficie-suave px-1.5 py-0.5 text-[11px] font-bold text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave">
                        {u.rol_sistema}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                      {u.correo} · {u.subgrupo || u.etapa}
                    </p>
                  </div>
                </div>

                {bloqueoAutoasignacion ? (
                  <div
                    title="No puedes autoasignarte clave de radio"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-borde bg-superficie-suave px-3 py-1.5 text-[11px] font-semibold text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave"
                  >
                    <Lock size={13} strokeWidth={2} />
                    <span>No puedes autoasignarte clave de radio</span>
                  </div>
                ) : (
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

                    {/* Switch accesible autorizado_radio */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={estado.autorizado}
                      aria-label={`Autorizar radio para ${nombreCompleto(u)}`}
                      disabled={!permitido || ocupado}
                      onClick={() =>
                        setBorradores((prev) => ({
                          ...prev,
                          [u.uid]: { ...estado, autorizado: !estado.autorizado },
                        }))
                      }
                      className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                        estado.autorizado
                          ? 'border-activo bg-activo-suave text-activo dark:border-activo-claro dark:bg-noche-campo dark:text-activo-claro'
                          : 'border-borde bg-fondo text-tinta-suave dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta-suave'
                      }`}
                    >
                      <Radio size={13} strokeWidth={2} />
                      <span>{estado.autorizado ? 'Autorizado' : 'Sin acceso'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!permitido || ocupado || sinCambios}
                      onClick={() => void guardar(u)}
                      className="btn-verde min-h-9 px-3 text-xs"
                    >
                      {ocupado ? '...' : 'Guardar'}
                    </button>

                    {(u.autorizado_radio || claveActual) && (
                      <button
                        type="button"
                        disabled={!permitido || ocupado}
                        onClick={() => void guardar(u, { clave: '', autorizado: false })}
                        className="btn min-h-9 border border-alerta/70 bg-tarjeta px-2.5 text-xs text-alerta hover:bg-alerta-suave dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </article>
      )}
    </section>
  )
}
