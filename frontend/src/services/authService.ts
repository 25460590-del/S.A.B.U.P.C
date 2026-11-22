import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { AYUDANTIAS, ETAPAS_BRIGADISTA } from '../constants/catalogos'
import {
  esAdmin,
  esEncargadoAP,
  esEncargadoTesla,
  etapaDesdeGrupo,
  grupoDesdeEtapa,
  normalizarClaveRadio,
  normalizarUsuario,
  puedeAsignarRadio,
  puedeGestionarBrigadista,
} from '../lib/permisos'
import type {
  AyudantiaSlot,
  DatosAcademicos,
  DatosMedicos,
  DatosPersonales,
  EstatusUsuario,
  EtapaBrigadista,
  GrupoOperativo,
  RolSistema,
  TipoEventoAuditoria,
  Usuario,
} from '../types'

const usuariosRef = collection(db, 'usuarios')
const auditoriaRef = collection(db, 'auditoria_eventos')

export function nombreCompleto(u: Pick<Usuario, 'nombres' | 'apellido_paterno' | 'apellido_materno'>): string {
  return [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' ')
}

// ── Sesión ───────────────────────────────────────────────────────────────────

export async function iniciarSesion(correo: string, contrasena: string): Promise<void> {
  await signInWithEmailAndPassword(auth, correo.trim(), contrasena)
}

/**
 * Inicio de sesión con Google (@ucol.mx o @gmail.com).
 * Usa popup y hace fallback automático a redirección en navegadores móviles o si se bloquea el popup.
 */
export async function iniciarSesionConGoogle(): Promise<void> {
  const proveedor = new GoogleAuthProvider()
  proveedor.setCustomParameters({ prompt: 'select_account' })
  try {
    await signInWithPopup(auth, proveedor)
  } catch (error) {
    const codigo = (error as { code?: string })?.code ?? ''
    if (
      codigo === 'auth/popup-blocked' ||
      codigo === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, proveedor)
      return
    }
    throw error
  }
}

export function reenviarVerificacionCorreo(user: User): Promise<void> {
  return sendEmailVerification(user)
}

export async function verificarEstadoCorreo(user: User): Promise<boolean> {
  await user.reload()
  return Boolean(auth.currentUser?.emailVerified)
}

export function cerrarSesion(): Promise<void> {
  return signOut(auth)
}

export function recuperarContrasena(correo: string): Promise<void> {
  return sendPasswordResetEmail(auth, correo.trim())
}

// ── Registro multipaso (Personal → Académico → Médico) ──────────────────────

export interface DatosRegistro {
  correo: string
  contrasena: string
  personal: DatosPersonales
  academico: DatosAcademicos
  medico: DatosMedicos
}

/**
 * Crea la cuenta en Authentication y el expediente `usuarios/{uid}` en estado
 * Pendiente. Si Firestore rechaza el expediente, se elimina la cuenta de Auth
 * para no dejar usuarios huérfanos.
 */
export async function registrarBrigadista(datos: DatosRegistro): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, datos.correo.trim(), datos.contrasena)

  try {
    await setDoc(doc(usuariosRef, user.uid), {
      uid: user.uid,
      correo: user.email,
      ...datos.personal,
      ...datos.academico,
      ...datos.medico,
      // Valores iniciales forzados también por firestore.rules
      grupo_operativo: 'Ninguno',
      ayudantia_slot: 'Ninguna',
      etapa: 'Alfa',
      subgrupo: '',
      ayudantia: 'Ninguna',
      grupos_a_cargo: [],
      rol_sistema: 'Brigadista',
      autorizado_radio: false,
      clave_personal_radio: null,
      clave_radio: '',
      estatus: 'Pendiente',
      qr_codigo_unico: null,
      tiene_foto: false,
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    })
    await sendEmailVerification(user).catch(() => undefined)
  } catch (error) {
    await deleteUser(user).catch(() => signOut(auth))
    throw error
  }
}

export interface DatosRegistroSinContrasena {
  personal: DatosPersonales
  academico: DatosAcademicos
  medico: DatosMedicos
}

/**
 * Completa el expediente `usuarios/{uid}` para un usuario ya autenticado con Google.
 */
export async function completarRegistroGoogle(
  user: User,
  datos: DatosRegistroSinContrasena,
): Promise<void> {
  if (!user.email) {
    throw new Error('La cuenta de Google no proporcionó un correo electrónico válido.')
  }
  await setDoc(doc(usuariosRef, user.uid), {
    uid: user.uid,
    correo: user.email,
    ...datos.personal,
    ...datos.academico,
    ...datos.medico,
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    etapa: 'Alfa',
    subgrupo: '',
    ayudantia: 'Ninguna',
    grupos_a_cargo: [],
    rol_sistema: 'Brigadista',
    autorizado_radio: false,
    clave_personal_radio: null,
    clave_radio: '',
    estatus: 'Pendiente',
    qr_codigo_unico: null,
    tiene_foto: false,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  })
}

