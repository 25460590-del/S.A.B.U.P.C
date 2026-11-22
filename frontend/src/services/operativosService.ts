import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import * as OTPAuth from 'otpauth'
import { db } from '../lib/firebase'
import { normalizarOperativo, puedeEliminarOperativo } from '../lib/permisos'
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
    detalle: `${datos.categoria} · Sede: ${datos.sede.trim()} · Modo QR: ${datos.modo_qr}`,
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

/**
 * Cierre definitivo e irreversible del operativo (escala hasta 300+ personas):
 * 1. Verifica en vivo que ningún asistente tenga `equipos_bupc_pendientes > 0`.
 * 2. Cierra automáticamente todas las asistencias abiertas en bloques de ≤ 400 operaciones.
 * 3. Marca el operativo como `estatus: 'Finalizado'`, `recepcion_abierta: false` y registra auditoría.
 */
export async function finalizarOperativoConCierreAsistencias(
  actor: Usuario,
  operativo: Operativo,
): Promise<{ salidasCerradas: number }> {
  if (operativo.estatus === 'Finalizado') {
    throw new Error('Este operativo ya se encuentra finalizado.')
  }

  const pre = await verificarPreCierreOperativo(operativo.id)
  if (pre.deudores.length > 0) {
    throw new Error(
      `No se puede finalizar: ${pre.deudores.length} brigadista(s) aún tienen material BUPC pendiente de devolución.`,
    )
  }

  const ahoraMs = Date.now()
  // 1. Cerrar primero todas las asistencias abiertas en lotes seguros ≤ 400 ops
  //    (antes de marcar el operativo como Finalizado para cumplir firestore.rules).
  for (let i = 0; i < pre.asistenciasAbiertas.length; i += MAX_OPS_LOTE) {
    const segmento = pre.asistenciasAbiertas.slice(i, i + MAX_OPS_LOTE)
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

  // 2. Marcar operativo como Finalizado de forma irreversible + evento de auditoría
  const loteCierre = writeBatch(db)
  loteCierre.update(doc(operativosRef, operativo.id), {
    estatus: 'Finalizado',
    recepcion_abierta: false,
    actualizado_en: serverTimestamp(),
  })
  loteCierre.set(doc(auditoriaRef), {
    tipo: 'FINALIZACION_OPERATIVO',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `Operativo finalizado de forma irreversible · ${pre.asistenciasAbiertas.length} salida(s) cerrada(s) automáticamente · ${pre.totalAsistencias} asistente(s) totales`,
    creado_en: serverTimestamp(),
  })
  await loteCierre.commit()

  return { salidasCerradas: pre.asistenciasAbiertas.length }
}

/** Alias retrocompatible para cierre rápido sin asistencias abiertas. */
export async function finalizarOperativo(actor: Usuario, operativo: Operativo): Promise<void> {
  await finalizarOperativoConCierreAsistencias(actor, operativo)
}

/**
 * Eliminación controlada de un operativo (exclusivo Administrador activo)
 * con metadatos completos en `auditoria_eventos`.
 */
export async function eliminarOperativo(admin: Usuario, operativo: Operativo): Promise<void> {
  if (!puedeEliminarOperativo(admin)) {
    throw new Error('Solo un Administrador activo puede eliminar operativos.')
  }
  const lote = writeBatch(db)
  lote.delete(doc(operativosRef, operativo.id))
  lote.set(doc(auditoriaRef), {
    tipo: 'ELIMINACION_OPERATIVO',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: operativo.id,
    objetivo_nombre: operativo.nombre,
    detalle: `Operativo eliminado · ${operativo.categoria} · Sede: ${operativo.sede} · Inicio: ${operativo.fecha_inicio} · Estatus previo: ${operativo.estatus}`,
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
