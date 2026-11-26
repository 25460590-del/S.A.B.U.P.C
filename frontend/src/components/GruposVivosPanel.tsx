import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Eye,
  GraduationCap,
  Layers,
  Plus,
  RotateCcw,
  Square,
  Users,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { AYUDANTIAS_ACTIVAS, ETAPAS_FORMATIVAS } from '../constants/catalogos'
import {
  ayudantiaEfectiva,
  ayudantiaJefatura,
  esAdmin,
  esConfiguracionJefeAyudantia,
  etapaDeSubgrupo,
  etiquetaAyudantia,
  faltaAyudantiaOperativo,
  puedeGestionarBrigadista,
  subgruposDeEtapa,
} from '../lib/permisos'
import { mensajeDeError, nombreCompleto } from '../services/authService'
import {
  formatearNombreGrupoFormativo,
  guardarCatalogoSubgrupos,
} from '../services/catalogosService'
import type { EtapaFormativa, Usuario } from '../types'
import { ModalPromocionLote } from './grupos/ModalPromocionLote'
import { usePromocionLote, type SeleccionGrupo } from './grupos/usePromocionLote'
import { IndicadorAlcanceAyudantia } from './IndicadorAlcanceAyudantia'

interface GruposVivosPanelProps {
  actor: Usuario
  usuarios: Usuario[]
  subgruposActivos: string[]
  subgruposArchivados: string[]
  alAbrirExpediente: (uid: string) => void
  alNotificar: (msg: string) => void
  alError: (msg: string) => void
}

const DESCRIPCION_ETAPA: Record<EtapaFormativa, string> = {
  Alfa: 'Tronco Común · Primeros Auxilios (pasa a Omega)',
  Omega: 'Tronco Común · Protección Civil (pasa a Grupo Operativo)',
  SIERRA: 'Diplomado de Socorrismo (se gradúa directo a Grupo Operativo)',
}

function iniciales(u: Usuario): string {
  const n = (u.nombres.trim()[0] ?? '').toUpperCase()
  const a = (u.apellido_paterno.trim()[0] ?? '').toUpperCase()
  return `${n}${a}` || 'B'
}

