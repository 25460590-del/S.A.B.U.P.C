import type { ClaveRebace, TablaRebace } from '../types'

export const ETIQUETAS_TABLAS_REBACE: Record<TablaRebace, string> = {
  codigos_1_100: 'Códigos 1–100',
  claves_personales: 'Claves Personales',
  alfabeto_fonetico: 'Alfabeto OACI',
  codigo_q: 'Código Q',
  morse_banderolas: 'Morse / Banderolas',
}

export const TABLAS_REBACE_ORDEN: TablaRebace[] = [
  'codigos_1_100',
  'claves_personales',
  'alfabeto_fonetico',
  'codigo_q',
  'morse_banderolas',
]

export const CANALES_SUGERIDOS: { nombre: string; etiqueta: string; unidades: string[] }[] = [
  { nombre: 'CECOM', etiqueta: 'Canal 1 · Base', unidades: ['CECOM', '58A', 'UCOL-01', 'UCOL-02', 'TESLA'] },
  { nombre: '58A / Puesto de Mando', etiqueta: 'Canal 2 · Mando', unidades: ['58A', 'CECOM', '42', 'Piscis'] },
  { nombre: 'BUPC 1', etiqueta: 'Canal 3 · Campo', unidades: ['CECOM', 'UCOL-01', 'UCOL-02', 'UCOL-03'] },
  { nombre: 'BUPC 2', etiqueta: 'Canal 4 · Apoyo', unidades: ['CECOM', 'Lince', 'Apolo', 'Artemisa'] },
  { nombre: 'Sala de Crisis', etiqueta: 'Canal 5 · Emergencia', unidades: ['58A', 'CECOM', '42'] },
]

/** Códigos básicos resaltados para referencia rápida en operación de radio. */
const CODIGOS_BASICOS = new Set([
  '1', '2', '2A', '2F', '3', '4', '5', '5G', '6', '7', '7A', '8', '10',
  '17', '18', '18A', '19', '22', '23', '27', '31', '33', '33A', '34',
  '36', '38', '38A', '42', '45', '50', '51', '51R', '58', '58A', '59',
  '62', '63', '67', '67A', '70', '71', '95', '99', '100',
])

/**
 * Listado oficial de 114 Códigos Generales de Radiocomunicación (100% offline).
 */
