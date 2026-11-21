import type { Timestamp } from 'firebase/firestore'

// ── Catálogos cerrados (deben coincidir 1:1 con firestore.rules) ──────────────

export type GrupoOperativo = 'Alfa' | 'Omega' | 'Ninguno'

export type AyudantiaSlot =
  | 'Capacitación'
  | 'Administración de Personal'
  | 'Tesla'
  | 'Socorros'
  | 'Logística'
  | 'Ninguna'

export type RolSistema = 'Brigadista' | 'Encargado' | 'Administrador'

export type EstatusUsuario = 'Pendiente' | 'Activo' | 'Inactivo'

export type Sexo = 'Mujer' | 'Hombre' | 'Prefiero no decir'

export type NivelAcademico = 'Media Superior' | 'Superior' | 'Egresado' | 'Estudiante externo UdeC'

export type TipoSangre = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'

// ── Registro multipaso ───────────────────────────────────────────────────────

/** Paso 1 · Personal y Contacto */
export interface DatosPersonales {
  nombres: string
  apellido_paterno: string
  apellido_materno: string
  /** Formato YYYY-MM-DD */
  fecha_nacimiento: string
  sexo: Sexo
  telefono_fijo: string
  celular: string
  celular_con_whatsapp: boolean
}

/** Paso 2 · Académico */
export interface DatosAcademicos {
  nivel_academico: NivelAcademico
  /** Carrera del catálogo, texto libre si eligió "Otro", o plantel/bachillerato. */
  escuela_carrera: string
  /** "0" si no aplica. */
  numero_cuenta: string
}

/** Paso 3 · Expediente Médico */
export interface DatosMedicos {
  tipo_sangre: TipoSangre
  alergias: string
  padecimientos_medicamentos: string
  contacto_emergencia_nombre: string
  contacto_emergencia_telefono: string
}

/** Campos que solo un Administrador activo puede modificar. */
export interface CamposPrivilegiados {
  grupo_operativo: GrupoOperativo
  ayudantia_slot: AyudantiaSlot
  rol_sistema: RolSistema
  autorizado_radio: boolean
  clave_personal_radio: string | null
  estatus: EstatusUsuario
  qr_codigo_unico: string | null
}

// ── Colección `usuarios/{uid}` ───────────────────────────────────────────────

export interface Usuario extends DatosPersonales, DatosAcademicos, DatosMedicos, CamposPrivilegiados {
  uid: string
  correo: string
  /** La foto WebP vive en `fotos_perfiles/{uid}` (sin Firebase Storage). */
  tiene_foto: boolean
  creado_en: Timestamp
  actualizado_en: Timestamp
}

// ── Colección `fotos_perfiles/{uid}` (WebP base64 sin Firebase Storage) ──────

export interface FotoPerfil {
  uid: string
  imagen_webp_base64: string
  actualizado_en: Timestamp
}

// ── Colección `operativos/{id}` y subcolección `secretos/totp` ───────────────

export type CategoriaOperativo =
  | 'Operativos Masivos'
  | 'Proyectos y Soporte Técnico'
  | 'Guardias Ordinarias'
  | 'Capacitaciones, Simulacros y Difusión'

export type ModoQrOperativo = 'estatico' | 'dinamico'

export interface Operativo {
  id: string
  nombre: string
  categoria: CategoriaOperativo
  sede: string
  fecha_inicio: string
  fecha_fin: string
  descripcion: string
  recepcion_abierta: boolean
  modo_qr: ModoQrOperativo
  qr_token_estatico: string
  creado_por_uid: string
  creado_por_nombre: string
  creado_en: Timestamp
  actualizado_en: Timestamp
}

export interface SecretoTotpOperativo {
  secreto_base32: string
  periodo_segundos: 30
  digitos: 6
  actualizado_en: Timestamp
}

// ── Colección `asistencias_personal/{id}` (con Candado Duro de Salida) ───────

export type RolEnTurno =
  | 'Primeros Auxilios'
  | 'Radiocomunicación'
  | 'Búsqueda y Rescate'
  | 'Evacuación'
  | 'Logística'
  | 'Encargado'
  | 'Sin asignar'

export type EstadoOperativo = 'En servicio' | 'En descanso' | 'Reserva' | 'Retirado'

export type MetodoEntrada =
  | 'QR_Operativo_TOTP'
  | 'QR_Operativo_Estatico'
  | 'QR_Credencial'
  | 'Manual'

export interface SignosVitales {
  spo2: string
  fc: string
  fr: string
  ta: string
  temp: string
  tomado_en: Timestamp
  tomado_por: string
}

