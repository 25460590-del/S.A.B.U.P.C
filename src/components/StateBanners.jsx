import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function ErrorBanner({
  title = 'Sin conexión con Puesto de Mando',
  message = 'No se pudo sincronizar la información. Verifica tu señal celular o reintenta en unos segundos.',
  onRetry,
  variant = 'offline',
}) {
  const Icon = variant === 'offline' ? WifiOff : AlertTriangle
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#DC2626] bg-[#FEF2F2] text-[#991B1B] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon size={20} strokeWidth={2} className="text-[#DC2626] shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#991B1B]">{title}</p>
          <p className="text-[13px] font-normal text-[#991B1B] mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-3.5 min-h-10 rounded-lg bg-[#FFFFFF] border border-[#DC2626] text-[#991B1B] text-[13px] font-semibold hover:bg-[#FEF2F2] shrink-0"
        >
          <RefreshCw size={16} strokeWidth={2} />
          <span>Reintentar</span>
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: CustomIcon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#EAF2E4] border border-[#C8DDB9] text-[#284A19] flex items-center justify-center">
        <CustomIcon size={24} strokeWidth={2} />
      </div>
      <div className="flex flex-col gap-1 max-w-md">
        <h3 className="text-[16px] font-semibold text-[#111827]">{title}</h3>
        <p className="text-[14px] text-[#4B5563]">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center justify-center gap-2 px-4 min-h-12 rounded-lg bg-[#EAF2E4] border border-[#C8DDB9] text-[#284A19] text-[14px] font-semibold hover:bg-[#dcead2]"
        >
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  )
}

export function StatePreviewBar() {
  const { viewMode, setViewMode } = useApp()
  const modes = [
    { id: 'normal', label: 'Datos activos' },
    { id: 'loading', label: 'Cargando' },
    { id: 'empty', label: 'Vacío' },
    { id: 'error', label: 'Error / Sin red' },
  ]

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2"
      aria-label="Selector de estado de interfaz"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
        Vista de estado UI
      </span>
      <div className="flex flex-wrap items-center gap-1.5" role="group">
        {modes.map((m) => {
          const active = viewMode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setViewMode(m.id)}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-colors ${
                active
                  ? 'bg-[#3E6E28] text-[#FFFFFF]'
                  : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
