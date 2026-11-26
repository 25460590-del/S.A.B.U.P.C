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
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { AYUDANTIAS, ETAPAS_BRIGADISTA } from '../constants/catalogos'
import { normalizarNombrePropio, normalizarParentesco } from '../lib/nombres'
import {
  ayudantiaEfectiva,
  ayudantiaJefatura,
  esAdmin,
  esAyudantiaValidaParaEtapa,
  etapaDesdeGrupo,
  etiquetaAyudantia,
  grupoDesdeEtapa,
  normalizarClaveRadio,
  normalizarUsuario,
  puedeAsignarRadio,
  puedeCambiarEstatusBrigadista,
  puedeGestionarBrigadista,
} from '../lib/permisos'
import type {
  AyudantiaSlot,
  DatosAcademicos,
  DatosMedicos,
  DatosPersonales,
  EstatusUsuario,
  EtapaBrigadista,
  EtapaFormativa,
  GrupoOperativo,
  RolSistema,
  TipoEventoAuditoria,
  TipoSangre,
  Usuario,
} from '../types'

const usuariosRef = collection(db, 'usuarios')
const perfilesOperativosRef = collection(db, 'perfiles_operativos')
const auditoriaRef = collection(db, 'auditoria_eventos')

function construirPayloadPerfilOperativo(u: {
  uid: string
  nombres: string
  apellido_paterno: string
  apellido_materno: string
  numero_cuenta: string
  estatus: EstatusUsuario
  etapa: EtapaBrigadista
  subgrupo: string
  ayudantia: AyudantiaSlot
  grupo_operativo: GrupoOperativo
  ayudantia_slot: AyudantiaSlot
  qr_codigo_unico: string | null
  clave_radio: string
}) {
  return {
    uid: u.uid,
    nombre_completo: nombreCompleto(u),
    numero_cuenta: (u.numero_cuenta || '0').trim(),
    estatus: u.estatus,
    etapa: u.etapa,
    subgrupo: u.subgrupo || '',
    ayudantia: u.ayudantia,
    grupo_operativo: u.grupo_operativo,
    ayudantia_slot: u.ayudantia_slot,
    qr_codigo_unico: u.qr_codigo_unico ?? null,
    clave_radio: u.clave_radio || '',
    actualizado_en: serverTimestamp(),
  }
}

