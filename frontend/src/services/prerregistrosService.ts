import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { rolOperativoPorAyudantia } from '../constants/catalogos'
import { db } from '../lib/firebase'
import {
  ayudantiaEfectiva,
  ayudantiaJefatura,
  esOperativoCerrado,
  etapaEfectiva,
  normalizarOperativo,
  type AyudantiaActiva,
} from '../lib/permisos'
import type { Operativo, PrerregistroOperativo, RolEnTurno, Usuario } from '../types'
import { nombreCompleto } from './authService'

function prerregistrosRef(operativoId: string) {
  return collection(db, 'operativos', operativoId, 'prerregistros')
}

function prerregistroDocRef(operativoId: string, usuarioUid: string) {
  return doc(db, 'operativos', operativoId, 'prerregistros', usuarioUid)
}

/**
 * Escucha la lista de prerregistros de un operativo:
 * - Administrador / Encargado sin ayudantía: todos los prerregistros del operativo.
 * - Jefe de Ayudantía: consulta filtrada exactamente por `where('ayudantia', '==', ayudantiaFiltro)`.
 */
export function escucharPrerregistrosDeOperativo(
  operativoId: string,
  alCambiar: (lista: PrerregistroOperativo[]) => void,
  alFallar?: (error: FirestoreError) => void,
  ayudantiaFiltro?: AyudantiaActiva | null,
): Unsubscribe {
  const ref = prerregistrosRef(operativoId)
  const consulta = ayudantiaFiltro ? query(ref, where('ayudantia', '==', ayudantiaFiltro)) : ref
  return onSnapshot(
    consulta,
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
  rolPersonalizado?: RolEnTurno,
) {
  const ay = ayudantiaEfectiva(integrante)
  const rolAuto = rolOperativoPorAyudantia(ay)
  const rolFinal = rolPersonalizado ?? rolAuto
  return {
    usuario_uid: integrante.uid,
    usuario_nombre: nombreCompleto(integrante),
    usuario_cuenta: integrante.numero_cuenta,
    etapa: etapaEfectiva(integrante),
    subgrupo: (integrante.subgrupo ?? '').trim(),
    ayudantia: ay,
    ayudantia_slot: ay,
    rol_en_turno: rolFinal,
    rol_editado_manual: rolFinal !== rolAuto,
    origen,
    registrado_por_uid: registradoPorUid,
    fecha_registro: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }
}

/**
 * Permite a Administración, Jefe de Ayudantía (dentro de su ayudantía) o Encargado
 * ajustar el rol operativo de un participante prerregistrado durante la convocatoria.
 */
export function actualizarRolPrerregistro(
  operativoId: string,
  usuarioUid: string,
  rol: RolEnTurno,
): Promise<void> {
  return updateDoc(prerregistroDocRef(operativoId, usuarioUid), {
    rol_en_turno: rol,
    rol_editado_manual: true,
    actualizado_en: serverTimestamp(),
  })
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
    if (esOperativoCerrado(op)) {
      throw new Error(
        op.estatus === 'Cancelado'
          ? 'Este operativo fue cancelado.'
          : 'Este operativo ya fue finalizado.',
      )
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
    if (esOperativoCerrado(op)) {
      throw new Error(
        `No se puede cancelar porque el operativo ya fue ${op.estatus === 'Cancelado' ? 'cancelado' : 'finalizado'}.`,
      )
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
  const ayJefe = ayudantiaJefatura(encargado)
  if (ayJefe && ayudantiaEfectiva(integrante) !== ayJefe) {
    throw new Error(`Solo puedes prerregistrar integrantes de tu ayudantía (${ayJefe}).`)
  }
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, integrante.uid)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap] = await Promise.all([tx.get(opRef), tx.get(preRef)])
    if (!opSnap.exists()) {
      throw new Error('El operativo ya no se encuentra disponible.')
    }
    const op = normalizarOperativo(opSnap.data() as Operativo)
    if (esOperativoCerrado(op)) {
      throw new Error(
        `No se puede modificar la lista previa de un operativo ${op.estatus === 'Cancelado' ? 'cancelado' : 'finalizado'}.`,
      )
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
    if (esOperativoCerrado(op)) {
      throw new Error(
        `No se puede modificar la lista previa de un operativo ${op.estatus === 'Cancelado' ? 'cancelado' : 'finalizado'}.`,
      )
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