export function GruposVivosPanel({
  actor,
  usuarios,
  subgruposActivos,
  subgruposArchivados,
  alAbrirExpediente,
  alNotificar,
  alError,
}: GruposVivosPanelProps) {
  const soyAdmin = esAdmin(actor)
  const ayJefe = ayudantiaJefatura(actor)

  const [etapaNuevo, setEtapaNuevo] = useState<EtapaFormativa>('Alfa')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [ocupadoCatalogo, setOcupadoCatalogo] = useState(false)
  const [grupoAbierto, setGrupoAbierto] = useState<SeleccionGrupo | null>(null)

  const usuariosActivos = useMemo(
    () => usuarios.filter((u) => u.estatus === 'Activo'),
    [usuarios],
  )

  const conteoPorSubgrupo = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const u of usuariosActivos) {
      const sg = (u.subgrupo ?? '').trim()
      if (!sg) continue
      mapa.set(sg, (mapa.get(sg) ?? 0) + 1)
    }
    return mapa
  }, [usuariosActivos])

  const conteoOperativoPorAyudantia = useMemo(() => {
    const mapa = new Map<string, number>()
    let sinAyudantia = 0
    for (const u of usuariosActivos) {
      if (u.etapa !== 'Grupo Operativo') continue
      const ay = ayudantiaEfectiva(u)
      if (ay === 'Ninguna') sinAyudantia += 1
      else mapa.set(ay, (mapa.get(ay) ?? 0) + 1)
    }
    return { mapa, sinAyudantia }
  }, [usuariosActivos])

  const gruposPorEtapa = useMemo(() => {
    const resultado: Record<
      EtapaFormativa,
      { nombre: string; activos: number; cerrado: boolean }[]
    > = {
      Alfa: [],
      Omega: [],
      SIERRA: [],
    }

    const vistos = new Set<string>()
    for (const etapa of ETAPAS_FORMATIVAS) {
      const activosEtapa = subgruposDeEtapa(subgruposActivos, etapa)
      for (const nombre of activosEtapa) {
        const cuenta = conteoPorSubgrupo.get(nombre) ?? 0
        if (ayJefe && cuenta === 0) continue
        vistos.add(nombre)
        resultado[etapa].push({ nombre, activos: cuenta, cerrado: false })
      }
      for (const [sg, cuenta] of conteoPorSubgrupo.entries()) {
        if (vistos.has(sg)) continue
        if (etapaDeSubgrupo(sg) === etapa && cuenta > 0) {
          vistos.add(sg)
          resultado[etapa].push({ nombre: sg, activos: cuenta, cerrado: true })
        }
      }
    }
    return resultado
  }, [subgruposActivos, conteoPorSubgrupo, ayJefe])

  const gruposOmegaActivos = useMemo(
    () => subgruposDeEtapa(subgruposActivos, 'Omega'),
    [subgruposActivos],
  )

  const integrantesGrupoAbierto = useMemo(() => {
    if (!grupoAbierto) return []
    if (grupoAbierto.tipo === 'formativo') {
      return usuariosActivos.filter(
        (u) => u.etapa === grupoAbierto.etapa && (u.subgrupo ?? '').trim() === grupoAbierto.nombre,
      )
    }
    if (grupoAbierto.tipo === 'operativo') {
      return usuariosActivos.filter(
        (u) => u.etapa === 'Grupo Operativo' && ayudantiaEfectiva(u) === grupoAbierto.ayudantia,
      )
    }
    return usuariosActivos.filter((u) => faltaAyudantiaOperativo(u))
  }, [grupoAbierto, usuariosActivos])

  const integrantesGestionables = useMemo(
    () => integrantesGrupoAbierto.filter((u) => puedeGestionarBrigadista(actor, u)),
    [integrantesGrupoAbierto, actor],
  )

  const promocion = usePromocionLote({
    actor,
    grupoAbierto,
    integrantesGrupoAbierto,
    integrantesGestionables,
    gruposOmegaActivos,
    alNotificar,
  })

  function abrirGrupo(seleccion: SeleccionGrupo) {
    setGrupoAbierto(seleccion)
    promocion.reiniciarSeleccion()
  }

  async function manejarCrearGrupo(e: FormEvent) {
    e.preventDefault()
    if (!soyAdmin) return
    const etiqueta = formatearNombreGrupoFormativo(etapaNuevo, nombreNuevo)
    if (!etiqueta) return
    if (subgruposActivos.some((s) => s.toLowerCase() === etiqueta.toLowerCase())) {
      alError(`El grupo "${etiqueta}" ya está activo.`)
      return
    }
    setOcupadoCatalogo(true)
    alError('')
    try {
      const nuevosActivos = [...subgruposActivos, etiqueta]
      const nuevosArchivados = subgruposArchivados.filter(
        (s) => s.toLowerCase() !== etiqueta.toLowerCase(),
      )
      await guardarCatalogoSubgrupos(
        actor,
        nuevosActivos,
        nuevosArchivados,
        `Nuevo grupo creado en ${etapaNuevo}: ${etiqueta}`,
      )
      setNombreNuevo('')
      alNotificar(`Grupo "${etiqueta}" creado en etapa ${etapaNuevo}.`)
    } catch (err) {
      alError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoCatalogo(false)
    }
  }

  async function manejarCerrarGrupo(nombre: string) {
    if (!soyAdmin) return
    setOcupadoCatalogo(true)
    alError('')
    try {
      const nuevosActivos = subgruposActivos.filter((s) => s !== nombre)
      const nuevosArchivados = Array.from(new Set([...subgruposArchivados, nombre]))
      await guardarCatalogoSubgrupos(
        actor,
        nuevosActivos,
        nuevosArchivados,
        `Grupo cerrado sin afectar historiales: ${nombre}`,
      )
      alNotificar(`Grupo "${nombre}" cerrado. El historial de asistencias se conserva intacto.`)
    } catch (err) {
      alError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoCatalogo(false)
    }
  }

  async function manejarReabrirGrupo(nombre: string) {
    if (!soyAdmin) return
    setOcupadoCatalogo(true)
    alError('')
    try {
      const nuevosActivos = Array.from(new Set([...subgruposActivos, nombre]))
      const nuevosArchivados = subgruposArchivados.filter((s) => s !== nombre)
      await guardarCatalogoSubgrupos(
        actor,
        nuevosActivos,
        nuevosArchivados,
        `Grupo reabierto: ${nombre}`,
      )
      alNotificar(`Grupo "${nombre}" reabierto.`)
    } catch (err) {
      alError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setOcupadoCatalogo(false)
    }
  }

  // ── VISTA B: PADRÓN DE INTEGRANTES DEL GRUPO ABIERTO ──────────────────────
  if (grupoAbierto) {
    const esFormativo = grupoAbierto.tipo === 'formativo'
    const tituloGrupo =
      grupoAbierto.tipo === 'formativo'
        ? grupoAbierto.nombre
        : grupoAbierto.tipo === 'operativo'
          ? `Grupo Operativo · ${grupoAbierto.ayudantia}`
          : 'Grupo Operativo · Pendientes de ayudantía'

    const textoProgresion =
      grupoAbierto.tipo === 'formativo'
        ? grupoAbierto.etapa === 'Alfa'
          ? 'Al acreditar Primeros Auxilios pasan a un grupo activo de Omega.'
          : grupoAbierto.etapa === 'Omega'
            ? 'Al acreditar Protección Civil se integran a Grupo Operativo (requiere ayudantía).'
            : 'Diplomado de Socorrismo: se gradúan directamente a Grupo Operativo (requiere ayudantía).'
        : grupoAbierto.tipo === 'operativo_sin_ayudantia'
          ? 'Abre el expediente de cada integrante para asignarle su ayudantía obligatoria.'
          : 'Personal operativo activo adscrito a esta ayudantía.'

    return (
      <section aria-label={`Integrantes de ${tituloGrupo}`} className="flex flex-col gap-3">
        {ayJefe && (
          <IndicadorAlcanceAyudantia
            ayudantia={ayJefe}
            descripcion={`Padrón filtrado exclusivamente a los integrantes de ${ayJefe} en este grupo.`}
          />
        )}

        <article className="tarjeta flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setGrupoAbierto(null)}
                className="btn-salvia min-h-9 px-3 text-xs"
              >
                <ArrowLeft size={14} strokeWidth={2} />
                <span>Grupos</span>
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                    {tituloGrupo}
                  </h3>
                  {esFormativo && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        grupoAbierto.cerrado
                          ? 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                          : 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                      }`}
                    >
                      {grupoAbierto.cerrado ? 'Cerrado' : 'Activo'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  {textoProgresion}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-salvia px-3 py-1 text-xs font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
              {integrantesGrupoAbierto.length} activo{integrantesGrupoAbierto.length === 1 ? '' : 's'}
            </span>
          </div>

          {esFormativo &&
            integrantesGestionables.length > 0 &&
            (grupoAbierto.etapa === 'Alfa' || soyAdmin || Boolean(ayJefe)) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3 dark:border-noche-borde">
                <button
                  type="button"
                  onClick={promocion.alternarTodos}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-borde bg-superficie-suave px-3 text-xs font-semibold text-tinta hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:text-noche-tinta"
                >
                  {promocion.todosSeleccionados ? (
                    <CheckSquare
                      size={15}
                      strokeWidth={2}
                      className="text-udec dark:text-activo-claro"
                    />
                  ) : (
                    <Square
                      size={15}
                      strokeWidth={2}
                      className="text-tinta-suave dark:text-noche-tinta-suave"
                    />
                  )}
                  <span>
                    {promocion.todosSeleccionados ? 'Quitar selección' : 'Seleccionar todos'} (
                    {promocion.seleccionadosEfectivos.length}/{integrantesGestionables.length})
                  </span>
                </button>

                <button
                  type="button"
                  disabled={promocion.seleccionadosEfectivos.length === 0}
                  onClick={promocion.abrirModalPromocion}
                  className="btn-naranja min-h-9 px-3.5 text-xs disabled:opacity-50"
                >
                  <GraduationCap size={15} strokeWidth={2} />
                  <span>
                    {grupoAbierto.etapa === 'Alfa'
                      ? `Promover seleccionados (${promocion.seleccionadosEfectivos.length})`
                      : `Graduar a Grupo Operativo (${promocion.seleccionadosEfectivos.length})`}
                  </span>
                </button>
              </div>
            )}
        </article>

        {integrantesGrupoAbierto.length === 0 ? (
          <article className="tarjeta flex flex-col items-center gap-2 p-8 text-center">
            <Users size={30} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
            <h4 className="text-sm font-bold text-tinta dark:text-noche-tinta">
              Sin integrantes activos en este grupo
            </h4>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              {esFormativo
                ? 'Cuando se asignen brigadistas activos aquí, aparecerán listos para seguimiento y promoción.'
                : 'No hay personal operativo activo en esta categoría.'}
            </p>
          </article>
        ) : (
          <article className="tarjeta divide-y divide-borde overflow-hidden dark:divide-noche-borde">
            {integrantesGrupoAbierto.map((u) => {
              const puedeGestionar = puedeGestionarBrigadista(actor, u)
              const marcado = promocion.seleccionadosEfectivos.some((s) => s.uid === u.uid)
              const sinAyuOperativo = faltaAyudantiaOperativo(u)

              return (
                <div
                  key={u.uid}
                  className={`flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 transition-colors ${
                    marcado
                      ? 'bg-salvia/55 dark:bg-noche-campo/90'
                      : 'hover:bg-superficie-suave/60 dark:hover:bg-noche-campo/50'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {esFormativo && (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar a ${nombreCompleto(u)}`}
                        checked={marcado}
                        disabled={!puedeGestionar}
                        onChange={() => promocion.alternarSeleccion(u.uid)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded accent-udec disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    )}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salvia text-[11px] font-extrabold text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                      {iniciales(u)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                          {nombreCompleto(u)}
                        </span>
                        {sinAyuOperativo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ambar-suave px-2 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                            <AlertTriangle size={11} strokeWidth={2} />
                            <span>Falta asignar ayudantía</span>
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                        Cuenta {u.numero_cuenta} · {etiquetaAyudantia(u.ayudantia)} ·{' '}
                        {esConfiguracionJefeAyudantia(u.rol_sistema, u.etapa, u.ayudantia)
                          ? 'Jefe de Ayudantía'
                          : u.rol_sistema}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => alAbrirExpediente(u.uid)}
                    className="btn-salvia min-h-8 px-2.5 text-[11px]"
                  >
                    <Eye size={13} strokeWidth={2} />
                    <span>Expediente</span>
                  </button>
                </div>
              )
            })}
          </article>
        )}

        {promocion.modalPromocionAbierto && grupoAbierto.tipo === 'formativo' && (
          <ModalPromocionLote
            grupo={grupoAbierto}
            seleccionadosEfectivos={promocion.seleccionadosEfectivos}
            seleccionadosSinAyudantia={promocion.seleccionadosSinAyudantia}
            gruposOmegaActivos={gruposOmegaActivos}
            subgrupoDestinoOmega={promocion.subgrupoDestinoOmega}
            modoAyudantiaLote={promocion.modoAyudantiaLote}
            ayudantiaComun={promocion.ayudantiaComun}
            ayudantiasIndividuales={promocion.ayudantiasIndividuales}
            promoviendo={promocion.promoviendo}
            errorModal={promocion.errorModal}
            alCambiarDestinoOmega={promocion.setSubgrupoDestinoOmega}
            alCambiarModoAyudantia={promocion.setModoAyudantiaLote}
            alCambiarAyudantiaComun={promocion.setAyudantiaComun}
            alCambiarAyudantiaIndividual={(uid, ay) =>
              promocion.setAyudantiasIndividuales((prev) => ({ ...prev, [uid]: ay }))
            }
            alConfirmar={(e) => void promocion.manejarConfirmarPromocion(e)}
            alCerrar={() => promocion.setModalPromocionAbierto(false)}
          />
        )}
      </section>
    )
  }

  // ── VISTA A: RESUMEN DE GRUPOS VIVOS POR ETAPA + GRUPO OPERATIVO ──────────
  const archivadosSinMiembros = subgruposArchivados.filter(
    (sg) => (conteoPorSubgrupo.get(sg) ?? 0) === 0,
  )

  return (
    <section aria-label="Grupos activos y progresión" className="flex flex-col gap-4">
      {ayJefe && (
        <IndicadorAlcanceAyudantia
          ayudantia={ayJefe}
          descripcion={`En Grupos Vivos solo se contabilizan y listan integrantes pertenecientes a ${ayJefe}.`}
        />
      )}

      {soyAdmin && (
        <article className="tarjeta flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers size={17} strokeWidth={2} className="text-udec dark:text-activo-claro" />
              <div>
                <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                  Nuevo grupo o generación
                </h3>
                <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Abre un grupo de Alfa, Omega o una nueva generación de SIERRA en un solo paso.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => void manejarCrearGrupo(e)} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Etapa del nuevo grupo"
              value={etapaNuevo}
              onChange={(e) => setEtapaNuevo(e.target.value as EtapaFormativa)}
              className="campo min-h-9 w-32 text-xs font-semibold"
              disabled={ocupadoCatalogo}
            >
              {ETAPAS_FORMATIVAS.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={40}
              placeholder={
                etapaNuevo === 'SIERRA'
                  ? 'Ej. 2 o Sierra 2'
                  : etapaNuevo === 'Omega'
                    ? 'Ej. 3 o Omega 3'
                    : 'Ej. 5 o Alfa 5'
              }
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              className="campo min-h-9 min-w-44 flex-1 text-xs"
              disabled={ocupadoCatalogo}
              required
            />
            <button
              type="submit"
              disabled={ocupadoCatalogo}
              className="btn-naranja min-h-9 px-3.5 text-xs"
            >
              <Plus size={14} strokeWidth={2} />
              <span>Crear grupo</span>
            </button>
          </form>
        </article>
      )}

      {conteoOperativoPorAyudantia.sinAyudantia > 0 && (
        <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ambar bg-ambar-suave p-3.5 dark:bg-noche-ambar">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              size={18}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-ambar-texto dark:text-noche-ambar-texto"
            />
            <div>
              <p className="text-xs font-bold text-ambar-texto dark:text-noche-ambar-texto">
                {conteoOperativoPorAyudantia.sinAyudantia} integrante
                {conteoOperativoPorAyudantia.sinAyudantia === 1 ? '' : 's'} en Grupo Operativo sin
                ayudantía asignada
              </p>
              <p className="text-[11px] text-ambar-texto/90 dark:text-noche-ambar-texto/90">
                Sus cuentas siguen funcionando con normalidad; asígnales ayudantía cuando actualices
                su expediente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => abrirGrupo({ tipo: 'operativo_sin_ayudantia' })}
            className="btn min-h-8 border border-ambar bg-tarjeta px-3 text-xs font-bold text-ambar-texto hover:bg-superficie-suave dark:bg-noche-tarjeta dark:text-noche-ambar-texto"
          >
            <span>Revisar</span>
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </article>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {ETAPAS_FORMATIVAS.map((etapa) => {
          const lista = gruposPorEtapa[etapa]
          const totalEtapa = lista.reduce((acc, g) => acc + g.activos, 0)
          return (
            <article key={etapa} className="tarjeta flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
                <div>
                  <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
                    {etapa === 'SIERRA' ? 'SIERRA' : `Etapa ${etapa}`}
                  </h3>
                  <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                    {DESCRIPCION_ETAPA[etapa]}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-salvia px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-udec-oscuro dark:bg-noche-campo dark:text-activo-claro">
                  {totalEtapa}
                </span>
              </div>

              {lista.length === 0 ? (
                <p className="py-4 text-center text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Sin grupos activos en {etapa}.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lista.map((g) => (
                    <div
                      key={g.nombre}
                      className="flex items-center justify-between gap-2 rounded-lg border border-borde bg-superficie-suave px-3 py-2.5 dark:border-noche-borde dark:bg-noche-campo"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-tinta dark:text-noche-tinta">
                            {g.nombre}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              g.cerrado
                                ? 'bg-tarjeta text-tinta-suave dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                                : 'bg-activo-suave text-activo dark:bg-noche-tarjeta dark:text-activo-claro'
                            }`}
                          >
                            {g.cerrado ? 'Cerrado' : 'Activo'}
                          </span>
                        </div>
                        <p className="text-[11px] tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {g.activos} integrante{g.activos === 1 ? '' : 's'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            abrirGrupo({
                              tipo: 'formativo',
                              etapa,
                              nombre: g.nombre,
                              cerrado: g.cerrado,
                            })
                          }
                          className="btn-salvia min-h-8 px-2.5 text-[11px]"
                        >
                          <span>Ver integrantes</span>
                        </button>

                        {soyAdmin &&
                          (g.cerrado ? (
                            <button
                              type="button"
                              disabled={ocupadoCatalogo}
                              onClick={() => void manejarReabrirGrupo(g.nombre)}
                              title={`Reabrir ${g.nombre}`}
                              aria-label={`Reabrir ${g.nombre}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-borde bg-tarjeta text-tinta-suave hover:text-udec dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-activo-claro"
                            >
                              <RotateCcw size={13} strokeWidth={2} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={ocupadoCatalogo}
                              onClick={() => void manejarCerrarGrupo(g.nombre)}
                              title={`Cerrar ${g.nombre}`}
                              aria-label={`Cerrar ${g.nombre}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-borde bg-tarjeta text-tinta-suave hover:text-alerta dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-noche-rojo-texto"
                            >
                              <Archive size={13} strokeWidth={2} />
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )
        })}
      </div>

      <article className="tarjeta flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2.5 dark:border-noche-borde">
          <div>
            <h3 className="text-sm font-bold text-tinta dark:text-noche-tinta">
              {ayJefe
                ? `Grupo Operativo · Ayudantía ${ayJefe}`
                : 'Grupo Operativo · Distribución por Ayudantía'}
            </h3>
            <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
              {ayJefe
                ? `Personal en Grupo Operativo adscrito exclusivamente a ${ayJefe}.`
                : 'Todo integrante en Grupo Operativo pertenece obligatoriamente a una ayudantía.'}
            </p>
          </div>
          <span className="rounded-full bg-udec px-2.5 py-0.5 text-xs font-bold tabular-nums text-white">
            {ayJefe
              ? (conteoOperativoPorAyudantia.mapa.get(ayJefe) ?? 0)
              : Array.from(conteoOperativoPorAyudantia.mapa.values()).reduce((a, b) => a + b, 0) +
                conteoOperativoPorAyudantia.sinAyudantia}{' '}
            activos
          </span>
        </div>

        <div
          className={
            ayJefe
              ? 'grid grid-cols-1 gap-2 sm:max-w-sm'
              : 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5'
          }
        >
          {(ayJefe ? [ayJefe] : AYUDANTIAS_ACTIVAS).map((ay) => {
            const total = conteoOperativoPorAyudantia.mapa.get(ay) ?? 0
            return (
              <button
                key={ay}
                type="button"
                onClick={() => abrirGrupo({ tipo: 'operativo', ayudantia: ay })}
                className="flex cursor-pointer flex-col justify-between gap-2 rounded-lg border border-borde bg-superficie-suave p-3 text-left transition-colors hover:border-udec dark:border-noche-borde dark:bg-noche-campo dark:hover:border-activo-claro"
              >
                <span className="text-xs font-bold text-tinta dark:text-noche-tinta">{ay}</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-extrabold tabular-nums text-udec dark:text-activo-claro">
                    {total}
                  </span>
                  <span className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Ver integrantes →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </article>

      {soyAdmin && archivadosSinMiembros.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-borde bg-superficie-suave px-3.5 py-2.5 dark:border-noche-borde dark:bg-noche-campo">
          <span className="text-[11px] font-semibold text-tinta-suave dark:text-noche-tinta-suave">
            Grupos cerrados:
          </span>
          {archivadosSinMiembros.map((sg) => (
            <button
              key={sg}
              type="button"
              disabled={ocupadoCatalogo}
              onClick={() => void manejarReabrirGrupo(sg)}
              title={`Reabrir ${sg}`}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-borde-fuerte bg-tarjeta px-2.5 py-0.5 text-[11px] font-semibold text-tinta-suave hover:border-udec hover:text-udec dark:border-noche-borde dark:bg-noche-tarjeta dark:text-noche-tinta-suave dark:hover:text-activo-claro"
            >
              <RotateCcw size={11} strokeWidth={2} />
              <span>{sg}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
