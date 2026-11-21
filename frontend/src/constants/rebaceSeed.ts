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
  { nombre: 'CECOM', etiqueta: 'Canal 1 · Base', unidades: ['CECOM', '58A', 'E4', 'E5', 'BUPC 1'] },
  { nombre: '58A / Puesto de Mando', etiqueta: 'Canal 2 · Mando', unidades: ['58A', 'CECOM', 'Jefe Sector'] },
  { nombre: 'BUPC 1', etiqueta: 'Canal 3 · Campo', unidades: ['CECOM', 'BUPC 1', 'E1', 'E2'] },
  { nombre: 'BUPC 2', etiqueta: 'Canal 4 · Apoyo', unidades: ['CECOM', 'BUPC 2', 'E3', 'E4'] },
  { nombre: 'Sala de Crisis', etiqueta: 'Canal 5 · Emergencia', unidades: ['58A', 'CECOM', 'Sala de Crisis'] },
]

/**
 * Catálogo inicial de las 5 tablas oficiales ReBaCE v2 para poblar `catalogo_claves` en Firestore.
 */
export const SEMILLA_REBACE_V2: ClaveRebace[] = [
  // ── Tabla 1: Códigos 1-100 (básicos marcados con es_basico: true) ─────────
  { id: 'c_1', tabla: 'codigos_1_100', codigo: '1', significado: 'Sin novedad / Todo normal', categoria: 'Operación', es_basico: true, orden: 1 },
  { id: 'c_2', tabla: 'codigos_1_100', codigo: '2', significado: 'Recibido / Enterado', categoria: 'Operación', es_basico: true, orden: 2 },
  { id: 'c_3', tabla: 'codigos_1_100', codigo: '3', significado: 'Repita mensaje', categoria: 'Operación', es_basico: true, orden: 3 },
  { id: 'c_4', tabla: 'codigos_1_100', codigo: '4', significado: 'Afirmativo / Correcto', categoria: 'Operación', es_basico: true, orden: 4 },
  { id: 'c_5', tabla: 'codigos_1_100', codigo: '5', significado: 'Negativo', categoria: 'Operación', es_basico: true, orden: 5 },
  { id: 'c_6', tabla: 'codigos_1_100', codigo: '6', significado: 'En camino / Traslado', categoria: 'Despliegue', es_basico: true, orden: 6 },
  { id: 'c_7', tabla: 'codigos_1_100', codigo: '7', significado: 'En el lugar', categoria: 'Despliegue', es_basico: true, orden: 7 },
  { id: 'c_8', tabla: 'codigos_1_100', codigo: '8', significado: 'Disponible / En servicio', categoria: 'Estatus', es_basico: true, orden: 8 },
  { id: 'c_9', tabla: 'codigos_1_100', codigo: '9', significado: 'Fuera de servicio / En descanso', categoria: 'Estatus', es_basico: true, orden: 9 },
  { id: 'c_10', tabla: 'codigos_1_100', codigo: '10', significado: 'En espera de instrucciones', categoria: 'Operación', es_basico: true, orden: 10 },
  { id: 'c_14', tabla: 'codigos_1_100', codigo: '14', significado: 'Solicito apoyo de primeros auxilios', categoria: 'Emergencia', es_basico: true, orden: 14 },
  { id: 'c_19', tabla: 'codigos_1_100', codigo: '19', significado: 'Circulación o ubicación', categoria: 'Despliegue', es_basico: true, orden: 19 },
  { id: 'c_20', tabla: 'codigos_1_100', codigo: '20', significado: 'Punto de reunión / Base', categoria: 'Despliegue', es_basico: false, orden: 20 },
  { id: 'c_25', tabla: 'codigos_1_100', codigo: '25', significado: 'Persona lesionada o enferma', categoria: 'Emergencia', es_basico: true, orden: 25 },
  { id: 'c_30', tabla: 'codigos_1_100', codigo: '30', significado: 'Solicito ambulancia / traslado médico', categoria: 'Emergencia', es_basico: true, orden: 30 },
  { id: 'c_35', tabla: 'codigos_1_100', codigo: '35', significado: 'Conato o reporte de incendio', categoria: 'Emergencia', es_basico: false, orden: 35 },
  { id: 'c_40', tabla: 'codigos_1_100', codigo: '40', significado: 'Fuga de gas o material peligroso', categoria: 'Emergencia', es_basico: false, orden: 40 },
  { id: 'c_50', tabla: 'codigos_1_100', codigo: '50', significado: 'Evacuación de inmueble en curso', categoria: 'Emergencia', es_basico: true, orden: 50 },
  { id: 'c_51R', tabla: 'codigos_1_100', codigo: '51R', significado: 'Radio', categoria: 'Equipo', es_basico: true, orden: 51 },
  { id: 'c_58', tabla: 'codigos_1_100', codigo: '58', significado: 'Puesto de Mando / Coordinación', categoria: 'Mando', es_basico: true, orden: 58 },
  { id: 'c_60', tabla: 'codigos_1_100', codigo: '60', significado: 'Inmueble revisado y despejado', categoria: 'Emergencia', es_basico: false, orden: 60 },
  { id: 'c_70', tabla: 'codigos_1_100', codigo: '70', significado: 'Simulacro', categoria: 'Operación', es_basico: true, orden: 70 },
  { id: 'c_80', tabla: 'codigos_1_100', codigo: '80', significado: 'Apoyo logístico / hidratación / relevo', categoria: 'Logística', es_basico: false, orden: 80 },
  { id: 'c_90', tabla: 'codigos_1_100', codigo: '90', significado: 'Situación controlada', categoria: 'Operación', es_basico: true, orden: 90 },
  { id: 'c_99', tabla: 'codigos_1_100', codigo: '99', significado: 'Emergencia prioritaria — Silencio de radio', categoria: 'Emergencia', es_basico: true, orden: 99 },
  { id: 'c_100', tabla: 'codigos_1_100', codigo: '100', significado: 'Cierre de operativo / Fin de transmisión', categoria: 'Operación', es_basico: true, orden: 100 },

  // ── Tabla 2: Claves Personales / Indicadores ─────────────────────────────
  { id: 'p_cecom', tabla: 'claves_personales', codigo: 'CECOM', significado: 'Centro de Comunicaciones BUPC', categoria: 'Base', es_basico: true, orden: 1 },
  { id: 'p_58A', tabla: 'claves_personales', codigo: '58A', significado: 'Puesto de Mando / Coordinación General', categoria: 'Mando', es_basico: true, orden: 2 },
  { id: 'p_bupc1', tabla: 'claves_personales', codigo: 'BUPC 1', significado: 'Unidad Operativa Principal 1', categoria: 'Unidad', es_basico: true, orden: 3 },
  { id: 'p_bupc2', tabla: 'claves_personales', codigo: 'BUPC 2', significado: 'Unidad Operativa Principal 2', categoria: 'Unidad', es_basico: false, orden: 4 },
  { id: 'p_e1', tabla: 'claves_personales', codigo: 'E1', significado: 'Elemento / Binomio Operativo 1', categoria: 'Elemento', es_basico: false, orden: 5 },
  { id: 'p_e4', tabla: 'claves_personales', codigo: 'E4', significado: 'Elemento / Unidad Móvil 4', categoria: 'Elemento', es_basico: false, orden: 6 },
  { id: 'p_e5', tabla: 'claves_personales', codigo: 'E5', significado: 'Elemento / Unidad Móvil 5', categoria: 'Elemento', es_basico: false, orden: 7 },
  { id: 'p_alfa', tabla: 'claves_personales', codigo: 'ALFA', significado: 'Grupo Operativo Alfa', categoria: 'Grupo', es_basico: true, orden: 8 },
  { id: 'p_omega', tabla: 'claves_personales', codigo: 'OMEGA', significado: 'Grupo Operativo Omega', categoria: 'Grupo', es_basico: true, orden: 9 },

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
