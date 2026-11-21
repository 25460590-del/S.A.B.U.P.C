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
import type {
  AyudantiaSlot,
  DatosAcademicos,
  DatosMedicos,
  DatosPersonales,
  EstatusUsuario,
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
      rol_sistema: 'Brigadista',
      autorizado_radio: false,
      clave_personal_radio: null,
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
    rol_sistema: 'Brigadista',
    autorizado_radio: false,
    clave_personal_radio: null,
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
      if (snap.exists()) alCambiar(snap.data() as Usuario)
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

/** Solo Administrador activo (lo exige firestore.rules). */
export function escucharUsuariosPorEstatus(
  estatus: EstatusUsuario[],
  alCambiar: (usuarios: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(usuariosRef, where('estatus', 'in', estatus)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as Usuario)
      lista.sort((a, b) => (a.creado_en?.toMillis() ?? 0) - (b.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
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
  autorizado_radio: boolean
  clave_personal_radio: string | null
}

export function aprobarUsuario(admin: Usuario, objetivo: Usuario, asignacion: AsignacionAlta): Promise<void> {
  const detalle = `Alta aprobada · Grupo ${asignacion.grupo_operativo} · Ayudantía ${asignacion.ayudantia_slot}${
    asignacion.autorizado_radio ? ` · Radio autorizado (${asignacion.clave_personal_radio ?? 'sin clave'})` : ''
  }`
  return nuevoLoteConAuditoria(admin, objetivo, 'APROBACION_USUARIO', detalle, {
    ...asignacion,
    estatus: 'Activo',
    qr_codigo_unico: crypto.randomUUID(),
  })
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
