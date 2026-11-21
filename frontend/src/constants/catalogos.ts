import type {
  AyudantiaSlot,
  CategoriaOperativo,
  EstadoOperativo,
  GrupoOperativo,
  NivelAcademico,
  RolEnTurno,
  RolSistema,
  Sexo,
  TipoSangre,
} from '../types'

export const ROLES_EN_TURNO: RolEnTurno[] = [
  'Sin asignar',
  'Primeros Auxilios',
  'Radiocomunicación',
  'Búsqueda y Rescate',
  'Evacuación',
  'Logística',
  'Encargado',
]

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

export const AYUDANTIAS: AyudantiaSlot[] = [
  'Capacitación',
  'Administración de Personal',
  'Tesla',
  'Socorros',
  'Logística',
  'Ninguna',
]

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
