import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
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
import { db } from '../lib/firebase'
import { comprimirImagenAWebP } from '../lib/imageCompression'
import { ayudantiaEfectiva, ayudantiaJefatura, type AyudantiaActiva } from '../lib/permisos'
import type { AsistenciaPersonal, EquipoTurno, EvidenciaEquipo, Usuario } from '../types'
import { nombreCompleto } from './authService'

const equiposRef = collection(db, 'equipos_turno')
const asistenciasRef = collection(db, 'asistencias_personal')
const evidenciasRef = collection(db, 'evidencias_equipos')
const auditoriaRef = collection(db, 'auditoria_eventos')

/** Máximo seguro por `writeBatch` (límite Firestore = 500 operaciones). */
const MAX_OPS_LOTE = 400

export interface DatosNuevoEquipo {
  nombre_articulo: string
  codigo_inventario: string
  cantidad?: number
  /** Nonce opcional para idempotencia al reintentar entregas en lote tras fallo de red. */
  operacion_nonce?: string
}

/**
 * Encargado/Admin asigna material BUPC a un brigadista en turno:
 * - Crea un documento independiente en `equipos_turno/{id}` (cero sobrescritura de arrays).
 * - Actualiza `equipos_bupc_pendientes` con `increment(1)` (seguro ante concurrencia multi-encargado).
 * - Si incluye número de serie/folio (`codigo_inventario`), verifica que no esté prestado
 *   simultáneamente en el mismo operativo y ejecuta dentro de `runTransaction`.
 */
export async function asignarEquipoBupc(
  encargado: Usuario,
  asistencia: AsistenciaPersonal,
  datos: DatosNuevoEquipo,
): Promise<string> {
  const nombreArticulo = datos.nombre_articulo.trim()
  const codigoInventario = datos.codigo_inventario.trim()
  const cantidad = Math.min(99, Math.max(1, Math.floor(datos.cantidad ?? 1)))

  if (!nombreArticulo) {
    throw new Error('Indica el nombre del artículo BUPC.')
  }

  const nuevoEquipo = doc(equiposRef)
  const asistenciaDoc = doc(asistenciasRef, asistencia.id)
  const encargadoNombre = nombreCompleto(encargado)

  const payloadEquipo = {
    id: nuevoEquipo.id,
    asistencia_id: asistencia.id,
    operativo_id: asistencia.operativo_id,
    operativo_nombre: asistencia.operativo_nombre,
    usuario_uid: asistencia.usuario_uid,
    usuario_nombre: asistencia.usuario_nombre,
    ayudantia_slot: asistencia.ayudantia_slot,
    nombre_articulo: nombreArticulo,
    codigo_inventario: codigoInventario,
    cantidad,
    origen_material: 'BUPC_Asignado' as const,
    estado_reporte: 'OK' as const,
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: encargado.uid,
    creado_por_nombre: encargadoNombre,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }

  const payloadAuditoria = {
    tipo: 'ASIGNACION_EQUIPO' as const,
    actor_uid: encargado.uid,
    actor_nombre: encargadoNombre,
    objetivo_uid: asistencia.usuario_uid,
    objetivo_nombre: asistencia.usuario_nombre,
    detalle: `Asignado: ${cantidad > 1 ? `${cantidad}× ` : ''}${nombreArticulo}${
      codigoInventario ? ` (${codigoInventario})` : ''
    }`,
    creado_en: serverTimestamp(),
  }

  if (codigoInventario) {
    // Validación anti-doble préstamo simultáneo para equipo serializado (acotada por ayudantia_slot si es Jefe)
    const ayJefe = ayudantiaJefatura(encargado)
    const consultaDup = ayJefe
      ? query(
          equiposRef,
          where('operativo_id', '==', asistencia.operativo_id),
          where('codigo_inventario', '==', codigoInventario),
          where('ayudantia_slot', '==', ayJefe),
        )
      : query(
          equiposRef,
          where('operativo_id', '==', asistencia.operativo_id),
          where('codigo_inventario', '==', codigoInventario),
        )
    const dupSnap = await getDocs(consultaDup)
    const yaPrestado = dupSnap.docs
      .map((d) => d.data() as EquipoTurno)
      .find(
        (eq) =>
          eq.origen_material === 'BUPC_Asignado' && !eq.devuelto && eq.acta_incidencia === null,
      )
    if (yaPrestado) {
      throw new Error(
        `El folio/serie "${codigoInventario}" ya está asignado actualmente a ${yaPrestado.usuario_nombre}.`,
      )
    }

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(asistenciaDoc)
      if (!snap.exists()) throw new Error('No se encontró la asistencia seleccionada.')
      const actual = snap.data() as AsistenciaPersonal
      if (actual.hora_salida !== null) {
        throw new Error('No se puede asignar material a un turno que ya fue cerrado.')
      }

      tx.set(nuevoEquipo, payloadEquipo)
      tx.update(asistenciaDoc, {
        equipos_bupc_pendientes: increment(1),
        actualizado_en: serverTimestamp(),
      })
      tx.set(doc(auditoriaRef), payloadAuditoria)
    })

    return nuevoEquipo.id
  }

  // Material genérico sin serie: writeBatch atómico con increment(1) seguro ante concurrencia
  const lote = writeBatch(db)
  lote.set(nuevoEquipo, payloadEquipo)
  lote.update(asistenciaDoc, {
    equipos_bupc_pendientes: increment(1),
    actualizado_en: serverTimestamp(),
  })
  lote.set(doc(auditoriaRef), payloadAuditoria)
  await lote.commit()

  return nuevoEquipo.id
}

