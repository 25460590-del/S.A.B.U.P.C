import { ShieldCheck } from 'lucide-react'
import type { AyudantiaActiva } from '../lib/permisos'

interface IndicadorAlcanceAyudantiaProps {
  ayudantia: AyudantiaActiva
  descripcion?: string
  compacto?: boolean
}

/**
 * Encabezado/indicador institucional que señala claramente cuando un Jefe de Ayudantía
 * está visualizando y operando exclusivamente sobre el personal de su ayudantía.
 */
export function IndicadorAlcanceAyudantia({
  ayudantia,
  descripcion,
  compacto = false,
}: IndicadorAlcanceAyudantiaProps) {
  if (compacto) {
    return (
      <div
        role="status"
        className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-udec/35 bg-salvia px-3 py-1 text-xs font-bold text-udec-oscuro dark:border-activo-claro/35 dark:bg-noche-campo dark:text-activo-claro"
      >
        <ShieldCheck size={14} strokeWidth={2} className="shrink-0" />
        <span>Jefatura · {ayudantia}</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label={`Viendo ayudantía ${ayudantia}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-udec/35 bg-salvia px-3.5 py-2.5 text-udec-oscuro dark:border-activo-claro/35 dark:bg-noche-campo dark:text-noche-tinta"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ShieldCheck
          size={18}
          strokeWidth={2}
          className="shrink-0 text-udec dark:text-activo-claro"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-udec-oscuro dark:text-activo-claro">
            Jefe de Ayudantía · Viendo exclusivamente: {ayudantia}
          </p>
          <p className="text-[11px] font-medium text-tinta-suave dark:text-noche-tinta-suave">
            {descripcion ??
              `Solo se muestran y gestionan integrantes adscritos a la ayudantía ${ayudantia}.`}
          </p>
        </div>
      </div>

      <span className="shrink-0 rounded-full bg-udec px-2.5 py-0.5 text-[11px] font-bold text-white">
        {ayudantia}
      </span>
    </div>
  )
}
