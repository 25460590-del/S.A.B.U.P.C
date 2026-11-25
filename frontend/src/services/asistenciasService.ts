import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import * as OTPAuth from 'otpauth'
import { db } from '../lib/firebase'
import {
  esEncargado,
  grupoDesdeEtapa,
  normalizarOperativo,
  normalizarUsuario,
} from '../lib/permisos'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  EstadoOperativo,
  MetodoEntrada,
  Operativo,
  RolEnTurno,
  SecretoTotpOperativo,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

const asistenciasRef = collection(db, 'asistencias_personal')
const equiposRef = collection(db, 'equipos_turno')
const usuariosRef = collection(db, 'usuarios')
const auditoriaRef = collection(db, 'auditoria_eventos')

// ── Parseo y validación de códigos QR ────────────────────────────────────────

export type QrEscaneado =
  | { tipo: 'operativo_totp'; op: string; totp: string }
  | { tipo: 'operativo_estatico'; op: string; token: string }
  | { tipo: 'credencial_bupc'; uid: string; cuenta: string; qr: string }

export function parsearQrEscaneado(texto: string): QrEscaneado | null {
  try {
    const data = JSON.parse(texto) as Record<string, unknown>
    if (
      data.tipo === 'operativo_totp' &&
      typeof data.op === 'string' &&
      typeof data.totp === 'string'
    ) {
      return { tipo: 'operativo_totp', op: data.op, totp: data.totp }
    }
    if (
      data.tipo === 'operativo_estatico' &&
      typeof data.op === 'string' &&
      typeof data.token === 'string'
    ) {
      return { tipo: 'operativo_estatico', op: data.op, token: data.token }
    }
    if (
      data.tipo === 'credencial_bupc' &&
      typeof data.uid === 'string' &&
      typeof data.qr === 'string'
    ) {
      return {
        tipo: 'credencial_bupc',
        uid: data.uid,
        cuenta: typeof data.cuenta === 'string' ? data.cuenta : '0',
        qr: data.qr,
      }
    }
    return null
  } catch {
    return null
  }
}

function validarTotpOffline(
  operativoId: string,
  secretoBase32: string,
  codigo: string,
): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: 'SABUPC',
    label: operativoId,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretoBase32),
  })
  // Ventana ±1 (±30 s) para tolerar ligero desfase de reloj en campo offline
  return totp.validate({ token: codigo, window: 1 }) !== null
}

// ── Resultados estructurados ─────────────────────────────────────────────────

export type ResultadoRegistroQR =
  | { accion: 'entrada'; asistenciaId: string; operativoNombre: string; usuarioNombre: string }
  | {
      accion: 'salida'
      asistenciaId: string
      operativoNombre: string
      usuarioNombre: string
      horasTotales: number
    }
  | {
      accion: 'candado_duro'
      asistencia: AsistenciaPersonal
      pendientes: EquipoTurno[]
    }
  | {
      accion: 'perfil_inactivo'
      usuario: Usuario
    }

async function obtenerEquiposBupcPendientes(
  asistenciaId: string,
  usuarioUid: string,
): Promise<EquipoTurno[]> {
  const snap = await getDocs(
    query(
      equiposRef,
      where('usuario_uid', '==', usuarioUid),
      where('asistencia_id', '==', asistenciaId),
    ),
  )
  return snap.docs
    .map((d) => d.data() as EquipoTurno)
    .filter(
      (eq) =>
        eq.origen_material === 'BUPC_Asignado' && !eq.devuelto && eq.acta_incidencia === null,
    )
}

async function buscarAsistenciaAbierta(
  usuarioUid: string,
  operativoId: string,
): Promise<AsistenciaPersonal | null> {
  const snap = await getDocs(
    query(
      asistenciasRef,
      where('usuario_uid', '==', usuarioUid),
      where('operativo_id', '==', operativoId),
    ),
  )
  const abierta = snap.docs
    .map((d) => d.data() as AsistenciaPersonal)
    .find((a) => a.hora_salida === null)
  return abierta ?? null
}

/**
 * Cierra la salida de una asistencia respetando el Candado Duro (`equipos_bupc_pendientes == 0`)
 * dentro de una transacción atómica.
 */
export async function cerrarSalidaConCandado(
  asistenciaId: string,
  actor: Usuario,
  esManual = false,
): Promise<
  | { bloqueado: true; asistencia: AsistenciaPersonal; pendientes: EquipoTurno[] }
  | { bloqueado: false; horasTotales: number }
