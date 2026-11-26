import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocFromCache,
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
import { estaEnLinea } from '../lib/colaOffline'
import { db } from '../lib/firebase'
import { normalizarNombrePropio } from '../lib/nombres'
import {
  ayudantiaEfectiva,
  ayudantiaJefatura,
  esOperativoCerrado,
  etapaEfectiva,
  normalizarOperativo,
  type AyudantiaActiva,
} from '../lib/permisos'
import type {
  ContadorPrerregistros,
  Operativo,
  PerfilOperativoMinimo,
  PrerregistroOperativo,
  RolEnTurno,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

export type IntegrantePrerregistro =
  | Usuario
  | Pick<
      PerfilOperativoMinimo,
      | 'uid'
      | 'nombre_completo'
      | 'numero_cuenta'
      | 'etapa'
      | 'subgrupo'
      | 'ayudantia'
      | 'ayudantia_slot'
      | 'grupo_operativo'
    >

function nombreIntegrante(integrante: IntegrantePrerregistro): string {
  if ('nombre_completo' in integrante && integrante.nombre_completo) {
    return normalizarNombrePropio(integrante.nombre_completo)
  }
  if ('nombres' in integrante) {
    return nombreCompleto(integrante)
  }
  return 'Integrante'
}

function prerregistrosRef(operativoId: string) {
  return collection(db, 'operativos', operativoId, 'prerregistros')
}

function prerregistroDocRef(operativoId: string, usuarioUid: string) {
  return doc(db, 'operativos', operativoId, 'prerregistros', usuarioUid)
}

function contadorDocRef(operativoId: string) {
  return doc(db, 'operativos', operativoId, 'meta', 'contador')
}

/**
 * Escucha el subdocumento dedicado `operativos/{operativoId}/meta/contador`
 * (evita escribir en el documento caliente `operativos/{id}` durante picos de convocatoria).
 */
export function escucharContadorPrerregistros(
  operativoId: string,
  alCambiar: (conteo: number | null) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    contadorDocRef(operativoId),
    (snap) => {
      if (!snap.exists()) {
        alCambiar(null)
        return
      }
      const data = snap.data() as Partial<ContadorPrerregistros>
      alCambiar(typeof data.prerregistros_count === 'number' ? data.prerregistros_count : 0)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer contador de prerregistros:', err.code)
    },
  )
}

/**
 * Lectura puntual del contador en `operativos/{id}/meta/contador` (1 lectura),
 * con respaldo a `fallbackLegacy` si el operativo fue creado antes de la migración.
 */
export async function obtenerConteoPrerregistros(
  operativoId: string,
  fallbackLegacy = 0,
): Promise<number> {
  const snap = await getDoc(contadorDocRef(operativoId))
  if (!snap.exists()) return fallbackLegacy
  const data = snap.data() as Partial<ContadorPrerregistros>
  return typeof data.prerregistros_count === 'number' ? data.prerregistros_count : fallbackLegacy
}

/**
 * Agregación liviana en servidor (`getCountFromServer`) para vistas de mando
 * cuando se requiere verificar el total exacto sin descargar documentos.
 */
export async function contarPrerregistrosServidor(operativoId: string): Promise<number> {
  const snap = await getCountFromServer(prerregistrosRef(operativoId))
  return snap.data().count
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
  const ref = prerregistroDocRef(operativoId, usuarioUid)
  const snap = estaEnLinea() ? await getDoc(ref) : await getDocFromCache(ref).catch(() => null)
  return snap?.exists() ? (snap.data() as PrerregistroOperativo) : null
}

function construirPayloadPrerregistro(
  integrante: IntegrantePrerregistro,
  registradoPorUid: string,
  origen: 'Autoregistro' | 'Manual_Encargado',
  rolPersonalizado?: RolEnTurno,
) {
  const ay = ayudantiaEfectiva(integrante)
  const rolAuto = rolOperativoPorAyudantia(ay)
  const rolFinal = rolPersonalizado ?? rolAuto
  const cuentaValida = (integrante.numero_cuenta || '0').trim().slice(0, 12) || '0'
  return {
    usuario_uid: integrante.uid,
    usuario_nombre: nombreIntegrante(integrante),
    usuario_cuenta: cuentaValida,
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
 * Actualiza atómicamente `prerregistros/{uid}` y `meta/contador` SIN escribir sobre `operativos/{id}`.
 */
export async function apuntarseAOperativo(
  operativoId: string,
  perfil: Usuario,
): Promise<number> {
  if (!estaEnLinea()) {
    throw new Error(
      'Sin conexión a internet. Apuntarse a una convocatoria requiere señal para validar el cupo vigente en el servidor.',
    )
  }
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, perfil.uid)
  const contRef = contadorDocRef(operativoId)
  let nuevoConteo = 0

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap, contSnap] = await Promise.all([
      tx.get(opRef),
      tx.get(preRef),
      tx.get(contRef),
    ])
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
    const conteoActual = contSnap.exists()
      ? ((contSnap.data() as Partial<ContadorPrerregistros>).prerregistros_count ?? 0)
      : (op.prerregistros_count ?? 0)
    if (preSnap.exists()) {
      nuevoConteo = conteoActual
      return
    }
    if (op.cupo_sugerido !== null && op.cupo_sugerido !== undefined && conteoActual >= op.cupo_sugerido) {
      throw new Error('El cupo sugerido para este operativo ya está completo.')
    }

    nuevoConteo = conteoActual + 1
    tx.set(preRef, construirPayloadPrerregistro(perfil, perfil.uid, 'Autoregistro'))
    tx.set(contRef, {
      prerregistros_count: nuevoConteo,
      actualizado_en: serverTimestamp(),
    })
  })

  return nuevoConteo
}

