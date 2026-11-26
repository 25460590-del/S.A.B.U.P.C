import {
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
  writeBatch,
  type DocumentData,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import {
  esAdmin,
  esOperativoCerrado,
  normalizarOperativo,
  puedeConfigurarOperativoActivo,
  puedeEliminarOperativo,
  puedeFinalizarOperativo,
} from '../lib/permisos'
import type {
  AsistenciaPersonal,
  CategoriaOperativo,
  EquipoTurno,
  ModoQrOperativo,
  Operativo,
  SecretoEstaticoOperativo,
  SecretoVigenteOperativo,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

const operativosRef = collection(db, 'operativos')
const asistenciasRef = collection(db, 'asistencias_personal')
const equiposRef = collection(db, 'equipos_turno')
const auditoriaRef = collection(db, 'auditoria_eventos')

/** Máximo seguro de operaciones por writeBatch (límite Firestore = 500). */
const MAX_OPS_LOTE = 400

/** Intervalo de rotación del nonce QR dinámico en pantalla del Encargado/Admin (30 s). */
export const PERIODO_QR_DINAMICO_SEG = 30
/** Ventana mínima entre rotaciones en Firestore para evitar colisiones entre múltiples pantallas. */
const UMBRAL_ROTACION_MS = 25_000

const ALFABETO_NONCE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface DatosNuevoOperativo {
  nombre: string
  categoria: CategoriaOperativo
  sede: string
  fecha_inicio: string
  fecha_fin: string
  descripcion: string
  modo_qr: ModoQrOperativo
  recepcion_abierta: boolean
  convocatoria_abierta?: boolean
  cupo_sugerido?: number | null
}

function normalizarCupoSugerido(cupo?: number | null): number | null {
  if (typeof cupo !== 'number' || !Number.isFinite(cupo)) return null
  const entero = Math.floor(cupo)
  return entero > 0 ? Math.min(entero, 1000) : null
}

/** Genera un código criptográfico alfanumérico de 8 caracteres para prueba de presencia QR. */
export function generarNonceQr(longitud = 8): string {
  const bytes = new Uint8Array(longitud)
  crypto.getRandomValues(bytes)
  let salida = ''
  for (let i = 0; i < longitud; i++) {
    salida += ALFABETO_NONCE[bytes[i] % ALFABETO_NONCE.length]
  }
  return salida
}

function generarTokenEstatico(): string {
  return `BUPC-OP-${crypto.randomUUID()}`
}

/**
 * Crea un operativo y sus secretos QR protegidos en la subcolección `operativos/{id}/secretos/`
 * (`estatico` y `vigente`, legibles/escribibles únicamente por Encargado o Administrador),
 * sin exponer el token estático en el documento público del operativo.
 */
export async function crearYConfigurarOperativo(
  actor: Usuario,
  datos: DatosNuevoOperativo,
): Promise<string> {
  const opDoc = doc(operativosRef)
  const secretoEstaticoDoc = doc(db, 'operativos', opDoc.id, 'secretos', 'estatico')
  const secretoVigenteDoc = doc(db, 'operativos', opDoc.id, 'secretos', 'vigente')
  const contadorMetaDoc = doc(db, 'operativos', opDoc.id, 'meta', 'contador')
  const qrTokenEstatico = generarTokenEstatico()
  const nonceInicial = generarNonceQr()
  const convocatoriaAbierta = Boolean(datos.convocatoria_abierta)
  const cupoSugerido = normalizarCupoSugerido(datos.cupo_sugerido)

  const lote = writeBatch(db)
  lote.set(opDoc, {
    id: opDoc.id,
    nombre: datos.nombre.trim(),
    categoria: datos.categoria,
    sede: datos.sede.trim(),
    fecha_inicio: datos.fecha_inicio.trim(),
    fecha_fin: datos.fecha_fin.trim(),
    descripcion: datos.descripcion.trim(),
    estatus: 'Activo',
    recepcion_abierta: datos.recepcion_abierta,
    convocatoria_abierta: convocatoriaAbierta,
    cupo_sugerido: cupoSugerido,
    modo_qr: datos.modo_qr,
    creado_por_uid: actor.uid,
    creado_por_nombre: nombreCompleto(actor),
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  })

  lote.set(contadorMetaDoc, {
    prerregistros_count: 0,
    actualizado_en: serverTimestamp(),
  })

  lote.set(secretoEstaticoDoc, {
    token: qrTokenEstatico,
    actualizado_en: serverTimestamp(),
  })

  lote.set(secretoVigenteDoc, {
    nonce: nonceInicial,
    nonce_anterior: null,
    actualizado_en: serverTimestamp(),
  })

  lote.set(doc(auditoriaRef), {
    tipo: 'CREACION_OPERATIVO',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: opDoc.id,
    objetivo_nombre: datos.nombre.trim(),
    detalle: `${datos.categoria} · Sede: ${datos.sede.trim()} · Modo QR: ${datos.modo_qr}${convocatoriaAbierta ? ` · Convocatoria abierta${cupoSugerido ? ` (cupo ${cupoSugerido})` : ''}` : ''}`,
    creado_en: serverTimestamp(),
  })

  await lote.commit()
  return opDoc.id
}

/**
 * Escucha únicamente los operativos activos (`estatus == 'Activo'`) para vistas operativas en vivo
 * (Plan Spark: evita descargar todo el histórico de operativos cerrados en tiempo real).
 */
export function escucharOperativosActivos(
  alCambiar: (operativos: Operativo[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(operativosRef, where('estatus', '==', 'Activo')),
    (snap) => {
      const lista = snap.docs
        .map((d) => normalizarOperativo(d.data() as Operativo))
        .filter((op) => !esOperativoCerrado(op))
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al consultar operativos activos:', err.code)
    },
  )
}

export interface PaginaOperativos {
  operativos: Operativo[]
  ultimoDoc: QueryDocumentSnapshot<DocumentData> | null
  hayMas: boolean
}

/**
 * Lectura paginada (`getDocs` + `orderBy('creado_en', 'desc')` + `limit(N)`) para Archivo Operativo
 * e históricos sin abrir listeners globales sobre toda la colección `operativos`.
 */
export async function obtenerOperativosPaginados(
  tamanoPagina = 20,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<PaginaOperativos> {
  const consulta = cursor
    ? query(operativosRef, orderBy('creado_en', 'desc'), startAfter(cursor), limit(tamanoPagina))
    : query(operativosRef, orderBy('creado_en', 'desc'), limit(tamanoPagina))
  const snap = await getDocs(consulta)
  const operativos = snap.docs.map((d) => normalizarOperativo(d.data() as Operativo))
  const ultimoDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null
  return {
    operativos,
    ultimoDoc,
    hayMas: snap.docs.length === tamanoPagina,
  }
}

/**
 * Lectura puntual de respaldo (`getDoc`) solo cuando un registro histórico carece de metadatos
 * desnormalizados (ej. `operativo_nombre` o `categoria`).
 */
export async function obtenerOperativoPorId(operativoId: string): Promise<Operativo | null> {
  const snap = await getDoc(doc(operativosRef, operativoId))
  return snap.exists() ? normalizarOperativo(snap.data() as Operativo) : null
}

/**
 * Permite a Administración o Encargado sin ayudantía abrir/cerrar la convocatoria y ajustar
 * el cupo sugerido mientras el operativo siga Activo.
 */
export async function actualizarConvocatoriaOperativo(
  actor: Usuario,
  operativo: Operativo,
  cambios: { convocatoria_abierta: boolean; cupo_sugerido: number | null },
): Promise<void> {
  if (!puedeConfigurarOperativoActivo(actor)) {
    throw new Error('No tienes permiso para modificar la convocatoria global del operativo.')
  }
  const cupo = normalizarCupoSugerido(cambios.cupo_sugerido)
  const lote = writeBatch(db)
  lote.update(doc(operativosRef, operativo.id), {
    convocatoria_abierta: cambios.convocatoria_abierta,
    cupo_sugerido: cupo,
    actualizado_en: serverTimestamp(),
  })
  lote.set(doc(auditoriaRef), {
    tipo: 'CAMBIO_CONVOCATORIA_OPERATIVO',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `${cambios.convocatoria_abierta ? 'Convocatoria abierta' : 'Convocatoria cerrada'} · Cupo sugerido: ${cupo ?? 'Sin límite'}`,
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}

// ── Secretos de prueba de presencia QR (exclusivos Encargado / Administrador) ─

export function escucharSecretoEstatico(
  operativoId: string,
  alCambiar: (secreto: SecretoEstaticoOperativo | null) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'operativos', operativoId, 'secretos', 'estatico'),
    (snap) => {
      alCambiar(snap.exists() ? (snap.data() as SecretoEstaticoOperativo) : null)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer secreto QR fijo:', err.code)
    },
  )
}

/**
 * Garantiza que exista `operativos/{id}/secretos/estatico` (útil para operativos
 * históricos creados antes del blindaje de secretos QR).
 */
export async function asegurarSecretoEstatico(operativoId: string): Promise<string> {
  const ref = doc(db, 'operativos', operativoId, 'secretos', 'estatico')
  let tokenFinal = ''
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) {
      tokenFinal = (snap.data() as SecretoEstaticoOperativo).token
      return
    }
    tokenFinal = generarTokenEstatico()
    tx.set(ref, {
      token: tokenFinal,
      actualizado_en: serverTimestamp(),
    })
  })
  return tokenFinal
}

export function escucharSecretoVigente(
  operativoId: string,
  alCambiar: (secreto: SecretoVigenteOperativo | null) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'operativos', operativoId, 'secretos', 'vigente'),
    (snap) => {
      alCambiar(snap.exists() ? (snap.data() as SecretoVigenteOperativo) : null)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer secreto QR dinámico:', err.code)
    },
  )
}