> {
  const ref = doc(asistenciasRef, asistenciaId)
  let bloqueadaData: AsistenciaPersonal | null = null
  let horasCalculadas = 0

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('No se encontró el registro de asistencia.')
    const actual = snap.data() as AsistenciaPersonal

    if (actual.hora_salida !== null) {
      throw new Error('Esta asistencia ya tiene una salida registrada.')
    }

    if (actual.equipos_bupc_pendientes > 0) {
      bloqueadaData = actual
      return
    }

    const entradaMs = actual.hora_entrada?.toMillis() ?? Date.now()
    horasCalculadas = Math.max(0, Number(((Date.now() - entradaMs) / 3_600_000).toFixed(2)))

    const cambios: Record<string, unknown> = {
      hora_salida: serverTimestamp(),
      horas_totales: horasCalculadas,
      estado_operativo: 'Retirado',
      actualizado_en: serverTimestamp(),
    }
    if (esManual) {
      cambios.salida_cerrada_manual = true
    }

    tx.update(ref, cambios)

    if (esManual) {
      tx.set(doc(auditoriaRef), {
        tipo: 'SALIDA_MANUAL',
        actor_uid: actor.uid,
        actor_nombre: nombreCompleto(actor),
        objetivo_uid: actual.usuario_uid,
        objetivo_nombre: actual.usuario_nombre,
        detalle: `Salida cerrada manualmente en ${actual.operativo_nombre} (${horasCalculadas} h)`,
        creado_en: serverTimestamp(),
      })
    }
  })

  if (bloqueadaData) {
    const asistenciaBloqueada: AsistenciaPersonal = bloqueadaData
    const pendientes = await obtenerEquiposBupcPendientes(
      asistenciaId,
      asistenciaBloqueada.usuario_uid,
    )
    return { bloqueado: true, asistencia: asistenciaBloqueada, pendientes }
  }

  return { bloqueado: false, horasTotales: horasCalculadas }
}

async function crearEntradaAtomica(
  actor: Usuario,
  brigadista: Usuario,
  operativo: Operativo,
  metodo: MetodoEntrada,
  rolInicial: RolEnTurno = 'Sin asignar',
): Promise<string> {
  const nuevoDoc = doc(asistenciasRef)
  const grupoValido =
    brigadista.grupo_operativo === 'Alfa' ||
    brigadista.grupo_operativo === 'Omega' ||
    brigadista.grupo_operativo === 'Ninguno'
      ? brigadista.grupo_operativo
      : grupoDesdeEtapa(brigadista.etapa)
  const ayudantiaValida = brigadista.ayudantia_slot || brigadista.ayudantia || 'Ninguna'
  const cuentaValida = (brigadista.numero_cuenta || '0').trim().slice(0, 12) || '0'

  await runTransaction(db, async (tx) => {
    tx.set(nuevoDoc, {
      id: nuevoDoc.id,
      operativo_id: operativo.id,
      operativo_nombre: operativo.nombre,
      usuario_uid: brigadista.uid,
      usuario_nombre: nombreCompleto(brigadista),
      usuario_cuenta: cuentaValida,
      grupo_operativo: grupoValido,
      ayudantia_slot: ayudantiaValida,
      rol_en_turno: rolInicial,
      estado_operativo: 'En servicio',
      signos_vitales: null,
      metodo_entrada: metodo,
      hora_entrada: serverTimestamp(),
      hora_salida: null,
      horas_totales: null,
      salida_cerrada_manual: false,
      equipos_bupc_pendientes: 0,
      registrado_por_uid: actor.uid,
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    })
  })

  return nuevoDoc.id
}

/**
 * Registro de asistencia por QR de doble vía:
 * - Si el texto corresponde a un QR de Operativo (Estático o Dinámico TOTP), registra Entrada o Salida del propio usuario.
 * - Si el texto corresponde a una Credencial QR de Brigadista (escaneada por Encargado/Admin),
 *   verifica estatus (alerta roja si es Inactivo) y registra Entrada o Salida en `operativoActual`.
 */
