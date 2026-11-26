import { collection, getDocs, query, where } from 'firebase/firestore'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { CATEGORIAS_OPERATIVO } from '../constants/catalogos'
import { db } from '../lib/firebase'
import { normalizarNombrePropio } from '../lib/nombres'
import type { AyudantiaActiva } from '../lib/permisos'
import type {
  AsistenciaPersonal,
  CategoriaOperativo,
  EquipoTurno,
  Operativo,
  RegistroBitacoraRadio,
  Usuario,
} from '../types'
import { nombreCompleto } from './authService'

export interface DesgloseCategoria {
  categoria: CategoriaOperativo
  horas: number
  turnos: number
}

export interface DatosExpedienteOperativo {
  asistencias: AsistenciaPersonal[]
  equipos: EquipoTurno[]
  registrosRadio: RegistroBitacoraRadio[]
}

function formatearFechaHora(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function slugArchivo(texto: string): string {
  return (
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'reporte'
  )
}

async function cargarLogoBupcDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch('/logo-bupc.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function calcularDesgloseHoras(
  asistenciasCerradas: AsistenciaPersonal[],
  mapaOperativos: Map<string, Operativo>,
): { totalHoras: number; desglose: DesgloseCategoria[] } {
  const acumulado = new Map<CategoriaOperativo, { horas: number; turnos: number }>()
  for (const cat of CATEGORIAS_OPERATIVO) {
    acumulado.set(cat, { horas: 0, turnos: 0 })
  }

  let totalHoras = 0
  for (const a of asistenciasCerradas) {
    const horas = typeof a.horas_totales === 'number' ? a.horas_totales : 0
    totalHoras += horas
    const cat = mapaOperativos.get(a.operativo_id)?.categoria ?? 'Guardias Ordinarias'
    const actual = acumulado.get(cat)!
    actual.horas += horas
    actual.turnos += 1
  }

  return {
    totalHoras: Number(totalHoras.toFixed(2)),
    desglose: CATEGORIAS_OPERATIVO.map((categoria) => {
      const item = acumulado.get(categoria)!
      return {
        categoria,
        horas: Number(item.horas.toFixed(2)),
        turnos: item.turnos,
      }
    }),
  }
}

/**
 * Genera y descarga la Constancia de Horas en PDF con membrete oficial BUPC Universidad de Colima.
 */
export async function generarConstanciaHorasPdf(
  usuario: Usuario,
  asistenciasCerradas: AsistenciaPersonal[],
  mapaOperativos: Map<string, Operativo>,
): Promise<void> {
  const { totalHoras, desglose } = calcularDesgloseHoras(asistenciasCerradas, mapaOperativos)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = await cargarLogoBupcDataUrl()

  // Encabezado institucional Verde Universidad de Colima (#2E5A27) + franja Naranja PC (#EA580C)
  doc.setFillColor(46, 90, 39)
  doc.rect(0, 0, 216, 30, 'F')
  doc.setFillColor(234, 88, 12)
  doc.rect(0, 30, 216, 2, 'F')

  if (logo) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(12, 5, 20, 20, 2, 2, 'F')
    doc.addImage(logo, 'PNG', 13.5, 6.5, 17, 17)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('UNIVERSIDAD DE COLIMA', 38, 12)
  doc.setFontSize(11)
  doc.text('Brigada Universitaria de Protección Civil (BUPC)', 38, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('S.A.B.U.P.C · Constancia Oficial de Horas Operativas', 38, 24)

  // Datos del Brigadista
  doc.setTextColor(24, 24, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('CONSTANCIA DE PARTICIPACIÓN Y HORAS ACUMULADAS', 14, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const grupoTxt =
    usuario.subgrupo ||
    (usuario.grupo_operativo === 'Ninguno' ? usuario.etapa : `Grupo ${usuario.grupo_operativo}`)
  const contactoNombre = normalizarNombrePropio(usuario.contacto_emergencia_nombre)
  const contactoParentesco = usuario.contacto_emergencia_parentesco?.trim() || ''
  const contactoLinea = [
    contactoNombre,
    contactoParentesco ? `(${contactoParentesco})` : '',
    usuario.contacto_emergencia_telefono,
  ]
    .filter(Boolean)
    .join(' · ')

  doc.text(`Brigadista: ${nombreCompleto(usuario)}`, 14, 50)
  doc.text(`No. de Cuenta UdeC: ${usuario.numero_cuenta}`, 14, 56)
  doc.text(`Adscripción: ${grupoTxt} · Ayudantía: ${usuario.ayudantia || usuario.ayudantia_slot}`, 14, 62)
  doc.text(`Fecha de emisión: ${formatearFechaHora(Date.now())}`, 14, 68)
  if (contactoLinea) {
    doc.setFontSize(8.5)
    doc.text(`Ficha de Emergencia · Contacto: ${contactoLinea}`, 14, 74)
    doc.setFontSize(10)
  }

  doc.setFillColor(237, 245, 235)
  doc.roundedRect(148, 46, 54, 22, 2, 2, 'F')
  doc.setTextColor(30, 86, 49)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL ACUMULADO', 175, 53, { align: 'center' })
  doc.setFontSize(18)
  doc.text(`${totalHoras.toFixed(2)} hrs`, 175, 63, { align: 'center' })

  // Tabla 1: Desglose por categoría
  autoTable(doc, {
    startY: contactoLinea ? 80 : 76,
    head: [['Categoría Institucional', 'Turnos', 'Horas Acumuladas']],
    body: desglose.map((d) => [d.categoria, String(d.turnos), `${d.horas.toFixed(2)} hrs`]),
    headStyles: { fillColor: [30, 86, 49], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2.5 },
  })

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 115

  // Tabla 2: Historial cronológico
  autoTable(doc, {
    startY: finalY + 8,
    head: [['Operativo / Actividad', 'Categoría', 'Rol en Turno', 'Entrada', 'Salida', 'Horas']],
    body:
      asistenciasCerradas.length > 0
        ? asistenciasCerradas.map((a) => [
            a.operativo_nombre,
            mapaOperativos.get(a.operativo_id)?.categoria ?? '—',
            a.rol_en_turno,
            formatearFechaHora(a.hora_entrada?.toMillis()),
            formatearFechaHora(a.hora_salida?.toMillis()),
            `${(a.horas_totales ?? 0).toFixed(2)}`,
          ])
        : [['Sin asistencias cerradas registradas', '—', '—', '—', '—', '0.00']],
    headStyles: { fillColor: [46, 90, 39], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
  })

  doc.save(`constancia-horas-bupc-${slugArchivo(usuario.numero_cuenta || usuario.uid)}.pdf`)
}

// ── Archivo Operativo Global (Encargado / Administrador) ─────────────────────

export async function obtenerDatosExpedienteOperativo(
  operativoId: string,
  ayudantiaFiltro?: AyudantiaActiva | null,
): Promise<DatosExpedienteOperativo> {
  const consultaAsis = ayudantiaFiltro
    ? query(
        collection(db, 'asistencias_personal'),
        where('operativo_id', '==', operativoId),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(collection(db, 'asistencias_personal'), where('operativo_id', '==', operativoId))

  const consultaEq = ayudantiaFiltro
    ? query(
        collection(db, 'equipos_turno'),
        where('operativo_id', '==', operativoId),
        where('ayudantia_slot', '==', ayudantiaFiltro),
      )
    : query(collection(db, 'equipos_turno'), where('operativo_id', '==', operativoId))

  const [asisSnap, eqSnap, radioSnap] = await Promise.all([
    getDocs(consultaAsis),
    getDocs(consultaEq),
    getDocs(
      query(collection(db, 'bitacora_radio_registros'), where('operativo_id', '==', operativoId)),
    ).catch(() => null),
  ])

  const asistencias = asisSnap.docs
    .map((d) => d.data() as AsistenciaPersonal)
    .sort((a, b) => (a.hora_entrada?.toMillis() ?? 0) - (b.hora_entrada?.toMillis() ?? 0))

  const idsAsistenciaPermitidos = ayudantiaFiltro
    ? new Set(asistencias.map((a) => a.id))
    : null

  const equipos = eqSnap.docs
    .map((d) => d.data() as EquipoTurno)
    .filter((eq) => !idsAsistenciaPermitidos || idsAsistenciaPermitidos.has(eq.asistencia_id))
    .sort((a, b) => (a.creado_en?.toMillis() ?? 0) - (b.creado_en?.toMillis() ?? 0))

  const registrosRadio = radioSnap
    ? radioSnap.docs
        .map((d) => d.data() as RegistroBitacoraRadio)
        .sort((a, b) => (a.creado_en?.toMillis() ?? 0) - (b.creado_en?.toMillis() ?? 0))
    : []

  return { asistencias, equipos, registrosRadio }
}

/**
 * Exporta el Archivo Operativo en formato Excel (.xlsx compatible con Google Sheets)
 * con 3 hojas separadas: Asistencias, Equipos y Actas, y Bitácora Radio.
 */
export function exportarExpedienteExcel(
  operativo: Operativo,
  datos: DatosExpedienteOperativo,
): void {
  const wb = XLSX.utils.book_new()

  const hojaAsistencias = XLSX.utils.json_to_sheet(
    datos.asistencias.length > 0
      ? datos.asistencias.map((a) => ({
          Brigadista: normalizarNombrePropio(a.usuario_nombre),
          Cuenta: a.usuario_cuenta,
          Grupo: a.grupo_operativo,
          Ayudantía: a.ayudantia_slot,
          'Rol en Turno': a.rol_en_turno,
          Estado: a.estado_operativo,
          Entrada: formatearFechaHora(a.hora_entrada?.toMillis()),
          Salida: formatearFechaHora(a.hora_salida?.toMillis()),
          'Horas Totales': a.horas_totales ?? 0,
          'Método Entrada': a.metodo_entrada,
          'BUPC Pendientes': a.equipos_bupc_pendientes,
        }))
      : [{ Aviso: 'Sin asistencias registradas en este operativo' }],
  )
  XLSX.utils.book_append_sheet(wb, hojaAsistencias, 'Asistencias')

  const hojaEquipos = XLSX.utils.json_to_sheet(
    datos.equipos.length > 0
      ? datos.equipos.map((e) => ({
          Brigadista: normalizarNombrePropio(e.usuario_nombre),
          Artículo: e.nombre_articulo,
          Folio: e.codigo_inventario,
          Origen: e.origen_material,
          Estado: e.estado_reporte,
          Devuelto: e.devuelto ? 'Sí' : 'No',
          'Falla Reportada': e.falla_reportada,
          'Acta de Incidencia': e.acta_incidencia?.motivo ?? '',
        }))
      : [{ Aviso: 'Sin equipos registrados en este operativo' }],
  )
  XLSX.utils.book_append_sheet(wb, hojaEquipos, 'Equipos y Actas')

  const hojaRadio = XLSX.utils.json_to_sheet(
    datos.registrosRadio.length > 0
      ? datos.registrosRadio.map((r) => ({
          Hora: r.hora_original,
          ORIGEN: r.origen,
          DESTINO: r.destinos.join(', '),
          Actividades: r.actividades,
          'Registrado por': normalizarNombrePropio(r.registrado_por),
          Editado: r.fue_editado ? 'Sí' : 'No',
          'Respaldo Original': r.actividad_original_respaldo ?? '',
        }))
      : [{ Aviso: 'Sin transmisiones de radio registradas en este operativo' }],
  )
  XLSX.utils.book_append_sheet(wb, hojaRadio, 'Bitácora Radio')

  XLSX.writeFile(wb, `expediente-bupc-${slugArchivo(operativo.nombre)}.xlsx`)
}

/**
 * Genera el Expediente Operativo completo en PDF con jsPDF + jspdf-autotable.
 */
export async function exportarExpedientePdf(
  operativo: Operativo,
  datos: DatosExpedienteOperativo,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const logo = await cargarLogoBupcDataUrl()

  doc.setFillColor(46, 90, 39)
  doc.rect(0, 0, 216, 28, 'F')
  doc.setFillColor(234, 88, 12)
  doc.rect(0, 28, 216, 2, 'F')

  if (logo) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(12, 4, 20, 20, 2, 2, 'F')
    doc.addImage(logo, 'PNG', 13.5, 5.5, 17, 17)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('EXPEDIENTE OPERATIVO · BUPC UdeC', 38, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${operativo.nombre} (${operativo.categoria})`, 38, 18)
  doc.setFontSize(8.5)
  doc.text(`Sede: ${operativo.sede} · Inicio: ${operativo.fecha_inicio.replace('T', ' ')}`, 38, 24)

  const incidencias = datos.equipos.filter((e) => e.acta_incidencia !== null || e.estado_reporte === 'Con_Falla')

  doc.setTextColor(24, 24, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(
    `Personal: ${datos.asistencias.length}  |  Equipos registrados: ${datos.equipos.length}  |  Incidencias: ${incidencias.length}  |  Transmisiones Radio: ${datos.registrosRadio.length}`,
    14,
    38,
  )

  autoTable(doc, {
    startY: 43,
    head: [['Brigadista', 'Grupo / Ayudantía', 'Rol', 'Entrada', 'Salida', 'Horas']],
    body:
      datos.asistencias.length > 0
        ? datos.asistencias.map((a) => [
            normalizarNombrePropio(a.usuario_nombre),
            `${a.grupo_operativo} · ${a.ayudantia_slot}`,
            a.rol_en_turno,
            formatearFechaHora(a.hora_entrada?.toMillis()),
            formatearFechaHora(a.hora_salida?.toMillis()),
            String(a.horas_totales ?? 0),
          ])
        : [['Sin personal registrado', '—', '—', '—', '—', '—']],
    headStyles: { fillColor: [30, 86, 49], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
  })

  let nextY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 85

  autoTable(doc, {
    startY: nextY + 8,
    head: [['Material / Equipo', 'Brigadista', 'Origen', 'Estado / Acta de Incidencia']],
    body:
      datos.equipos.length > 0
        ? datos.equipos.map((e) => [
            `${e.nombre_articulo}${e.codigo_inventario ? ` (${e.codigo_inventario})` : ''}`,
            normalizarNombrePropio(e.usuario_nombre),
            e.origen_material,
            e.acta_incidencia
              ? `ACTA: ${e.acta_incidencia.motivo}`
              : e.devuelto
                ? 'Devuelto OK'
                : e.falla_reportada || e.estado_reporte,
          ])
        : [['Sin material registrado', '—', '—', '—']],
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
  })

  nextY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130

  autoTable(doc, {
    startY: nextY + 8,
    head: [['Hora', 'ORIGEN', 'DESTINO', 'Actividades (Bitácora de Radio)']],
    body:
      datos.registrosRadio.length > 0
        ? datos.registrosRadio.map((r) => [
            r.hora_original,
            r.origen,
            r.destinos.join(', '),
            r.fue_editado ? `${r.actividades} [Editado]` : r.actividades,
          ])
        : [['—', '—', '—', 'Sin transmisiones registradas']],
    headStyles: { fillColor: [46, 90, 39], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
  })

  doc.save(`expediente-operativo-${slugArchivo(operativo.nombre)}.pdf`)
}
