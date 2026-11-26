import type { AsistenciaPersonal, PerfilOperativoMinimo } from '../../types'

export type FiltroEstadoBitacora = 'todos' | 'en_turno' | 'con_adeudo' | 'salidos' | 'por_llegar'

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