const CODIGOS_GENERALES_OFICIALES: readonly (readonly [string, string])[] = [
  ['1', 'Urgencia'],
  ['2', 'Bomberos'],
  ['2A', 'Incendio'],
  ['2B', 'Explosión'],
  ['2F', 'Fuga de gas'],
  ['2I', 'Inundación'],
  ['3', 'Emergencia Grande'],
  ['4', 'Ambulancia'],
  ['5', 'Herido'],
  ['5A', 'Herido Apuñalado'],
  ['5B', 'Herido Baleado'],
  ['5C', 'Herido Caído'],
  ['5D', 'Herido Leve'],
  ['5E', 'Herido Electrocutado'],
  ['5F', 'Herido Fracturado'],
  ['5G', 'Herido Grave'],
  ['5I', 'Herido Intoxicado'],
  ['5M', 'Herido Amputado'],
  ['5P', 'Herido Golpeado'],
  ['5Q', 'Herido Quemado'],
  ['5R', 'Herido Cortado'],
  ['5S', 'Herido Asfixiado'],
  ['5Z', 'Herido Cardiaco'],
  ['6', 'Regresamos Libres'],
  ['7', 'En el lugar'],
  ['7A', 'Situación Controlada'],
  ['8', 'Policía'],
  ['10', 'Traslado'],
  ['11', 'Prensa'],
  ['11A', 'Foto'],
  ['12', 'Carretera'],
  ['14', 'Cadáver'],
  ['14S', 'Suicidio'],
  ['15', 'Servicio Especial'],
  ['15A', 'Servicio Administrativo'],
  ['15M', 'Servicio de Mantenimiento'],
  ['16', 'Teléfono'],
  ['16C', 'Teléfono Celular'],
  ['17', 'Repetir Mensaje'],
  ['18', 'Enterado'],
  ['18A', 'Afirmativo'],
  ['19', 'Circulación o Ubicación'],
  ['19A', 'Domicilio Particular'],
  ['19P', 'Casa'],
  ['20', 'Persona Ajena'],
  ['20A', 'Familiar'],
  ['21', 'Alimentos'],
  ['21A', 'Agua'],
  ['21D', 'Diésel'],
  ['21G', 'Gasolina'],
  ['21N', 'Sanitario'],
  ['22', 'Falsa Alarma'],
  ['22B', 'No se encontró lesionado'],
  ['22C', 'Negó ser atendido'],
  ['23', 'Rescate'],
  ['23E', 'Equipo de...'],
  ['25', 'Accidente Aéreo'],
  ['26', 'Vehículo'],
  ['27', 'Choque'],
  ['27A', 'Volcadura'],
  ['29', 'Jefe de...'],
  ['29A', 'Operador de ambulancia'],
  ['31', 'Pendiente'],
  ['32', 'Convoy'],
  ['33', 'Adelante con el Mensaje'],
  ['33A', 'Canal Libre'],
  ['34', 'Personal'],
  ['34A', 'Personal Administrativo'],
  ['34B', 'Búsqueda y rescate'],
  ['34C', 'Abastecedores'],
  ['34D', 'Socorristas/Atención'],
  ['34E', 'Enfermero/a'],
  ['34M', 'Médico'],
  ['34R', 'Radiocomunicador/TESLA'],
  ['36', 'Datos del Incidente'],
  ['36B', 'Informe Novedades'],
  ['37', 'Reunión'],
  ['38', 'Servicio/Orden Cancelado'],
  ['38A', 'Negativo/No'],
  ['39', 'Orden'],
  ['41', 'Dron'],
  ['41C', 'Dron Tello'],
  ['41D', 'Dron DJI'],
  ['41H', 'Helicóptero'],
  ['42', 'Director General'],
  ['43', 'Otro Servicio Cercano'],
  ['44', 'Persona Ebria'],
  ['44D', 'Persona Drogada'],
  ['44N', 'Persona con Crisis Nerviosa'],
  ['45', 'Hospital'],
  ['47', 'Falla Mecánica'],
  ['47T', 'Taller'],
  ['49', 'Parto'],
  ['49A', 'Hemorragia o Aborto'],
  ['50', 'Llamada General'],
  ['51', 'Cambio de Canal'],
  ['51R', 'Radio'],
  ['52', 'Investigue el Lugar'],
  ['52A', 'Necesitamos más datos'],
  ['54', 'Problemas'],
  ['58', 'Base'],
  ['58A', 'Puesto de mando'],
  ['59', 'Relevo'],
  ['62', 'Urgencia en Silencio'],
  ['63', 'Servicio Urgente'],
  ['67', 'Fuera de Aire'],
  ['67A', 'Al aire'],
  ['69', 'Zona del Desastre'],
  ['70', 'Simulacro'],
  ['71', 'Lesiones y Signos Vitales del Lesionado'],
  ['75', 'Paramédico'],
  ['95', 'Gracias/Por Favor'],
  ['99', 'Ayuda'],
  ['100', 'Personal Herido'],
] as const

export const CLAVES_GENERALES_OFFLINE: ClaveRebace[] = CODIGOS_GENERALES_OFICIALES.map(
  ([codigo, significado], idx) => ({
    id: `c_${codigo.toLowerCase()}`,
    tabla: 'codigos_1_100',
    codigo,
    significado,
    categoria: 'General',
    es_basico: CODIGOS_BASICOS.has(codigo),
    orden: idx + 1,
  }),
)

/**
 * Respaldo inicial offline de Claves Personales y Unidades Móviles.
 * El Administrador puede editarlas o agregar nuevas desde Catálogos en Firestore.
 */
