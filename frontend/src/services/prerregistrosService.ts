import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ayudantiaEfectiva, etapaEfectiva, normalizarOperativo } from '../lib/permisos'
import type { Operativo, PrerregistroOperativo, Usuario } from '../types'
import { nombreCompleto } from './authService'

function prerregistrosRef(operativoId: string) {
  return collection(db, 'operativos', operativoId, 'prerregistros')
}

function prerregistroDocRef(operativoId: string, usuarioUid: string) {
  return doc(db, 'operativos', operativoId, 'prerregistros', usuarioUid)
}

/**
 * Escucha la lista completa de prerregistros de un operativo (solo Encargado o Administrador).
 */
export function escucharPrerregistrosDeOperativo(
  operativoId: string,
  alCambiar: (lista: PrerregistroOperativo[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    prerregistrosRef(operativoId),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as PrerregistroOperativo)
      lista.sort((a, b) => (a.fecha_registro?.toMillis() ?? 0) - (b.fecha_registro?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer prerregistros:', err.code)
    },
  )
}

/**
 * Lectura puntual del estado de prerregistro propio (`getDoc` por ID = `uid`).
 * Jamás usa `list` y devuelve `null` silenciosamente si el documento no existe.
 */
export async function obtenerMiPrerregistro(
  operativoId: string,
  usuarioUid: string,
): Promise<PrerregistroOperativo | null> {
  const snap = await getDoc(prerregistroDocRef(operativoId, usuarioUid))
  return snap.exists() ? (snap.data() as PrerregistroOperativo) : null
}

function construirPayloadPrerregistro(
  integrante: Usuario,
  registradoPorUid: string,
  origen: 'Autoregistro' | 'Manual_Encargado',
) {
  return {
    usuario_uid: integrante.uid,
    usuario_nombre: nombreCompleto(integrante),
    usuario_cuenta: integrante.numero_cuenta,
    etapa: etapaEfectiva(integrante),
    subgrupo: (integrante.subgrupo ?? '').trim(),
    ayudantia: ayudantiaEfectiva(integrante),
    origen,
    registrado_por_uid: registradoPorUid,
    fecha_registro: serverTimestamp(),
  }
}

/**
 * Autoregistro de un brigadista activo en un operativo con convocatoria abierta.
 * Valida atómicamente en transacción el estado del operativo, duplicados y `cupo_sugerido`.
 */
export async function apuntarseAOperativo(
  operativoId: string,
  perfil: Usuario,
): Promise<void> {
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, perfil.uid)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap] = await Promise.all([tx.get(opRef), tx.get(preRef)])
    if (!opSnap.exists()) {
      throw new Error('El operativo ya no se encuentra disponible.')
    }
    const op = normalizarOperativo(opSnap.data() as Operativo)
    if (op.estatus === 'Finalizado') {
      throw new Error('Este operativo ya fue finalizado.')
    }
    if (!op.convocatoria_abierta) {
      throw new Error('La convocatoria de este operativo ya fue cerrada.')
    }
    if (preSnap.exists()) {
      return
    }
    const conteoActual = op.prerregistros_count ?? 0
    if (op.cupo_sugerido !== null && op.cupo_sugerido !== undefined && conteoActual >= op.cupo_sugerido) {
      throw new Error('El cupo sugerido para este operativo ya está completo.')
    }

    tx.set(preRef, construirPayloadPrerregistro(perfil, perfil.uid, 'Autoregistro'))
    tx.update(opRef, {
      prerregistros_count: conteoActual + 1,
      actualizado_en: serverTimestamp(),
    })
  })
}

/**
 * Cancelación del prerregistro propio mientras la convocatoria siga abierta y no esté finalizado.
 */
export async function cancelarMiPrerregistro(
  operativoId: string,
  usuarioUid: string,
): Promise<void> {
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, usuarioUid)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap] = await Promise.all([tx.get(opRef), tx.get(preRef)])
    if (!preSnap.exists()) return
    if (!opSnap.exists()) {
      throw new Error('El operativo ya no se encuentra disponible.')
    }
    const op = normalizarOperativo(opSnap.data() as Operativo)
    if (op.estatus === 'Finalizado') {
      throw new Error('No se puede cancelar porque el operativo ya fue finalizado.')
    }
    if (!op.convocatoria_abierta) {
      throw new Error('La convocatoria está cerrada; solicita el cambio a tu Encargado.')
    }
    const conteoActual = op.prerregistros_count ?? 0
    tx.delete(preRef)
    if (conteoActual > 0) {
      tx.update(opRef, {
        prerregistros_count: conteoActual - 1,
        actualizado_en: serverTimestamp(),
      })
    }
  })
}

/**
 * Alta manual previa por Encargado o Administrador (permitida en operativos Programados o Activos).
 */
export async function registrarPrerregistroManual(
  operativoId: string,
  encargado: Usuario,
  integrante: Usuario,
): Promise<void> {
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, integrante.uid)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap] = await Promise.all([tx.get(opRef), tx.get(preRef)])
    if (!opSnap.exists()) {
      throw new Error('El operativo ya no se encuentra disponible.')
    }
    const op = normalizarOperativo(opSnap.data() as Operativo)
    if (op.estatus === 'Finalizado') {
      throw new Error('No se puede modificar la lista previa de un operativo finalizado.')
    }
    if (preSnap.exists()) {
      throw new Error(`${nombreCompleto(integrante)} ya se encuentra prerregistrado.`)
    }
    const conteoActual = op.prerregistros_count ?? 0
    tx.set(preRef, construirPayloadPrerregistro(integrante, encargado.uid, 'Manual_Encargado'))
    tx.update(opRef, {
      prerregistros_count: conteoActual + 1,
      actualizado_en: serverTimestamp(),
    })
  })
}

/**
 * Baja manual de un asistente del prerregistro por Encargado o Administrador (mientras no esté Finalizado).
 */
export async function quitarPrerregistroManual(
  operativoId: string,
  usuarioUid: string,
): Promise<void> {
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, usuarioUid)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap] = await Promise.all([tx.get(opRef), tx.get(preRef)])
    if (!preSnap.exists()) return
    if (!opSnap.exists()) {
      throw new Error('El operativo ya no se encuentra disponible.')
    }
    const op = normalizarOperativo(opSnap.data() as Operativo)
    if (op.estatus === 'Finalizado') {
      throw new Error('No se puede modificar la lista previa de un operativo finalizado.')
    }
    const conteoActual = op.prerregistros_count ?? 0
    tx.delete(preRef)
    if (conteoActual > 0) {
      tx.update(opRef, {
        prerregistros_count: conteoActual - 1,
        actualizado_en: serverTimestamp(),
      })
    }
  })
}
