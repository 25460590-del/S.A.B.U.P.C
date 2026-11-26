import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { SEMILLA_REBACE_V2 } from '../constants/rebaceSeed'
import { db } from '../lib/firebase'
import { esEncargado } from '../lib/permisos'
import type {
  CanalRadio,
  ClaveRebace,
  RegistroBitacoraRadio,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

const canalesRef = collection(db, 'canales_radio')
const registrosRef = collection(db, 'bitacora_radio_registros')
const clavesRef = collection(db, 'catalogo_claves')
const auditoriaRef = collection(db, 'auditoria_eventos')

function horaActualHHMMSS(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ── Canales de radio por operativo ───────────────────────────────────────────

export interface DatosNuevoCanal {
  operativo_id: string
  nombre_canal: string
  frecuencia_etiqueta: string
  unidades_participantes: string[]
}

export async function crearCanalRadio(actor: Usuario, datos: DatosNuevoCanal): Promise<string> {
  const nuevo = doc(canalesRef)
  const lote = writeBatch(db)
  lote.set(nuevo, {
    id: nuevo.id,
    operativo_id: datos.operativo_id,
    nombre_canal: datos.nombre_canal.trim(),
    frecuencia_etiqueta: datos.frecuencia_etiqueta.trim(),
    unidades_participantes: datos.unidades_participantes.map((u) => u.trim()).filter(Boolean),
    creado_por: nombreCompleto(actor),
    creado_por_uid: actor.uid,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  })
  if (esEncargado(actor)) {
    lote.set(doc(auditoriaRef), {
      tipo: 'CREACION_CANAL_RADIO',
      actor_uid: actor.uid,
      actor_nombre: nombreCompleto(actor),
      objetivo_uid: nuevo.id,
      objetivo_nombre: datos.nombre_canal.trim(),
      detalle: `Canal creado para operativo ${datos.operativo_id}`,
      creado_en: serverTimestamp(),
    })
  }
  await lote.commit()
  return nuevo.id
}

export function actualizarUnidadesCanal(canalId: string, unidades: string[]): Promise<void> {
  const limpias = Array.from(new Set(unidades.map((u) => u.trim()).filter(Boolean))).slice(0, 50)
  return updateDoc(doc(canalesRef, canalId), {
    unidades_participantes: limpias,
    actualizado_en: serverTimestamp(),
  })
}

export function escucharCanalesOperativo(
  operativoId: string,
  alCambiar: (canales: CanalRadio[]) => void,
  alFallar: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(canalesRef, where('operativo_id', '==', operativoId)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as CanalRadio)
      lista.sort((a, b) => (a.creado_en?.toMillis() ?? 0) - (b.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

// ── Registros cronológicos inmutables ────────────────────────────────────────

export interface DatosMensajeRadio {
  canal_id: string
  operativo_id: string
  origen: string
  destinos: string[]
  actividades: string
}

/**
 * Captura rápida con sello `hora_original` (`HH:MM:SS`) inmutable y soporte offline-first.
 */
export async function registrarMensajeRadio(
  actor: Usuario,
  datos: DatosMensajeRadio,
): Promise<string> {
  const origen = datos.origen.trim()
  const destinos = datos.destinos.map((d) => d.trim()).filter(Boolean)
  const actividades = datos.actividades.trim()
  if (!origen) throw new Error('Indica la unidad de ORIGEN.')
  if (destinos.length === 0) throw new Error('Selecciona al menos una unidad de DESTINO.')
  if (!actividades) throw new Error('Escribe el mensaje o clave en Actividades.')

  const nuevo = doc(registrosRef)
  await setDoc(nuevo, {
    id: nuevo.id,
    canal_id: datos.canal_id,
    operativo_id: datos.operativo_id,
    hora_original: horaActualHHMMSS(),
    origen,
    destinos,
    actividades,
    registrado_por: nombreCompleto(actor),
    registrado_por_uid: actor.uid,
    fue_editado: false,
    actividad_original_respaldo: null,
    editado_en: null,
    editado_por: null,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  })
  return nuevo.id
}

export const LIMITE_REGISTROS_RADIO = 80

export function escucharRegistrosCanal(
  canalId: string,
  alCambiar: (registros: RegistroBitacoraRadio[]) => void,
  alFallar: (error: FirestoreError) => void,
  limite = LIMITE_REGISTROS_RADIO,
): Unsubscribe {
  return onSnapshot(
    query(
      registrosRef,
      where('canal_id', '==', canalId),
      orderBy('creado_en', 'desc'),
      limit(limite),
    ),
    { includeMetadataChanges: true },
    (snap) => {
      const lista = snap.docs.map((d) => {
        const data = d.data() as RegistroBitacoraRadio
        return {
          ...data,
          sync_status: d.metadata.hasPendingWrites ? ('pendiente' as const) : ('sincronizado' as const),
        }
      })
      // Cronológico descendente (más reciente arriba; registros pendientes sin timestamp quedan primero)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? Date.now()) - (a.creado_en?.toMillis() ?? Date.now()))
      alCambiar(lista)
    },
    alFallar,
  )
}

/**
 * Carga paginada hacia atrás ("Cargar más") de mensajes anteriores en un canal de radio.
 */
export async function obtenerRegistrosCanalAnteriores(
  canalId: string,
  antesDe: Timestamp,
  limite = LIMITE_REGISTROS_RADIO,
): Promise<{ registros: RegistroBitacoraRadio[]; hayMas: boolean }> {
  const snap = await getDocs(
    query(
      registrosRef,
      where('canal_id', '==', canalId),
      orderBy('creado_en', 'desc'),
      startAfter(antesDe),
      limit(limite),
    ),
  )
  const registros = snap.docs.map((d) => ({
    ...(d.data() as RegistroBitacoraRadio),
    sync_status: 'sincronizado' as const,
  }))
  return {
    registros,
    hayMas: snap.docs.length === limite,
  }
}

/**
 * Edita únicamente `actividades` dentro de `runTransaction`, preservando `hora_original`
 * intacta, respaldando el texto anterior en `actividad_original_respaldo` y registrando auditoría.
 */
export async function editarRegistroBitacoraRadio(
  actor: Usuario,
  registroId: string,
  nuevaActividad: string,
): Promise<void> {
  const textoNuevo = nuevaActividad.trim()
  if (!textoNuevo) throw new Error('El texto de actividades no puede estar vacío.')

  const regDoc = doc(registrosRef, registroId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(regDoc)
    if (!snap.exists()) throw new Error('No se encontró el registro de bitácora.')
    const actual = snap.data() as RegistroBitacoraRadio

    // Si ya había un respaldo original previo, lo conservamos; si es la primera edición, respaldamos el original.
    const respaldo = actual.actividad_original_respaldo ?? actual.actividades

    tx.update(regDoc, {
      actividades: textoNuevo,
      fue_editado: true,
      actividad_original_respaldo: respaldo,
      editado_en: serverTimestamp(),
      editado_por: nombreCompleto(actor),
      actualizado_en: serverTimestamp(),
    })

    if (esEncargado(actor)) {
      tx.set(doc(auditoriaRef), {
        tipo: 'EDICION_BITACORA_RADIO',
        actor_uid: actor.uid,
        actor_nombre: nombreCompleto(actor),
        objetivo_uid: actual.id,
        objetivo_nombre: `${actual.hora_original} · ${actual.origen}`,
        detalle: `Anterior: "${actual.actividades}" → Nuevo: "${textoNuevo}"`,
        creado_en: serverTimestamp(),
      })
    }
  })
}

// ── Exportación local CSV (SheetJS / xlsx — funciona 100% offline) ───────────

export function exportarBitacoraCsvLocal(
  nombreOperativo: string,
  nombreCanal: string,
  registros: RegistroBitacoraRadio[],
): void {
  const filas = [...registros].reverse().map((r) => ({
    Hora: r.hora_original,
    ORIGEN: r.origen,
    DESTINO: r.destinos.join(', '),
    Actividades: r.actividades,
    'Registrado por': r.registrado_por,
    Editado: r.fue_editado ? 'Sí' : 'No',
    'Respaldo original': r.actividad_original_respaldo ?? '',
    'Editado por': r.editado_por ?? '',
  }))

  const hoja = XLSX.utils.json_to_sheet(filas)
  const csv = XLSX.utils.sheet_to_csv(hoja)
  // BOM UTF-8 para que Excel abra acentos (á, é, í, ó, ú, ñ) correctamente sin internet
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  const slug = `${nombreOperativo}-${nombreCanal}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  enlace.href = url
  enlace.download = `bitacora-radio-${slug || 'cecom'}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

// ── Catálogo de Claves ReBaCE v2 ─────────────────────────────────────────────

export function escucharCatalogoRebace(
  alCambiar: (claves: ClaveRebace[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    clavesRef,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as ClaveRebace)
      lista.sort((a, b) => a.orden - b.orden)
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer catálogo ReBaCE:', err.code)
    },
  )
}

/**
 * Pobla `catalogo_claves` en Firestore con las 5 tablas oficiales ReBaCE v2 (solo Administrador).
 */
export async function poblarCatalogoRebace(admin: Usuario): Promise<number> {
  const lote = writeBatch(db)
  for (const clave of SEMILLA_REBACE_V2) {
    lote.set(doc(clavesRef, clave.id), clave)
  }
  lote.set(doc(auditoriaRef), {
    tipo: 'SEED_CLAVES_REBACE',
    actor_uid: admin.uid,
    actor_nombre: nombreCompleto(admin),
    objetivo_uid: 'catalogo_claves',
    objetivo_nombre: 'Catálogo ReBaCE v2',
    detalle: `${SEMILLA_REBACE_V2.length} claves cargadas en 5 tablas oficiales`,
    creado_en: serverTimestamp(),
  })
  await lote.commit()
  return SEMILLA_REBACE_V2.length
}
