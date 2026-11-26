import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import type { PersonaAlertaInactivo } from '../components/AlertaInactivoModal'
import { resolverRolInicialOperativo, rolOperativoPorAyudantia } from '../constants/catalogos'
import { db } from '../lib/firebase'
import { normalizarNombrePropio } from '../lib/nombres'
import {
  ayudantiaEfectiva,
  ayudantiaJefatura,
  esAdmin,
  esEncargado,
  esOperativoCerrado,
  etapaEfectiva,
  grupoDesdeEtapa,
  normalizarOperativo,
  normalizarUsuario,
  type AyudantiaActiva,
} from '../lib/permisos'
import type {
  AsistenciaPersonal,
  EquipoTurno,
  EstadoOperativo,
  MetodoEntrada,
  Operativo,
  PerfilOperativoMinimo,
  RolEnTurno,
  Usuario,
} from '../types'
import { escucharDirectorioSegunRol, nombreCompleto } from './authService'
import { obtenerMiPrerregistro } from './prerregistrosService'

const asistenciasRef = collection(db, 'asistencias_personal')
const equiposRef = collection(db, 'equipos_turno')
const usuariosRef = collection(db, 'usuarios')
const perfilesOperativosRef = collection(db, 'perfiles_operativos')
const auditoriaRef = collection(db, 'auditoria_eventos')

/** Ventana anti-rebote: si un turno abierto tiene menos de 5 min, exige confirmación explícita antes de cerrar salida. */
export const VENTANA_ANTIREBOTE_MS = 5 * 60 * 1000

export type PersonaOperativa = Usuario | PerfilOperativoMinimo

export function nombreDePersona(persona: PersonaOperativa): string {
  if ('nombre_completo' in persona && persona.nombre_completo) {
    return normalizarNombrePropio(persona.nombre_completo)
  }
  if ('nombres' in persona) {
    return nombreCompleto(persona)
  }
  return 'Brigadista'
}

function normalizarPerfilOperativo(raw: Partial<PerfilOperativoMinimo>, uidFallback: string): PerfilOperativoMinimo {
  const ay = ayudantiaEfectiva({
    ayudantia: raw.ayudantia,
    ayudantia_slot: raw.ayudantia_slot ?? 'Ninguna',
  })
  const etapa = etapaEfectiva({
    etapa: raw.etapa,
    grupo_operativo: raw.grupo_operativo ?? 'Ninguno',
  })
  const grupo =
    raw.grupo_operativo === 'Alfa' || raw.grupo_operativo === 'Omega' || raw.grupo_operativo === 'Ninguno'
      ? raw.grupo_operativo
      : grupoDesdeEtapa(etapa)
  return {
    uid: raw.uid || uidFallback,
    nombre_completo: normalizarNombrePropio(raw.nombre_completo ?? 'Brigadista'),
    numero_cuenta: (raw.numero_cuenta || '0').trim() || '0',
    estatus: raw.estatus ?? 'Pendiente',
    etapa,
    subgrupo: (raw.subgrupo ?? '').trim(),
    ayudantia: ay,
    grupo_operativo: grupo,
    ayudantia_slot: ay,
    qr_codigo_unico: raw.qr_codigo_unico ?? null,
    clave_radio: (raw.clave_radio ?? '').trim(),
    actualizado_en: raw.actualizado_en as PerfilOperativoMinimo['actualizado_en'],
  }
}

