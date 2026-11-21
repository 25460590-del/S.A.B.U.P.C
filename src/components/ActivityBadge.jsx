const ACTIVITY_STYLES = {
  masivo: {
    bg: 'bg-[#FFEDD5]',
    text: 'text-[#9A3412]',
    label: 'Operativo Masivo',
  },
  proyecto: {
    bg: 'bg-[#E0E7FF]',
    text: 'text-[#3730A3]',
    label: 'Proyecto / Soporte Técnico',
  },
  guardia: {
    bg: 'bg-[#EAF2E4]',
    text: 'text-[#284A19]',
    label: 'Guardia Ordinaria',
  },
  capacitacion: {
    bg: 'bg-[#F1F5F9]',
    text: 'text-[#334155]',
    label: 'Capacitación / Simulacro',
  },
}

export function ActivityBadge({ category, label }) {
  const style = ACTIVITY_STYLES[category] || ACTIVITY_STYLES.guardia
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${style.bg} ${style.text}`}
    >
      {label || style.label}
    </span>
  )
}

export function StatusBadge({ status }) {
  if (status === 'En servicio' || status === 'QR Activo' || status === 'Activo' || status === 'En línea') {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#065F46] text-[11px] font-semibold whitespace-nowrap shrink-0"
      >
        <span className="w-2 h-2 rounded-full bg-[#059669] shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    )
  }

  if (status === 'Turno por cerrar' || status === 'Operativo en curso') {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#92400E] text-[11px] font-semibold whitespace-nowrap shrink-0"
      >
        <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    )
  }

  if (status === 'Pausado' || status === 'Sin red') {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#991B1B] text-[11px] font-semibold whitespace-nowrap shrink-0"
      >
        <span className="w-2 h-2 rounded-full bg-[#DC2626] shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    )
  }

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#4B5563] text-[11px] font-semibold whitespace-nowrap shrink-0"
    >
      <span>{status}</span>
    </span>
  )
}
