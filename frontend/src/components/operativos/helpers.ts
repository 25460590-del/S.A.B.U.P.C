import { esOperativoCerrado } from '../../lib/permisos'
import type { CategoriaOperativo, Operativo } from '../../types'

export type FiltroEstadoOperativo = 'en_curso' | 'programados' | 'finalizados'
export type SubVistaOperativo = 'resumen' | 'qr' | 'bitacora'

export function estiloCategoria(cat: CategoriaOperativo): string {
  switch (cat) {
    case 'Operativos Masivos':
      return 'bg-naranja-suave text-naranja-oscuro border-naranja dark:bg-noche-campo dark:text-naranja'
    case 'Proyectos y Soporte Técnico':
      return 'bg-salvia text-udec-oscuro border-udec dark:bg-noche-campo dark:text-activo-claro'
    case 'Guardias Ordinarias':
      return 'bg-activo-suave text-activo border-activo dark:bg-noche-campo dark:text-activo-claro'
    case 'Capacitaciones, Simulacros y Difusión':
      return 'bg-superficie-suave text-tinta-suave border-borde-fuerte dark:bg-noche-campo dark:text-noche-tinta-suave dark:border-noche-borde'
  }
}

export function valorDatetimeLocalActual(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function clasificarOperativo(op: Operativo, referenciaMs: number): FiltroEstadoOperativo {
  if (esOperativoCerrado(op)) return 'finalizados'
  const inicioMs = Date.parse(op.fecha_inicio)
  if (!op.recepcion_abierta && !Number.isNaN(inicioMs) && inicioMs > referenciaMs) {
    return 'programados'
  }
  return 'en_curso'
}