/**
 * Rota el nonce vigente en `operativos/{id}/secretos/vigente` preservando `nonce_anterior`
 * para mantener una ventana de gracia (~60 s). Si otra pantalla de Encargado ya rotó hace
 * menos de 25 s, respeta ese valor sin sobrescribir la ventana de gracia.
 */
export async function rotarNonceOperativo(
  operativoId: string,
  forzar = false,
): Promise<string> {
  const ref = doc(db, 'operativos', operativoId, 'secretos', 'vigente')
  let nonceFinal = ''

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      nonceFinal = generarNonceQr()
      tx.set(ref, {
        nonce: nonceFinal,
        nonce_anterior: null,
        actualizado_en: serverTimestamp(),
      })
      return
    }

    const actual = snap.data() as SecretoVigenteOperativo
    const ultimoMs = actual.actualizado_en?.toMillis() ?? 0
    if (!forzar && ultimoMs > 0 && Date.now() - ultimoMs < UMBRAL_ROTACION_MS) {
      nonceFinal = actual.nonce
      return
    }

    nonceFinal = generarNonceQr()
    tx.set(ref, {
      nonce: nonceFinal,
      nonce_anterior: actual.nonce,
      actualizado_en: serverTimestamp(),
    })
  })

  return nonceFinal
}

