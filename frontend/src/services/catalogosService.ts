import {
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { SUBGRUPOS_POR_DEFECTO } from '../constants/catalogos'
import { db } from '../lib/firebase'
import { puedeAdministrarCatalogos } from '../lib/permisos'
import type { CatalogoDinamico, Usuario } from '../types'
import { nombreCompleto } from './authService'

const SUBGRUPOS_DOC_ID = 'subgrupos'

/**
 * Escucha el catálogo dinámico de subgrupos (`catalogos/subgrupos`).
 * Si aún no existe en Firestore, entrega la lista base `SUBGRUPOS_POR_DEFECTO`.
 */
export function escucharCatalogoSubgrupos(
  alCambiar: (subgrupos: string[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'catalogos', SUBGRUPOS_DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        alCambiar(SUBGRUPOS_POR_DEFECTO)
        return
      }
      const data = snap.data() as Partial<CatalogoDinamico>
      const items = Array.isArray(data.items)
        ? data.items.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
        : []
      alCambiar(items.length > 0 ? items : SUBGRUPOS_POR_DEFECTO)
    },
    alFallar,
  )
}

/**
 * Exclusivo Administrador activo: guarda el catálogo dinámico de subgrupos en
 * `catalogos/subgrupos` y registra el evento en `auditoria_eventos`.
 */
export async function guardarCatalogoSubgrupos(admin: Usuario, items: string[]): Promise<void> {
  if (!puedeAdministrarCatalogos(admin)) {
    throw new Error('Solo un Administrador activo puede modificar el catálogo de subgrupos.')
  }
  const limpios = Array.from(new Set(items.map((i) => i.trim()).filter(Boolean))).slice(0, 100)
  const lote = writeBatch(db)
  lote.set(doc(db, 'catalogos', SUBGRUPOS_DOC_ID), {
    id: SUBGRUPOS_DOC_ID,
    nombre: 'Subgrupos operativos',
    items: limpios,
    actualizado_en: serverTimestamp(),
    actualizado_por_uid: admin.uid,
  })
  lote.set(doc(db, 'auditoria_eventos', crypto.randomUUID()), {
    tipo: 'EDICION_CATALOGO_SUBGRUPOS',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: SUBGRUPOS_DOC_ID,
    objetivo_nombre: 'Catálogo de Subgrupos',
    detalle: `${limpios.length} subgrupos configurados: ${limpios.join(', ')}`.slice(0, 500),
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}