export async function registrarAsistenciaQR(
  actor: Usuario,
  qrRaw: string,
  operativoActual?: Operativo | null,
): Promise<ResultadoRegistroQR> {
  const qr = parsearQrEscaneado(qrRaw)
  if (!qr) {
    throw new Error('Código QR no reconocido por S.A.B.U.P.C.')
  }

  // VÍA 1: Brigadista (o cualquier usuario activo) escanea el QR del Operativo
  if (qr.tipo === 'operativo_totp' || qr.tipo === 'operativo_estatico') {
    if (actor.estatus === 'Inactivo') {
      return { accion: 'perfil_inactivo', usuario: actor }
    }

    const opSnap = await getDoc(doc(db, 'operativos', qr.op))
    if (!opSnap.exists()) {
      throw new Error('El operativo indicado por el QR no existe.')
    }
    const operativo = normalizarOperativo(opSnap.data() as Operativo)
    if (operativo.estatus === 'Finalizado') {
      throw new Error(`El operativo "${operativo.nombre}" ya fue finalizado.`)
    }

    if (qr.tipo === 'operativo_estatico') {
      if (operativo.modo_qr !== 'estatico') {
        throw new Error('Este operativo requiere escanear el código QR dinámico vigente.')
      }
      if (operativo.qr_token_estatico !== qr.token) {
        throw new Error('El código QR fijo no corresponde a este operativo.')
      }
    } else {
      if (operativo.modo_qr !== 'dinamico') {
        throw new Error('Este operativo utiliza código QR fijo.')
      }
      const secretoSnap = await getDoc(doc(db, 'operativos', operativo.id, 'secretos', 'totp'))
      if (!secretoSnap.exists()) {
        throw new Error('No se encontró el código de verificación del operativo.')
      }
      const secreto = secretoSnap.data() as SecretoTotpOperativo
      if (!validarTotpOffline(operativo.id, secreto.secreto_base32, qr.totp)) {
        throw new Error('El código QR dinámico expiró. Escanea nuevamente el código en pantalla.')
      }
    }

    // Recepción Cerrada: permite registrar salida a quien ya tiene entrada abierta.
    const abierta = await buscarAsistenciaAbierta(actor.uid, operativo.id)
    if (abierta) {
      const resSalida = await cerrarSalidaConCandado(abierta.id, actor, false)
      if (resSalida.bloqueado) {
        return {
          accion: 'candado_duro',
          asistencia: resSalida.asistencia,
          pendientes: resSalida.pendientes,
        }
      }
      return {
        accion: 'salida',
        asistenciaId: abierta.id,
        operativoNombre: operativo.nombre,
        usuarioNombre: nombreCompleto(actor),
        horasTotales: resSalida.horasTotales,
      }
    }

    if (!operativo.recepcion_abierta) {
      throw new Error(
        `La recepción de "${operativo.nombre}" está cerrada. No se admiten nuevas entradas; solo salidas de personal ya registrado.`,
      )
    }

    const metodo: MetodoEntrada =
      qr.tipo === 'operativo_totp' ? 'QR_Operativo_TOTP' : 'QR_Operativo_Estatico'
    const asistenciaId = await crearEntradaAtomica(actor, actor, operativo, metodo)
    return {
      accion: 'entrada',
      asistenciaId,
      operativoNombre: operativo.nombre,
      usuarioNombre: nombreCompleto(actor),
    }
  }

  // VÍA 2: Encargado / Administrador escanea la Credencial QR de un Brigadista
  if (!esEncargado(actor)) {
    throw new Error('Solo un Encargado o Administrador puede escanear credenciales de personal.')
  }
  if (!operativoActual) {
    throw new Error('Selecciona primero un operativo activo antes de escanear una credencial.')
  }
  const opNormalizado = normalizarOperativo(operativoActual)
  if (opNormalizado.estatus === 'Finalizado') {
    throw new Error(`El operativo "${opNormalizado.nombre}" ya fue finalizado.`)
  }

  const userSnap = await getDoc(doc(usuariosRef, qr.uid))
  if (!userSnap.exists()) {
    throw new Error('La credencial escaneada no corresponde a un usuario registrado.')
  }
  const brigadista = normalizarUsuario(userSnap.data() as Usuario)

  if (brigadista.estatus === 'Inactivo') {
    await runTransaction(db, async (tx) => {
      tx.set(doc(auditoriaRef), {
        tipo: 'INTENTO_ACCESO_INACTIVO',
        actor_uid: actor.uid,
        actor_nombre: nombreCompleto(actor),
        objetivo_uid: brigadista.uid,
        objetivo_nombre: nombreCompleto(brigadista),
        detalle: `Intento de escaneo bloqueado en ${opNormalizado.nombre}`,
        creado_en: serverTimestamp(),
      })
    })
    return { accion: 'perfil_inactivo', usuario: brigadista }
  }

  if (brigadista.estatus !== 'Activo') {
    throw new Error('La cuenta escaneada está Pendiente de aprobación por un Administrador.')
  }

  if (brigadista.qr_codigo_unico && brigadista.qr_codigo_unico !== qr.qr) {
    throw new Error('La credencial QR escaneada no está vigente.')
  }

  // Recepción Cerrada: permite registrar salida a quien ya tiene entrada abierta.
  const abierta = await buscarAsistenciaAbierta(brigadista.uid, opNormalizado.id)
  if (abierta) {
    const resSalida = await cerrarSalidaConCandado(abierta.id, actor, false)
    if (resSalida.bloqueado) {
      return {
        accion: 'candado_duro',
        asistencia: resSalida.asistencia,
        pendientes: resSalida.pendientes,
      }
    }
    return {
      accion: 'salida',
      asistenciaId: abierta.id,
      operativoNombre: opNormalizado.nombre,
      usuarioNombre: nombreCompleto(brigadista),
      horasTotales: resSalida.horasTotales,
    }
  }

  if (!opNormalizado.recepcion_abierta) {
    throw new Error(
      `La recepción de "${opNormalizado.nombre}" está cerrada. No se admiten nuevas entradas; solo salidas de personal ya registrado.`,
    )
  }

  const asistenciaId = await crearEntradaAtomica(
    actor,
    brigadista,
    opNormalizado,
    'QR_Credencial',
  )
  return {
    accion: 'entrada',
    asistenciaId,
    operativoNombre: opNormalizado.nombre,
    usuarioNombre: nombreCompleto(brigadista),
  }
}