export async function cambiarRecepcionOperativo(
  actor: Usuario,
  operativo: Operativo,
  recepcionAbierta: boolean,
): Promise<void> {
  if (!puedeConfigurarOperativoActivo(actor)) {
    throw new Error('No tienes permiso para abrir o cerrar la recepción global del operativo.')
  }
  const lote = writeBatch(db)
  lote.update(doc(operativosRef, operativo.id), {
    recepcion_abierta: recepcionAbierta,
    actualizado_en: serverTimestamp(),
  })
  lote.set(doc(auditoriaRef), {
    tipo: 'CAMBIO_RECEPCION_OPERATIVO',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: recepcionAbierta ? 'Recepción abierta' : 'Recepción cerrada',
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}

export async function cambiarModoQrOperativo(
  actor: Usuario,
  operativo: Operativo,
  modoQr: ModoQrOperativo,
): Promise<void> {
  if (!puedeConfigurarOperativoActivo(actor)) {
    throw new Error('No tienes permiso para cambiar el modo QR del operativo.')
  }
  const lote = writeBatch(db)
  lote.update(doc(operativosRef, operativo.id), {
    modo_qr: modoQr,
    actualizado_en: serverTimestamp(),
  })
  lote.set(doc(auditoriaRef), {
    tipo: 'CAMBIO_MODO_QR',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `Modo QR cambiado a ${modoQr === 'dinamico' ? 'Dinámico (30s)' : 'Estático (PNG)'}`,
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}

export interface DeudorOperativo {
  asistencia: AsistenciaPersonal
  equiposPendientes: EquipoTurno[]
}

export interface ResultadoPreCierreOperativo {
  deudores: DeudorOperativo[]
  asistenciasAbiertas: AsistenciaPersonal[]
  totalAsistencias: number
}

/**
 * Pre-verificación en vivo antes de finalizar un operativo:
 * detecta cualquier asistente con `equipos_bupc_pendientes > 0` y devuelve
 * el desglose exacto de su material pendiente para bloquear el cierre.
 */
export async function verificarPreCierreOperativo(
  operativoId: string,
): Promise<ResultadoPreCierreOperativo> {
  const [asisSnap, eqSnap] = await Promise.all([
    getDocs(query(asistenciasRef, where('operativo_id', '==', operativoId))),
    getDocs(query(equiposRef, where('operativo_id', '==', operativoId))),
  ])

  const asistencias = asisSnap.docs.map((d) => d.data() as AsistenciaPersonal)
  const equiposPendientesOp = eqSnap.docs
    .map((d) => d.data() as EquipoTurno)
    .filter(
      (eq) =>
        eq.origen_material === 'BUPC_Asignado' && !eq.devuelto && eq.acta_incidencia === null,
    )

  const porAsistencia = new Map<string, EquipoTurno[]>()
  for (const eq of equiposPendientesOp) {
    const lista = porAsistencia.get(eq.asistencia_id) ?? []
    lista.push(eq)
    porAsistencia.set(eq.asistencia_id, lista)
  }

  const deudores: DeudorOperativo[] = asistencias
    .filter((a) => a.equipos_bupc_pendientes > 0 || (porAsistencia.get(a.id)?.length ?? 0) > 0)
    .map((a) => ({
      asistencia: a,
      equiposPendientes: porAsistencia.get(a.id) ?? [],
    }))

  const asistenciasAbiertas = asistencias.filter((a) => a.hora_salida === null)

  return {
    deudores,
    asistenciasAbiertas,
    totalAsistencias: asistencias.length,
  }
}

export class ErrorDeudoresEnCierre extends Error {
  readonly preCierre: ResultadoPreCierreOperativo

  constructor(mensaje: string, preCierre: ResultadoPreCierreOperativo) {
    super(mensaje)
    this.name = 'ErrorDeudoresEnCierre'
    this.preCierre = preCierre
  }
}

/**
 * Cierre definitivo e irreversible del operativo en secuencia segura (exclusivo Administración):
 * 1. Primera escritura independiente: cierra `recepcion_abierta: false` y `convocatoria_abierta: false`
 *    para frenar nuevas entradas o entregas mientras se verifica.
 * 2. Re-ejecuta `verificarPreCierreOperativo`; si apareció material BUPC pendiente en ese instante,
 *    aborta el cierre dejando recepción cerrada preventivamente y expone los deudores para resolverlos.
 * 3. Cierra las asistencias abiertas y libera sus candados `presentes/{uid}` en bloques de ≤ 400
 *    operaciones, y finalmente marca `estatus: 'Finalizado'`.
 */
export async function finalizarOperativoConCierreAsistencias(
  actor: Usuario,
  operativo: Operativo,
): Promise<{ salidasCerradas: number }> {
  if (!puedeFinalizarOperativo(actor)) {
    throw new Error('Solo un Administrador activo puede finalizar operativos.')
  }
  if (esOperativoCerrado(operativo)) {
    throw new Error(
      operativo.estatus === 'Cancelado'
        ? 'Este operativo ya fue cancelado.'
        : 'Este operativo ya se encuentra finalizado.',
    )
  }

  // Paso 1: Escritura independiente para frenar nuevas entradas o prerregistros antes de re-verificar
  await updateDoc(doc(operativosRef, operativo.id), {
    recepcion_abierta: false,
    convocatoria_abierta: false,
    actualizado_en: serverTimestamp(),
  })

  // Paso 2: Re-verificación en vivo tras cerrar recepción
  const post = await verificarPreCierreOperativo(operativo.id)
  if (post.deudores.length > 0) {
    throw new ErrorDeudoresEnCierre(
      `Se cerró preventivamente la recepción, pero se detectó que ${post.deudores.length} brigadista(s) aún tienen material BUPC pendiente. Resuelve la devolución o levanta Acta de Incidencia (o reabre recepción si fue prematuro) antes de finalizar.`,
      post,
    )
  }

  const ahoraMs = Date.now()
  // Paso 3a: Cerrar todas las asistencias abiertas y liberar candados `presentes/{uid}` (2 ops por registro)
  const porLote = Math.floor(MAX_OPS_LOTE / 2)
  for (let i = 0; i < post.asistenciasAbiertas.length; i += porLote) {
    const segmento = post.asistenciasAbiertas.slice(i, i + porLote)
    const loteAsis = writeBatch(db)
    for (const a of segmento) {
      const entradaMs = a.hora_entrada?.toMillis() ?? ahoraMs
      const horasTotales = Math.max(0, Number(((ahoraMs - entradaMs) / 3_600_000).toFixed(2)))
      loteAsis.update(doc(asistenciasRef, a.id), {
        hora_salida: serverTimestamp(),
        horas_totales: horasTotales,
        estado_operativo: 'Retirado',
        salida_cerrada_manual: true,
        actualizado_en: serverTimestamp(),
      })
      loteAsis.delete(doc(db, 'operativos', operativo.id, 'presentes', a.usuario_uid))
    }
    await loteAsis.commit()
  }

  // Paso 3b: Marcar operativo como Finalizado de forma irreversible + evento de auditoría
  const loteCierre = writeBatch(db)
  loteCierre.update(doc(operativosRef, operativo.id), {
    estatus: 'Finalizado',
    recepcion_abierta: false,
    convocatoria_abierta: false,
    actualizado_en: serverTimestamp(),
  })
  loteCierre.set(doc(auditoriaRef), {
    tipo: 'FINALIZACION_OPERATIVO',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `Operativo finalizado de forma irreversible · ${post.asistenciasAbiertas.length} salida(s) cerrada(s) automáticamente · ${post.totalAsistencias} asistente(s) totales`,
    creado_en: serverTimestamp(),
  })
  await loteCierre.commit()

  return { salidasCerradas: post.asistenciasAbiertas.length }
}

export interface VerificacionBorradoOperativo {
  vacio: boolean
  tieneAsistencias: boolean
  tieneEquipos: boolean
  tienePrerregistros: boolean
}

/**
 * Verifica con consultas livianas `limit(1)` si el operativo tiene registros asociados
 * en `asistencias_personal`, `equipos_turno` o `prerregistros` para impedir huérfanos.
 */
export async function verificarOperativoVacioParaBorrado(
  operativoId: string,
): Promise<VerificacionBorradoOperativo> {
  const [asisSnap, eqSnap, preSnap] = await Promise.all([
    getDocs(query(asistenciasRef, where('operativo_id', '==', operativoId), limit(1))),
    getDocs(query(equiposRef, where('operativo_id', '==', operativoId), limit(1))),
    getDocs(query(collection(db, 'operativos', operativoId, 'prerregistros'), limit(1))),
  ])
  const tieneAsistencias = !asisSnap.empty
  const tieneEquipos = !eqSnap.empty
  const tienePrerregistros = !preSnap.empty
  return {
    vacio: !tieneAsistencias && !tieneEquipos && !tienePrerregistros,
    tieneAsistencias,
    tieneEquipos,
    tienePrerregistros,
  }
}

/**
 * Baja lógica de un operativo con registros asociados (`estatus: 'Cancelado'`, solo lectura irreversible).
 * Exclusivo de Administrador activo.
 */
export async function cancelarOperativo(
  admin: Usuario,
  operativo: Operativo,
  motivo?: string,
): Promise<void> {
  if (!esAdmin(admin)) {
    throw new Error('Solo un Administrador activo puede cancelar operativos.')
  }
  if (esOperativoCerrado(operativo)) {
    throw new Error(
      operativo.estatus === 'Cancelado'
        ? 'Este operativo ya fue cancelado.'
        : 'Este operativo ya fue finalizado y no puede cancelarse.',
    )
  }

  const motivoLimpio = (motivo ?? '').trim()
  const lote = writeBatch(db)
  lote.update(doc(operativosRef, operativo.id), {
    estatus: 'Cancelado',
    recepcion_abierta: false,
    convocatoria_abierta: false,
    actualizado_en: serverTimestamp(),
  })
  lote.set(doc(auditoriaRef), {
    tipo: 'CANCELACION_OPERATIVO',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `Baja lógica (Cancelado) · ${operativo.categoria} · Sede: ${operativo.sede}${motivoLimpio ? ` · Motivo: ${motivoLimpio}` : ''}`.slice(
      0,
      500,
    ),
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}

/**
 * Eliminación física controlada de un operativo (exclusivo Administrador activo):
 * bloquea el borrado si existen asistencias, equipos o prerregistros asociados.
 */
export async function eliminarOperativo(admin: Usuario, operativo: Operativo): Promise<void> {
  if (!puedeEliminarOperativo(admin)) {
    throw new Error('Solo un Administrador activo puede eliminar operativos.')
  }
  const estado = await verificarOperativoVacioParaBorrado(operativo.id)
  if (!estado.vacio) {
    throw new Error(
      'No se puede eliminar físicamente un operativo que ya cuenta con asistencias, material o prerregistros asociados. Usa la baja lógica ("Cancelar operativo") para conservar el historial sin registros huérfanos.',
    )
  }
  const lote = writeBatch(db)
  lote.delete(doc(operativosRef, operativo.id))
  lote.set(doc(auditoriaRef), {
    tipo: 'ELIMINACION_OPERATIVO',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `Operativo vacío eliminado físicamente · ${operativo.categoria} · Sede: ${operativo.sede} · Inicio: ${operativo.fecha_inicio} · Estatus previo: ${operativo.estatus}`,
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}

// ── Construcción de payloads QR (validados en servidor mediante prueba_qr) ───

export function construirPayloadQrDinamico(operativoId: string, nonce: string): string {
  return JSON.stringify({
    v: 1,
    tipo: 'operativo_totp',
    op: operativoId,
    totp: nonce,
  })
}

export function construirPayloadQrEstatico(operativoId: string, token: string): string {
  return JSON.stringify({
    v: 1,
    tipo: 'operativo_estatico',
    op: operativoId,
    token,
  })
}