/**
 * Asignación rápida de material repetitivo (chalecos, lámparas, radios genéricos) a
 * múltiples brigadistas seleccionados en lotes seguros de ≤ 400 operaciones.
 * Usa IDs deterministas derivados de `asistencia_id` + `operacion_nonce` y verifica
 * existencia antes de escribir para garantizar idempotencia en reintentos tras cortes de red
 * (sin duplicar artículos ni incrementar dos veces `equipos_bupc_pendientes`).
 */
export async function asignarEquipoBupcMultiple(
  encargado: Usuario,
  asistenciasObjetivo: AsistenciaPersonal[],
  datos: DatosNuevoEquipo,
): Promise<number> {
  const nombreArticulo = datos.nombre_articulo.trim()
  const codigoInventario = datos.codigo_inventario.trim()
  const cantidad = Math.min(99, Math.max(1, Math.floor(datos.cantidad ?? 1)))

  if (!nombreArticulo) throw new Error('Indica el nombre del artículo BUPC.')
  const abiertas = asistenciasObjetivo.filter((a) => a.hora_salida === null)
  if (abiertas.length === 0) {
    throw new Error('Selecciona al menos un brigadista con turno abierto.')
  }

  const nonceCrudo = (datos.operacion_nonce ?? '').trim() || crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const nonceLimpio = nonceCrudo.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'lote'

  const ayJefe = ayudantiaJefatura(encargado)
  const operativoId = abiertas[0].operativo_id

  // Consulta acotada al operativo (+ ayudantía si aplica) para detectar entregas ya aplicadas en reintentos
  const consultaExistentes = ayJefe
    ? query(
        equiposRef,
        where('operativo_id', '==', operativoId),
        where('ayudantia_slot', '==', ayJefe),
      )
    : query(equiposRef, where('operativo_id', '==', operativoId))
  const existentesSnap = await getDocs(consultaExistentes)
  const idsExistentes = new Set(existentesSnap.docs.map((d) => d.id))

  const pendientes = abiertas
    .map((asis) => ({
      asis,
      equipoId: `eq_${asis.id}_${nonceLimpio}`.slice(0, 120),
    }))
    .filter(({ equipoId }) => !idsExistentes.has(equipoId))

  if (pendientes.length === 0) {
    return abiertas.length
  }

  const encargadoNombre = nombreCompleto(encargado)
  // Cada brigadista consume 3 operaciones (equipo + asistencia increment + auditoría)
  const personasPorLote = Math.floor(MAX_OPS_LOTE / 3)

  for (let i = 0; i < pendientes.length; i += personasPorLote) {
    const segmento = pendientes.slice(i, i + personasPorLote)
    const lote = writeBatch(db)

    for (const { asis, equipoId } of segmento) {
      const nuevoEquipo = doc(equiposRef, equipoId)
      const auditoriaDoc = doc(auditoriaRef, `aud_${equipoId}`.slice(0, 120))
      lote.set(nuevoEquipo, {
        id: equipoId,
        asistencia_id: asis.id,
        operativo_id: asis.operativo_id,
        operativo_nombre: asis.operativo_nombre,
        usuario_uid: asis.usuario_uid,
        usuario_nombre: asis.usuario_nombre,
        ayudantia_slot: asis.ayudantia_slot,
        nombre_articulo: nombreArticulo,
        codigo_inventario: codigoInventario,
        cantidad,
        origen_material: 'BUPC_Asignado',
        estado_reporte: 'OK',
        falla_reportada: '',
        devuelto: false,
        devuelto_en: null,
        devuelto_por_uid: null,
        acta_incidencia: null,
        creado_por_uid: encargado.uid,
        creado_por_nombre: encargadoNombre,
        creado_en: serverTimestamp(),
        actualizado_en: serverTimestamp(),
      })

      lote.update(doc(asistenciasRef, asis.id), {
        equipos_bupc_pendientes: increment(1),
        actualizado_en: serverTimestamp(),
      })

      lote.set(auditoriaDoc, {
        tipo: 'ASIGNACION_EQUIPO',
        actor_uid: encargado.uid,
        actor_nombre: encargadoNombre,
        objetivo_uid: asis.usuario_uid,
        objetivo_nombre: asis.usuario_nombre,
        detalle: `Asignación rápida: ${cantidad > 1 ? `${cantidad}× ` : ''}${nombreArticulo}${
          codigoInventario ? ` (${codigoInventario})` : ''
        }`,
        creado_en: serverTimestamp(),
      })
    }

    await lote.commit()
  }

  return abiertas.length
}