export const CLAVES_PERSONALES_Y_UNIDADES_OFFLINE: ClaveRebace[] = [
  // Personal
  { id: 'p_piscis', tabla: 'claves_personales', codigo: 'Piscis', significado: 'TUM Marcelino Ramos', categoria: 'Personal', es_basico: true, orden: 1 },
  { id: 'p_libra', tabla: 'claves_personales', codigo: 'Libra', significado: 'TUM Sergio Martinez', categoria: 'Personal', es_basico: true, orden: 2 },
  { id: 'p_42', tabla: 'claves_personales', codigo: '42', significado: 'Mtro. Marcos Buenrostro Jr', categoria: 'Personal', es_basico: true, orden: 3 },
  { id: 'p_roma', tabla: 'claves_personales', codigo: 'Roma', significado: 'Arq. Alexandra Gutierrez', categoria: 'Personal', es_basico: true, orden: 4 },
  { id: 'p_artemisa', tabla: 'claves_personales', codigo: 'Artemisa', significado: 'Diana Cruz', categoria: 'Personal', es_basico: true, orden: 5 },
  { id: 'p_apolo', tabla: 'claves_personales', codigo: 'Apolo', significado: 'Carlos Avalos', categoria: 'Personal', es_basico: true, orden: 6 },
  { id: 'p_lince', tabla: 'claves_personales', codigo: 'Lince', significado: 'Sofia Ramos', categoria: 'Personal', es_basico: true, orden: 7 },
  { id: 'p_tesla', tabla: 'claves_personales', codigo: 'TESLA', significado: 'Karol Cobian', categoria: 'Personal', es_basico: true, orden: 8 },
  // Unidades
  { id: 'u_ucol_01', tabla: 'claves_personales', codigo: 'UCOL-01', significado: 'Ambulancia de Traslados', categoria: 'Unidad', es_basico: true, orden: 9 },
  { id: 'u_ucol_02', tabla: 'claves_personales', codigo: 'UCOL-02', significado: 'Lobo', categoria: 'Unidad', es_basico: true, orden: 10 },
  { id: 'u_ucol_03', tabla: 'claves_personales', codigo: 'UCOL-03', significado: 'Econoline', categoria: 'Unidad', es_basico: true, orden: 11 },
]

/**
 * Catálogo completo oficial ReBaCE v2 (5 tablas) disponible 100% offline y como semilla para Firestore.
 */