// ── Acciones del Encargado / Administrador en Bitácora ───────────────────────

export async function registrarAsistenciaManual(
  encargado: Usuario,
  operativo: Operativo,
  brigadista: Usuario,
  rolEnTurno: RolEnTurno,
): Promise<ResultadoRegistroQR> {
  const opNorm = normalizarOperativo(operativo)
  if (opNorm.estatus === 'Finalizado') {
    throw new Error(`El operativo "${opNorm.nombre}" ya fue finalizado.`)
  }
  if (!opNorm.recepcion_abierta) {
    throw new Error(
      `La recepción de "${opNorm.nombre}" está cerrada. Reábrela si deseas registrar nuevas entradas.`,
    )
  }
  if (brigadista.estatus === 'Inactivo') {
    return { accion: 'perfil_inactivo', usuario: brigadista }
  }
  if (brigadista.estatus !== 'Activo') {
    throw new Error('Solo se puede registrar personal con cuenta Activa.')
  }
  const abierta = await buscarAsistenciaAbierta(brigadista.uid, operativo.id)
  if (abierta) {
    throw new Error(`${nombreCompleto(brigadista)} ya tiene una entrada abierta en este operativo.`)
  }
  const asistenciaId = await crearEntradaAtomica(
    encargado,
    brigadista,
    operativo,
    'Manual',
    rolEnTurno,
  )
  return {
    accion: 'entrada',
    asistenciaId,
    operativoNombre: operativo.nombre,
    usuarioNombre: nombreCompleto(brigadista),
  }
}

export function actualizarRolEnTurno(asistenciaId: string, rol: RolEnTurno): Promise<void> {
  return updateDoc(doc(asistenciasRef, asistenciaId), {
    rol_en_turno: rol,
    actualizado_en: serverTimestamp(),
  })
}

export function actualizarEstadoOperativo(
  asistenciaId: string,
  estado: EstadoOperativo,
): Promise<void> {
  return updateDoc(doc(asistenciasRef, asistenciaId), {
    estado_operativo: estado,
    actualizado_en: serverTimestamp(),
  })
}

export interface DatosSignosVitales {
  spo2: string
  fc: string
  fr: string
  ta: string
  temp: string
}

export function guardarSignosVitales(
  asistenciaId: string,
  actor: Usuario,
  vitales: DatosSignosVitales,
): Promise<void> {
  return updateDoc(doc(asistenciasRef, asistenciaId), {
    signos_vitales: {
      spo2: vitales.spo2.trim(),
      fc: vitales.fc.trim(),
      fr: vitales.fr.trim(),
      ta: vitales.ta.trim(),
      temp: vitales.temp.trim(),
      tomado_en: serverTimestamp(),
      tomado_por: nombreCompleto(actor),
    },
    actualizado_en: serverTimestamp(),
  })
}

// ── Listeners en tiempo real ─────────────────────────────────────────────────

export function escucharAsistenciasDeOperativo(
  operativoId: string,
  alCambiar: (lista: AsistenciaPersonal[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(asistenciasRef, where('operativo_id', '==', operativoId)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as AsistenciaPersonal)
      lista.sort((a, b) => (b.hora_entrada?.toMillis() ?? 0) - (a.hora_entrada?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

export function escucharMisAsistencias(
  uid: string,
  alCambiar: (lista: AsistenciaPersonal[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(asistenciasRef, where('usuario_uid', '==', uid)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as AsistenciaPersonal)
      lista.sort((a, b) => (b.hora_entrada?.toMillis() ?? 0) - (a.hora_entrada?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

export function escucharUsuariosParaBitacora(
  alCambiar: (lista: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(usuariosRef, where('estatus', 'in', ['Activo', 'Inactivo'])),
    (snap) => {
      const lista = snap.docs.map((d) => normalizarUsuario(d.data() as Usuario))
      lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es-MX'))
      alCambiar(lista)
    },
    alFallar,
  )
}