/**
 * Válvula de escape 1 del Candado Duro:
 * marca un artículo BUPC como Devuelto OK y decrementa `equipos_bupc_pendientes` con `increment(-1)`.
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
      equipos_bupc_pendientes:
        asisActual.equipos_bupc_pendientes > 0 ? increment(-1) : 0,
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
 * y decrementa `equipos_bupc_pendientes` con `increment(-1)` atómicamente.
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
      equipos_bupc_pendientes:
        asisActual.equipos_bupc_pendientes > 0 ? increment(-1) : 0,
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
  const nombreBrig = nombreCompleto(brigadista)
  await setDoc(nuevoDoc, {
    id: nuevoDoc.id,
    asistencia_id: asistencia.id,
    operativo_id: asistencia.operativo_id,
    operativo_nombre: asistencia.operativo_nombre,
    usuario_uid: brigadista.uid,
    usuario_nombre: nombreBrig,
    ayudantia_slot: asistencia.ayudantia_slot || ayudantiaEfectiva(brigadista),
    nombre_articulo: datos.nombre_articulo.trim(),
    codigo_inventario: datos.codigo_inventario.trim(),
    cantidad: Math.min(99, Math.max(1, Math.floor(datos.cantidad ?? 1))),
    origen_material: 'Propio',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: brigadista.uid,
    creado_por_nombre: nombreBrig,
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
  usuarioUid?: string,
): Unsubscribe {
  const consulta = usuarioUid
    ? query(
        equiposRef,
        where('usuario_uid', '==', usuarioUid),
        where('asistencia_id', '==', asistenciaId),
      )
    : query(equiposRef, where('asistencia_id', '==', asistenciaId))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as EquipoTurno)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer equipos de asistencia:', err.code)
    },
  )
}

export function escucharEquiposDeOperativo(
  operativoId: string,
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
  ayudantiaFiltro?: AyudantiaActiva | null,
): Unsubscribe {
  const consulta = ayudantiaFiltro
    ? query(
        equiposRef,
        where('operativo_id', '==', operativoId),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(equiposRef, where('operativo_id', '==', operativoId))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as EquipoTurno)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer equipos de operativo:', err.code)
    },
  )
}

export const LIMITE_EQUIPOS_PAGINA = 50

/**
 * Suscripción en tiempo real acotada al `uid` del brigadista y `origen_material == 'BUPC_Asignado'`
 * ordenada por `creado_en desc` con `limit(N)` para la vista "Mi Material".
 */