export function nombreCompleto(
  u: Pick<Usuario, 'nombres' | 'apellido_paterno' | 'apellido_materno'>,
): string {
  return normalizarNombrePropio(
    [u.nombres, u.apellido_paterno, u.apellido_materno].filter(Boolean).join(' '),
  )
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

// ── Registro multipaso (Personal → Académico → Ficha de Emergencia) ─────────

export interface DatosRegistro {
  correo: string
  contrasena: string
  personal: DatosPersonales
  academico: DatosAcademicos
  medico: DatosMedicos
}

function normalizarDatosPersonalesRegistro(p: DatosPersonales): DatosPersonales {
  return {
    ...p,
    nombres: normalizarNombrePropio(p.nombres),
    apellido_paterno: normalizarNombrePropio(p.apellido_paterno),
    apellido_materno: normalizarNombrePropio(p.apellido_materno),
  }
}

function normalizarFichaEmergenciaRegistro(m: DatosMedicos): DatosMedicos {
  return {
    ...m,
    alergias: m.alergias.trim() || 'Ninguna',
    padecimientos_medicamentos: m.padecimientos_medicamentos.trim() || 'Ninguno',
    contacto_emergencia_nombre: normalizarNombrePropio(m.contacto_emergencia_nombre),
    contacto_emergencia_parentesco: normalizarParentesco(m.contacto_emergencia_parentesco),
    contacto_emergencia_telefono: m.contacto_emergencia_telefono.trim(),
  }
}

/**
 * Crea la cuenta en Authentication y los documentos `usuarios/{uid}` y
 * `perfiles_operativos/{uid}` en estado Pendiente. Si Firestore rechaza el lote,
 * se elimina la cuenta de Auth para no dejar usuarios huérfanos.
 */
export async function registrarBrigadista(datos: DatosRegistro): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, datos.correo.trim(), datos.contrasena)
  const personalNormalizado = normalizarDatosPersonalesRegistro(datos.personal)
  const academicoNormalizado: DatosAcademicos = {
    nivel_academico: datos.academico.nivel_academico,
    escuela_carrera: datos.academico.escuela_carrera.trim(),
    numero_cuenta: datos.academico.numero_cuenta.trim(),
  }
  const fichaNormalizada = normalizarFichaEmergenciaRegistro(datos.medico)

  try {
    const lote = writeBatch(db)
    lote.set(doc(usuariosRef, user.uid), {
      uid: user.uid,
      correo: user.email,
      ...personalNormalizado,
      ...academicoNormalizado,
      ...fichaNormalizada,
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
    lote.set(
      doc(perfilesOperativosRef, user.uid),
      construirPayloadPerfilOperativo({
        uid: user.uid,
        ...personalNormalizado,
        numero_cuenta: academicoNormalizado.numero_cuenta,
        estatus: 'Pendiente',
        etapa: 'Alfa',
        subgrupo: '',
        ayudantia: 'Ninguna',
        grupo_operativo: 'Ninguno',
        ayudantia_slot: 'Ninguna',
        qr_codigo_unico: null,
        clave_radio: '',
      }),
    )
    await lote.commit()
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
 * Recrea o completa el expediente `usuarios/{uid}` y `perfiles_operativos/{uid}` en estado
 * Pendiente para una cuenta ya autenticada en Firebase Auth (Google o cuenta huérfana correo/contraseña).
 */
export async function completarRegistroAutenticado(
  user: User,
  datos: DatosRegistroSinContrasena,
): Promise<void> {
  if (!user.email) {
    throw new Error('La cuenta autenticada no proporcionó un correo electrónico válido.')
  }
  const personalNormalizado = normalizarDatosPersonalesRegistro(datos.personal)
  const academicoNormalizado: DatosAcademicos = {
    nivel_academico: datos.academico.nivel_academico,
    escuela_carrera: datos.academico.escuela_carrera.trim(),
    numero_cuenta: datos.academico.numero_cuenta.trim(),
  }
  const fichaNormalizada = normalizarFichaEmergenciaRegistro(datos.medico)

  const lote = writeBatch(db)
  lote.set(doc(usuariosRef, user.uid), {
    uid: user.uid,
    correo: user.email,
    ...personalNormalizado,
    ...academicoNormalizado,
    ...fichaNormalizada,
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
  lote.set(
    doc(perfilesOperativosRef, user.uid),
    construirPayloadPerfilOperativo({
      uid: user.uid,
      ...personalNormalizado,
      numero_cuenta: academicoNormalizado.numero_cuenta,
      estatus: 'Pendiente',
      etapa: 'Alfa',
      subgrupo: '',
      ayudantia: 'Ninguna',
      grupo_operativo: 'Ninguno',
      ayudantia_slot: 'Ninguna',
      qr_codigo_unico: null,
      clave_radio: '',
    }),
  )
  await lote.commit()
}

export const completarRegistroGoogle = completarRegistroAutenticado

/**
 * Permite a un usuario con cuenta en estado `Pendiente` corregir cualquiera de los datos
 * enviados en su registro antes de ser aprobado, sincronizando `perfiles_operativos/{uid}`.
 */
export async function corregirDatosPendiente(
  uid: string,
  datos: DatosRegistroSinContrasena,
): Promise<void> {
  const personalNormalizado = normalizarDatosPersonalesRegistro(datos.personal)
  const academicoNormalizado: DatosAcademicos = {
    nivel_academico: datos.academico.nivel_academico,
    escuela_carrera: datos.academico.escuela_carrera.trim(),
    numero_cuenta: datos.academico.numero_cuenta.trim(),
  }
  const fichaNormalizada = normalizarFichaEmergenciaRegistro(datos.medico)

  const lote = writeBatch(db)
  lote.update(doc(usuariosRef, uid), {
    ...personalNormalizado,
    ...academicoNormalizado,
    ...fichaNormalizada,
    actualizado_en: serverTimestamp(),
  })
  lote.set(
    doc(perfilesOperativosRef, uid),
    construirPayloadPerfilOperativo({
      uid,
      ...personalNormalizado,
      numero_cuenta: academicoNormalizado.numero_cuenta,
      estatus: 'Pendiente',
      etapa: 'Alfa',
      subgrupo: '',
      ayudantia: 'Ninguna',
      grupo_operativo: 'Ninguno',
      ayudantia_slot: 'Ninguna',
      qr_codigo_unico: null,
      clave_radio: '',
    }),
  )
  await lote.commit()
}

export interface DatosFichaEmergenciaPropia {
  tipo_sangre: TipoSangre
  alergias: string
  padecimientos_medicamentos: string
  contacto_emergencia_nombre: string
  contacto_emergencia_parentesco: string
  contacto_emergencia_telefono: string
}

/**
 * Permite al propio integrante Activo actualizar únicamente su Ficha de Emergencia
 * (sin tocar nombre completo, número de cuenta ni correo).
 */
export async function actualizarFichaEmergenciaPropia(
  uid: string,
  datos: DatosFichaEmergenciaPropia,
): Promise<void> {
  await updateDoc(doc(usuariosRef, uid), {
    tipo_sangre: datos.tipo_sangre,
    alergias: datos.alergias.trim() || 'Ninguna',
    padecimientos_medicamentos: datos.padecimientos_medicamentos.trim() || 'Ninguno',
    contacto_emergencia_nombre: normalizarNombrePropio(datos.contacto_emergencia_nombre),
    contacto_emergencia_parentesco: normalizarParentesco(datos.contacto_emergencia_parentesco),
    contacto_emergencia_telefono: datos.contacto_emergencia_telefono.trim(),
    actualizado_en: serverTimestamp(),
  })
}

export interface DatosTelefonoPropio {
  celular: string
  celular_con_whatsapp: boolean
  telefono_fijo: string
}

/**
 * Permite al propio integrante Activo actualizar únicamente sus teléfonos de contacto.
 */
export async function actualizarTelefonoPropio(
  uid: string,
  datos: DatosTelefonoPropio,
): Promise<void> {
  await updateDoc(doc(usuariosRef, uid), {
    celular: datos.celular.trim(),
    celular_con_whatsapp: datos.celular_con_whatsapp,
    telefono_fijo: datos.telefono_fijo.trim(),
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

/**
 * Escucha usuarios por estatus:
 * - Administrador: consulta global `where('estatus', 'in', estatus)`.
 * - Jefe de Ayudantía (ej. Tesla): consulta exacta `where('ayudantia', '==', ayudantiaActor)`
 *   para coincidir con `firestore.rules` sin desperdiciar lecturas y filtra `estatus` en memoria.
 */
export function escucharUsuariosPorEstatus(
  estatus: EstatusUsuario[],
  alCambiar: (usuarios: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
  actor?: Usuario,
): Unsubscribe {
  const ayJefe = actor ? ayudantiaJefatura(actor) : null
  const consulta = ayJefe
    ? query(usuariosRef, where('ayudantia', '==', ayJefe))
    : query(usuariosRef, where('estatus', 'in', estatus))
  const permitidos = new Set<EstatusUsuario>(estatus)

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs
        .map((d) => normalizarUsuario(d.data() as Usuario))
        .filter((u) => permitidos.has(u.estatus))
      lista.sort((a, b) => (a.creado_en?.toMillis() ?? 0) - (b.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

/**
 * Consulta acotada del directorio según rol (eficiencia Plan Spark):
 * - Administrador: un solo listener global sobre `usuarios`.
 * - Jefe de Ayudantía (`Encargado` + `Grupo Operativo` + ayudantía activa): consulta exacta
 *   `where('ayudantia', '==', ayJefe)` alineada con `firestore.rules` (0 lecturas fuera de su ayudantía).
 * - Encargado sin ayudantía (Opción B): consultas acotadas únicamente a `Brigadistas` dentro de `grupos_a_cargo`.
 * Nunca descarga `fotos_perfiles`.
 */
export function escucharDirectorioSegunRol(
  actor: Usuario,
  alCambiar: (usuarios: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  if (esAdmin(actor)) {
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

  const ayJefe = ayudantiaJefatura(actor)
  if (ayJefe) {
    return onSnapshot(
      query(usuariosRef, where('ayudantia', '==', ayJefe)),
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
  const subgrupo = etapa === 'Grupo Operativo' ? '' : (asignacion.subgrupo ?? '').trim()
  const ayudantia = asignacion.ayudantia ?? asignacion.ayudantia_slot
  if (!esAyudantiaValidaParaEtapa(etapa, ayudantia)) {
    return Promise.reject(
      new Error('Para asignar a Grupo Operativo es obligatorio seleccionar una ayudantía.'),
    )
  }
  // Eliminar import no usado de setDoc si ya todo va por writeBatch
  const qrGenerado = objetivo.qr_codigo_unico ?? crypto.randomUUID()
  const cambios: Record<string, unknown> = {
    grupo_operativo: grupoDesdeEtapa(etapa),
    ayudantia_slot: ayudantia,
    etapa,
    subgrupo,
    ayudantia,
    estatus: 'Activo',
    qr_codigo_unico: qrGenerado,
  }

  let claveAsignada = objetivo.clave_radio || objetivo.clave_personal_radio || ''
  let detalleRadio = ''
  if (puedeAsignarRadio(admin, objetivo) && typeof asignacion.autorizado_radio === 'boolean') {
    const clave = normalizarClaveRadio(asignacion.clave_radio ?? asignacion.clave_personal_radio)
    claveAsignada = clave
    cambios.autorizado_radio = asignacion.autorizado_radio
    cambios.clave_radio = clave
    cambios.clave_personal_radio = clave ? clave.slice(0, 10) : null
    if (asignacion.autorizado_radio) {
      detalleRadio = ` · Radio autorizado (${clave || 'sin clave'})`
    }
  }

  const detalle = `Alta aprobada · Etapa ${etapa}${subgrupo ? ` (${subgrupo})` : ''} · Ayudantía ${etiquetaAyudantia(ayudantia)}${detalleRadio}`
  const lote = writeBatch(db)
  lote.update(doc(usuariosRef, objetivo.uid), { ...cambios, actualizado_en: serverTimestamp() })
  if (esAdmin(admin) || Boolean(ayudantiaJefatura(admin))) {
    lote.set(
      doc(perfilesOperativosRef, objetivo.uid),
      construirPayloadPerfilOperativo({
        uid: objetivo.uid,
        nombres: objetivo.nombres,
        apellido_paterno: objetivo.apellido_paterno,
        apellido_materno: objetivo.apellido_materno,
        numero_cuenta: objetivo.numero_cuenta,
        estatus: 'Activo',
        etapa,
        subgrupo,
        ayudantia,
        grupo_operativo: grupoDesdeEtapa(etapa),
        ayudantia_slot: ayudantia,
        qr_codigo_unico: qrGenerado,
        clave_radio: claveAsignada,
      }),
    )
  }
  lote.set(doc(auditoriaRef), {
    tipo: 'APROBACION_USUARIO' as TipoEventoAuditoria,
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: objetivo.uid,
    objetivo_nombre: nombreCompleto(objetivo),
    detalle,
    creado_en: serverTimestamp(),
  })
  return lote.commit()
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
  nombres?: string
  apellido_paterno?: string
  apellido_materno?: string
  numero_cuenta?: string
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
 * los campos permitidos por rol en `firestore.rules`, propagando identidad y adscripción a
 * `perfiles_operativos/{uid}` y registrando `valor_anterior` / `valor_nuevo` en `auditoria_eventos`.
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
  const ayJefe = ayudantiaJefatura(actor)
  const puedoCambiarEstatus = puedeCambiarEstatusBrigadista(actor, objetivo)
  const payload: Record<string, unknown> = {}
  const diffs: string[] = []
  const partesAnterior: string[] = []
  const partesNuevo: string[] = []

  // Protección de campos identitarios: exclusivos de Administración
  const intentaCambiarIdentidad =
    (cambios.nombres !== undefined && cambios.nombres !== objetivo.nombres) ||
    (cambios.apellido_paterno !== undefined &&
      cambios.apellido_paterno !== objetivo.apellido_paterno) ||
    (cambios.apellido_materno !== undefined &&
      cambios.apellido_materno !== objetivo.apellido_materno) ||
    (cambios.numero_cuenta !== undefined &&
      cambios.numero_cuenta.trim() !== objetivo.numero_cuenta)

  if (!soyAdmin && intentaCambiarIdentidad) {
    return Promise.reject(
      new Error('Solo Administración puede corregir nombre completo o número de cuenta.'),
    )
  }

  let nombresFinal = normalizarNombrePropio(objetivo.nombres)
  let paternoFinal = normalizarNombrePropio(objetivo.apellido_paterno)
  let maternoFinal = normalizarNombrePropio(objetivo.apellido_materno)
  let cuentaFinal = objetivo.numero_cuenta.trim()

  if (soyAdmin) {
    const tocaNombre =
      cambios.nombres !== undefined ||
      cambios.apellido_paterno !== undefined ||
      cambios.apellido_materno !== undefined

    if (tocaNombre) {
      const nProp = normalizarNombrePropio(cambios.nombres ?? objetivo.nombres)
      const pProp = normalizarNombrePropio(cambios.apellido_paterno ?? objetivo.apellido_paterno)
      const mProp = normalizarNombrePropio(cambios.apellido_materno ?? objetivo.apellido_materno)

      if (!nProp || nProp.length > 80) {
        return Promise.reject(new Error('Ingresa un nombre válido (1 a 80 caracteres).'))
      }
      if (!pProp || pProp.length > 60) {
        return Promise.reject(new Error('Ingresa un apellido paterno válido (1 a 60 caracteres).'))
      }
      if (mProp.length > 60) {
        return Promise.reject(new Error('El apellido materno no debe exceder 60 caracteres.'))
      }

      if (
        nProp !== objetivo.nombres ||
        pProp !== objetivo.apellido_paterno ||
        mProp !== objetivo.apellido_materno
      ) {
        const nombrePrevioRaw = [
          objetivo.nombres,
          objetivo.apellido_paterno,
          objetivo.apellido_materno,
        ]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(' ')
        nombresFinal = nProp
        paternoFinal = pProp
        maternoFinal = mProp
        const nombreNuevoNorm = [nombresFinal, paternoFinal, maternoFinal].filter(Boolean).join(' ')

        payload.nombres = nombresFinal
        payload.apellido_paterno = paternoFinal
        payload.apellido_materno = maternoFinal
        diffs.push(`Nombre: ${nombrePrevioRaw} → ${nombreNuevoNorm}`)
        partesAnterior.push(`Nombre: ${nombrePrevioRaw}`)
        partesNuevo.push(`Nombre: ${nombreNuevoNorm}`)
      }
    }

    if (cambios.numero_cuenta !== undefined) {
      const cProp = cambios.numero_cuenta.trim()
      if (!cProp || cProp.length > 12) {
        return Promise.reject(
          new Error('Ingresa un número de cuenta válido (1 a 12 caracteres, o 0 si no aplica).'),
        )
      }
      if (cProp !== objetivo.numero_cuenta) {
        cuentaFinal = cProp
        payload.numero_cuenta = cuentaFinal
        diffs.push(`No. de cuenta: ${objetivo.numero_cuenta} → ${cuentaFinal}`)
        partesAnterior.push(`Cuenta: ${objetivo.numero_cuenta}`)
        partesNuevo.push(`Cuenta: ${cuentaFinal}`)
      }
    }
  }

  const etapaFinal = cambios.etapa ?? objetivo.etapa
  const ayudantiaFinal = cambios.ayudantia ?? ayudantiaEfectiva(objetivo)
  if (ayJefe && ayudantiaFinal !== ayJefe) {
    return Promise.reject(
      new Error(`Como Jefe de Ayudantía solo puedes gestionar integrantes dentro de ${ayJefe}.`),
    )
  }
  const tocaAdscripcion =
    cambios.etapa !== undefined ||
    cambios.subgrupo !== undefined ||
    cambios.ayudantia !== undefined

  if (tocaAdscripcion && !esAyudantiaValidaParaEtapa(etapaFinal, ayudantiaFinal)) {
    return Promise.reject(
      new Error('Para asignar a Grupo Operativo es obligatorio seleccionar una ayudantía.'),
    )
  }

  if (cambios.etapa !== undefined && cambios.etapa !== objetivo.etapa) {
    payload.etapa = cambios.etapa
    payload.grupo_operativo = grupoDesdeEtapa(cambios.etapa)
    diffs.push(`Etapa: ${objetivo.etapa} → ${cambios.etapa}`)
  }

  const subgrupoSolicitado =
    etapaFinal === 'Grupo Operativo'
      ? ''
      : cambios.subgrupo !== undefined
        ? cambios.subgrupo.trim()
        : undefined

  if (subgrupoSolicitado !== undefined && subgrupoSolicitado !== (objetivo.subgrupo || '')) {
    payload.subgrupo = subgrupoSolicitado
    diffs.push(`Grupo: ${objetivo.subgrupo || 'Ninguno'} → ${subgrupoSolicitado || 'Ninguno'}`)
  }

  if (cambios.ayudantia !== undefined && cambios.ayudantia !== objetivo.ayudantia) {
    payload.ayudantia = cambios.ayudantia
    payload.ayudantia_slot = cambios.ayudantia
    diffs.push(
      `Ayudantía: ${etiquetaAyudantia(objetivo.ayudantia)} → ${etiquetaAyudantia(cambios.ayudantia)}`,
    )
  }
  if (
    puedoCambiarEstatus &&
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

  const hayCorreccionIdentidad = partesAnterior.length > 0
  const estatusFinal = (payload.estatus as EstatusUsuario | undefined) ?? objetivo.estatus
  const subgrupoFinal =
    etapaFinal === 'Grupo Operativo'
      ? ''
      : ((payload.subgrupo as string | undefined) ?? (objetivo.subgrupo || ''))
  const qrFinal =
    (payload.qr_codigo_unico as string | null | undefined) ?? objetivo.qr_codigo_unico ?? null
  const claveFinal =
    (payload.clave_radio as string | undefined) ??
    (objetivo.clave_radio || objetivo.clave_personal_radio || '')

  const tipoEvento: TipoEventoAuditoria = hayCorreccionIdentidad
    ? 'CORRECCION_IDENTIDAD'
    : payload.rol_sistema !== undefined
      ? 'CAMBIO_ROL'
      : payload.estatus === 'Inactivo'
        ? 'BAJA_USUARIO'
        : payload.estatus === 'Activo' && objetivo.estatus === 'Pendiente'
          ? 'APROBACION_USUARIO'
          : 'ACTUALIZACION_PERSONAL'

  const lote = writeBatch(db)
  lote.update(doc(usuariosRef, objetivo.uid), { ...payload, actualizado_en: serverTimestamp() })

  // Propagar a `perfiles_operativos/{uid}` normalizando a Tipo Título cuando edita Admin o Jefe de Ayudantía
  if (soyAdmin || Boolean(ayJefe)) {
    lote.set(
      doc(perfilesOperativosRef, objetivo.uid),
      construirPayloadPerfilOperativo({
        uid: objetivo.uid,
        nombres: nombresFinal,
        apellido_paterno: paternoFinal,
        apellido_materno: maternoFinal,
        numero_cuenta: cuentaFinal,
        estatus: estatusFinal,
        etapa: etapaFinal,
        subgrupo: subgrupoFinal,
        ayudantia: ayudantiaFinal,
        grupo_operativo: grupoDesdeEtapa(etapaFinal),
        ayudantia_slot: ayudantiaFinal,
        qr_codigo_unico: qrFinal,
        clave_radio: claveFinal,
      }),
    )
  }

  const eventoData: Record<string, unknown> = {
    tipo: tipoEvento,
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: objetivo.uid,
    objetivo_nombre: nombreCompleto({
      nombres: nombresFinal,
      apellido_paterno: paternoFinal,
      apellido_materno: maternoFinal,
    }),
    detalle: diffs.join(' · ').slice(0, 500),
    creado_en: serverTimestamp(),
  }

  if (hayCorreccionIdentidad) {
    eventoData.valor_anterior = partesAnterior.join(' | ').slice(0, 500)
    eventoData.valor_nuevo = partesNuevo.join(' | ').slice(0, 500)
  }

  lote.set(doc(auditoriaRef), eventoData)
  return lote.commit()
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
  const etapaFinal = cambios.etapa ?? objetivo.etapa
  const ayudantiaFinal = cambios.ayudantia ?? ayudantiaEfectiva(objetivo)
  if (!esAyudantiaValidaParaEtapa(etapaFinal, ayudantiaFinal)) {
    return Promise.reject(
      new Error('Para asignar a Grupo Operativo es obligatorio seleccionar una ayudantía.'),
    )
  }

  const payload: Record<string, unknown> = {}
  const resumen: string[] = []

  if (cambios.etapa !== undefined) {
    payload.etapa = cambios.etapa
    payload.grupo_operativo = grupoDesdeEtapa(cambios.etapa)
    resumen.push(`Etapa: ${cambios.etapa}`)
  }
  if (etapaFinal === 'Grupo Operativo') {
    if (objetivo.subgrupo || cambios.subgrupo !== undefined) {
      payload.subgrupo = ''
    }
  } else if (cambios.subgrupo !== undefined) {
    const sg = cambios.subgrupo.trim()
    payload.subgrupo = sg
    resumen.push(`Grupo: ${sg || 'Ninguno'}`)
  }
  if (cambios.ayudantia !== undefined) {
    payload.ayudantia = cambios.ayudantia
    payload.ayudantia_slot = cambios.ayudantia
    resumen.push(`Ayudantía: ${etiquetaAyudantia(cambios.ayudantia)}`)
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

export interface DestinoPromocionLote {
  etapaOrigen: EtapaFormativa
  grupoOrigen: string
  etapaDestino: 'Omega' | 'Grupo Operativo'
  /** Obligatorio cuando etapaDestino === 'Omega' */
  subgrupoDestino?: string
  /** Ayudantía a asignar por UID para quienes estaban sin ayudantía al graduarse a Grupo Operativo */
  ayudantiasPorUid?: Record<string, AyudantiaSlot>
}

const MAX_OPS_LOTE_PROMOCION = 400

/**
 * Promoción o graduación en lote (Plan Spark 100%, writeBatch dividido en bloques ≤ 400):
 * - Alfa → Omega (asigna grupo activo de Omega y conserva la ayudantía actual)
 * - Omega → Grupo Operativo (limpia grupo formativo y exige ayudantía válida)
 * - SIERRA → Grupo Operativo (graduación directa del Diplomado de Socorrismo; exige ayudantía)
 */
export async function promoverIntegrantesEnLote(
  actor: Usuario,
  objetivos: Usuario[],
  destino: DestinoPromocionLote,
): Promise<number> {
  if (objetivos.length === 0) {
    throw new Error('Selecciona al menos un integrante para promover.')
  }

  const subgrupoOmega = (destino.subgrupoDestino ?? '').trim()
  if (destino.etapaDestino === 'Omega' && !subgrupoOmega) {
    throw new Error('Selecciona un grupo activo de Omega como destino.')
  }

  // Validar permisos y reglas de negocio antes de escribir un solo documento
  const actualizaciones: { uid: string; nombre: string; cambios: Record<string, unknown> }[] = []

  for (const u of objetivos) {
    if (!puedeGestionarBrigadista(actor, u)) {
      throw new Error(`No tienes permiso para promover a ${nombreCompleto(u)}.`)
    }
    if (destino.etapaDestino === 'Omega') {
      actualizaciones.push({
        uid: u.uid,
        nombre: nombreCompleto(u),
        cambios: {
          etapa: 'Omega',
          grupo_operativo: 'Omega',
          subgrupo: subgrupoOmega,
          actualizado_en: serverTimestamp(),
        },
      })
    } else {
      const actual = ayudantiaEfectiva(u)
      const ayudantiaFinal: AyudantiaSlot =
        actual !== 'Ninguna' ? actual : (destino.ayudantiasPorUid?.[u.uid] ?? 'Ninguna')
      if (!esAyudantiaValidaParaEtapa('Grupo Operativo', ayudantiaFinal)) {
        throw new Error(
          `Para promover a ${nombreCompleto(u)} a Grupo Operativo es obligatorio asignar una ayudantía.`,
        )
      }
      actualizaciones.push({
        uid: u.uid,
        nombre: nombreCompleto(u),
        cambios: {
          etapa: 'Grupo Operativo',
          grupo_operativo: 'Ninguno',
          subgrupo: '',
          ayudantia: ayudantiaFinal,
          ayudantia_slot: ayudantiaFinal,
          actualizado_en: serverTimestamp(),
        },
      })
    }
  }

  const etiquetaDestino =
    destino.etapaDestino === 'Omega' ? subgrupoOmega : 'Grupo Operativo'
  const nombresResumen = actualizaciones
    .slice(0, 6)
    .map((a) => a.nombre)
    .join(', ')
  const sufijoExtra =
    actualizaciones.length > 6 ? ` y ${actualizaciones.length - 6} más` : ''
  const detalleAuditoria = `Promoción en lote (${actualizaciones.length}): ${destino.grupoOrigen} (${destino.etapaOrigen}) → ${etiquetaDestino} · ${nombresResumen}${sufijoExtra}`.slice(
    0,
    500,
  )

  for (let i = 0; i < actualizaciones.length; i += MAX_OPS_LOTE_PROMOCION) {
    const bloque = actualizaciones.slice(i, i + MAX_OPS_LOTE_PROMOCION)
    const esUltimo = i + MAX_OPS_LOTE_PROMOCION >= actualizaciones.length
    const lote = writeBatch(db)
    for (const item of bloque) {
      lote.update(doc(usuariosRef, item.uid), item.cambios)
    }
    if (esUltimo) {
      lote.set(doc(auditoriaRef), {
        tipo: 'PROMOCION_LOTE' as TipoEventoAuditoria,
        actor_uid: actor.uid,
        actor_nombre: nombreCompleto(actor),
        objetivo_uid: destino.grupoOrigen.slice(0, 128),
        objetivo_nombre: `${destino.grupoOrigen} → ${etiquetaDestino}`.slice(0, 200),
        detalle: detalleAuditoria,
        creado_en: serverTimestamp(),
      })
    }
    await lote.commit()
  }

  return actualizaciones.length
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