export const SEMILLA_REBACE_V2: ClaveRebace[] = [
  ...CLAVES_GENERALES_OFFLINE,
  ...CLAVES_PERSONALES_Y_UNIDADES_OFFLINE,

  // ── Tabla 3: Alfabeto Fonético OACI / UIT ────────────────────────────────
  ...([
    ['A', 'Alfa'], ['B', 'Bravo'], ['C', 'Charlie'], ['D', 'Delta'], ['E', 'Eco'],
    ['F', 'Foxtrot'], ['G', 'Golf'], ['H', 'Hotel'], ['I', 'India'], ['J', 'Juliett'],
    ['K', 'Kilo'], ['L', 'Lima'], ['M', 'Mike'], ['N', 'November'], ['O', 'Oscar'],
    ['P', 'Papa'], ['Q', 'Quebec'], ['R', 'Romeo'], ['S', 'Sierra'], ['T', 'Tango'],
    ['U', 'Uniform'], ['V', 'Victor'], ['W', 'Whiskey'], ['X', 'X-ray'], ['Y', 'Yankee'],
    ['Z', 'Zulu'],
  ] as const).map(([letra, palabra], i) => ({
    id: `f_${letra}`,
    tabla: 'alfabeto_fonetico' as const,
    codigo: letra,
    significado: palabra,
    categoria: 'OACI / UIT',
    es_basico: i < 6,
    orden: i + 1,
  })),

  // ── Tabla 4: Código Q ────────────────────────────────────────────────────
  { id: 'q_qap', tabla: 'codigo_q', codigo: 'QAP', significado: 'A la escucha / En frecuencia', categoria: 'Enlace', es_basico: true, orden: 1 },
  { id: 'q_qra', tabla: 'codigo_q', codigo: 'QRA', significado: 'Nombre o indicativo de la estación', categoria: 'Identidad', es_basico: false, orden: 2 },
  { id: 'q_qrm', tabla: 'codigo_q', codigo: 'QRM', significado: 'Interferencia de otra estación', categoria: 'Señal', es_basico: true, orden: 3 },
  { id: 'q_qrn', tabla: 'codigo_q', codigo: 'QRN', significado: 'Ruido estático o atmosférico', categoria: 'Señal', es_basico: false, orden: 4 },
  { id: 'q_qrt', tabla: 'codigo_q', codigo: 'QRT', significado: 'Suspender transmisión / Fuera del aire', categoria: 'Enlace', es_basico: true, orden: 5 },
  { id: 'q_qrv', tabla: 'codigo_q', codigo: 'QRV', significado: 'Listo para recibir', categoria: 'Enlace', es_basico: true, orden: 6 },
  { id: 'q_qrx', tabla: 'codigo_q', codigo: 'QRX', significado: 'Espere un momento en frecuencia', categoria: 'Enlace', es_basico: true, orden: 7 },
  { id: 'q_qsl', tabla: 'codigo_q', codigo: 'QSL', significado: 'Acuso recibo / Comprendido', categoria: 'Confirmación', es_basico: true, orden: 8 },
  { id: 'q_qso', tabla: 'codigo_q', codigo: 'QSO', significado: 'Comunicación directa establecida', categoria: 'Enlace', es_basico: false, orden: 9 },
  { id: 'q_qsy', tabla: 'codigo_q', codigo: 'QSY', significado: 'Cambiar de frecuencia / canal', categoria: 'Enlace', es_basico: true, orden: 10 },
  { id: 'q_qth', tabla: 'codigo_q', codigo: 'QTH', significado: 'Ubicación o posición actual', categoria: 'Ubicación', es_basico: true, orden: 11 },
  { id: 'q_qtr', tabla: 'codigo_q', codigo: 'QTR', significado: 'Hora exacta', categoria: 'Tiempo', es_basico: false, orden: 12 },

  // ── Tabla 5: Código Morse / Banderolas ───────────────────────────────────
  { id: 'm_sos', tabla: 'morse_banderolas', codigo: 'SOS', significado: '... --- ... · Señal internacional de auxilio', categoria: 'Morse', es_basico: true, orden: 1 },
  { id: 'm_ok', tabla: 'morse_banderolas', codigo: 'K', significado: '-.- · Adelante / Cambio para transmitir', categoria: 'Morse', es_basico: true, orden: 2 },
  { id: 'm_r', tabla: 'morse_banderolas', codigo: 'R', significado: '.-. · Recibido correctamente', categoria: 'Morse', es_basico: true, orden: 3 },
  { id: 'm_ar', tabla: 'morse_banderolas', codigo: 'AR', significado: '.-.-. · Fin de mensaje', categoria: 'Morse', es_basico: false, orden: 4 },
  { id: 'b_verde', tabla: 'morse_banderolas', codigo: 'Banderola Verde', significado: 'Zona segura / Paso libre / Sin novedad', categoria: 'Banderolas', es_basico: true, orden: 5 },
  { id: 'b_amarilla', tabla: 'morse_banderolas', codigo: 'Banderola Amarilla', significado: 'Precaución / Alerta preventiva', categoria: 'Banderolas', es_basico: true, orden: 6 },
  { id: 'b_roja', tabla: 'morse_banderolas', codigo: 'Banderola Roja', significado: 'Peligro / Alto total / Evacuación inmediata', categoria: 'Banderolas', es_basico: true, orden: 7 },
  { id: 'b_blanca', tabla: 'morse_banderolas', codigo: 'Banderola Blanca', significado: 'Puesto de Mando / Atención médica', categoria: 'Banderolas', es_basico: false, orden: 8 },
]

/**
 * Fusiona el catálogo offline oficial con entradas personalizadas en Firestore:
 * - Los 114 códigos generales, Alfabeto, Código Q y Morse están siempre disponibles offline.
 * - Las entradas en Firestore sobreescriben por `id` o añaden nuevas claves/unidades.
 */
export function combinarCatalogoRebaceConOffline(remotas: ClaveRebace[]): ClaveRebace[] {
  const mapa = new Map<string, ClaveRebace>()
  for (const base of SEMILLA_REBACE_V2) {
    mapa.set(base.id, base)
  }
  const hayClavesPersonalesRemotas = remotas.some((r) => r.tabla === 'claves_personales')
  if (hayClavesPersonalesRemotas) {
    // Si el Admin ya gestiona `claves_personales` en Firestore, respetamos exactamente las remotas
    // (así los borrados del Admin se reflejan de inmediato).
    for (const base of CLAVES_PERSONALES_Y_UNIDADES_OFFLINE) {
      mapa.delete(base.id)
    }
  }
  for (const r of remotas) {
    mapa.set(r.id, r)
  }
  return Array.from(mapa.values()).sort((a, b) => a.orden - b.orden)
}
