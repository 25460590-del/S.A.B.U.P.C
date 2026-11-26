import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { esAdmin } from '../lib/permisos'
import type {
  GravedadIncidencia,
  IncidenciaPersonal,
  TipoIncidenciaPersonal,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

const incidenciasRef = collection(db, 'incidencias_personal')
const auditoriaRef = collection(db, 'auditoria_eventos')

export interface DatosNuevaIncidenciaPersonal {
  objetivo: Pick<Usuario, 'uid' | 'nombres' | 'apellido_paterno' | 'apellido_materno'>
  operativo_id?: string | null
  tipo: TipoIncidenciaPersonal
  gravedad: GravedadIncidencia
  descripcion: string
}

/**
 * Registra una incidencia de personal inmutable y su evento en `auditoria_eventos`.
 */
export async function crearIncidenciaPersonal(
  actor: Usuario,
  datos: DatosNuevaIncidenciaPersonal,
): Promise<string> {
  const descripcion = datos.descripcion.trim()
  if (!descripcion) {
    throw new Error('Describe el motivo o detalle de la incidencia.')
  }

  const nuevoDoc = doc(incidenciasRef)
  const objetivoNombre = nombreCompleto(datos.objetivo)
  const operativoId = datos.operativo_id?.trim() || null

  const lote = writeBatch(db)
  lote.set(nuevoDoc, {
    id: nuevoDoc.id,
    usuario_uid: datos.objetivo.uid,
    usuario_nombre: objetivoNombre,
    operativo_id: operativoId,
    tipo: datos.tipo,
    gravedad: datos.gravedad,
    descripcion,
    creado_por_uid: actor.uid,
    creado_por_nombre: nombreCompleto(actor),
    creado_en: serverTimestamp(),
  })
  lote.set(doc(auditoriaRef), {
    tipo: 'INCIDENCIA_PERSONAL',
    actor_uid: actor.uid,
    actor_nombre: nombreCompleto(actor),
    objetivo_uid: datos.objetivo.uid,
    objetivo_nombre: objetivoNombre,
    detalle: `[${datos.tipo} · ${datos.gravedad}] ${descripcion}`.slice(0, 500),
    creado_en: serverTimestamp(),
  })

  await lote.commit()
  return nuevoDoc.id
}

export function escucharIncidenciasPorUsuario(
  usuarioUid: string,
  alCambiar: (lista: IncidenciaPersonal[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(incidenciasRef, where('usuario_uid', '==', usuarioUid)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as IncidenciaPersonal)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer incidencias del usuario:', err.code)
    },
  )
}

export function escucharIncidenciasPorOperativo(
  operativoId: string,
  alCambiar: (lista: IncidenciaPersonal[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(incidenciasRef, where('operativo_id', '==', operativoId)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as IncidenciaPersonal)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer incidencias del operativo:', err.code)
    },
  )
}

/**
 * Consulta acotada de incidencias de personal según el rol del actor:
 * - Admin y Encargado AP: todas las incidencias registradas.
 * - Encargado normal: únicamente las incidencias creadas por él (alineado con `firestore.rules`).
 */
export function escucharIncidenciasPersonalSegunRol(
  actor: Usuario,
  alCambiar: (lista: IncidenciaPersonal[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  const consulta = esAdmin(actor)
    ? incidenciasRef
    : query(incidenciasRef, where('creado_por_uid', '==', actor.uid))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as IncidenciaPersonal)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer incidencias de personal:', err.code)
    },
  )
}
