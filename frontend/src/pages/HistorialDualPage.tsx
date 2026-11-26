import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  History,
  Lock,
  Radio,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { CATEGORIAS_OPERATIVO } from '../constants/catalogos'
import { IndicadorAlcanceAyudantia } from '../components/IndicadorAlcanceAyudantia'
import { ayudantiaJefatura, puedeUsarRadio } from '../lib/permisos'
import {
  escucharMisAsistencias,
  LIMITE_MIS_ASISTENCIAS,
  obtenerMasMisAsistencias,
} from '../services/asistenciasService'
import { mensajeDeError } from '../services/authService'
import {
  obtenerOperativoPorId,
  obtenerOperativosPaginados,
  type PaginaOperativos,
} from '../services/operativosService'
import {
  escucharCanalesOperativo,
  escucharRegistrosCanal,
  exportarBitacoraCsvLocal,
  LIMITE_REGISTROS_RADIO,
  obtenerRegistrosCanalAnteriores,
} from '../services/radioService'
import {
  calcularDesgloseHoras,
  exportarExpedienteExcel,
  exportarExpedientePdf,
  generarConstanciaHorasPdf,
  obtenerDatosExpedienteOperativo,
} from '../services/reportesService'
import type {
  AsistenciaPersonal,
  CanalRadio,
  CategoriaOperativo,
  Operativo,
  RegistroBitacoraRadio,
  Usuario,
} from '../types'

interface HistorialDualPageProps {
  usuario: Usuario
  pestanaInicial?: 'personal' | 'archivo'
}