/**
 * Cancelación del prerregistro propio mientras la convocatoria siga abierta y no esté finalizado.
 * Actualiza únicamente `meta/contador` sin tocar `operativos/{id}`.
 */
export async function cancelarMiPrerregistro(
  operativoId: string,
  usuarioUid: string,
): Promise<number> {
  if (!estaEnLinea()) {
    throw new Error(
      'Sin conexión a internet. Cancelar tu prerregistro requiere conexión para actualizar el cupo en el servidor.',
    )
  }
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, usuarioUid)
  const contRef = contadorDocRef(operativoId)
  let nuevoConteo = 0

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap, contSnap] = await Promise.all([
      tx.get(opRef),
      tx.get(preRef),
      tx.get(contRef),
    ])
    const conteoActual = contSnap.exists()
      ? ((contSnap.data() as Partial<ContadorPrerregistros>).prerregistros_count ?? 0)
      : opSnap.exists()
        ? ((opSnap.data() as Operativo).prerregistros_count ?? 0)
        : 0
    if (!preSnap.exists()) {
      nuevoConteo = conteoActual
      return
    }
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

    nuevoConteo = Math.max(0, conteoActual - 1)
    tx.delete(preRef)
    if (contSnap.exists() && conteoActual > 0) {
      tx.update(contRef, {
        prerregistros_count: nuevoConteo,
        actualizado_en: serverTimestamp(),
      })
    }
  })

  return nuevoConteo
}

/**
 * Alta manual previa por Encargado, Jefe de Ayudantía o Administrador.
 * Actualiza `meta/contador` sin modificar `operativos/{id}`.
 */
export async function registrarPrerregistroManual(
  operativoId: string,
  encargado: Usuario,
  integrante: IntegrantePrerregistro,
): Promise<void> {
  if (!estaEnLinea()) {
    throw new Error(
      'Sin conexión a internet. Agregar personal a la convocatoria previa requiere señal para sincronizar el contador en el servidor.',
    )
  }
  const ayJefe = ayudantiaJefatura(encargado)
  if (ayJefe && ayudantiaEfectiva(integrante) !== ayJefe) {
    throw new Error(`Solo puedes prerregistrar integrantes de tu ayudantía (${ayJefe}).`)
  }
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, integrante.uid)
  const contRef = contadorDocRef(operativoId)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap, contSnap] = await Promise.all([
      tx.get(opRef),
      tx.get(preRef),
      tx.get(contRef),
    ])
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
      throw new Error(`${nombreIntegrante(integrante)} ya se encuentra prerregistrado.`)
    }
    const conteoActual = contSnap.exists()
      ? ((contSnap.data() as Partial<ContadorPrerregistros>).prerregistros_count ?? 0)
      : (op.prerregistros_count ?? 0)
    tx.set(preRef, construirPayloadPrerregistro(integrante, encargado.uid, 'Manual_Encargado'))
    tx.set(contRef, {
      prerregistros_count: conteoActual + 1,
      actualizado_en: serverTimestamp(),
    })
  })
}

/**
 * Baja manual de un asistente del prerregistro por Encargado, Jefe de Ayudantía o Administrador.
 * Actualiza `meta/contador` sin tocar `operativos/{id}`.
 */
export async function quitarPrerregistroManual(
  operativoId: string,
  usuarioUid: string,
): Promise<void> {
  if (!estaEnLinea()) {
    throw new Error(
      'Sin conexión a internet. Quitar personal del prerregistro requiere señal para actualizar el contador en el servidor.',
    )
  }
  const opRef = doc(db, 'operativos', operativoId)
  const preRef = prerregistroDocRef(operativoId, usuarioUid)
  const contRef = contadorDocRef(operativoId)

  await runTransaction(db, async (tx) => {
    const [opSnap, preSnap, contSnap] = await Promise.all([
      tx.get(opRef),
      tx.get(preRef),
      tx.get(contRef),
    ])
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
    const conteoActual = contSnap.exists()
      ? ((contSnap.data() as Partial<ContadorPrerregistros>).prerregistros_count ?? 0)
      : (op.prerregistros_count ?? 0)
    tx.delete(preRef)
    tx.set(contRef, {
      prerregistros_count: Math.max(0, conteoActual - 1),
      actualizado_en: serverTimestamp(),
    })
  })
}
