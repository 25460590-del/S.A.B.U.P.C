import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AuditoriaEvento, ClaveRebace, Usuario } from '../types'
import { nombreCompleto } from './authService'
import {
  actualizarVersionCatalogoRebaceEnLote,
  invalidarCacheCatalogoRebace,
} from './radioService'

const auditoriaRef = collection(db, 'auditoria_eventos')
const clavesRef = collection(db, 'catalogo_claves')

export function escucharAuditoriaEventos(
  alCambiar: (eventos: AuditoriaEvento[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    auditoriaRef,
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditoriaEvento, 'id'>) }))
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

export async function guardarClaveCatalogo(
  admin: Usuario,
  clave: ClaveRebace,
  esNueva: boolean,
): Promise<void> {
  const lote = writeBatch(db)
  lote.set(doc(clavesRef, clave.id), {
    id: clave.id,
    tabla: clave.tabla,
    codigo: clave.codigo.trim(),
    significado: clave.significado.trim(),
    categoria: clave.categoria.trim(),
    es_basico: clave.es_basico,
    orden: clave.orden,
  })
  lote.set(doc(auditoriaRef), {
    tipo: 'EDICION_CATALOGO_CLAVES',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: clave.id,
    objetivo_nombre: `${clave.codigo.trim()} (${clave.tabla})`,
    detalle: esNueva
      ? `Clave creada: ${clave.codigo.trim()} — ${clave.significado.trim()}`
      : `Clave actualizada: ${clave.codigo.trim()} — ${clave.significado.trim()}`,
    creado_en: serverTimestamp(),
  })
  actualizarVersionCatalogoRebaceEnLote(lote, admin.uid)
  await lote.commit()
  invalidarCacheCatalogoRebace()
}

export async function eliminarClaveCatalogo(admin: Usuario, clave: ClaveRebace): Promise<void> {
  const lote = writeBatch(db)
  lote.delete(doc(clavesRef, clave.id))
  lote.set(doc(auditoriaRef), {
    tipo: 'EDICION_CATALOGO_CLAVES',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: clave.id,
    objetivo_nombre: `${clave.codigo} (${clave.tabla})`,
    detalle: `Clave eliminada: ${clave.codigo} — ${clave.significado}`,
    creado_en: serverTimestamp(),
  })
  actualizarVersionCatalogoRebaceEnLote(lote, admin.uid)
  await lote.commit()
  invalidarCacheCatalogoRebace()
}