function formatearFechaCorta(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function BitacoraRadioArchivoModal({
  operativo,
  alCerrar,
}: {
  operativo: Operativo
  alCerrar: () => void
}) {
  const [canales, setCanales] = useState<CanalRadio[]>([])
  const [cargandoCanales, setCargandoCanales] = useState(true)
  const [canalIdSel, setCanalIdSel] = useState<string>('')
  const [registrosPorCanal, setRegistrosPorCanal] = useState<{
    canalId: string
    lista: RegistroBitacoraRadio[]
    anteriores: RegistroBitacoraRadio[]
    hayMas: boolean
  } | null>(null)
  const [cargandoMasRadio, setCargandoMasRadio] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cancelar = escucharCanalesOperativo(
      operativo.id,
      (lista) => {
        setCanales(lista)
        setCargandoCanales(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargandoCanales(false)
      },
    )
    return cancelar
  }, [operativo.id])

  const canalActivo = canales.find((c) => c.id === canalIdSel) ?? canales[0] ?? null
  const canalActivoId = canalActivo?.id ?? null

  useEffect(() => {
    if (!canalActivoId) return
    const cancelar = escucharRegistrosCanal(
      canalActivoId,
      (lista) =>
        setRegistrosPorCanal((prev) => ({
          canalId: canalActivoId,
          lista,
          anteriores: prev?.canalId === canalActivoId ? prev.anteriores : [],
          hayMas:
            prev?.canalId === canalActivoId && prev.anteriores.length > 0
              ? prev.hayMas
              : lista.length >= LIMITE_REGISTROS_RADIO,
        })),
      (err) => setError(mensajeDeError(err)),
      LIMITE_REGISTROS_RADIO,
    )
    return cancelar
  }, [canalActivoId])

  const registros = (() => {
    if (registrosPorCanal?.canalId !== canalActivoId) return []
    const mapa = new Map<string, RegistroBitacoraRadio>()
    for (const r of registrosPorCanal.lista) mapa.set(r.id, r)
    for (const r of registrosPorCanal.anteriores) {
      if (!mapa.has(r.id)) mapa.set(r.id, r)
    }
    return Array.from(mapa.values()).sort(
      (a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0),
    )
  })()
  const hayMasRadio =
    registrosPorCanal?.canalId === canalActivoId ? registrosPorCanal.hayMas : false

  async function cargarMasRadioArchivo() {
    if (!canalActivoId || cargandoMasRadio) return
    const ultimo = registros[registros.length - 1]
    if (!ultimo?.creado_en) return
    setCargandoMasRadio(true)
    setError(null)
    try {
      const res = await obtenerRegistrosCanalAnteriores(
        canalActivoId,
        ultimo.creado_en,
        LIMITE_REGISTROS_RADIO,
      )
      setRegistrosPorCanal((prev) =>
        prev?.canalId === canalActivoId
          ? {
              ...prev,
              anteriores: [...prev.anteriores, ...res.registros],
              hayMas: res.hayMas,
            }
          : prev,
      )
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoMasRadio(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bitácora de radio de ${operativo.nombre}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
    >
      <article className="tarjeta flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl sm:h-[85dvh] sm:rounded-xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-3 border-naranja bg-udec px-4 py-3.5 text-white">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold">
                Bitácora de Radio · {operativo.nombre}
              </h3>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                <Lock size={11} strokeWidth={2} />
                <span>Solo lectura</span>
              </span>
            </div>
            <p className="truncate text-xs text-white/85">
              {operativo.sede} · {operativo.fecha_inicio.replace('T', ' ')}
            </p>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar bitácora de radio"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        {/* Barra de canales (sin + Canal ni + Unidad) + Exportar CSV */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-borde bg-superficie-suave px-4 py-2.5 dark:border-noche-borde dark:bg-noche-campo">
          <div className="flex flex-wrap items-center gap-1.5">
            {canales.length === 0 && !cargandoCanales ? (
              <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                Sin canales de radio registrados
              </span>
            ) : (
              canales.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCanalIdSel(c.id)}
                  className={`min-h-8 cursor-pointer rounded-md px-3 text-xs font-bold transition-colors ${
                    canalActivo?.id === c.id
                      ? 'bg-udec text-white'
                      : 'bg-salvia text-udec-oscuro hover:bg-salvia-hover dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
                  }`}
                >
                  {c.nombre_canal}
                  {c.frecuencia_etiqueta ? ` · ${c.frecuencia_etiqueta}` : ''}
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            disabled={!canalActivo || registros.length === 0}
            onClick={() => {
              if (canalActivo) {
                exportarBitacoraCsvLocal(operativo.nombre, canalActivo.nombre_canal, registros)
              }
            }}
            className="btn-salvia min-h-9 px-3 text-xs"
          >
            <Download size={14} strokeWidth={2} />
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* Unidades participantes en solo lectura */}
        {canalActivo && canalActivo.unidades_participantes.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-borde px-4 py-2 text-[11px] dark:border-noche-borde">
            <span className="font-bold text-tinta-suave dark:text-noche-tinta-suave">Unidades:</span>
            {canalActivo.unidades_participantes.map((u) => (
              <span
                key={u}
                className="rounded bg-superficie-suave px-2 py-0.5 font-semibold text-tinta dark:bg-noche-campo dark:text-noche-tinta"
              >
                {u}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-alerta bg-alerta-suave p-2.5 text-xs font-semibold text-red-900 dark:bg-noche-rojo-suave dark:text-noche-rojo-texto"
          >
            <AlertCircle size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {cargandoCanales ? (
            <div className="flex flex-col gap-2 p-4">
              <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
              <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
            </div>
          ) : !canalActivo ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Radio size={30} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
              <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                Este operativo no tiene canales de radio registrados
              </p>
            </div>
          ) : registros.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Clock size={28} strokeWidth={2} className="text-tinta-suave dark:text-noche-tinta-suave" />
              <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                Sin transmisiones registradas en {canalActivo.nombre_canal}
              </p>
            </div>
          ) : (
            <>
              {/* Móvil: filas compactas de solo lectura */}
              <div className="flex min-h-0 flex-1 flex-col divide-y divide-borde overflow-y-auto md:hidden dark:divide-noche-borde">
                {registros.map((r) => (
                  <div key={r.id} className="flex flex-col gap-0.5 px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                        {r.hora_original}
                      </span>
                      <span className="font-bold text-udec dark:text-activo-claro">{r.origen}</span>
                      <span className="text-tinta-suave">→</span>
                      <span className="font-semibold text-tinta dark:text-noche-tinta">
                        {r.destinos.join(', ')}
                      </span>
                      {r.fue_editado && (
                        <span className="rounded bg-ambar-suave px-1 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto">
                          Editado
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] leading-snug font-medium text-tinta dark:text-noche-tinta">
                      {r.actividades}
                    </p>
                    {r.fue_editado && r.actividad_original_respaldo && (
                      <p className="text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                        Original: &ldquo;{r.actividad_original_respaldo}&rdquo;
                      </p>
                    )}
                    <p className="text-[10px] text-tinta-suave dark:text-noche-tinta-suave">
                      Registrado por: {r.registrado_por}
                    </p>
                  </div>
                ))}
              </div>

              {/* Escritorio: tabla de solo lectura sin columna de edición */}
              <div className="hidden min-h-0 flex-1 overflow-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-udec-oscuro text-white">
                    <tr>
                      <th scope="col" className="w-28 px-3 py-2 text-[11px] font-semibold">
                        Hora
                      </th>
                      <th scope="col" className="w-28 px-3 py-2 text-[11px] font-semibold">
                        ORIGEN
                      </th>
                      <th scope="col" className="w-36 px-3 py-2 text-[11px] font-semibold">
                        DESTINO
                      </th>
                      <th scope="col" className="px-3 py-2 text-[11px] font-semibold">
                        Actividades
                      </th>
                      <th scope="col" className="w-36 px-3 py-2 text-[11px] font-semibold">
                        Registrado por
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde dark:divide-noche-borde">
                    {registros.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-xs font-bold tabular-nums text-tinta dark:text-noche-tinta">
                              {r.hora_original}
                            </span>
                            {r.fue_editado && (
                              <span
                                title={`Original: ${r.actividad_original_respaldo ?? ''} · Editado por ${r.editado_por ?? ''}`}
                                className="rounded bg-ambar-suave px-1 py-0.5 text-[10px] font-bold text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto"
                              >
                                Editado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-tinta dark:text-noche-tinta">
                          {r.origen}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-tinta dark:text-noche-tinta">
                          {r.destinos.join(', ')}
                        </td>
                        <td className="px-3 py-2 text-[13px] leading-snug text-tinta dark:text-noche-tinta">
                          <p className="font-medium">{r.actividades}</p>
                          {r.fue_editado && r.actividad_original_respaldo && (
                            <p className="mt-0.5 text-[11px] text-tinta-suave dark:text-noche-tinta-suave">
                              Original: &ldquo;{r.actividad_original_respaldo}&rdquo;
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                          {r.registrado_por}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hayMasRadio && (
                <div className="flex shrink-0 justify-center border-t border-borde bg-superficie-suave px-3 py-2 dark:border-noche-borde dark:bg-noche-campo">
                  <button
                    type="button"
                    disabled={cargandoMasRadio}
                    onClick={() => void cargarMasRadioArchivo()}
                    className="btn-salvia min-h-8 px-3.5 text-xs"
                  >
                    {cargandoMasRadio ? 'Cargando...' : 'Cargar mensajes anteriores'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  )
}

export function HistorialDualPage({
  usuario,
  pestanaInicial = 'personal',
}: HistorialDualPageProps) {
  const esGestor =
    usuario.rol_sistema === 'Encargado' || usuario.rol_sistema === 'Administrador'
  const ayJefe = ayudantiaJefatura(usuario)
  const puedoVerRadio = puedeUsarRadio(usuario)

  const [pestana, setPestana] = useState<'personal' | 'archivo'>(
    pestanaInicial === 'archivo' && esGestor ? 'archivo' : 'personal',
  )
  const [asistenciasVivo, setAsistenciasVivo] = useState<AsistenciaPersonal[]>([])
  const [asistenciasExtra, setAsistenciasExtra] = useState<AsistenciaPersonal[]>([])
  const [hayMasAsis, setHayMasAsis] = useState(false)
  const [cargandoMasAsis, setCargandoMasAsis] = useState(false)

  // Archivo Operativo Global: paginado con getDocs (20 por página) en lugar de listener global
  const [operativos, setOperativos] = useState<Operativo[]>([])
  const [cursorOps, setCursorOps] = useState<PaginaOperativos['ultimoDoc']>(null)
  const [hayMasOps, setHayMasOps] = useState(false)
  const [cargandoOps, setCargandoOps] = useState(false)
  const [operativosExtra, setOperativosExtra] = useState<Record<string, Operativo>>({})
  const [cargando, setCargando] = useState(true)

  // Filtros del Archivo Operativo Global
  const [filtroCategoria, setFiltroCategoria] = useState<'Todas' | CategoriaOperativo>('Todas')
  const [filtroEstatus, setFiltroEstatus] = useState<'Todos' | 'Abierta' | 'Cerrada' | 'Finalizado'>(
    'Todos',
  )
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [operativoRadioArchivo, setOperativoRadioArchivo] = useState<Operativo | null>(null)

  const [exportandoId, setExportandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const cancelarAsis = escucharMisAsistencias(
      usuario.uid,
      (lista) => {
        setAsistenciasVivo(lista)
        setHayMasAsis(lista.length >= LIMITE_MIS_ASISTENCIAS)
        setCargando(false)
      },
      (err) => {
        setError(mensajeDeError(err))
        setCargando(false)
      },
      LIMITE_MIS_ASISTENCIAS,
    )
    return cancelarAsis
  }, [usuario.uid])

  // Cargar primera página de operativos (20) mediante getDocs al montar
  useEffect(() => {
    let activo = true
    void obtenerOperativosPaginados(20, null)
      .then((pagina) => {
        if (!activo) return
        setOperativos(pagina.operativos)
        setCursorOps(pagina.ultimoDoc)
        setHayMasOps(pagina.hayMas)
      })
      .catch((err) => {
        if (activo) setError(mensajeDeError(err))
      })
    return () => {
      activo = false
    }
  }, [])

  const misAsistencias = (() => {
    const mapa = new Map<string, AsistenciaPersonal>()
    for (const a of asistenciasVivo) mapa.set(a.id, a)
    for (const a of asistenciasExtra) {
      if (!mapa.has(a.id)) mapa.set(a.id, a)
    }
    return Array.from(mapa.values()).sort(
      (a, b) => (b.hora_entrada?.toMillis() ?? 0) - (a.hora_entrada?.toMillis() ?? 0),
    )
  })()

  // Resolver metadatos (categoría) puntualmente solo si alguna asistencia personal apunta a un
  // operativo fuera de las páginas cargadas
  useEffect(() => {
    const presentes = new Set([...operativos.map((o) => o.id), ...Object.keys(operativosExtra)])
    const faltantes = Array.from(
      new Set(misAsistencias.map((a) => a.operativo_id).filter((id) => id && !presentes.has(id))),
    )
    if (faltantes.length === 0) return
    let activo = true
    void Promise.all(
      faltantes.map(async (id) => {
        const op = await obtenerOperativoPorId(id).catch(() => null)
        return [id, op] as const
      }),
    ).then((pares) => {
      if (!activo) return
      setOperativosExtra((prev) => {
        const copia = { ...prev }
        for (const [id, op] of pares) {
          if (op) copia[id] = op
        }
        return copia
      })
    })
    return () => {
      activo = false
    }
  }, [misAsistencias, operativos, operativosExtra])

  const mapaOperativos = new Map<string, Operativo>([
    ...operativos.map((o) => [o.id, o] as const),
    ...Object.entries(operativosExtra),
  ])
  const asistenciasCerradas = misAsistencias.filter((a) => a.hora_salida !== null)
  const { totalHoras, desglose } = calcularDesgloseHoras(asistenciasCerradas, mapaOperativos)

  async function cargarMasOperativos() {
    if (!hayMasOps || cargandoOps || !cursorOps) return
    setCargandoOps(true)
    setError(null)
    try {
      const pagina = await obtenerOperativosPaginados(20, cursorOps)
      setOperativos((prev) => {
        const mapa = new Map(prev.map((o) => [o.id, o]))
        for (const o of pagina.operativos) mapa.set(o.id, o)
        return Array.from(mapa.values())
      })
      setCursorOps(pagina.ultimoDoc)
      setHayMasOps(pagina.hayMas)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoOps(false)
    }
  }

  async function cargarMasMisAsistencias() {
    const ultima = misAsistencias[misAsistencias.length - 1]
    if (!ultima?.hora_entrada || cargandoMasAsis) return
    setCargandoMasAsis(true)
    setError(null)
    try {
      const res = await obtenerMasMisAsistencias(
        usuario.uid,
        ultima.hora_entrada,
        LIMITE_MIS_ASISTENCIAS,
      )
      setAsistenciasExtra((prev) => [...prev, ...res.asistencias])
      setHayMasAsis(res.hayMas)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargandoMasAsis(false)
    }
  }

  const operativosFiltrados = operativos.filter((op) => {
    const cerrado = op.estatus === 'Finalizado' || op.estatus === 'Cancelado'
    if (filtroCategoria !== 'Todas' && op.categoria !== filtroCategoria) return false
    if (filtroEstatus === 'Finalizado' && !cerrado) return false
    if (filtroEstatus === 'Abierta' && (cerrado || !op.recepcion_abierta)) {
      return false
    }
    if (filtroEstatus === 'Cerrada' && (cerrado || op.recepcion_abierta)) {
      return false
    }
    const fechaOp = op.fecha_inicio.slice(0, 10)
    if (fechaDesde && fechaOp < fechaDesde) return false
    if (fechaHasta && fechaOp > fechaHasta) return false
    return true
  })

  async function manejarConstanciaPdf() {
    setExportandoId('constancia')
    setError(null)
    setAviso(null)
    try {
      await generarConstanciaHorasPdf(usuario, asistenciasCerradas, mapaOperativos)
      setAviso('Constancia de Horas en PDF descargada correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setExportandoId(null)
    }
  }

  async function manejarExportarOperativo(op: Operativo, formato: 'excel' | 'pdf') {
    setExportandoId(`${op.id}-${formato}`)
    setError(null)
    setAviso(null)
    try {
      const datos = await obtenerDatosExpedienteOperativo(op.id, ayJefe, {
        incluirRadio: puedoVerRadio,
        fechaDesde,
        fechaHasta,
      })
      if (formato === 'excel') {
        exportarExpedienteExcel(op, datos)
        setAviso(`Archivo Excel (.xlsx) generado para "${op.nombre}".`)
      } else {
        await exportarExpedientePdf(op, datos)
        setAviso(`Expediente Operativo en PDF generado para "${op.nombre}".`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeDeError(err))
    } finally {
      setExportandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera y selector de pestañas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-tinta dark:text-noche-tinta">
            Historial y Reportes
          </h2>
          <p className="mt-0.5 text-sm text-tinta-suave dark:text-noche-tinta-suave">
            Constancia personal de horas y archivo operativo exportable a Excel y PDF.
          </p>
        </div>

        <div className="inline-flex flex-wrap gap-1.5 rounded-lg border border-borde bg-superficie-suave p-1 dark:border-noche-borde dark:bg-noche-campo">
          <button
            type="button"
            onClick={() => setPestana('personal')}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
              pestana === 'personal'
                ? 'bg-udec text-white'
                : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
            }`}
          >
            <History size={15} strokeWidth={2} />
            <span>Mi Historial</span>
          </button>

          {esGestor && (
            <button
              type="button"
              onClick={() => setPestana('archivo')}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
                pestana === 'archivo'
                  ? 'bg-udec text-white'
                  : 'bg-salvia text-udec-oscuro dark:bg-noche-tarjeta dark:text-noche-tinta-suave'
              }`}
            >
              <FolderArchive size={15} strokeWidth={2} />
              <span>Archivo Operativo Global ({operativos.length})</span>
            </button>
          )}
        </div>
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

      {/* PESTAÑA 1: MI HISTORIAL */}
      {pestana === 'personal' && (
        <section className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Total acumulado + CTA Descargar Constancia PDF */}
            <article className="tarjeta flex flex-col justify-between gap-4 p-5 lg:col-span-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                    Horas acumuladas verificadas
                  </span>
                  <p className="mt-1 text-4xl font-extrabold tabular-nums text-udec dark:text-activo-claro">
                    {totalHoras.toFixed(2)}{' '}
                    <span className="text-base font-bold text-tinta-suave dark:text-noche-tinta-suave">
                      hrs
                    </span>
                  </p>
                </div>
                <Clock size={26} strokeWidth={2} className="text-udec dark:text-activo-claro" />
              </div>

              <p className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                Basado en <strong className="tabular-nums">{asistenciasCerradas.length}</strong>{' '}
                {asistenciasCerradas.length === 1 ? 'turno cerrado' : 'turnos cerrados'} con salida
                validada.
              </p>

              <button
                type="button"
                disabled={exportandoId === 'constancia'}
                onClick={() => void manejarConstanciaPdf()}
                className="btn-naranja w-full"
              >
                <FileDown size={18} strokeWidth={2} />
                <span>
                  {exportandoId === 'constancia'
                    ? 'Generando PDF...'
                    : 'Descargar Constancia PDF'}
                </span>
              </button>
            </article>

            {/* Desglose con barras de progreso en Verde UdeC / Naranja por categoría */}
            <article className="tarjeta flex flex-col gap-3 p-5 lg:col-span-8">
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Desglose por Categoría Institucional
              </h3>

              <div className="flex flex-col gap-3">
                {desglose.map((item, idx) => {
                  const pct = totalHoras > 0 ? Math.round((item.horas / totalHoras) * 100) : 0
                  const barraColor = idx % 2 === 0 ? 'bg-udec dark:bg-activo-claro' : 'bg-naranja'
                  return (
                    <div key={item.categoria} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-tinta dark:text-noche-tinta">
                          {item.categoria}
                        </span>
                        <span className="font-bold tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {item.horas.toFixed(2)} hrs · {item.turnos}{' '}
                          {item.turnos === 1 ? 'turno' : 'turnos'} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-esqueleto dark:bg-noche-campo">
                        <div
                          className={`h-full rounded-full ${barraColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          </div>

          {/* Tabla cronológica personal */}
          <article className="tarjeta overflow-hidden">
            <div className="border-b border-borde px-4 py-3 dark:border-noche-borde">
              <h3 className="text-base font-bold text-tinta dark:text-noche-tinta">
                Historial Cronológico de Asistencias Cerradas
              </h3>
            </div>

            {cargando ? (
              <div className="flex flex-col gap-2 p-4">
                <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
                <div className="h-10 animate-pulse rounded bg-esqueleto dark:bg-noche-borde" />
              </div>
            ) : asistenciasCerradas.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                  Aún no tienes asistencias cerradas
                </p>
                <p className="mt-1 text-xs text-tinta-suave dark:text-noche-tinta-suave">
                  Cuando completes un turno registrando tu salida, tus horas aparecerán aquí
                  automáticamente.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-udec-oscuro text-white">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Operativo / Actividad
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Categoría
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Rol en Turno
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Entrada
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Salida
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Horas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde dark:divide-noche-borde">
                    {asistenciasCerradas.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 text-sm font-bold text-tinta dark:text-noche-tinta">
                          {a.operativo_nombre}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-tinta-suave dark:text-noche-tinta-suave">
                          {mapaOperativos.get(a.operativo_id)?.categoria ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-tinta dark:text-noche-tinta">
                          {a.rol_en_turno}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {formatearFechaCorta(a.hora_entrada?.toMillis())}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                          {formatearFechaCorta(a.hora_salida?.toMillis())}
                        </td>
                        <td className="px-4 py-3 text-sm font-extrabold tabular-nums text-udec dark:text-activo-claro">
                          {(a.horas_totales ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hayMasAsis && (
              <div className="flex justify-center border-t border-borde bg-superficie-suave px-4 py-2.5 dark:border-noche-borde dark:bg-noche-campo">
                <button
                  type="button"
                  disabled={cargandoMasAsis}
                  onClick={() => void cargarMasMisAsistencias()}
                  className="btn-salvia min-h-9 px-4 text-xs"
                >
                  {cargandoMasAsis ? 'Cargando...' : 'Cargar más asistencias'}
                </button>
              </div>
            )}
          </article>
        </section>
      )}

      {/* PESTAÑA 2: ARCHIVO OPERATIVO GLOBAL (Encargado / Administrador) */}
      {pestana === 'archivo' && esGestor && (
        <section className="flex flex-col gap-4">
          {ayJefe && (
            <IndicadorAlcanceAyudantia
              ayudantia={ayJefe}
              descripcion={`Las exportaciones Excel y PDF del archivo operativo incluyen exclusivamente a integrantes de ${ayJefe}.`}
            />
          )}
          {/* Filtros */}
          <article className="tarjeta grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="arch-cat" className="etiqueta">
                Categoría
              </label>
              <select
                id="arch-cat"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value as 'Todas' | CategoriaOperativo)}
                className="campo min-h-10 text-xs"
              >
                <option value="Todas">Todas las categorías</option>
                {CATEGORIAS_OPERATIVO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="arch-est" className="etiqueta">
                Estatus
              </label>
              <select
                id="arch-est"
                value={filtroEstatus}
                onChange={(e) =>
                  setFiltroEstatus(
                    e.target.value as 'Todos' | 'Abierta' | 'Cerrada' | 'Finalizado',
                  )
                }
                className="campo min-h-10 text-xs"
              >
                <option value="Todos">Todos</option>
                <option value="Abierta">Recepción abierta</option>
                <option value="Cerrada">Recepción cerrada</option>
                <option value="Finalizado">Finalizados</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="arch-desde" className="etiqueta">
                Desde
              </label>
              <input
                id="arch-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="campo min-h-10 text-xs tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="arch-hasta" className="etiqueta">
                Hasta
              </label>
              <input
                id="arch-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="campo min-h-10 text-xs tabular-nums"
              />
            </div>
          </article>

          {/* Tabla de Archivo Operativo */}
          <article className="tarjeta overflow-hidden">
            {operativosFiltrados.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-tinta dark:text-noche-tinta">
                  Sin operativos que coincidan con los filtros
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-udec-oscuro text-white">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Operativo / Sede
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Categoría
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Fecha Inicio
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Estatus
                      </th>
                      <th scope="col" className="px-4 py-3 text-xs font-semibold">
                        Consulta y exportación
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde dark:divide-noche-borde">
                    {operativosFiltrados.map((op) => {
                      const finalizado = op.estatus === 'Finalizado' || op.estatus === 'Cancelado'
                      return (
                        <tr key={op.id}>
                          <td className="px-4 py-3">
                            <span className="block text-sm font-bold text-tinta dark:text-noche-tinta">
                              {op.nombre}
                            </span>
                            <span className="text-xs text-tinta-suave dark:text-noche-tinta-suave">
                              {op.sede}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-tinta dark:text-noche-tinta">
                            {op.categoria}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-tinta-suave dark:text-noche-tinta-suave">
                            {op.fecha_inicio.replace('T', ' ')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                finalizado
                                  ? 'bg-superficie-suave text-tinta-suave dark:bg-noche-campo dark:text-noche-tinta-suave'
                                  : op.recepcion_abierta
                                    ? 'bg-activo-suave text-activo dark:bg-noche-campo dark:text-activo-claro'
                                    : 'bg-ambar-suave text-ambar-texto dark:bg-noche-ambar dark:text-noche-ambar-texto'
                              }`}
                            >
                              {finalizado && <Lock size={11} strokeWidth={2} />}
                              <span>
                                {op.estatus === 'Cancelado'
                                  ? 'Cancelado'
                                  : op.estatus === 'Finalizado'
                                    ? 'Finalizado'
                                    : op.recepcion_abierta
                                      ? 'Abierta'
                                      : 'Cerrada'}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {puedoVerRadio && (
                                <button
                                  type="button"
                                  onClick={() => setOperativoRadioArchivo(op)}
                                  className="btn-salvia min-h-9 px-3 text-xs"
                                >
                                  <Radio size={15} strokeWidth={2} />
                                  <span>Bitácora Radio</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={exportandoId === `${op.id}-excel`}
                                onClick={() => void manejarExportarOperativo(op, 'excel')}
                                className="btn-salvia min-h-9 px-3 text-xs"
                              >
                                <FileSpreadsheet size={15} strokeWidth={2} />
                                <span>
                                  {exportandoId === `${op.id}-excel` ? 'Generando...' : 'Excel'}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={exportandoId === `${op.id}-pdf`}
                                onClick={() => void manejarExportarOperativo(op, 'pdf')}
                                className="btn-verde min-h-9 px-3 text-xs"
                              >
                                <FileText size={15} strokeWidth={2} />
                                <span>
                                  {exportandoId === `${op.id}-pdf` ? 'Generando...' : 'PDF'}
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {hayMasOps && (
              <div className="flex justify-center border-t border-borde bg-superficie-suave px-4 py-2.5 dark:border-noche-borde dark:bg-noche-campo">
                <button
                  type="button"
                  disabled={cargandoOps}
                  onClick={() => void cargarMasOperativos()}
                  className="btn-salvia min-h-9 px-4 text-xs"
                >
                  {cargandoOps ? 'Cargando...' : 'Cargar más operativos'}
                </button>
              </div>
            )}
          </article>
        </section>
      )}

      {operativoRadioArchivo && (
        <BitacoraRadioArchivoModal
          operativo={operativoRadioArchivo}
          alCerrar={() => setOperativoRadioArchivo(null)}
        />
      )}
    </div>
  )
}
