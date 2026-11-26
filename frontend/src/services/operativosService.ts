import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import * as OTPAuth from 'otpauth'
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
  SecretoTotpOperativo,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

const operativosRef = collection(db, 'operativos')
const asistenciasRef = collection(db, 'asistencias_personal')
const equiposRef = collection(db, 'equipos_turno')
const auditoriaRef = collection(db, 'auditoria_eventos')

/** Máximo seguro de operaciones por writeBatch (límite Firestore = 500). */
const MAX_OPS_LOTE = 400

const PERIODO_TOTP = 30
const DIGITOS_TOTP = 6

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

function generarSecretoBase32(): string {
  // 20 bytes aleatorios criptográficos -> 32 caracteres Base32 (A-Z2-7)
  return new OTPAuth.Secret({ size: 20 }).base32
}

/**
 * Crea un operativo, su secreto TOTP protegido (`operativos/{id}/secretos/totp`)
 * y el evento de auditoría en un solo `writeBatch`.
 */
export async function crearYConfigurarOperativo(
  actor: Usuario,
  datos: DatosNuevoOperativo,
): Promise<string> {
  const opDoc = doc(operativosRef)
  const secretoDoc = doc(db, 'operativos', opDoc.id, 'secretos', 'totp')
  const qrTokenEstatico = `BUPC-OP-${crypto.randomUUID()}`
  const secretoBase32 = generarSecretoBase32()
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
    prerregistros_count: 0,
    modo_qr: datos.modo_qr,
    qr_token_estatico: qrTokenEstatico,
    creado_por_uid: actor.uid,
    creado_por_nombre: nombreCompleto(actor),
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  })

  lote.set(secretoDoc, {
    secreto_base32: secretoBase32,
    periodo_segundos: PERIODO_TOTP,
    digitos: DIGITOS_TOTP,
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

export function escucharOperativos(
  alCambiar: (operativos: Operativo[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    operativosRef,
    (snap) => {
      const lista = snap.docs.map((d) => normalizarOperativo(d.data() as Operativo))
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

/**
 * Escucha únicamente los operativos con convocatoria abierta (`convocatoria_abierta == true`)
 * y no finalizados (consulta acotada para ahorrar lecturas en Plan Spark en la vista del brigadista).
 */
export function escucharOperativosConConvocatoriaAbierta(
  alCambiar: (operativos: Operativo[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(operativosRef, where('convocatoria_abierta', '==', true)),
    (snap) => {
      const lista = snap.docs
        .map((d) => normalizarOperativo(d.data() as Operativo))
        .filter((op) => !esOperativoCerrado(op))
      lista.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al consultar convocatorias abiertas:', err.code)
    },
  )
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

export function escucharSecretoTotp(
  operativoId: string,
  alCambiar: (secreto: SecretoTotpOperativo | null) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'operativos', operativoId, 'secretos', 'totp'),
    (snap) => {
      alCambiar(snap.exists() ? (snap.data() as SecretoTotpOperativo) : null)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer secreto TOTP:', err.code)
    },
  )
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
    detalle: `Modo QR cambiado a ${modoQr === 'dinamico' ? 'Dinámico TOTP (30s)' : 'Estático (PNG)'}`,
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
 * 3. Cierra las asistencias abiertas en bloques de ≤ 400 operaciones y marca `estatus: 'Finalizado'`.
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
  // Paso 3a: Cerrar todas las asistencias abiertas en lotes seguros ≤ 400 ops
  for (let i = 0; i < post.asistenciasAbiertas.length; i += MAX_OPS_LOTE) {
    const segmento = post.asistenciasAbiertas.slice(i, i + MAX_OPS_LOTE)
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

// ── Generación offline de código TOTP (rotación cada 30s) ────────────────────

export interface EstadoTotp {
  codigo: string
  segundosRestantes: number
  payloadQr: string
}

export function generarEstadoTotpOffline(
  operativo: Operativo,
  secretoBase32: string,
  ahoraMs = Date.now(),
): EstadoTotp {
  const totp = new OTPAuth.TOTP({
    issuer: 'SABUPC',
    label: operativo.id,
    algorithm: 'SHA1',
    digits: DIGITOS_TOTP,
    period: PERIODO_TOTP,
    secret: OTPAuth.Secret.fromBase32(secretoBase32),
  })

  const codigo = totp.generate({ timestamp: ahoraMs })
  const transcurridos = Math.floor(ahoraMs / 1000) % PERIODO_TOTP
  const segundosRestantes = PERIODO_TOTP - transcurridos

  const payloadQr = JSON.stringify({
    v: 1,
    tipo: 'operativo_totp',
    op: operativo.id,
    totp: codigo,
  })

  return { codigo, segundosRestantes, payloadQr }
}

export function construirPayloadQrEstatico(operativo: Operativo): string {
  return JSON.stringify({
    v: 1,
    tipo: 'operativo_estatico',
    op: operativo.id,
    token: operativo.qr_token_estatico,
  })
}