export function escucharMisEquiposBupc(
  usuarioUid: string,
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
  limite = LIMITE_EQUIPOS_PAGINA,
): Unsubscribe {
  return onSnapshot(
    query(
      equiposRef,
      where('usuario_uid', '==', usuarioUid),
      where('origen_material', '==', 'BUPC_Asignado'),
      orderBy('creado_en', 'desc'),
      limit(limite),
    ),
    (snap) => {
      const lista = snap.docs.map((d) => d.data() as EquipoTurno)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer Mi Material BUPC:', err.code)
    },
  )
}

/**
 * Carga paginada ("Cargar más") de entregas BUPC anteriores del brigadista.
 */
export async function obtenerMasMisEquiposBupc(
  usuarioUid: string,
  antesDe: Timestamp,
  limite = LIMITE_EQUIPOS_PAGINA,
): Promise<{ equipos: EquipoTurno[]; hayMas: boolean }> {
  const snap = await getDocs(
    query(
      equiposRef,
      where('usuario_uid', '==', usuarioUid),
      where('origen_material', '==', 'BUPC_Asignado'),
      orderBy('creado_en', 'desc'),
      startAfter(antesDe),
      limit(limite),
    ),
  )
  const equipos = snap.docs.map((d) => d.data() as EquipoTurno)
  return {
    equipos,
    hayMas: snap.docs.length === limite,
  }
}

/**
 * Suscripción en tiempo real para Encargados/Admin en "Resguardo Global de Material":
 * concentra todo el material BUPC que aún no ha sido devuelto ni cerrado por acta.
 * Si consulta un Jefe de Ayudantía, filtra estrictamente por `ayudantia_slot`.
 */
export function escucharResguardoGlobalBupc(
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
  ayudantiaFiltro?: AyudantiaActiva | null,
): Unsubscribe {
  const consulta = ayudantiaFiltro
    ? query(
        equiposRef,
        where('origen_material', '==', 'BUPC_Asignado'),
        where('devuelto', '==', false),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(
        equiposRef,
        where('origen_material', '==', 'BUPC_Asignado'),
        where('devuelto', '==', false),
      )

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs
        .map((d) => d.data() as EquipoTurno)
        .filter((e) => e.acta_incidencia === null)
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer Resguardo Global:', err.code)
    },
  )
}

/**
 * Suscripción en tiempo real acotada (`orderBy('actualizado_en', 'desc')` + `limit(N)`)
 * a las Actas de Incidencia de material BUPC (sin descargar `evidencias_equipos`).
 */
