import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { comprimirImagenAWebP } from '../lib/imageCompression'
import type { AsistenciaPersonal, EquipoTurno, Usuario } from '../types'
import { nombreCompleto } from './authService'

const equiposRef = collection(db, 'equipos_turno')
const asistenciasRef = collection(db, 'asistencias_personal')
const evidenciasRef = collection(db, 'evidencias_equipos')
const auditoriaRef = collection(db, 'auditoria_eventos')

export interface DatosNuevoEquipo {
  nombre_articulo: string
  codigo_inventario: string
}

/**
 * Encargado/Admin asigna material BUPC a un brigadista en turno:
 * crea `equipos_turno` e incrementa atómicamente `equipos_bupc_pendientes` (+1).
 */
export async function asignarEquipoBupc(
  encargado: Usuario,
  asistencia: AsistenciaPersonal,
  datos: DatosNuevoEquipo,
): Promise<string> {
  const nuevoEquipo = doc(equiposRef)
  const asistenciaDoc = doc(asistenciasRef, asistencia.id)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(asistenciaDoc)
    if (!snap.exists()) throw new Error('No se encontró la asistencia seleccionada.')
    const actual = snap.data() as AsistenciaPersonal
    if (actual.hora_salida !== null) {
      throw new Error('No se puede asignar material a un turno que ya fue cerrado.')
    }

    tx.set(nuevoEquipo, {
      id: nuevoEquipo.id,
      asistencia_id: actual.id,
      operativo_id: actual.operativo_id,
      usuario_uid: actual.usuario_uid,
      usuario_nombre: actual.usuario_nombre,
      nombre_articulo: datos.nombre_articulo.trim(),
      codigo_inventario: datos.codigo_inventario.trim(),
      origen_material: 'BUPC_Asignado',
      estado_reporte: 'OK',
      falla_reportada: '',
      devuelto: false,
      devuelto_en: null,
      devuelto_por_uid: null,
      acta_incidencia: null,
      creado_por_uid: encargado.uid,
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    })

    tx.update(asistenciaDoc, {
      equipos_bupc_pendientes: actual.equipos_bupc_pendientes + 1,
      actualizado_en: serverTimestamp(),
    })

    tx.set(doc(auditoriaRef), {
      tipo: 'ASIGNACION_EQUIPO',
      actor_uid: encargado.uid,
      actor_nombre: nombreCompleto(encargado),
      objetivo_uid: actual.usuario_uid,
      objetivo_nombre: actual.usuario_nombre,
      detalle: `Asignado: ${datos.nombre_articulo.trim()}${
        datos.codigo_inventario.trim() ? ` (${datos.codigo_inventario.trim()})` : ''
      }`,
      creado_en: serverTimestamp(),
    })
  })

  return nuevoEquipo.id
}

/**
 * Válvula de escape 1 del Candado Duro:
 * marca un artículo BUPC como Devuelto OK y decrementa `equipos_bupc_pendientes` (-1).
 */
export async function marcarEquipoDevueltoOk(
  encargado: Usuario,
  equipo: EquipoTurno,
): Promise<void> {
  const equipoDoc = doc(equiposRef, equipo.id)
  const asistenciaDoc = doc(asistenciasRef, equipo.asistencia_id)

  await runTransaction(db, async (tx) => {
    const [eqSnap, asisSnap] = await Promise.all([tx.get(equipoDoc), tx.get(asistenciaDoc)])
    if (!eqSnap.exists() || !asisSnap.exists()) {
      throw new Error('No se encontró el registro de equipo o asistencia.')
    }

    const eqActual = eqSnap.data() as EquipoTurno
    const asisActual = asisSnap.data() as AsistenciaPersonal

    if (eqActual.origen_material !== 'BUPC_Asignado') {
      throw new Error('Solo el material BUPC asignado requiere recepción de devolución.')
    }
    if (eqActual.devuelto || eqActual.acta_incidencia !== null) {
      throw new Error('Este artículo ya fue liberado anteriormente.')
    }

    tx.update(equipoDoc, {
      devuelto: true,
      estado_reporte: 'Devuelto',
      devuelto_en: serverTimestamp(),
      devuelto_por_uid: encargado.uid,
      actualizado_en: serverTimestamp(),
    })

    tx.update(asistenciaDoc, {
      equipos_bupc_pendientes: Math.max(0, asisActual.equipos_bupc_pendientes - 1),
      actualizado_en: serverTimestamp(),
    })

    tx.set(doc(auditoriaRef), {
      tipo: 'DEVOLUCION_EQUIPO',
      actor_uid: encargado.uid,
      actor_nombre: nombreCompleto(encargado),
      objetivo_uid: eqActual.usuario_uid,
      objetivo_nombre: eqActual.usuario_nombre,
      detalle: `Devolución OK: ${eqActual.nombre_articulo}${
        eqActual.codigo_inventario ? ` (${eqActual.codigo_inventario})` : ''
      }`,
      creado_en: serverTimestamp(),
    })
  })
}