function formatearHoraHHMM(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Parseo de códigos QR ─────────────────────────────────────────────────────

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
      accion: 'confirmar_salida_anticipada'
      asistenciaId: string
      operativoNombre: string
      usuarioNombre: string
      horaEntradaTexto: string
      minutosTranscurridos: number
      qrOriginal: string
    }
  | {
      accion: 'candado_duro'
      asistencia: AsistenciaPersonal
      pendientes: EquipoTurno[]
    }
  | {
      accion: 'perfil_inactivo'
      usuario: PersonaAlertaInactivo
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
 * y eliminando atómicamente el candado determinista `operativos/{opId}/presentes/{uid}`
 * dentro de la misma transacción.
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

    const candadoRef = doc(db, 'operativos', actual.operativo_id, 'presentes', actual.usuario_uid)
    const candadoSnap = await tx.get(candadoRef)

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

    if (candadoSnap.exists() && candadoSnap.data()?.asistencia_id === asistenciaId) {
      tx.delete(candadoRef)
    }

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

/**
 * Crea la entrada junto al documento candado determinista `operativos/{opId}/presentes/{uid}`
 * dentro de la misma transacción: elimina cualquier condición de carrera ante escaneos simultáneos.
 */
async function crearEntradaAtomica(
  actor: Usuario,
  brigadista: PersonaOperativa,
  operativo: Operativo,
  metodo: MetodoEntrada,
  rolInicial?: RolEnTurno,
  pruebaQr?: string,
): Promise<string> {
  const nuevoDoc = doc(asistenciasRef)
  const candadoRef = doc(db, 'operativos', operativo.id, 'presentes', brigadista.uid)
  const grupoValido =
    brigadista.grupo_operativo === 'Alfa' ||
    brigadista.grupo_operativo === 'Omega' ||
    brigadista.grupo_operativo === 'Ninguno'
      ? brigadista.grupo_operativo
      : grupoDesdeEtapa(brigadista.etapa)
  const ayudantiaValida = ayudantiaEfectiva(brigadista)
  const rolFinal = rolInicial ?? rolOperativoPorAyudantia(ayudantiaValida)
  const cuentaValida = (brigadista.numero_cuenta || '0').trim().slice(0, 12) || '0'
  const nombreBrig = nombreDePersona(brigadista)

  await runTransaction(db, async (tx) => {
    const candadoSnap = await tx.get(candadoRef)
    if (candadoSnap.exists()) {
      throw new Error(`${nombreBrig} ya tiene un turno abierto en este operativo.`)
    }

    tx.set(candadoRef, {
      asistencia_id: nuevoDoc.id,
      usuario_uid: brigadista.uid,
      operativo_id: operativo.id,
      ayudantia_slot: ayudantiaValida,
      creado_en: serverTimestamp(),
    })

    const payloadAsistencia: Record<string, unknown> = {
      id: nuevoDoc.id,
      operativo_id: operativo.id,
      operativo_nombre: operativo.nombre,
      usuario_uid: brigadista.uid,
      usuario_nombre: nombreBrig,
      usuario_cuenta: cuentaValida,
      grupo_operativo: grupoValido,
      ayudantia_slot: ayudantiaValida,
      rol_en_turno: rolFinal,
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
    }
    if (pruebaQr) {
      payloadAsistencia.prueba_qr = pruebaQr
    }

    tx.set(nuevoDoc, payloadAsistencia)
  })

  return nuevoDoc.id
}

async function leerPersonaPorCredencial(
  actor: Usuario,
  uidObjetivo: string,
): Promise<PersonaOperativa | null> {
  const ayJefe = ayudantiaJefatura(actor)

  try {
    const perfilSnap = await getDoc(doc(perfilesOperativosRef, uidObjetivo))
    if (perfilSnap.exists()) {
      return normalizarPerfilOperativo(
        perfilSnap.data() as Partial<PerfilOperativoMinimo>,
        uidObjetivo,
      )
    }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'permission-denied' && ayJefe) {
      throw new Error(
        `Esta credencial corresponde a un integrante fuera de tu ayudantía (${ayJefe}). Solo puedes pasar lista a personal de ${ayJefe}.`,
      )
    }
    throw err
  }

  // Respaldo para cuentas históricas sin proyección en `perfiles_operativos`
  try {
    const userSnap = await getDoc(doc(usuariosRef, uidObjetivo))
    if (userSnap.exists()) {
      return normalizarUsuario(userSnap.data() as Usuario)
    }
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ''
    if (code === 'permission-denied') {
      if (ayJefe) {
        throw new Error(
          `Esta credencial corresponde a un integrante fuera de tu ayudantía (${ayJefe}). Solo puedes pasar lista a personal de ${ayJefe}.`,
        )
      }
      return null
    }
    throw err
  }

  return null
}

