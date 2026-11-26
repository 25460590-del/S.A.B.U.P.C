import type {
  AyudantiaSlot,
  CategoriaOperativo,
  EstadoOperativo,
  EtapaBrigadista,
  EtapaFormativa,
  GravedadIncidencia,
  GrupoOperativo,
  NivelAcademico,
  PrerregistroOperativo,
  RolEnTurno,
  RolOperativoCanonico,
  RolSistema,
  Sexo,
  TipoIncidenciaPersonal,
  TipoSangre,
} from '../types'

export const ROLES_EN_TURNO: RolOperativoCanonico[] = [
  'Sin definir',
  'Atención',
  'Radios',
  'Búsqueda y Rescate',
  'Abastecedores',
  'Encargados',
]

/**
 * Mapeo oficial de ayudantía -> rol operativo inicial al integrarse a un operativo.
 * Sin ayudantía (Alfa, Omega, SIERRA o sin ayudantía definida) -> 'Sin definir'.
 */
export const ROL_OPERATIVO_POR_AYUDANTIA: Readonly<Record<AyudantiaSlot, RolOperativoCanonico>> = {
  Capacitación: 'Búsqueda y Rescate',
  Tesla: 'Radios',
  'Administración de Personal': 'Encargados',
  Logística: 'Abastecedores',
  Socorros: 'Atención',
  Ninguna: 'Sin definir',
}

/**
 * Devuelve el rol operativo automático correspondiente a la ayudantía del participante.
 */
export function rolOperativoPorAyudantia(
  ayudantia?: AyudantiaSlot | string | null,
): RolOperativoCanonico {
  if (
    ayudantia === 'Capacitación' ||
    ayudantia === 'Tesla' ||
    ayudantia === 'Administración de Personal' ||
    ayudantia === 'Logística' ||
    ayudantia === 'Socorros'
  ) {
    return ROL_OPERATIVO_POR_AYUDANTIA[ayudantia]
  }
  return 'Sin definir'
}

/**
 * Resuelve el rol inicial al confirmar entrada a un operativo:
 * - Si el participante ya tiene un rol registrado en su prerregistro (incluyendo ediciones
 *   manuales durante la convocatoria), lo conserva intacto.
 * - De lo contrario, asigna automáticamente el rol según su ayudantía.
 */
export function resolverRolInicialOperativo(
  ayudantia?: AyudantiaSlot | string | null,
  prerregistro?: Pick<PrerregistroOperativo, 'rol_en_turno' | 'rol_editado_manual'> | null,
): RolEnTurno {
  if (prerregistro?.rol_en_turno) {
    return prerregistro.rol_en_turno
  }
  return rolOperativoPorAyudantia(ayudantia)
}

/**
 * Opciones para selectores de rol en turno: siempre muestra el catálogo oficial vigente
 * y preserva un valor histórico si un registro legado lo contiene.
 */
export function opcionesRolEnTurno(rolActual?: RolEnTurno | null): RolEnTurno[] {
  if (!rolActual || (ROLES_EN_TURNO as readonly string[]).includes(rolActual)) {
    return ROLES_EN_TURNO
  }
  return [...ROLES_EN_TURNO, rolActual]
}

export const ESTADOS_OPERATIVOS: EstadoOperativo[] = [
  'En servicio',
  'En descanso',
  'Reserva',
  'Retirado',
]

export const EQUIPO_BUPC_SUGERIDO: string[] = [
  'Radio portátil',
  'Botiquín de trauma',
  'Chaleco alta visibilidad',
  'Camilla rígida',
  'Lámpara táctica',
]

export const CATEGORIAS_OPERATIVO: CategoriaOperativo[] = [
  'Operativos Masivos',
  'Proyectos y Soporte Técnico',
  'Guardias Ordinarias',
  'Capacitaciones, Simulacros y Difusión',
]

export const GRUPOS_OPERATIVOS: GrupoOperativo[] = ['Alfa', 'Omega', 'Ninguno']

export const ETAPAS_FORMATIVAS: EtapaFormativa[] = ['Alfa', 'Omega', 'SIERRA']

export const ETAPAS_BRIGADISTA: EtapaBrigadista[] = ['Alfa', 'Omega', 'SIERRA', 'Grupo Operativo']

/** Semilla inicial para `catalogos/subgrupos` (respaldo si aún no existe en Firestore). */
export const SUBGRUPOS_POR_DEFECTO: string[] = [
  'Alfa 1',
  'Alfa 2',
  'Alfa 3',
  'Alfa 4',
  'Omega 1',
  'Omega 2',
  'Sierra 1',
]

export const TIPOS_INCIDENCIA_PERSONAL: TipoIncidenciaPersonal[] = [
  'Falta',
  'Retardo',
  'Conducta',
  'Incumplimiento',
  'Reconocimiento',
  'Observación',
]

export const GRAVEDADES_INCIDENCIA: GravedadIncidencia[] = ['Baja', 'Media', 'Alta']

export const AYUDANTIAS_ACTIVAS: Exclude<AyudantiaSlot, 'Ninguna'>[] = [
  'Capacitación',
  'Administración de Personal',
  'Tesla',
  'Socorros',
  'Logística',
]

export const AYUDANTIAS: AyudantiaSlot[] = [...AYUDANTIAS_ACTIVAS, 'Ninguna']

export const ROLES: RolSistema[] = ['Brigadista', 'Encargado', 'Administrador']

export const SEXOS: Sexo[] = ['Mujer', 'Hombre', 'Prefiero no decir']

export const NIVELES_ACADEMICOS: NivelAcademico[] = [
  'Media Superior',
  'Superior',
  'Egresado',
  'Estudiante externo UdeC',
]

export const TIPOS_SANGRE: TipoSangre[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

/** Selector de carrera (nivel Superior). Tomado de la pantalla de Registro en Stitch. */
export const CARRERAS_SUPERIOR: string[] = [
  'Médico Cirujano y Partero',
  'Ingeniería en Sistemas Computacionales',
  'Enfermería',
  'Protección Civil y Emergencias',
]

export const OPCION_OTRA_CARRERA = 'Otro (especificar)'
