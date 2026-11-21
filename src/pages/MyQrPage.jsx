import { useRef, useState } from 'react'
import { CheckCircle2, Download, QrCode } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/ActivityBadge'
import { QrCodeSvg, downloadQrAsPng } from '../components/QrCodeSvg'
import { EmptyState, ErrorBanner, StatePreviewBar } from '../components/StateBanners'
import { MyQrSkeleton } from '../components/ViewSkeletons'
import { useApp } from '../context/AppContext'

export function MyQrPage() {
  const { currentUser, viewMode, setViewMode } = useApp()
  const qrSvgRef = useRef(null)
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = () => {
    downloadQrAsPng(qrSvgRef.current, `QR-Brigadista-${currentUser.matricula}.png`, {
      title: currentUser.name,
      code: currentUser.qrCode,
      subtitle: `Matrícula ${currentUser.matricula} · ${currentUser.delegacion}`,
    })
    setDownloaded(true)
  }

  return (
    <AppShell
      title="Mi Credencial Digital QR"
      subtitle="Identificación oficial de brigadista para registro en campo"
      mobileTitle="Credencial Digital QR"
      mobileSubtitle="BUPC · Universidad de Colima"
      headerRight={<StatusBadge status={currentUser.status} />}
    >
      <StatePreviewBar />

      {viewMode === 'error' && (
        <ErrorBanner
          title="No se pudo verificar el estado de tu credencial"
          message="Puedes seguir mostrando tu código QR guardado sin conexión al Encargado de Puesto de Mando."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'loading' ? (
        <MyQrSkeleton />
      ) : viewMode === 'empty' ? (
        <div className="max-w-md mx-auto w-full">
          <EmptyState
            icon={QrCode}
            title="Credencial QR pendiente de activación"
            description="Tu solicitud aún no ha sido validada por tu Encargado de Delegación."
            actionLabel="Actualizar estado"
            onAction={() => setViewMode('normal')}
          />
        </div>
      ) : (
        <div className="max-w-md mx-auto w-full">
          <article className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col shadow-xs">
            {/* Banda superior institucional */}
            <div className="bg-[#2D521D] text-[#FFFFFF] px-5 py-4 border-b-[3px] border-[#E65300] flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#EAF2E4] text-[#284A19] border-2 border-[#E65300] flex items-center justify-center text-[20px] font-bold shrink-0">
                {currentUser.initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-[#EAF2E4] uppercase tracking-wider">
                  {currentUser.roleLabel}
                </span>
                <h2 className="text-[18px] font-bold text-[#FFFFFF] truncate">
                  {currentUser.name}
                </h2>
                <p className="text-[13px] font-semibold text-[#EAF2E4] tabular-nums">
                  Matrícula: {currentUser.matricula}
                </p>
              </div>
            </div>

            {/* Datos de capacitación separados por divisores (sin card-in-card) */}
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">
                  Nivel de capacitación
                </span>
                <span className="text-[13px] font-semibold text-[#111827]">
                  {currentUser.level}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563]">
                  Delegación / Campus
                </span>
                <span className="text-[13px] font-semibold text-[#111827]">
                  {currentUser.delegacion}
                </span>
              </div>
            </div>

            {/* Código QR nítido y botón de descarga */}
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="p-4 bg-[#FFFFFF] border-2 border-[#3E6E28] rounded-xl flex flex-col items-center gap-2">
                <QrCodeSvg
                  ref={qrSvgRef}
                  value={currentUser.qrCode}
                  size={184}
                  label={`Código QR personal del brigadista ${currentUser.matricula}`}
                />
                <span className="text-[13px] font-bold text-[#111827] tabular-nums tracking-wider">
                  {currentUser.qrCode}
                </span>
              </div>

              <p className="text-[13px] text-[#4B5563] text-center">
                Presenta este código al Encargado en Puesto de Mando si no cuentas con conexión de
                datos para escanear.
              </p>

              {/* Único CTA naranja permitido en la vista */}
              <button
                type="button"
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-2 px-5 min-h-12 rounded-lg bg-[#E65300] hover:bg-[#C94700] text-[#111827] text-[14px] font-bold transition-colors"
              >
                <Download size={18} strokeWidth={2} />
                <span>Descargar mi QR en PNG</span>
              </button>

              {downloaded && (
                <div
                  role="status"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#065F46] bg-[#ECFDF5] border border-[#059669] px-3.5 py-1.5 rounded-full"
                >
                  <CheckCircle2 size={15} strokeWidth={2} className="text-[#059669]" />
                  <span>Credencial QR descargada en PNG.</span>
                </div>
              )}
            </div>
          </article>
        </div>
      )}
    </AppShell>
  )
}
