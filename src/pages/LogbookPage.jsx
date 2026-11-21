import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LogOut,
  Search,
  X,
} from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ActivityBadge, StatusBadge } from '../components/ActivityBadge'
import { EmptyState, ErrorBanner, StatePreviewBar } from '../components/StateBanners'
import { LogbookSkeleton } from '../components/ViewSkeletons'
import { useApp } from '../context/AppContext'
import { STANDARD_ROLES } from '../data/mockData'

export function LogbookPage() {
  const { logbook, updateLogObservation, closeLogShift, viewMode, setViewMode } = useApp()

  const [query, setQuery] = useState('')
  const [filterOp, setFilterOp] = useState('')
  const [filterRol, setFilterRol] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [obsRowId, setObsRowId] = useState(null)
  const [obsDraft, setObsDraft] = useState('')
  const [exportFeedback, setExportFeedback] = useState('')

  const uniqueOperativos = useMemo(
    () => Array.from(new Set(logbook.map((row) => row.operativo))),
    [logbook]
  )

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logbook.filter((row) => {
      const matchQ =
        !q ||
        row.brigadista.toLowerCase().includes(q) ||
        row.fullName.toLowerCase().includes(q) ||
        row.matricula.includes(q) ||
        row.operativo.toLowerCase().includes(q)
      const matchOp = !filterOp || row.operativo === filterOp
      const matchRol = !filterRol || row.rol === filterRol
      const matchEst = !filterEstado || row.estado === filterEstado
      return matchQ && matchOp && matchRol && matchEst
    })
  }, [logbook, query, filterOp, filterRol, filterEstado])

  const activeObsRow = logbook.find((r) => r.id === obsRowId) || null

  const openObsModal = (row) => {
    setObsRowId(row.id)
    setObsDraft(row.observaciones || '')
  }

  const saveObs = () => {
    if (obsRowId) {
      updateLogObservation(obsRowId, obsDraft)
    }
    setObsRowId(null)
  }

  const handleExportCsv = () => {
    const headers = [
      'Brigadista',
      'Matricula UdeC',
      'Actividad',
      'Rol',
      'Hora Entrada',
      'Hora Salida',
      'Horas Totales',
      'Estado',
      'Equipo Asignado',
      'Observaciones',
    ]
    const csvRows = [headers.join(',')]
    filteredRows.forEach((row) => {
      const values = [
        row.fullName,
        row.matricula,
        row.operativo,
        row.rol,
        `${row.entrada} hrs`,
        row.salida === '—' ? '—' : `${row.salida} hrs`,
        row.horas,
        row.estado,
        row.equipo.join(' / '),
        row.observaciones,
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      csvRows.push(values.join(','))
    })

    // UTF-8 BOM para correcta apertura de acentos en Excel y Google Sheets
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Bitacora-BUPC-UdeC.csv'
    link.click()
    URL.revokeObjectURL(url)
    setExportFeedback(`Bitácora exportada (${filteredRows.length} registros en CSV).`)
  }

  const resetFilters = () => {
    setQuery('')
    setFilterOp('')
    setFilterRol('')
    setFilterEstado('')
  }

  return (
    <AppShell
      title="Bitácora y Asistencia en Tiempo Real"
      subtitle="Control administrativo de entradas, salidas, roles y horas por turno"
      mobileTitle="Bitácora BUPC"
      mobileSubtitle="Asistencia en tiempo real"
      headerRight={
        <span className="text-[12px] font-semibold text-[#284A19] bg-[#EAF2E4] border border-[#C8DDB9] px-3 py-1.5 rounded-lg tabular-nums">
          {viewMode === 'empty' ? 0 : filteredRows.length} registros
        </span>
      }
    >
      <StatePreviewBar />

      {viewMode === 'error' && (
        <ErrorBanner
          title="Error al consultar la bitácora"
          message="No se pudo conectar con la base de registros de asistencia. Reintenta para sincronizar."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {exportFeedback && (
        <div
          role="status"
          className="rounded-xl border border-[#059669] bg-[#ECFDF5] text-[#065F46] px-4 py-3 flex items-center justify-between gap-3 text-[13px] font-semibold"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} strokeWidth={2} className="text-[#059669] shrink-0" />
            <span>{exportFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportFeedback('')}
            aria-label="Cerrar notificación"
            className="p-1 rounded hover:bg-[#059669]/10"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      {viewMode === 'loading' ? (
        <LogbookSkeleton />
      ) : (
        <>
          {/* Barra superior de la bitácora: Filtros + botón Exportar siempre visible */}
          <section
            aria-label="Filtros y exportación de bitácora"
            className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-3 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[16px] font-bold text-[#111827]">
                  Registros de asistencia
                </h2>
                <p className="text-[12px] text-[#4B5563] tabular-nums">
                  Mostrando {viewMode === 'empty' ? 0 : filteredRows.length} de{' '}
                  {viewMode === 'empty' ? 0 : logbook.length} movimientos registrados
                </p>
              </div>

              {/* Botón Exportar siempre visible — único CTA naranja de la vista */}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={viewMode === 'empty' || filteredRows.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 min-h-12 rounded-lg bg-[#E65300] hover:bg-[#C94700] disabled:opacity-50 text-[#111827] text-[14px] font-bold transition-colors whitespace-nowrap shrink-0"
              >
                <Download size={18} strokeWidth={2} />
                <span>Exportar a Excel / CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2 relative">
                <Search
                  size={18}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar brigadista o matrícula..."
                  className="w-full pl-10 pr-3 min-h-12 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                />
              </div>

              <select
                aria-label="Filtrar por operativo"
                value={filterOp}
                onChange={(e) => setFilterOp(e.target.value)}
                className="min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28]"
              >
                <option value="">Todos los operativos</option>
                {uniqueOperativos.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por rol"
                value={filterRol}
                onChange={(e) => setFilterRol(e.target.value)}
                className="min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28]"
              >
                <option value="">Todos los roles</option>
                {STANDARD_ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por estado"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] focus:outline-none focus:border-[#3E6E28]"
              >
                <option value="">Todos los estados</option>
                <option value="En servicio">En servicio</option>
                <option value="Turno por cerrar">Turno por cerrar</option>
                <option value="Turno finalizado">Turno finalizado</option>
              </select>
            </div>
          </section>

          {/* Tabla de bitácora */}
          {viewMode === 'empty' || filteredRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin registros en bitácora"
              description={
                viewMode === 'empty'
                  ? 'Todavía no se han escaneado entradas o salidas en los operativos del día.'
                  : 'Ningún brigadista coincide con los filtros aplicados.'
              }
              actionLabel={viewMode === 'empty' ? 'Cargar datos de prueba' : 'Limpiar filtros'}
              onAction={() => (viewMode === 'empty' ? setViewMode('normal') : resetFilters())}
            />
          ) : (
            <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <tr>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Brigadista
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Matrícula UdeC
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Actividad
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Rol
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Entrada
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Salida
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Horas
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] whitespace-nowrap">
                        Estado
                      </th>
                      <th scope="col" className="px-3.5 py-3 text-[12px] font-semibold text-[#4B5563] text-right whitespace-nowrap">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-3.5 py-3 text-[14px] font-semibold text-[#111827] whitespace-nowrap">
                          {row.brigadista}
                        </td>
                        <td className="px-3.5 py-3 text-[13px] font-semibold text-[#4B5563] tabular-nums whitespace-nowrap">
                          {row.matricula}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] text-[#111827]">{row.operativoShort}</span>
                            <ActivityBadge category={row.category} />
                          </div>
                        </td>
                        <td className="px-3.5 py-3 text-[14px] text-[#111827] whitespace-nowrap">
                          {row.rol}
                        </td>
                        <td className="px-3.5 py-3 text-[14px] text-[#111827] tabular-nums whitespace-nowrap">
                          {row.entrada} hrs
                        </td>
                        <td className="px-3.5 py-3 text-[14px] text-[#4B5563] tabular-nums whitespace-nowrap">
                          {row.salida === '—' ? '—' : `${row.salida} hrs`}
                        </td>
                        <td className="px-3.5 py-3 text-[13px] font-semibold text-[#111827] tabular-nums whitespace-nowrap">
                          {row.horas}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <StatusBadge status={row.estado} />
                        </td>
                        <td className="px-3.5 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {row.estado !== 'Turno finalizado' && (
                              <button
                                type="button"
                                onClick={() => closeLogShift(row.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EAF2E4] hover:bg-[#dcead2] border border-[#C8DDB9] text-[#284A19] text-[12px] font-semibold"
                              >
                                <LogOut size={14} strokeWidth={2} />
                                <span>Registrar salida</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openObsModal(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#4B5563] text-[12px] font-semibold"
                              aria-label={`Ver observaciones de ${row.brigadista}`}
                            >
                              <FileText size={14} strokeWidth={2} />
                              <span>Obs.</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* Modal de Observaciones */}
      {activeObsRow && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="obsModalTitle"
        >
          <div className="bg-[#FFFFFF] text-[#111827] rounded-xl p-5 sm:p-6 max-w-md w-full border border-[#E2E8F0] flex flex-col gap-4">
            <header className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 id="obsModalTitle" className="text-[16px] font-bold text-[#111827]">
                  Observaciones de turno
                </h2>
                <p className="text-[13px] text-[#4B5563]">
                  {activeObsRow.fullName} ·{' '}
                  <span className="tabular-nums">{activeObsRow.matricula}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setObsRowId(null)}
                aria-label="Cerrar diálogo"
                className="w-9 h-9 rounded-lg border border-[#E2E8F0] text-[#4B5563] flex items-center justify-center hover:bg-[#F8FAFC]"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="obsTextarea" className="text-[12px] font-semibold text-[#4B5563]">
                Notas e incidencias del turno
              </label>
              <textarea
                id="obsTextarea"
                rows={4}
                value={obsDraft}
                onChange={(e) => setObsDraft(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] p-3 focus:outline-none focus:border-[#3E6E28]"
              />
            </div>

            <footer className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setObsRowId(null)}
                className="px-4 min-h-11 rounded-lg border border-[#E2E8F0] text-[#4B5563] text-[13px] font-semibold hover:bg-[#F8FAFC]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveObs}
                className="px-4 min-h-11 rounded-lg bg-[#3E6E28] hover:bg-[#2D521D] text-[#FFFFFF] text-[13px] font-semibold"
              >
                Guardar observación
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  )
}
