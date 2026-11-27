import { ROLES_EN_TURNO } from '../../constants/catalogos'
import { etiquetaAyudantia } from '../../lib/permisos'
import type {
  AsistenciaPersonal,
  Operativo,
  PerfilOperativoMinimo,
  SignosVitales,
} from '../../types'

export type FiltroEstadoBitacora = 'todos' | 'en_turno' | 'con_adeudo' | 'salidos' | 'por_llegar'

export const UMBRAL_RELEVO_MS = 4 * 60 * 60 * 1000

export function formatearHoraCorta(ms?: number): string {
  if (!ms) return '--:--'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function etiquetaMetodoEntrada(metodo: AsistenciaPersonal['metodo_entrada']): string {
  switch (metodo) {
    case 'QR_Operativo_TOTP':
      return 'QR Dinámico'
    case 'QR_Operativo_Estatico':
      return 'QR Fijo'
    case 'QR_Credencial':
      return 'Credencial QR'
    case 'Manual':
      return 'Manual'
  }
}

export function etiquetaGrupoAsistencia(
  a: AsistenciaPersonal,
  mapaPerfiles: Map<string, PerfilOperativoMinimo>,
): string {
  const p = mapaPerfiles.get(a.usuario_uid)
  if (p?.subgrupo) return p.subgrupo
  if (p?.etapa) return p.etapa
  return a.grupo_operativo === 'Ninguno' ? 'Grupo Operativo' : a.grupo_operativo
}

function numeroVital(valor?: string): number | null {
  if (!valor) return null
  const limpio = valor.trim().replace(',', '.').replace(/[^0-9.]/g, '')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/**
 * Evalúa signos vitales en memoria (0 lecturas extra) para resaltar alertas clínicas en campo:
 * SpO2 < 94%, FC > 110 o < 50 lpm, FR > 24 o < 10 rpm, Temp >= 38.0 °C o < 35.0 °C.
 */
export function evaluarAlertaSignosVitales(sv: SignosVitales | null): {
  fueraDeRango: boolean
  motivos: string[]
} {
  if (!sv) return { fueraDeRango: false, motivos: [] }
  const motivos: string[] = []
  const spo2 = numeroVital(sv.spo2)
  const fc = numeroVital(sv.fc)
  const fr = numeroVital(sv.fr)
  const temp = numeroVital(sv.temp)

  if (spo2 !== null && spo2 < 94) motivos.push(`SpO2 ${spo2}%`)
  if (fc !== null && (fc > 110 || fc < 50)) motivos.push(`FC ${fc} lpm`)
  if (fr !== null && (fr > 24 || fr < 10)) motivos.push(`FR ${fr} rpm`)
  if (temp !== null && (temp >= 38 || temp < 35)) motivos.push(`Temp ${temp} °C`)

  return { fueraDeRango: motivos.length > 0, motivos }
}

/**
 * Sugerencia discreta de relevo / hidratación para personal con > 4 h continuas en "En servicio".
 */
export function superaCuatroHorasEnServicio(a: AsistenciaPersonal, ahoraMs: number): boolean {
  if (a.hora_salida !== null || a.estado_operativo !== 'En servicio') return false
  const entradaMs = a.hora_entrada?.toMillis()
  if (!entradaMs) return false
  return ahoraMs - entradaMs > UMBRAL_RELEVO_MS
}

/**
 * Construye en memoria un Parte de Novedades estructurado listo para pegar en WhatsApp (0 lecturas extra).
 */
export function construirParteNovedadesWhatsApp(
  operativo: Operativo,
  asistencias: AsistenciaPersonal[],
  equiposBupcEnPrestamo: number,
  ahora = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const horaCorte = `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`
  const fechaCorte = `${pad(ahora.getDate())}/${pad(ahora.getMonth() + 1)}/${ahora.getFullYear()}`

  const enTurno = asistencias.filter((a) => a.hora_salida === null)
  const salidos = asistencias.length - enTurno.length
  const enServicio = enTurno.filter((a) => a.estado_operativo === 'En servicio').length
  const enDescanso = enTurno.filter((a) => a.estado_operativo === 'En descanso').length
  const enReserva = enTurno.filter((a) => a.estado_operativo === 'Reserva').length

  const porRol = new Map<string, number>()
  for (const rol of ROLES_EN_TURNO) porRol.set(rol, 0)
  for (const a of enTurno) {
    porRol.set(a.rol_en_turno, (porRol.get(a.rol_en_turno) ?? 0) + 1)
  }

  const porAyudantia = new Map<string, number>()
  for (const a of enTurno) {
    const etq = etiquetaAyudantia(a.ayudantia_slot)
    porAyudantia.set(etq, (porAyudantia.get(etq) ?? 0) + 1)
  }

  const lineasRoles = Array.from(porRol.entries())
    .filter(([, n]) => n > 0)
    .map(([rol, n]) => `• ${rol}: ${n}`)

  const lineasAy = Array.from(porAyudantia.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ay, n]) => `• ${ay}: ${n}`)

  const bloques = [
    `*PARTE DE NOVEDADES — BUPC UdeC*`,
    `*Operativo:* ${operativo.nombre}`,
    `*Sede:* ${operativo.sede}`,
    `*Corte:* ${fechaCorte} · ${horaCorte} h`,
    ``,
    `*Personal en turno:* ${enTurno.length} (En servicio: ${enServicio} · En descanso: ${enDescanso}${enReserva > 0 ? ` · Reserva: ${enReserva}` : ''})`,
    salidos > 0 ? `*Salidas registradas:* ${salidos}` : null,
    ``,
    `*Desglose por rol:*`,
    ...(lineasRoles.length > 0 ? lineasRoles : ['• Sin personal en turno']),
    ``,
    `*Desglose por ayudantía:*`,
    ...(lineasAy.length > 0 ? lineasAy : ['• Sin personal en turno']),
    ``,
    `*Material BUPC en préstamo:* ${equiposBupcEnPrestamo} artículo${equiposBupcEnPrestamo === 1 ? '' : 's'}`,
  ]

  return bloques.filter((l): l is string => l !== null).join('\n')
}
