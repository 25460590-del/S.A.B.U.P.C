import { Award, History } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { ActivityBadge, StatusBadge } from '../components/ActivityBadge'
import { EmptyState, ErrorBanner, StatePreviewBar } from '../components/StateBanners'
import { HistorySkeleton } from '../components/ViewSkeletons'
import { useApp } from '../context/AppContext'

export function HistoryPage() {
  const { currentUser, history, viewMode, setViewMode } = useApp()

  return (
    <AppShell
      title="Perfil e Historial del Brigadista"
      subtitle="Horas acumuladas para constancias universitarias y asistencias recientes"
      mobileTitle="Perfil e Historial"
      mobileSubtitle="BUPC · Universidad de Colima"
      headerRight={
        <span className="text-[13px] font-bold text-[#284A19] md:bg-[#EAF2E4] md:border md:border-[#C8DDB9] md:px-3 md:py-1.5 rounded-lg tabular-nums text-[#EAF2E4]">
          {currentUser.matricula}
        </span>
      }
      mobileHeaderRight={
        <span className="text-[13px] font-bold text-[#EAF2E4] tabular-nums shrink-0">
          {currentUser.matricula}
        </span>
      }
    >
      <StatePreviewBar />

      {viewMode === 'error' && (
        <ErrorBanner
          title="No se pudo cargar tu historial completo"
          message="Se perdió la conexión con el servidor de constancias. Intenta recargar en unos momentos."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'loading' ? (
        <HistorySkeleton />
      ) : viewMode === 'empty' ? (
        <div className="max-w-2xl mx-auto w-full">
          <EmptyState
            icon={History}
            title="Aún no tienes asistencias registradas"
            description="Escanea el QR de tu primera guardia u operativo para comenzar a acumular horas válidas para constancias."
            actionLabel="Cargar historial de prueba"
            onAction={() => setViewMode('normal')}
          />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-5">
          {/* Resumen personal y contador de horas (sin card-in-card) */}
          <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col shadow-xs">
            <div className="p-5 flex items-center gap-3.5 border-b border-[#E2E8F0]">
              <div className="w-14 h-14 rounded-full bg-[#EAF2E4] text-[#284A19] border-2 border-[#3E6E28] flex items-center justify-center text-[18px] font-bold shrink-0">
                {currentUser.initials}
              </div>
              <div className="min-w-0">
                <h2 className="text-[18px] font-bold text-[#111827] truncate">
                  {currentUser.name}
                </h2>
                <p className="text-[13px] text-[#4B5563]">{currentUser.levelFull}</p>
              </div>
            </div>

            <div className="bg-[#2D521D] text-[#FFFFFF] px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
                  Horas acumuladas (Constancias)
                </span>
                <p className="text-[28px] font-bold text-[#FFFFFF] tabular-nums leading-tight">
                  {currentUser.hoursSummary.total.toFixed(1)} hrs
                </p>
              </div>
              <Award size={36} strokeWidth={2} className="text-[#E65300] shrink-0" />
            </div>

            {/* Desglose por tipo de actividad con divisores verticales */}
            <div className="grid grid-cols-3 divide-x divide-[#E2E8F0] bg-[#F8FAFC]">
              <div className="p-3.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">Guardias</span>
                <span className="text-[16px] font-bold text-[#111827] tabular-nums">
                  {currentUser.hoursSummary.guardias.toFixed(1)} hrs
                </span>
              </div>
              <div className="p-3.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">Operativos</span>
                <span className="text-[16px] font-bold text-[#111827] tabular-nums">
                  {currentUser.hoursSummary.operativos.toFixed(1)} hrs
                </span>
              </div>
              <div className="p-3.5 flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">Capacit.</span>
                <span className="text-[16px] font-bold text-[#111827] tabular-nums">
                  {currentUser.hoursSummary.capacitacion.toFixed(1)} hrs
                </span>
              </div>
            </div>
          </section>

          {/* Historial cronológico */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[16px] font-bold text-[#111827]">Asistencias recientes</h3>
              <span className="text-[12px] font-semibold text-[#4B5563] tabular-nums">
                {history.length} registros
              </span>
            </div>

            {history.map((item) => (
              <article
                key={item.id}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <ActivityBadge category={item.category} label={item.categoryLabel} />
                  {item.isActive ? (
                    <StatusBadge status="En servicio" />
                  ) : (
                    <span className="text-[13px] font-bold text-[#111827] tabular-nums">
                      {item.hoursLabel}
                    </span>
                  )}
                </div>
                <h4 className="text-[15px] font-semibold text-[#111827]">{item.title}</h4>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#4B5563] tabular-nums">
                  <span>{item.dateRange}</span>
                  <span className="font-semibold text-[#111827]">{item.rol}</span>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </AppShell>
  )
}