// ── Listeners en tiempo real ─────────────────────────────────────────────────

/**
 * Escucha `usuarios/{uid}`. Entrega `undefined` mientras la caché local aún no
 * confirma con el servidor, `null` si el expediente no existe.
 */
export function escucharPerfil(
  uid: string,
  alCambiar: (perfil: Usuario | null | undefined) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(usuariosRef, uid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.exists()) alCambiar(normalizarUsuario(snap.data() as Usuario))
      else alCambiar(snap.metadata.fromCache ? undefined : null)
    },
    alFallar,
  )
}

/** Fuerza lectura desde el servidor (botón "Verificar estado de aprobación"). */
export async function verificarEstatusEnServidor(uid: string): Promise<EstatusUsuario | null> {
  const snap = await getDocFromServer(doc(usuariosRef, uid))
  return snap.exists() ? (snap.data() as Usuario).estatus : null
}

/** Solo Administrador / AP / Tesla activo (lo exige firestore.rules). */
export function escucharUsuariosPorEstatus(
  estatus: EstatusUsuario[],
  alCambiar: (usuarios: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(usuariosRef, where('estatus', 'in', estatus)),
    (snap) => {
      const lista = snap.docs.map((d) => normalizarUsuario(d.data() as Usuario))
      lista.sort((a, b) => (a.creado_en?.toMillis() ?? 0) - (b.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

/**
 * Consulta acotada del directorio según rol (escala Plan Spark 150 → 300 personas):
 * - Administrador, Encargado AP o Encargado Tesla: un solo listener sobre `usuarios`.
 * - Encargado normal (Opción B): consultas acotadas únicamente a `Brigadistas` dentro de `grupos_a_cargo`.
 * Nunca descarga `fotos_perfiles`.
 */
export function escucharDirectorioSegunRol(
  actor: Usuario,
  alCambiar: (usuarios: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  if (esAdmin(actor) || esEncargadoAP(actor) || esEncargadoTesla(actor)) {
    return onSnapshot(
      usuariosRef,
      (snap) => {
        const lista = snap.docs.map((d) => normalizarUsuario(d.data() as Usuario))
        lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es-MX'))
        alCambiar(lista)
      },
      alFallar,
    )
  }

  const grupos = actor.grupos_a_cargo ?? []
  if (actor.rol_sistema !== 'Encargado' || grupos.length === 0) {
    alCambiar([])
    return () => undefined
  }

  const ayudantiasSet = new Set<string>(AYUDANTIAS)
  const etapasSet = new Set<string>(ETAPAS_BRIGADISTA)

  const ayudantiasACargo = grupos.filter((g) => ayudantiasSet.has(g)).slice(0, 10)
  const etapasACargo = grupos.filter((g) => etapasSet.has(g)).slice(0, 10)
  const subgruposACargo = grupos
    .filter((g) => !ayudantiasSet.has(g) && !etapasSet.has(g))
    .slice(0, 30)

  const buckets = new Map<string, Usuario[]>()
  const unsubs: Unsubscribe[] = []

  const emitir = () => {
    const porUid = new Map<string, Usuario>()
    for (const lista of buckets.values()) {
      for (const u of lista) porUid.set(u.uid, u)
    }
    const combinada = Array.from(porUid.values())
    combinada.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es-MX'))
    alCambiar(combinada)
  }

  const suscribir = (clave: string, q: ReturnType<typeof query>) => {
    unsubs.push(
      onSnapshot(
        q,
        (snap) => {
          buckets.set(
            clave,
            snap.docs.map((d) => normalizarUsuario(d.data() as Usuario)),
          )
          emitir()
        },
        alFallar,
      ),
    )
  }

  if (subgruposACargo.length > 0) {
    suscribir(
      'subgrupos',
      query(
        usuariosRef,
        where('rol_sistema', '==', 'Brigadista'),
        where('subgrupo', 'in', subgruposACargo),
      ),
    )
  }
  if (ayudantiasACargo.length > 0) {
    suscribir(
      'ayudantias',
      query(
        usuariosRef,
        where('rol_sistema', '==', 'Brigadista'),
        where('ayudantia', 'in', ayudantiasACargo),
      ),
    )
  }
  if (etapasACargo.length > 0) {
    suscribir(
      'etapas',
      query(
        usuariosRef,
        where('rol_sistema', '==', 'Brigadista'),
        where('etapa', 'in', etapasACargo),
      ),
    )
  }

  if (unsubs.length === 0) {
    alCambiar([])
    return () => undefined
  }

  return () => {
    for (const u of unsubs) u()
  }
}

// ── Acciones de Administrador (writeBatch + auditoría inmutable) ────────────

function nuevoLoteConAuditoria(
  admin: Usuario,
  objetivo: Usuario,
  tipo: TipoEventoAuditoria,
  detalle: string,
  cambios: Record<string, unknown>,
) {
  const lote = writeBatch(db)
  lote.update(doc(usuariosRef, objetivo.uid), { ...cambios, actualizado_en: serverTimestamp() })
  lote.set(doc(auditoriaRef), {
    tipo,
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: objetivo.uid,
    objetivo_nombre: nombreCompleto(objetivo),
    detalle,
    creado_en: serverTimestamp(),
  })
  return lote.commit()
}

export interface AsignacionAlta {
  grupo_operativo: GrupoOperativo
  ayudantia_slot: AyudantiaSlot
  etapa?: EtapaBrigadista
  subgrupo?: string
  ayudantia?: AyudantiaSlot
  autorizado_radio?: boolean
  clave_personal_radio?: string | null
  clave_radio?: string
}

export function aprobarUsuario(admin: Usuario, objetivo: Usuario, asignacion: AsignacionAlta): Promise<void> {
  const etapa = asignacion.etapa ?? etapaDesdeGrupo(asignacion.grupo_operativo)
  const subgrupo = (asignacion.subgrupo ?? '').trim()
  const ayudantia = asignacion.ayudantia ?? asignacion.ayudantia_slot
  const cambios: Record<string, unknown> = {
    grupo_operativo: asignacion.grupo_operativo,
    ayudantia_slot: ayudantia,
    etapa,
    subgrupo,
    ayudantia,
    estatus: 'Activo',
    qr_codigo_unico: objetivo.qr_codigo_unico ?? crypto.randomUUID(),
  }

  let detalleRadio = ''
  if (puedeAsignarRadio(admin, objetivo) && typeof asignacion.autorizado_radio === 'boolean') {
    const clave = normalizarClaveRadio(asignacion.clave_radio ?? asignacion.clave_personal_radio)
    cambios.autorizado_radio = asignacion.autorizado_radio
    cambios.clave_radio = clave
    cambios.clave_personal_radio = clave ? clave.slice(0, 10) : null
    if (asignacion.autorizado_radio) {
      detalleRadio = ` · Radio autorizado (${clave || 'sin clave'})`
    }
  }

  const detalle = `Alta aprobada · Etapa ${etapa}${subgrupo ? ` (${subgrupo})` : ''} · Ayudantía ${ayudantia}${detalleRadio}`
  return nuevoLoteConAuditoria(admin, objetivo, 'APROBACION_USUARIO', detalle, cambios)
}

export interface DatosRadioUsuario {
  autorizado_radio: boolean
  clave_radio: string
}

/**
 * Dominio exclusivo de TESLA (solo cuentas ajenas) o Administrador.
 * Normaliza `clave_radio` a mayúsculas y sincroniza `clave_personal_radio`.
 */
export function actualizarRadioUsuario(
  actor: Usuario,
  objetivo: Usuario,
  datos: DatosRadioUsuario,
): Promise<void> {
  if (!puedeAsignarRadio(actor, objetivo)) {
    return Promise.reject(
      new Error('Solo un Encargado de Tesla (en cuentas ajenas) o un Administrador puede asignar radio.'),
    )
  }
  const clave = normalizarClaveRadio(datos.clave_radio)
  const claveAnterior = objetivo.clave_radio || objetivo.clave_personal_radio || 'Sin clave'
  const cambiosTexto: string[] = []
  if (objetivo.autorizado_radio !== datos.autorizado_radio) {
    cambiosTexto.push(
      `Radio: ${objetivo.autorizado_radio ? 'Autorizado' : 'No autorizado'} → ${
        datos.autorizado_radio ? 'Autorizado' : 'No autorizado'
      }`,
    )
  }
  if (claveAnterior !== (clave || 'Sin clave')) {
    cambiosTexto.push(`Clave: ${claveAnterior} → ${clave || 'Sin clave'}`)
  }
  const detalle =
    cambiosTexto.join(' · ') ||
    (datos.autorizado_radio
      ? `Radio autorizado · Clave ${clave || 'sin clave'}`
      : 'Autorización de radio revocada')

  return nuevoLoteConAuditoria(actor, objetivo, 'ASIGNACION_RADIO', detalle, {
    autorizado_radio: datos.autorizado_radio,
    clave_radio: clave,
    clave_personal_radio: clave ? clave.slice(0, 10) : null,
  })
}

export interface DatosEdicionExpediente {
  etapa?: EtapaBrigadista
  subgrupo?: string
  ayudantia?: AyudantiaSlot
  estatus?: EstatusUsuario
  rol_sistema?: RolSistema
  grupos_a_cargo?: string[]
  autorizado_radio?: boolean
  clave_radio?: string
}

/**
 * Edición post-incorporación desde el Expediente Unificado respetando estrictamente
 * los campos permitidos por rol en `firestore.rules` y registrando diff antes → después
 * en `auditoria_eventos`.
 */
export function guardarEdicionExpediente(
  actor: Usuario,
  objetivo: Usuario,
  cambios: DatosEdicionExpediente,
): Promise<void> {
  if (!puedeGestionarBrigadista(actor, objetivo)) {
    return Promise.reject(new Error('No tienes permiso para editar este expediente.'))
  }

  const soyAdmin = esAdmin(actor)
  const soyAP = esEncargadoAP(actor)
  const payload: Record<string, unknown> = {}
  const diffs: string[] = []

  if (cambios.etapa !== undefined && cambios.etapa !== objetivo.etapa) {
    payload.etapa = cambios.etapa
    payload.grupo_operativo = grupoDesdeEtapa(cambios.etapa)
    diffs.push(`Etapa: ${objetivo.etapa} → ${cambios.etapa}`)
  }
  if (cambios.subgrupo !== undefined) {
    const sg = cambios.subgrupo.trim()
    if (sg !== (objetivo.subgrupo || '')) {
      payload.subgrupo = sg
      diffs.push(`Subgrupo: ${objetivo.subgrupo || 'Ninguno'} → ${sg || 'Ninguno'}`)
    }
  }
  if (cambios.ayudantia !== undefined && cambios.ayudantia !== objetivo.ayudantia) {
    payload.ayudantia = cambios.ayudantia
    payload.ayudantia_slot = cambios.ayudantia
    diffs.push(`Ayudantía: ${objetivo.ayudantia} → ${cambios.ayudantia}`)
  }
  if (
    (soyAdmin || soyAP) &&
    cambios.estatus !== undefined &&
    cambios.estatus !== objetivo.estatus
  ) {
    payload.estatus = cambios.estatus
    if (cambios.estatus === 'Activo' && !objetivo.qr_codigo_unico) {
      payload.qr_codigo_unico = crypto.randomUUID()
    }
    diffs.push(`Estatus: ${objetivo.estatus} → ${cambios.estatus}`)
  }
  if (soyAdmin && cambios.rol_sistema !== undefined && cambios.rol_sistema !== objetivo.rol_sistema) {
    payload.rol_sistema = cambios.rol_sistema
    diffs.push(`Rol: ${objetivo.rol_sistema} → ${cambios.rol_sistema}`)
  }
  if (soyAdmin && cambios.grupos_a_cargo !== undefined) {
    const limpios = Array.from(
      new Set(cambios.grupos_a_cargo.map((g) => g.trim()).filter(Boolean)),
    ).slice(0, 30)
    const previos = (objetivo.grupos_a_cargo ?? []).join(', ') || 'Ninguno'
    const nuevos = limpios.join(', ') || 'Ninguno'
    if (previos !== nuevos) {
      payload.grupos_a_cargo = limpios
      diffs.push(`Grupos a cargo: ${previos} → ${nuevos}`)
    }
  }
  if (soyAdmin && cambios.autorizado_radio !== undefined) {
    if (cambios.autorizado_radio !== objetivo.autorizado_radio) {
      payload.autorizado_radio = cambios.autorizado_radio
      diffs.push(
        `Radio: ${objetivo.autorizado_radio ? 'Sí' : 'No'} → ${cambios.autorizado_radio ? 'Sí' : 'No'}`,
      )
    }
  }
  if (soyAdmin && cambios.clave_radio !== undefined) {
    const clave = normalizarClaveRadio(cambios.clave_radio)
    const previa = objetivo.clave_radio || objetivo.clave_personal_radio || ''
    if (clave !== previa) {
      payload.clave_radio = clave
      payload.clave_personal_radio = clave ? clave.slice(0, 10) : null
      diffs.push(`Clave radio: ${previa || 'Sin clave'} → ${clave || 'Sin clave'}`)
    }
  }

  if (Object.keys(payload).length === 0) {
    return Promise.resolve()
  }

  const tipoEvento: TipoEventoAuditoria =
    payload.rol_sistema !== undefined
      ? 'CAMBIO_ROL'
      : payload.estatus === 'Inactivo'
        ? 'BAJA_USUARIO'
        : payload.estatus === 'Activo' && objetivo.estatus === 'Pendiente'
          ? 'APROBACION_USUARIO'
          : 'ACTUALIZACION_PERSONAL'

  return nuevoLoteConAuditoria(
    actor,
    objetivo,
    tipoEvento,
    diffs.join(' · ').slice(0, 500),
    payload,
  )
}

export interface DatosOperativosPersonal {
  etapa?: EtapaBrigadista
  subgrupo?: string
  ayudantia?: AyudantiaSlot
  estatus?: EstatusUsuario
}

/**
 * Actualiza campos operativos de un brigadista (Admin, AP o Encargado Opción B).
 * Nunca modifica `rol_sistema`, `grupos_a_cargo` ni campos de radio.
 */
export function actualizarPersonalOperativo(
  actor: Usuario,
  objetivo: Usuario,
  cambios: DatosOperativosPersonal,
): Promise<void> {
  if (!puedeGestionarBrigadista(actor, objetivo)) {
    return Promise.reject(new Error('No tienes permiso para editar el perfil de este brigadista.'))
  }
  const payload: Record<string, unknown> = {}
  const resumen: string[] = []

  if (cambios.etapa !== undefined) {
    payload.etapa = cambios.etapa
    payload.grupo_operativo = grupoDesdeEtapa(cambios.etapa)
    resumen.push(`Etapa: ${cambios.etapa}`)
  }
  if (cambios.subgrupo !== undefined) {
    const sg = cambios.subgrupo.trim()
    payload.subgrupo = sg
    resumen.push(`Subgrupo: ${sg || 'Ninguno'}`)
  }
  if (cambios.ayudantia !== undefined) {
    payload.ayudantia = cambios.ayudantia
    payload.ayudantia_slot = cambios.ayudantia
    resumen.push(`Ayudantía: ${cambios.ayudantia}`)
  }
  if (cambios.estatus !== undefined) {
    payload.estatus = cambios.estatus
    resumen.push(`Estatus: ${cambios.estatus}`)
  }

  return nuevoLoteConAuditoria(
    actor,
    objetivo,
    'ACTUALIZACION_PERSONAL',
    resumen.join(' · ') || 'Actualización operativa',
    payload,
  )
}

/** Exclusivo Administrador: asigna los subgrupos/ayudantías a cargo de un Encargado. */
export function actualizarGruposACargo(
  admin: Usuario,
  objetivo: Usuario,
  gruposACargo: string[],
): Promise<void> {
  const limpios = Array.from(new Set(gruposACargo.map((g) => g.trim()).filter(Boolean))).slice(0, 30)
  return nuevoLoteConAuditoria(
    admin,
    objetivo,
    'ACTUALIZACION_PERSONAL',
    `Grupos a cargo: ${limpios.length > 0 ? limpios.join(', ') : 'Ninguno'}`,
    { grupos_a_cargo: limpios },
  )
}

export function rechazarUsuario(admin: Usuario, objetivo: Usuario): Promise<void> {
  return nuevoLoteConAuditoria(admin, objetivo, 'RECHAZO_USUARIO', 'Solicitud de alta rechazada', {
    estatus: 'Inactivo',
  })
}

export function darDeBajaUsuario(admin: Usuario, objetivo: Usuario, motivo: string): Promise<void> {
  return nuevoLoteConAuditoria(admin, objetivo, 'BAJA_USUARIO', `Baja definitiva · ${motivo}`, {
    estatus: 'Inactivo',
  })
}

export function cambiarRolUsuario(admin: Usuario, objetivo: Usuario, rol: RolSistema): Promise<void> {
  return nuevoLoteConAuditoria(
    admin,
    objetivo,
    'CAMBIO_ROL',
    `Rol ${objetivo.rol_sistema} → ${rol}`,
    { rol_sistema: rol },
  )
}

// ── Mensajes de error en español (México) ────────────────────────────────────

const MENSAJES: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/email-already-in-use': 'Ya existe una cuenta con este correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Verifica tu red e intenta de nuevo.',
  'auth/operation-not-allowed': 'El acceso con correo no está habilitado en el proyecto.',
  'permission-denied': 'No tienes permiso para realizar esta acción.',
  unavailable: 'Sin conexión con el servidor. Intenta de nuevo.',
}

export function mensajeDeError(error: unknown): string {
  const codigo = (error as { code?: string })?.code ?? ''
  return MENSAJES[codigo] ?? 'Ocurrió un error inesperado. Intenta de nuevo.'
}
