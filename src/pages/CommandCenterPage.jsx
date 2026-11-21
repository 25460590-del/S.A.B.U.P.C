import { useRef, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Download,
  Megaphone,
  Plus,
  QrCode,
  Shield,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ActivityBadge, StatusBadge } from '../components/ActivityBadge'
import { QrCodeSvg, downloadQrAsPng } from '../components/QrCodeSvg'
import { EmptyState, ErrorBanner, StatePreviewBar } from '../components/StateBanners'
import { CommandCenterSkeleton } from '../components/ViewSkeletons'
import { useApp } from '../context/AppContext'

const CATEGORY_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'masivo', label: 'Operativos Masivos' },
  { id: 'proyecto', label: 'Proyectos y Soporte' },
  { id: 'guardia', label: 'Guardias Ordinarias' },
  { id: 'capacitacion', label: 'Capacitaciones y Simulacros' },
]

const CATEGORY_LABELS = {
  masivo: 'Operativo Masivo',
  proyecto: 'Proyecto / Soporte Técnico',
  guardia: 'Guardia Ordinaria',
  capacitacion: 'Capacitación / Simulacro',
}

export function CommandCenterPage() {
  const {
    operativos,
    logbook,
    addOperativo,
    updateOperativoQr,
    roleType,
    viewMode,
    setViewMode,
  } = useApp()

  const [filter, setFilter] = useState('all')
  const [selectedOpId, setSelectedOpId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [downloadMsg, setDownloadMsg] = useState('')
  const [newOpForm, setNewOpForm] = useState({
    name: '',
    category: 'masivo',
    location: '',
    detail: '',
  })
  const eventQrRef = useRef(null)

  const selectedOp = operativos.find((o) => o.id === selectedOpId) || null
  const activeOpsCount = operativos.filter((o) => o.qrEnabled).length
  const activeBrigadistas = logbook.filter((l) => l.estado !== 'Turno finalizado').length + 20

  const filteredOperativos =
    filter === 'all' ? operativos : operativos.filter((op) => op.category === filter)

  const handleOpenQrModal = (opId) => {
    setSelectedOpId(opId)
    setDownloadMsg('')
  }

  const handleDownloadEventQr = () => {
    if (!selectedOp) return
    const mode = selectedOp.qrMode || 'ENTRADA'
    downloadQrAsPng(eventQrRef.current, `QR-${selectedOp.id}-${mode}.png`, {
      title: selectedOp.name,
      code: `${selectedOp.id} · ${mode}`,
      subtitle: selectedOp.location,
    })
    setDownloadMsg(`QR ${selectedOp.id} (${mode}) descargado en PNG.`)
  }

  const handleCreateOperativo = (e) => {
    e.preventDefault()
    if (!newOpForm.name.trim() || !newOpForm.location.trim()) return
    const prefix = { masivo: 'OP', proyecto: 'PR', guardia: 'GD', capacitacion: 'CP' }[
      newOpForm.category
    ]
    const code = `${prefix}-2026-${String(Math.floor(100 + Math.random() * 899))}`
    addOperativo({
      id: code,
      name: newOpForm.name.trim(),
      category: newOpForm.category,
      categoryLabel: CATEGORY_LABELS[newOpForm.category],
      location: newOpForm.location.trim(),
      detail: newOpForm.detail.trim() || 'Registro QR habilitado',
      brigadistasCount: 0,
      status: 'QR Activo',
      qrEnabled: true,
      qrMode: 'ENTRADA',
    })
    setNewOpForm({ name: '', category: 'masivo', location: '', detail: '' })
    setCreateOpen(false)
    setViewMode('normal')
  }

  return (
    <AppShell
      title="Panel de Control de Guardias y Operativos"
      subtitle="Brigada Universitaria de Protección Civil · Universidad de Colima"
      mobileTitle="Guardias y Operativos"
      mobileSubtitle="Puesto de Mando · BUPC"
      headerRight={<StatusBadge status={viewMode === 'error' ? 'Sin red' : 'En línea'} />}
    >
      <StatePreviewBar />

      {viewMode === 'error' && (
        <ErrorBanner
          title="Error al sincronizar el Puesto de Mando"
          message="No se pudieron actualizar los conteos en tiempo real. Revisa la conexión de red."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'loading' ? (
        <CommandCenterSkeleton />
      ) : (
        <>
          {/* Barra superior de métricas rápidas (KPIs) */}
          <section
            aria-label="Indicadores operativos"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch"
          >
            <article className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-2 shadow-xs">
              <header className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#4B5563]">
                  Brigadistas activos
                </span>
                <Users size={18} strokeWidth={2} className="text-[#059669] shrink-0" />
              </header>
              <p className="text-[28px] sm:text-[32px] font-bold text-[#111827] tabular-nums leading-none">
                {viewMode === 'empty' ? 0 : activeBrigadistas}
              </p>
              <span className="text-[12px] font-medium text-[#065F46]">
                En servicio ahora mismo
              </span>
            </article>

            <article className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-2 shadow-xs">
              <header className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#4B5563]">Horas del mes</span>
                <Clock size={18} strokeWidth={2} className="text-[#3E6E28] shrink-0" />
              </header>
              <p className="text-[28px] sm:text-[32px] font-bold text-[#111827] tabular-nums leading-none">
                {viewMode === 'empty' ? '0.0' : '482.5'}
              </p>
              <span className="text-[12px] font-medium text-[#4B5563]">Noviembre 2026</span>
            </article>

            <article className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-2 shadow-xs">
              <header className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#4B5563]">
                  Operativos activos
                </span>
                <Megaphone size={18} strokeWidth={2} className="text-[#E65300] shrink-0" />
              </header>
              <p className="text-[28px] sm:text-[32px] font-bold text-[#111827] tabular-nums leading-none">
                {viewMode === 'empty' ? 0 : activeOpsCount}
              </p>
              <span className="text-[12px] font-medium text-[#4B5563]">
                Con registro QR habilitado
              </span>
            </article>

            <article className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-2 shadow-xs">
              <header className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#4B5563]">
                  Asistencias de hoy
                </span>
                <UserCheck size={18} strokeWidth={2} className="text-[#3E6E28] shrink-0" />
              </header>
              <p className="text-[28px] sm:text-[32px] font-bold text-[#111827] tabular-nums leading-none">
                {viewMode === 'empty' ? 0 : 38}
              </p>
              <span className="text-[12px] font-medium text-[#4B5563]">
                Validaciones entrada/salida
              </span>
            </article>
          </section>

          {/* Encabezado de sección + Filtros + Único botón naranja */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] sm:text-[20px] font-bold text-[#111827] tracking-[-0.02em]">
                  Actividades y Generador de QR por Evento
                </h2>
                <p className="text-[13px] text-[#4B5563]">
                  Selecciona una guardia u operativo para habilitar o descargar su código QR.
                </p>
              </div>
              {/* Único CTA naranja permitido en la vista principal */}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 min-h-12 rounded-lg bg-[#E65300] hover:bg-[#C94700] text-[#111827] text-[14px] font-bold transition-colors shrink-0"
              >
                <Plus size={18} strokeWidth={2} />
                <span>Iniciar operativo</span>
              </button>
            </div>

            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Filtrar por tipo de actividad"
            >
              {CATEGORY_FILTERS.map((f) => {
                const active = filter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3.5 min-h-10 rounded-full text-[12px] font-semibold transition-colors ${
                      active
                        ? 'bg-[#3E6E28] text-[#FFFFFF]'
                        : 'bg-[#FFFFFF] border border-[#E2E8F0] text-[#111827] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>

            {viewMode === 'empty' || filteredOperativos.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No hay operativos activos hoy"
                description={
                  roleType === 'encargado'
                    ? 'Inicia una guardia ordinaria o un operativo masivo para generar su código QR de asistencia.'
                    : 'No existen actividades registradas para la categoría seleccionada.'
                }
                actionLabel={
                  viewMode === 'empty' ? 'Iniciar nuevo operativo' : 'Ver todas las actividades'
                }
                onAction={() => (viewMode === 'empty' ? setCreateOpen(true) : setFilter('all'))}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                {filteredOperativos.map((op) => (
                  <article
                    key={op.id}
                    className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4 shadow-xs"
                  >
                    <header className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <ActivityBadge category={op.category} label={op.categoryLabel} />
                        <span className="text-[12px] font-semibold text-[#4B5563] tabular-nums">
                          {op.id}
                        </span>
                      </div>
                      <h3 className="text-[16px] font-bold text-[#111827]">{op.name}</h3>
                      <p className="text-[13px] text-[#4B5563]">
                        {op.location} · {op.detail}
                      </p>
                    </header>

                    <footer className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                      <StatusBadge status={op.status} />
                      <button
                        type="button"
                        onClick={() => handleOpenQrModal(op.id)}
                        className="inline-flex items-center justify-center gap-2 px-3.5 min-h-11 rounded-lg bg-[#EAF2E4] hover:bg-[#dcead2] border border-[#C8DDB9] text-[#284A19] text-[13px] font-semibold transition-colors"
                      >
                        <QrCode size={16} strokeWidth={2} />
                        <span>Generar QR</span>
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal Generador de QR por Evento */}
      {selectedOp && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qrGenTitle"
        >
          <div className="bg-[#FFFFFF] text-[#111827] rounded-xl p-5 sm:p-6 max-w-md w-full border border-[#E2E8F0] flex flex-col gap-4">
            <header className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <span className="text-[12px] font-semibold text-[#4B5563] tabular-nums">
                  {selectedOp.id}
                </span>
                <h2 id="qrGenTitle" className="text-[18px] font-bold text-[#111827]">
                  {selectedOp.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOpId(null)}
                aria-label="Cerrar generador"
                className="w-10 h-10 rounded-lg border border-[#E2E8F0] text-[#4B5563] flex items-center justify-center hover:bg-[#F8FAFC]"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <div className="flex flex-col gap-3.5">
              {/* Activar / Desactivar registro */}
              <label className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] cursor-pointer min-h-12">
                <span className="text-[14px] font-semibold text-[#111827]">
                  Registro QR habilitado
                </span>
                <input
                  type="checkbox"
                  checked={selectedOp.qrEnabled}
                  onChange={(e) =>
                    updateOperativoQr(selectedOp.id, { qrEnabled: e.target.checked })
                  }
                  className="w-5 h-5 rounded accent-[#3E6E28]"
                />
              </label>

              {/* Modo Entrada / Salida */}
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modo de registro">
                <button
                  type="button"
                  onClick={() => updateOperativoQr(selectedOp.id, { qrMode: 'ENTRADA' })}
                  className={`min-h-11 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
                    selectedOp.qrMode === 'ENTRADA'
                      ? 'bg-[#3E6E28] text-[#FFFFFF]'
                      : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827]'
                  }`}
                >
                  Modo: Entrada
                </button>
                <button
                  type="button"
                  onClick={() => updateOperativoQr(selectedOp.id, { qrMode: 'SALIDA' })}
                  className={`min-h-11 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
                    selectedOp.qrMode === 'SALIDA'
                      ? 'bg-[#3E6E28] text-[#FFFFFF]'
                      : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#111827]'
                  }`}
                >
                  Modo: Salida
                </button>
              </div>

              {/* Vista previa del QR imprimible */}
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex flex-col items-center gap-2.5">
                <QrCodeSvg
                  ref={eventQrRef}
                  value={`BUPC-${selectedOp.id}-${selectedOp.qrMode}`}
                  size={176}
                  label={`Código QR de ${selectedOp.name}`}
                />
                <span
                  className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                    selectedOp.qrEnabled
                      ? 'bg-[#ECFDF5] text-[#065F46]'
                      : 'bg-[#FEF2F2] text-[#991B1B]'
                  }`}
                >
                  {selectedOp.qrEnabled
                    ? `REGISTRO ACTIVO · ${selectedOp.qrMode}`
                    : 'REGISTRO PAUSADO'}
                </span>
              </div>

              {downloadMsg && (
                <div
                  role="status"
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#065F46] bg-[#ECFDF5] border border-[#059669] px-3 py-1.5 rounded-lg"
                >
                  <CheckCircle2 size={15} strokeWidth={2} className="text-[#059669]" />
                  <span>{downloadMsg}</span>
                </div>
              )}
            </div>

            <footer className="pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={handleDownloadEventQr}
                className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-12 rounded-lg bg-[#E65300] hover:bg-[#C94700] text-[#111827] text-[14px] font-bold transition-colors"
              >
                <Download size={18} strokeWidth={2} />
                <span>Descargar QR para Punto de Reunión</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Nuevo Operativo */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="createOpTitle"
        >
          <div className="bg-[#FFFFFF] text-[#111827] rounded-xl p-5 sm:p-6 max-w-md w-full border border-[#E2E8F0] flex flex-col gap-4">
            <header className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 id="createOpTitle" className="text-[18px] font-bold text-[#111827]">
                  Nuevo operativo o guardia
                </h2>
                <p className="text-[13px] text-[#4B5563]">
                  Se habilitará automáticamente su código QR de asistencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Cerrar modal"
                className="w-10 h-10 rounded-lg border border-[#E2E8F0] text-[#4B5563] flex items-center justify-center hover:bg-[#F8FAFC]"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <form onSubmit={handleCreateOperativo} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="opName" className="text-[12px] font-semibold text-[#111827]">
                  Nombre del operativo
                </label>
                <input
                  id="opName"
                  type="text"
                  required
                  value={newOpForm.name}
                  onChange={(e) => setNewOpForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej. Operativo Estadio San Jorge"
                  className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[14px] text-[#111827] focus:outline-none focus:border-[#3E6E28]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="opCat" className="text-[12px] font-semibold text-[#111827]">
                  Tipo de actividad
                </label>
                <select
                  id="opCat"
                  value={newOpForm.category}
                  onChange={(e) => setNewOpForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[14px] text-[#111827] focus:outline-none focus:border-[#3E6E28]"
                >
                  <option value="masivo">Operativo Masivo</option>
                  <option value="proyecto">Proyecto / Soporte Técnico</option>
                  <option value="guardia">Guardia Ordinaria</option>
                  <option value="capacitacion">Capacitación / Simulacro</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="opLoc" className="text-[12px] font-semibold text-[#111827]">
                  Sede / Punto de reunión
                </label>
                <input
                  id="opLoc"
                  type="text"
                  required
                  value={newOpForm.location}
                  onChange={(e) => setNewOpForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Ej. Campus Central · Explanada"
                  className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[14px] text-[#111827] focus:outline-none focus:border-[#3E6E28]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="opDetail" className="text-[12px] font-semibold text-[#111827]">
                  Horario o detalle operativo
                </label>
                <input
                  id="opDetail"
                  type="text"
                  value={newOpForm.detail}
                  onChange={(e) => setNewOpForm((p) => ({ ...p, detail: e.target.value }))}
                  placeholder="Ej. Turno 08:00–14:00 hrs"
                  className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[14px] text-[#111827] focus:outline-none focus:border-[#3E6E28]"
                />
              </div>

              <footer className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 min-h-12 rounded-lg border border-[#E2E8F0] text-[#4B5563] text-[13px] font-semibold hover:bg-[#F8FAFC]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 min-h-12 rounded-lg bg-[#3E6E28] hover:bg-[#2D521D] text-[#FFFFFF] text-[13px] font-semibold"
                >
                  Crear y activar QR
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
