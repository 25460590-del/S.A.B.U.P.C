import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Backpack,
  BriefcaseMedical,
  CameraOff,
  CheckCircle2,
  ChevronRight,
  IdCard,
  PackageCheck,
  QrCode,
  Radio,
  ScanLine,
  ShieldAlert,
  X,
} from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { StatusBadge } from '../components/ActivityBadge'
import { EmptyState, ErrorBanner, StatePreviewBar } from '../components/StateBanners'
import { ScannerSkeleton } from '../components/ViewSkeletons'
import { useApp } from '../context/AppContext'
import { STANDARD_EQUIPMENT, STANDARD_ROLES } from '../data/mockData'

const EQUIP_ICONS = {
  Radio: Radio,
  Botiquín: BriefcaseMedical,
  Chaleco: ShieldAlert,
}

export function ScannerPage() {
  const {
    operativos,
    activeShift,
    recordScan,
    updateShiftRole,
    updateShiftEquipment,
    viewMode,
    setViewMode,
  } = useApp()

  const activeOperativos = operativos.filter((o) => o.qrEnabled)
  const [selectedOpId, setSelectedOpId] = useState(activeShift.operativoId)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [equipOpen, setEquipOpen] = useState(false)
  const [draftEquip, setDraftEquip] = useState(activeShift.equipment)
  const [scanAlert, setScanAlert] = useState(null)
  const lastScanEpochRef = useRef(0)

  const currentOp =
    operativos.find((o) => o.id === selectedOpId) || activeOperativos[0] || operativos[0]

  const handleSimulateScan = () => {
    const now = Date.now()
    setScannerOpen(false)

    if (now - lastScanEpochRef.current < 3000) {
      setScanAlert({
        type: 'warn',
        title: 'Registro duplicado evitado',
        body: 'Ya registraste un movimiento hace unos segundos. Espera antes de volver a escanear.',
      })
      return
    }

    lastScanEpochRef.current = now
    const { nextInService, timeFull, targetOp } = recordScan({
      operativoId: currentOp.id,
      rol: activeShift.rol,
      equipment: activeShift.equipment,
    })

    setScanAlert({
      type: 'success',
      title: nextInService ? 'Entrada registrada con éxito' : 'Salida registrada con éxito',
      body: `Validado a las ${timeFull} hrs en ${targetOp.name} · Rol: ${activeShift.rol}.`,
    })
  }

  const handleCameraError = () => {
    setScannerOpen(false)
    setScanAlert({
      type: 'error',
      title: 'No se pudo acceder a la cámara',
      body: 'Permite el acceso a la cámara en tu navegador o presenta tu Credencial QR en Puesto de Mando.',
    })
  }

  const openEquipmentModal = () => {
    setDraftEquip(activeShift.equipment)
    setEquipOpen(true)
  }

  const toggleEquipItem = (id) => {
    setDraftEquip((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const saveEquipment = () => {
    updateShiftEquipment(draftEquip)
    setEquipOpen(false)
  }

  return (
    <AppShell
      title="Registro por QR — Brigadista"
      subtitle="Control de asistencia en campo · Entrada y Salida"
      mobileTitle={currentOp ? currentOp.name : 'Registro por QR'}
      mobileSubtitle="BUPC · UdeC"
      headerRight={<StatusBadge status="Operativo en curso" />}
    >
      <StatePreviewBar />

      {viewMode === 'error' && (
        <ErrorBanner
          title="Sin conexión con Puesto de Mando"
          message="No se pudo validar el código QR. Verifica tu conexión o muestra tu Credencial QR al Encargado."
          onRetry={() => setViewMode('normal')}
        />
      )}

      {viewMode === 'loading' ? (
        <ScannerSkeleton />
      ) : viewMode === 'empty' ? (
        <div className="max-w-2xl mx-auto w-full">
          <EmptyState
            icon={ScanLine}
            title="No hay operativos activos hoy"
            description="Cuando Puesto de Mando habilite una guardia u operativo con código QR, aparecerá aquí para registrar tu entrada."
            actionLabel="Ver guardias y operativos"
            onAction={() => setViewMode('normal')}
          />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-5">
          {/* Banner de confirmación / advertencia / error de cámara */}
          {scanAlert && (
            <div
              role="alert"
              className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                scanAlert.type === 'success'
                  ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46]'
                  : scanAlert.type === 'warn'
                    ? 'border-[#D97706] bg-[#FFFBEB] text-[#92400E]'
                    : 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                {scanAlert.type === 'success' ? (
                  <CheckCircle2 size={20} strokeWidth={2} className="text-[#059669] shrink-0 mt-0.5" />
                ) : scanAlert.type === 'warn' ? (
                  <AlertTriangle size={20} strokeWidth={2} className="text-[#D97706] shrink-0 mt-0.5" />
                ) : (
                  <CameraOff size={20} strokeWidth={2} className="text-[#DC2626] shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{scanAlert.title}</p>
                  <p className="text-[13px] tabular-nums mt-0.5">{scanAlert.body}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScanAlert(null)}
                aria-label="Cerrar alerta"
                className="p-1 rounded-lg hover:bg-[#111827]/5 shrink-0"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          )}

          {/* Tarjeta principal: Escáner QR */}
          <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                  Control de asistencia
                </span>
                <h2 className="text-[20px] font-bold text-[#111827] tracking-[-0.02em]">
                  Registro en campo
                </h2>
              </div>
              <span className="text-[12px] font-semibold text-[#284A19] bg-[#EAF2E4] border border-[#C8DDB9] px-2.5 py-1 rounded-lg tabular-nums shrink-0">
                {currentOp?.id}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="activeOpSelect" className="text-[12px] font-semibold text-[#4B5563]">
                Operativo / Guardia seleccionada
              </label>
              <select
                id="activeOpSelect"
                value={selectedOpId}
                onChange={(e) => setSelectedOpId(e.target.value)}
                className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] font-medium focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
              >
                {activeOperativos.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} · {op.location}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[14px] text-[#4B5563]">
              Escanea el código QR del Puesto de Mando en{' '}
              <span className="font-semibold text-[#111827]">{currentOp?.location}</span> para
              validar tu entrada o salida.
            </p>

            {/* Único CTA naranja permitido en la vista */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 min-h-14 rounded-lg bg-[#E65300] hover:bg-[#C94700] text-[#111827] text-[15px] font-bold transition-colors"
            >
              <ScanLine size={20} strokeWidth={2} />
              <span>Escanear QR para Registrar Entrada / Salida</span>
            </button>

            {/* Opción alternativa integrada con divisor horizontal (sin card-in-card) */}
            <div className="pt-3 border-t border-[#E2E8F0]">
              <Link
                to="/mi-qr"
                className="flex items-center justify-between gap-3 py-2 px-1 rounded-lg hover:bg-[#F8FAFC] transition-colors min-h-12"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2E4] border border-[#C8DDB9] text-[#284A19] flex items-center justify-center shrink-0">
                    <IdCard size={20} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#111827] truncate">
                      Descargar / Mostrar mi QR de Brigadista
                    </p>
                    <p className="text-[12px] text-[#4B5563] truncate">
                      Credencial digital oficial con matrícula UdeC
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} strokeWidth={2} className="text-[#4B5563] shrink-0" />
              </Link>
            </div>
          </section>

          {/* Tarjeta de confirmación inmediata tras el escaneo */}
          <section className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4 shadow-xs">
            <header className="flex items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={20} strokeWidth={2} className="text-[#059669] shrink-0" />
                <h3 className="text-[16px] font-semibold text-[#111827] truncate">
                  Último registro confirmado
                </h3>
              </div>
              <StatusBadge status={activeShift.inService ? 'En servicio' : 'Turno finalizado'} />
            </header>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                  Hora exacta
                </span>
                <span className="text-[18px] font-bold text-[#111827] tabular-nums">
                  {activeShift.lastTime} hrs
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                  Tipo de registro
                </span>
                <span className="text-[15px] font-semibold text-[#111827]">
                  {activeShift.lastType}
                </span>
              </div>
              <div className="col-span-2 flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                  Operativo / Guardia
                </span>
                <span className="text-[14px] font-medium text-[#111827]">
                  {activeShift.operativoName} · {activeShift.location}
                </span>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <label
                  htmlFor="roleSelect"
                  className="text-[12px] font-semibold text-[#4B5563]"
                >
                  Rol asignado en turno
                </label>
                <select
                  id="roleSelect"
                  value={activeShift.rol}
                  onChange={(e) => updateShiftRole(e.target.value)}
                  className="w-full min-h-12 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#111827] text-[14px] font-medium focus:outline-none focus:border-[#3E6E28] focus:ring-1 focus:ring-[#3E6E28]"
                >
                  {STANDARD_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <footer className="pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Backpack size={18} strokeWidth={2} className="text-[#4B5563] shrink-0" />
                <span className="text-[13px] font-medium text-[#4B5563] truncate">
                  Equipo:{' '}
                  <strong className="text-[#111827] font-semibold">
                    {activeShift.equipment.length > 0
                      ? activeShift.equipment.join(', ')
                      : 'Ninguno reportado'}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={openEquipmentModal}
                className="inline-flex items-center justify-center gap-2 px-4 min-h-12 rounded-lg bg-[#EAF2E4] hover:bg-[#dcead2] border border-[#C8DDB9] text-[#284A19] text-[13px] font-semibold shrink-0"
              >
                <PackageCheck size={16} strokeWidth={2} />
                <span>Reportar equipo</span>
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Modal Visor de Escáner QR */}
      {scannerOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scannerModalTitle"
        >
          <div className="bg-[#111827] text-[#FFFFFF] rounded-xl p-5 max-w-sm w-full border border-[#334155] flex flex-col gap-4">
            <header className="flex items-center justify-between gap-3">
              <div>
                <h2 id="scannerModalTitle" className="text-[16px] font-bold text-[#FFFFFF]">
                  Visor de Escáner QR
                </h2>
                <p className="text-[12px] text-[#CBD5E1]">
                  Apunta al código QR del Puesto de Mando
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                aria-label="Cerrar escáner"
                className="w-10 h-10 rounded-lg bg-[#1F2937] flex items-center justify-center text-[#FFFFFF] hover:bg-[#374151]"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            {/* Visor con guías naranjas */}
            <div className="relative aspect-square w-full bg-[#0F172A] rounded-xl flex items-center justify-center border border-[#334155]">
              <div className="w-48 h-48 relative flex items-center justify-center">
                <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-[#E65300] rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-[#E65300] rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-[#E65300] rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-[#E65300] rounded-br-lg" />
                <QrCode size={64} strokeWidth={1.5} className="text-[#475569]" />
              </div>
              <span className="absolute bottom-3 px-3 py-1 rounded-full bg-[#1F2937] text-[#EAF2E4] text-[11px] font-semibold">
                Cámara activa · {currentOp?.id}
              </span>
            </div>

            <footer className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSimulateScan}
                className="w-full min-h-12 px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-[#FFFFFF] text-[14px] font-bold inline-flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} strokeWidth={2} />
                <span>
                  {activeShift.inService
                    ? 'Validar Escaneo de Salida'
                    : 'Validar Escaneo de Entrada'}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCameraError}
                  className="min-h-11 px-3 rounded-lg bg-[#FEF2F2] text-[#991B1B] text-[12px] font-semibold"
                >
                  Simular fallo cámara
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen(false)}
                  className="min-h-11 px-3 rounded-lg border border-[#475569] text-[#FFFFFF] text-[12px] font-semibold hover:bg-[#1F2937]"
                >
                  Cancelar
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Reportar Equipo Asignado */}
      {equipOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#111827]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="equipModalTitle"
        >
          <div className="bg-[#FFFFFF] text-[#111827] rounded-xl p-5 max-w-sm w-full border border-[#E2E8F0] flex flex-col gap-4">
            <header className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 id="equipModalTitle" className="text-[16px] font-bold text-[#111827]">
                  Reportar equipo asignado
                </h2>
                <p className="text-[13px] text-[#4B5563]">
                  Marca el equipo entregado para este turno.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEquipOpen(false)}
                aria-label="Cerrar diálogo"
                className="w-9 h-9 rounded-lg border border-[#E2E8F0] text-[#4B5563] flex items-center justify-center hover:bg-[#F8FAFC]"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <div className="flex flex-col divide-y divide-[#E2E8F0]">
              {STANDARD_EQUIPMENT.map((item) => {
                const Icon = EQUIP_ICONS[item.id] || PackageCheck
                const checked = draftEquip.includes(item.id)
                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 py-3 cursor-pointer min-h-12"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEquipItem(item.id)}
                      className="w-5 h-5 rounded accent-[#3E6E28]"
                    />
                    <Icon size={18} strokeWidth={2} className="text-[#3E6E28] shrink-0" />
                    <span className="text-[14px] font-semibold text-[#111827]">{item.label}</span>
                  </label>
                )
              })}
            </div>

            <footer className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setEquipOpen(false)}
                className="px-4 min-h-12 rounded-lg border border-[#E2E8F0] text-[#4B5563] text-[13px] font-semibold hover:bg-[#F8FAFC]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEquipment}
                className="px-4 min-h-12 rounded-lg bg-[#3E6E28] hover:bg-[#2D521D] text-[#FFFFFF] text-[13px] font-semibold"
              >
                Guardar equipo
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  )
}