/**
 * Válvula de escape 2 del Candado Duro:
 * levanta un Acta de Incidencia (motivo obligatorio + foto WebP opcional en `evidencias_equipos`)
 * y decrementa `equipos_bupc_pendientes` (-1) atómicamente.
 */
export async function levantarActaIncidencia(
  encargado: Usuario,
  equipo: EquipoTurno,
  motivo: string,
  archivoEvidencia?: File | null,
): Promise<void> {
  const motivoLimpio = motivo.trim()
  if (!motivoLimpio) {
    throw new Error('Describe el motivo del Acta de Incidencia.')
  }

  // Comprimir evidencia WebP (~40–70 KB) fuera de la transacción
  let evidenciaBase64: string | null = null
  if (archivoEvidencia) {
    const resultado = await comprimirImagenAWebP(archivoEvidencia, {
      ladoMaximo: 960,
      recorteCuadrado: false,
      maxBytes: 70 * 1024,
    })
    evidenciaBase64 = resultado.dataUrl
  }

  const equipoDoc = doc(equiposRef, equipo.id)
  const asistenciaDoc = doc(asistenciasRef, equipo.asistencia_id)
  const evidenciaDoc = evidenciaBase64 ? doc(evidenciasRef) : null

  await runTransaction(db, async (tx) => {
    const [eqSnap, asisSnap] = await Promise.all([tx.get(equipoDoc), tx.get(asistenciaDoc)])
    if (!eqSnap.exists() || !asisSnap.exists()) {
      throw new Error('No se encontró el registro de equipo o asistencia.')
    }

    const eqActual = eqSnap.data() as EquipoTurno
    const asisActual = asisSnap.data() as AsistenciaPersonal

    if (eqActual.origen_material !== 'BUPC_Asignado') {
      throw new Error('Solo el material BUPC asignado puede liberar candado por incidencia.')
    }
    if (eqActual.devuelto || eqActual.acta_incidencia !== null) {
      throw new Error('Este artículo ya fue liberado anteriormente.')
    }

    if (evidenciaDoc && evidenciaBase64) {
      tx.set(evidenciaDoc, {
        id: evidenciaDoc.id,
        equipo_id: eqActual.id,
        asistencia_id: eqActual.asistencia_id,
        operativo_id: eqActual.operativo_id,
        imagen_webp_base64: evidenciaBase64,
        creado_por_uid: encargado.uid,
        creado_en: serverTimestamp(),
      })
    }

    tx.update(equipoDoc, {
      estado_reporte: 'Incidencia',
      acta_incidencia: {
        motivo: motivoLimpio,
        evidencia_id: evidenciaDoc ? evidenciaDoc.id : null,
        registrado_por_uid: encargado.uid,
        registrado_por_nombre: nombreCompleto(encargado),
        registrado_en: serverTimestamp(),
      },
      actualizado_en: serverTimestamp(),
    })

    tx.update(asistenciaDoc, {
      equipos_bupc_pendientes: Math.max(0, asisActual.equipos_bupc_pendientes - 1),
      actualizado_en: serverTimestamp(),
    })

    tx.set(doc(auditoriaRef), {
      tipo: 'ACTA_INCIDENCIA',
      actor_uid: encargado.uid,
      actor_nombre: nombreCompleto(encargado),
      objetivo_uid: eqActual.usuario_uid,
      objetivo_nombre: eqActual.usuario_nombre,
      detalle: `Acta de Incidencia · ${eqActual.nombre_articulo}: ${motivoLimpio}`,
      creado_en: serverTimestamp(),
    })
  })
}

// ── Acciones del Brigadista (Material Propio + Reporte de fallas) ────────────

export async function registrarEquipoPropio(
  brigadista: Usuario,
  asistencia: AsistenciaPersonal,
  datos: DatosNuevoEquipo,
): Promise<string> {
  const nuevoDoc = doc(equiposRef)
  await setDoc(nuevoDoc, {
    id: nuevoDoc.id,
    asistencia_id: asistencia.id,
    operativo_id: asistencia.operativo_id,
    usuario_uid: brigadista.uid,
    usuario_nombre: nombreCompleto(brigadista),
    nombre_articulo: datos.nombre_articulo.trim(),
    codigo_inventario: datos.codigo_inventario.trim(),
    origen_material: 'Propio',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: brigadista.uid,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  })
  return nuevoDoc.id
}

export function reportarFallaEquipo(equipoId: string, falla: string): Promise<void> {
  const texto = falla.trim()
  if (!texto) throw new Error('Describe la falla o faltante encontrado.')
  return updateDoc(doc(equiposRef, equipoId), {
    estado_reporte: 'Con_Falla',
    falla_reportada: texto,
    actualizado_en: serverTimestamp(),
  })
}

// ── Listeners en tiempo real ─────────────────────────────────────────────────

export function escucharEquiposDeAsistencia(
  asistenciaId: string,
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(equiposRef, where('asistencia_id', '==', asistenciaId)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as EquipoTurno)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}

export function escucharEquiposDeOperativo(
  operativoId: string,
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    query(equiposRef, where('operativo_id', '==', operativoId)),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as EquipoTurno)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    alFallar,
  )
}
