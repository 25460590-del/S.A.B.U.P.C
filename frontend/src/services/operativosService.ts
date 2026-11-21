import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import * as OTPAuth from 'otpauth'
import { db } from '../lib/firebase'
import type {
  CategoriaOperativo,
  ModoQrOperativo,
  Operativo,
  SecretoTotpOperativo,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

const operativosRef = collection(db, 'operativos')
const auditoriaRef = collection(db, 'auditoria_eventos')

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
      const lista = snap.docs.map((d) => d.data() as Operativo)
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
    alFallar,
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