export function escucharActasMaterialBupc(
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
  ayudantiaFiltro?: AyudantiaActiva | null,
  limite = LIMITE_EQUIPOS_PAGINA,
): Unsubscribe {
  const consulta = ayudantiaFiltro
    ? query(
        equiposRef,
        where('estado_reporte', '==', 'Incidencia'),
        where('ayudantia_slot', '==', ayudantiaFiltro),
        orderBy('actualizado_en', 'desc'),
        limit(limite),
      )
    : query(
        equiposRef,
        where('estado_reporte', '==', 'Incidencia'),
        orderBy('actualizado_en', 'desc'),
        limit(limite),
      )

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs
        .map((d) => d.data() as EquipoTurno)
        .filter((e) => e.acta_incidencia !== null)
      lista.sort((a, b) => (b.actualizado_en?.toMillis() ?? 0) - (a.actualizado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer actas de material:', err.code)
    },
  )
}

/**
 * Carga paginada ("Cargar más") de Actas de Incidencia de material BUPC anteriores.
 */
export async function obtenerMasActasMaterialBupc(
  antesDe: Timestamp,
  ayudantiaFiltro?: AyudantiaActiva | null,
  limite = LIMITE_EQUIPOS_PAGINA,
): Promise<{ actas: EquipoTurno[]; hayMas: boolean }> {
  const consulta = ayudantiaFiltro
    ? query(
        equiposRef,
        where('estado_reporte', '==', 'Incidencia'),
        where('ayudantia_slot', '==', ayudantiaFiltro),
        orderBy('actualizado_en', 'desc'),
        startAfter(antesDe),
        limit(limite),
      )
    : query(
        equiposRef,
        where('estado_reporte', '==', 'Incidencia'),
        orderBy('actualizado_en', 'desc'),
        startAfter(antesDe),
        limit(limite),
      )
  const snap = await getDocs(consulta)
  const actas = snap.docs
    .map((d) => d.data() as EquipoTurno)
    .filter((e) => e.acta_incidencia !== null)
  return {
    actas,
    hayMas: snap.docs.length === limite,
  }
}

/**
 * Actas de incidencia de material asociadas a un brigadista específico (bajo demanda en Expediente).
 */
export function escucharActasMaterialDeUsuario(
  usuarioUid: string,
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
  ayudantiaFiltro?: AyudantiaActiva | null,
): Unsubscribe {
  const consulta = ayudantiaFiltro
    ? query(
        equiposRef,
        where('usuario_uid', '==', usuarioUid),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(equiposRef, where('usuario_uid', '==', usuarioUid))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs
        .map((d) => d.data() as EquipoTurno)
        .filter((e) => e.acta_incidencia !== null)
      lista.sort((a, b) => (b.actualizado_en?.toMillis() ?? 0) - (a.actualizado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer actas del usuario:', err.code)
    },
  )
}

/**
 * Material propio registrado por un brigadista a través de sus turnos (bajo demanda en Expediente).
 */
export function escucharMaterialPropioDeUsuario(
  usuarioUid: string,
  alCambiar: (lista: EquipoTurno[]) => void,
  alFallar?: (error: FirestoreError) => void,
  ayudantiaFiltro?: AyudantiaActiva | null,
): Unsubscribe {
  const consulta = ayudantiaFiltro
    ? query(
        equiposRef,
        where('usuario_uid', '==', usuarioUid),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(equiposRef, where('usuario_uid', '==', usuarioUid))

  return onSnapshot(
    consulta,
    (snap) => {
      const lista = snap.docs
        .map((d) => d.data() as EquipoTurno)
        .filter((e) => e.origen_material === 'Propio')
      lista.sort((a, b) => (b.creado_en?.toMillis() ?? 0) - (a.creado_en?.toMillis() ?? 0))
      alCambiar(lista)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer material propio del usuario:', err.code)
    },
  )
}

/**
 * Carga bajo demanda una evidencia fotográfica WebP desde `evidencias_equipos/{id}`
 * únicamente cuando el usuario pulsa "Ver evidencia".
 */
export async function obtenerEvidenciaEquipo(evidenciaId: string): Promise<EvidenciaEquipo | null> {
  const snap = await getDoc(doc(evidenciasRef, evidenciaId))
  return snap.exists() ? (snap.data() as EvidenciaEquipo) : null
}