/**
 * Registro de asistencia por QR de doble vía:
 * - VÍA 1: QR del Operativo (Dinámico o Fijo). Valida la prueba de presencia (`prueba_qr`)
 *   directamente en `firestore.rules` sin exponer secretos al brigadista.
 * - VÍA 2: Credencial QR de Brigadista (escaneada por Encargado/Admin). Lee `perfiles_operativos/{uid}`
 *   para no depender de `usuarios/{uid}` (preservando privacidad de Ficha de Emergencia).
 * - Protege contra doble escaneo accidental en los primeros 5 minutos exigiendo confirmación explícita.
 */
export async function registrarAsistenciaQR(
  actor: Usuario,
  qrRaw: string,
  operativoActual?: Operativo | null,
  opciones?: { confirmarSalidaAnticipada?: boolean },
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
    if (esOperativoCerrado(operativo)) {
      throw new Error(
        `El operativo "${operativo.nombre}" ya fue ${operativo.estatus === 'Cancelado' ? 'cancelado' : 'finalizado'}.`,
      )
    }

    if (qr.tipo === 'operativo_estatico' && operativo.modo_qr !== 'estatico') {
      throw new Error('Este operativo requiere escanear el código QR dinámico vigente.')
    }
    if (qr.tipo === 'operativo_totp' && operativo.modo_qr !== 'dinamico') {
      throw new Error('Este operativo utiliza código QR fijo.')
    }

    // Recepción Cerrada: permite registrar salida a quien ya tiene entrada abierta.
    const abierta = await buscarAsistenciaAbierta(actor.uid, operativo.id)
    if (abierta) {
      const entradaMs = abierta.hora_entrada?.toMillis() ?? 0
      if (
        !opciones?.confirmarSalidaAnticipada &&
        entradaMs > 0 &&
        Date.now() - entradaMs < VENTANA_ANTIREBOTE_MS
      ) {
        return {
          accion: 'confirmar_salida_anticipada',
          asistenciaId: abierta.id,
          operativoNombre: operativo.nombre,
          usuarioNombre: nombreCompleto(actor),
          horaEntradaTexto: formatearHoraHHMM(entradaMs),
          minutosTranscurridos: Math.max(0, Math.floor((Date.now() - entradaMs) / 60_000)),
          qrOriginal: qrRaw,
        }
      }

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
    const pruebaQr = (qr.tipo === 'operativo_totp' ? qr.totp : qr.token).trim()
    if (!pruebaQr) {
      throw new Error('El código QR escaneado no incluye un token de verificación válido.')
    }

    const prerregistroPropio = await obtenerMiPrerregistro(operativo.id, actor.uid).catch(
      () => null,
    )
    const rolInicial = resolverRolInicialOperativo(ayudantiaEfectiva(actor), prerregistroPropio)

    try {
      const asistenciaId = await crearEntradaAtomica(
        actor,
        actor,
        operativo,
        metodo,
        rolInicial,
        pruebaQr,
      )
      return {
        accion: 'entrada',
        asistenciaId,
        operativoNombre: operativo.nombre,
        usuarioNombre: nombreCompleto(actor),
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'permission-denied') {
        throw new Error(
          qr.tipo === 'operativo_totp'
            ? 'El código QR dinámico expiró o no es válido. Escanea nuevamente el código proyectado en pantalla.'
            : 'El código QR fijo no corresponde a este operativo o la recepción fue cerrada.',
        )
      }
      throw err
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
  if (esOperativoCerrado(opNormalizado)) {
    throw new Error(
      `El operativo "${opNormalizado.nombre}" ya fue ${opNormalizado.estatus === 'Cancelado' ? 'cancelado' : 'finalizado'}.`,
    )
  }

  const ayJefe = ayudantiaJefatura(actor)
  const brigadista = await leerPersonaPorCredencial(actor, qr.uid)
  if (!brigadista) {
    throw new Error('La credencial escaneada no corresponde a un usuario registrado.')
  }
  if (ayJefe && ayudantiaEfectiva(brigadista) !== ayJefe) {
    throw new Error(`Solo puedes pasar lista a integrantes de tu ayudantía (${ayJefe}).`)
  }

  const nombreBrig = nombreDePersona(brigadista)

  if (brigadista.estatus === 'Inactivo') {
    await addDoc(auditoriaRef, {
      tipo: 'INTENTO_ACCESO_INACTIVO',
      actor_uid: actor.uid,
      actor_nombre: nombreCompleto(actor),
      objetivo_uid: brigadista.uid,
      objetivo_nombre: nombreBrig,
      detalle: `Intento de escaneo bloqueado en ${opNormalizado.nombre}`,
      creado_en: serverTimestamp(),
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
    const entradaMs = abierta.hora_entrada?.toMillis() ?? 0
    if (
      !opciones?.confirmarSalidaAnticipada &&
      entradaMs > 0 &&
      Date.now() - entradaMs < VENTANA_ANTIREBOTE_MS
    ) {
      return {
        accion: 'confirmar_salida_anticipada',
        asistenciaId: abierta.id,
        operativoNombre: opNormalizado.nombre,
        usuarioNombre: nombreBrig,
        horaEntradaTexto: formatearHoraHHMM(entradaMs),
        minutosTranscurridos: Math.max(0, Math.floor((Date.now() - entradaMs) / 60_000)),
        qrOriginal: qrRaw,
      }
    }

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
      usuarioNombre: nombreBrig,
      horasTotales: resSalida.horasTotales,
    }
  }

  if (!opNormalizado.recepcion_abierta) {
    throw new Error(
      `La recepción de "${opNormalizado.nombre}" está cerrada. No se admiten nuevas entradas; solo salidas de personal ya registrado.`,
    )
  }

  const prerregistroBrig = await obtenerMiPrerregistro(opNormalizado.id, brigadista.uid).catch(
    () => null,
  )
  const rolInicial = resolverRolInicialOperativo(ayudantiaEfectiva(brigadista), prerregistroBrig)
  const asistenciaId = await crearEntradaAtomica(
    actor,
    brigadista,
    opNormalizado,
    'QR_Credencial',
    rolInicial,
  )
  return {
    accion: 'entrada',
    asistenciaId,
    operativoNombre: opNormalizado.nombre,
    usuarioNombre: nombreBrig,
  }
}

// ── Acciones del Encargado / Administrador en Bitácora ───────────────────────

export async function registrarAsistenciaManual(
  encargado: Usuario,
  operativo: Operativo,
  brigadista: PersonaOperativa,
  rolEnTurno?: RolEnTurno,
): Promise<ResultadoRegistroQR> {
  const ayJefe = ayudantiaJefatura(encargado)
  if (ayJefe && ayudantiaEfectiva(brigadista) !== ayJefe) {
    throw new Error(`Solo puedes pasar lista a integrantes de tu ayudantía (${ayJefe}).`)
  }
  const opNorm = normalizarOperativo(operativo)
  if (esOperativoCerrado(opNorm)) {
    throw new Error(
      `El operativo "${opNorm.nombre}" ya fue ${opNorm.estatus === 'Cancelado' ? 'cancelado' : 'finalizado'}.`,
    )
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
  const nombreBrig = nombreDePersona(brigadista)
  const rolFinal =
    rolEnTurno ??
    resolverRolInicialOperativo(
      ayudantiaEfectiva(brigadista),
      await obtenerMiPrerregistro(operativo.id, brigadista.uid).catch(() => null),
    )
  const asistenciaId = await crearEntradaAtomica(
    encargado,
    brigadista,
    operativo,
    'Manual',
    rolFinal,
  )
  return {
    accion: 'entrada',
    asistenciaId,
    operativoNombre: operativo.nombre,
    usuarioNombre: nombreBrig,
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
  ayudantiaFiltro?: AyudantiaActiva | null,
): Unsubscribe {
  const consulta = ayudantiaFiltro
    ? query(
        asistenciasRef,
        where('operativo_id', '==', operativoId),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(asistenciasRef, where('operativo_id', '==', operativoId))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as AsistenciaPersonal)
      lista.sort((a, b) => (b.hora_entrada?.toMillis() ?? 0) - (a.hora_entrada?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

export const LIMITE_MIS_ASISTENCIAS = 50

export function escucharMisAsistencias(
  uid: string,
  alCambiar: (lista: AsistenciaPersonal[]) => void,
  alFallar: (error: FirestoreError) => void,
  limite = LIMITE_MIS_ASISTENCIAS,
): Unsubscribe {
  return onSnapshot(
    query(
      asistenciasRef,
      where('usuario_uid', '==', uid),
      orderBy('hora_entrada', 'desc'),
      limit(limite),
    ),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as AsistenciaPersonal)
      lista.sort((a, b) => (b.hora_entrada?.toMillis() ?? 0) - (a.hora_entrada?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

/**
 * Carga paginada ("Cargar más") de asistencias anteriores del brigadista.
 */
export async function obtenerMasMisAsistencias(
  uid: string,
  antesDe: Timestamp,
  limite = LIMITE_MIS_ASISTENCIAS,
): Promise<{ asistencias: AsistenciaPersonal[]; hayMas: boolean }> {
  const snap = await getDocs(
    query(
      asistenciasRef,
      where('usuario_uid', '==', uid),
      orderBy('hora_entrada', 'desc'),
      startAfter(antesDe),
      limit(limite),
    ),
  )
  const asistencias = snap.docs.map((d) => d.data() as AsistenciaPersonal)
  return {
    asistencias,
    hayMas: snap.docs.length === limite,
  }
}

/**
 * Suscripción a `perfiles_operativos` (sin datos médicos) para Bitácora Operativa:
 * - Administrador y Encargado sin ayudantía: padrón operativo global Activo/Inactivo
 *   (desbloquea Manual, Prerregistrar y Confirmar entrada sin relajar privacidad de `usuarios`).
 * - Jefe de Ayudantía: consulta estrictamente acotada por `where('ayudantia', '==', ayJefe)`.
 */
export function escucharPerfilesOperativosParaBitacora(
  actor: Usuario,
  alCambiar: (lista: PerfilOperativoMinimo[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  const ayJefe = ayudantiaJefatura(actor)
  const consulta = ayJefe
    ? query(perfilesOperativosRef, where('ayudantia', '==', ayJefe))
    : query(perfilesOperativosRef, where('estatus', 'in', ['Activo', 'Inactivo']))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs
        .map((d) => normalizarPerfilOperativo(d.data() as Partial<PerfilOperativoMinimo>, d.id))
        .filter((p) => p.estatus === 'Activo' || p.estatus === 'Inactivo')
      lista.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es-MX'))
      alCambiar(lista)
    },
    alFallar,
  )
}

/**
 * Suscripción a `usuarios` (con Ficha de Emergencia) para Bitácora Operativa:
 * - Administrador: global `estatus in ['Activo', 'Inactivo']`.
 * - Jefe de Ayudantía: `where('ayudantia', '==', ayJefe)`.
 * - Encargado sin ayudantía (Opción B): estrictamente acotado a sus `grupos_a_cargo`.
 */
export function escucharUsuariosParaBitacora(
  actor: Usuario,
  alCambiar: (lista: Usuario[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  if (esAdmin(actor)) {
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

  const ayJefe = ayudantiaJefatura(actor)
  if (ayJefe) {
    return onSnapshot(
      query(usuariosRef, where('ayudantia', '==', ayJefe)),
      (snap) => {
        const lista = snap.docs
          .map((d) => normalizarUsuario(d.data() as Usuario))
          .filter((u) => u.estatus === 'Activo' || u.estatus === 'Inactivo')
        lista.sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es-MX'))
        alCambiar(lista)
      },
      alFallar,
    )
  }

  return escucharDirectorioSegunRol(actor, alCambiar, alFallar)
}