export interface AsistenciaPersonal {
  id: string
  operativo_id: string
  operativo_nombre: string
  usuario_uid: string
  usuario_nombre: string
  usuario_cuenta: string
  grupo_operativo: GrupoOperativo
  ayudantia_slot: AyudantiaSlot
  rol_en_turno: RolEnTurno
  estado_operativo: EstadoOperativo
  signos_vitales: SignosVitales | null
  metodo_entrada: MetodoEntrada
  hora_entrada: Timestamp
  hora_salida: Timestamp | null
  horas_totales: number | null
  salida_cerrada_manual: boolean
  /** Contador atómico del Candado Duro de Salida (must be 0 to close exit). */
  equipos_bupc_pendientes: number
  registrado_por_uid: string
  creado_en: Timestamp
  actualizado_en: Timestamp
}

// ── Colección `equipos_turno/{id}` y `evidencias_equipos/{id}` ───────────────

export type OrigenMaterial = 'BUPC_Asignado' | 'Propio'

export type EstadoReporteEquipo = 'OK' | 'Con_Falla' | 'Devuelto' | 'Incidencia'

export interface ActaIncidencia {
  motivo: string
  evidencia_id: string | null
  registrado_por_uid: string
  registrado_por_nombre: string
  registrado_en: Timestamp
}

export interface EquipoTurno {
  id: string
  asistencia_id: string
  operativo_id: string
  usuario_uid: string
  usuario_nombre: string
  nombre_articulo: string
  codigo_inventario: string
  origen_material: OrigenMaterial
  estado_reporte: EstadoReporteEquipo
  falla_reportada: string
  devuelto: boolean
  devuelto_en: Timestamp | null
  devuelto_por_uid: string | null
  acta_incidencia: ActaIncidencia | null
  creado_por_uid: string
  creado_en: Timestamp
  actualizado_en: Timestamp
}

export interface EvidenciaEquipo {
  id: string
  equipo_id: string
  asistencia_id: string
  operativo_id: string
  imagen_webp_base64: string
  creado_por_uid: string
  creado_en: Timestamp
}

// ── Colecciones de Radio Multi-Canal y Claves ReBaCE v2 (Módulo 5) ──────────

export interface CanalRadio {
  id: string
  operativo_id: string
  nombre_canal: string
  frecuencia_etiqueta: string
  unidades_participantes: string[]
  creado_por: string
  creado_por_uid: string
  creado_en: Timestamp
  actualizado_en: Timestamp
}

export interface RegistroBitacoraRadio {
  id: string
  canal_id: string
  operativo_id: string
  /** Sello inmutable HH:MM:SS (blindado en firestore.rules). */
  hora_original: string
  origen: string
  destinos: string[]
  actividades: string
  registrado_por: string
  registrado_por_uid: string
  fue_editado: boolean
  actividad_original_respaldo: string | null
  editado_en: Timestamp | null
  editado_por: string | null
  creado_en: Timestamp
  actualizado_en: Timestamp
  /** Solo estado en memoria del cliente (desde `snap.metadata.hasPendingWrites`). */
  sync_status?: 'sincronizado' | 'pendiente'
}

export type TablaRebace =
  | 'codigos_1_100'
  | 'claves_personales'
  | 'alfabeto_fonetico'
  | 'codigo_q'
  | 'morse_banderolas'

export interface ClaveRebace {
  id: string
  tabla: TablaRebace
  codigo: string
  significado: string
  categoria: string
  es_basico: boolean
  orden: number
}

// ── Colección `auditoria_eventos/{id}` (inmutable) ───────────────────────────

export type TipoEventoAuditoria =
  | 'APROBACION_USUARIO'
  | 'RECHAZO_USUARIO'
  | 'BAJA_USUARIO'
  | 'CAMBIO_ROL'
  | 'CREACION_OPERATIVO'
  | 'CAMBIO_RECEPCION_OPERATIVO'
  | 'CAMBIO_MODO_QR'
  | 'ASIGNACION_EQUIPO'
  | 'DEVOLUCION_EQUIPO'
  | 'ACTA_INCIDENCIA'
  | 'SALIDA_MANUAL'
  | 'INTENTO_ACCESO_INACTIVO'
  | 'CREACION_CANAL_RADIO'
  | 'EDICION_BITACORA_RADIO'
  | 'SEED_CLAVES_REBACE'
  | 'EDICION_CATALOGO_CLAVES'

export interface AuditoriaEvento {
  id: string
  tipo: TipoEventoAuditoria
  actor_uid: string
  actor_nombre: string
  objetivo_uid: string
  objetivo_nombre: string
  detalle: string
  creado_en: Timestamp
}
