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
const SUBGRUPOS_ARCHIVADOS_DOC_ID = 'subgrupos_archivados'

/**
 * Escucha el catálogo dinámico de subgrupos activos (`catalogos/subgrupos`).
 * Si aún no existe en Firestore, entrega la semilla base `SUBGRUPOS_POR_DEFECTO`.
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
 * Escucha subgrupos archivados (`catalogos/subgrupos_archivados`) para permitir restaurarlos
 * sin afectar historiales previos.
 */
export function escucharSubgruposArchivados(
  alCambiar: (archivados: string[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'catalogos', SUBGRUPOS_ARCHIVADOS_DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        alCambiar([])
        return
      }
      const data = snap.data() as Partial<CatalogoDinamico>
      const items = Array.isArray(data.items)
        ? data.items.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
        : []
      alCambiar(items)
    },
    alFallar,
  )
}

/**
 * Exclusivo Administrador activo: guarda subgrupos activos y archivados de forma atómica
 * y registra el detalle en `auditoria_eventos`.
 */
export async function guardarCatalogoSubgrupos(
  admin: Usuario,
  activos: string[],
  archivados?: string[],
  detalleResumen?: string,
): Promise<void> {
  if (!puedeAdministrarCatalogos(admin)) {
    throw new Error('Solo un Administrador activo puede modificar el catálogo de subgrupos.')
  }
  const limpiosActivos = Array.from(new Set(activos.map((i) => i.trim()).filter(Boolean))).slice(
    0,
    100,
  )
  const lote = writeBatch(db)
  lote.set(doc(db, 'catalogos', SUBGRUPOS_DOC_ID), {
    id: SUBGRUPOS_DOC_ID,
    nombre: 'Subgrupos operativos',
    items: limpiosActivos,
    actualizado_en: serverTimestamp(),
    actualizado_por_uid: admin.uid,
  })
  if (archivados !== undefined) {
    const limpiosArch = Array.from(
      new Set(
        archivados
          .map((i) => i.trim())
          .filter((i) => Boolean(i) && !limpiosActivos.includes(i)),
      ),
    ).slice(0, 100)
    lote.set(doc(db, 'catalogos', SUBGRUPOS_ARCHIVADOS_DOC_ID), {
      id: SUBGRUPOS_ARCHIVADOS_DOC_ID,
      nombre: 'Subgrupos archivados',
      items: limpiosArch,
      actualizado_en: serverTimestamp(),
      actualizado_por_uid: admin.uid,
    })
  }
  lote.set(doc(db, 'auditoria_eventos', crypto.randomUUID()), {
    tipo: 'EDICION_CATALOGO_SUBGRUPOS',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: SUBGRUPOS_DOC_ID,
    objetivo_nombre: 'Catálogo de Subgrupos',
    detalle: (
      detalleResumen ??
      `${limpiosActivos.length} subgrupos activos: ${limpiosActivos.join(', ')}`
    ).slice(0, 500),
    creado_en: serverTimestamp(),
  })
  await lote.commit()
}
