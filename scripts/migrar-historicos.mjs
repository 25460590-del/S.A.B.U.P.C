#!/usr/bin/env node
/**
 * S.A.B.U.P.C — Script local único de migración de registros históricos en Firestore.
 *
 * NO forma parte del frontend ni agrega vistas/botones en la UI.
 *
 * Uso manual por terminal (desde la raíz del repositorio):
 *   1) Simulación segura (por defecto, NO escribe nada en Firestore):
 *      node scripts/migrar-historicos.mjs --dry-run
 *
 *   2) Aplicar cambios en lotes WriteBatch (máximo 400 operaciones por lote):
 *      node scripts/migrar-historicos.mjs --apply
 *
 *   3) Prueba segura contra el emulador local de Firestore (detecta FIRESTORE_EMULATOR_HOST):
 *      # PowerShell:
 *      $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; node scripts/migrar-historicos.mjs --dry-run
 *      $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; node scripts/migrar-historicos.mjs --apply
 *
 *   4) Contra un proyecto con llave de cuenta de servicio (nunca versionar el JSON):
 *      $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\segura\serviceAccount.json"
 *      node scripts/migrar-historicos.mjs --project=sabupc-colima --dry-run
 *      node scripts/migrar-historicos.mjs --project=sabupc-colima --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const MAX_OPS_POR_LOTE = 400

const CONECTORES_MINUSCULA = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

const AYUDANTIAS_VALIDAS = new Set([
  'Capacitación',
  'Administración de Personal',
  'Tesla',
  'Socorros',
  'Logística',
  'Ninguna',
])

const ETAPAS_VALIDAS = new Set(['Alfa', 'Omega', 'SIERRA', 'Grupo Operativo'])

const ROLES_TURNO_VALIDOS = new Set([
  'Búsqueda y Rescate',
  'Radios',
  'Encargados',
  'Abastecedores',
  'Atención',
  'Sin definir',
  'Primeros Auxilios',
  'Radiocomunicación',
  'Evacuación',
  'Logística',
  'Encargado',
  'Sin asignar',
])

function capitalizarSegmento(segmento) {
  if (!segmento) return ''
  return segmento.charAt(0).toLocaleUpperCase('es-MX') + segmento.slice(1)
}

function normalizarNombrePropio(texto) {
  if (typeof texto !== 'string') return ''
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (!limpio) return ''

  return limpio
    .split(' ')
    .map((palabra, indice) => {
      const minuscula = palabra.toLocaleLowerCase('es-MX')
      if (indice > 0 && CONECTORES_MINUSCULA.has(minuscula)) {
        return minuscula
      }
      return minuscula
        .split('-')
        .map((seg) => capitalizarSegmento(seg))
        .join('-')
    })
    .join(' ')
}

function rolOperativoPorAyudantia(ayudantia) {
  switch (ayudantia) {
    case 'Capacitación':
      return 'Búsqueda y Rescate'
    case 'Tesla':
      return 'Radios'
    case 'Administración de Personal':
      return 'Encargados'
    case 'Logística':
      return 'Abastecedores'
    case 'Socorros':
      return 'Atención'
    default:
      return 'Sin definir'
  }
}

function etapaDeSubgrupo(subgrupo) {
  if (typeof subgrupo !== 'string') return null
  const limpio = subgrupo.trim().toLowerCase()
  if (limpio.startsWith('alfa')) return 'Alfa'
  if (limpio.startsWith('omega')) return 'Omega'
  if (limpio.startsWith('sierra')) return 'SIERRA'
  return null
}

function resolverEtapaCompatible(subgrupo, respaldoUsuario) {
  const desdeSub = etapaDeSubgrupo(subgrupo)
  if (desdeSub) return desdeSub
  if (respaldoUsuario && ETAPAS_VALIDAS.has(respaldoUsuario.etapa)) {
    return respaldoUsuario.etapa
  }
  const grupoLegado = respaldoUsuario?.grupo_operativo
  if (grupoLegado === 'Alfa') return 'Alfa'
  if (grupoLegado === 'Omega') return 'Omega'
  return 'Grupo Operativo'
}

function resolverAyudantiaValida(...candidatos) {
  for (const c of candidatos) {
    if (typeof c === 'string' && AYUDANTIAS_VALIDAS.has(c) && c !== 'Ninguna') {
      return c
    }
  }
  for (const c of candidatos) {
    if (typeof c === 'string' && AYUDANTIAS_VALIDAS.has(c)) {
      return c
    }
  }
  return 'Ninguna'
}

function parsearArgumentos(argv) {
  const tieneApply = argv.includes('--apply')
  const tieneDryRun = argv.includes('--dry-run')
  if (tieneApply && tieneDryRun) {
    throw new Error('Usa únicamente --dry-run o --apply, no ambos al mismo tiempo.')
  }

  const argProyecto = argv.find((a) => a.startsWith('--project='))
  const argCredencial = argv.find((a) => a.startsWith('--service-account='))

  return {
    modoApply: tieneApply,
    proyectoExplicito: argProyecto ? argProyecto.slice('--project='.length).trim() : '',
    rutaCredencial: argCredencial ? argCredencial.slice('--service-account='.length).trim() : '',
  }
}

function inicializarFirestoreAdmin({ proyectoExplicito, rutaCredencial }) {
  const hostEmulador = process.env.FIRESTORE_EMULATOR_HOST?.trim() || ''
  const esEmulador = Boolean(hostEmulador)
  const projectId =
    proyectoExplicito ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    (esEmulador ? 'demo-sabupc' : 'sabupc-colima')

  if (getApps().length === 0) {
    if (esEmulador) {
      initializeApp({ projectId })
    } else if (rutaCredencial) {
      const json = JSON.parse(readFileSync(resolve(rutaCredencial), 'utf8'))
      initializeApp({ credential: cert(json), projectId })
    } else {
      initializeApp({ credential: applicationDefault(), projectId })
    }
  }

  return { db: getFirestore(), esEmulador, hostEmulador, projectId }
}

async function main() {
  const opciones = parsearArgumentos(process.argv.slice(2))
  const { db, esEmulador, hostEmulador, projectId } = inicializarFirestoreAdmin(opciones)

  const etiquetaModo = opciones.modoApply ? 'APPLY (ESCRITURA EN LOTES <= 400)' : 'DRY-RUN (SOLO LECTURA)'
  const etiquetaDestino = esEmulador
    ? `EMULADOR LOCAL (${hostEmulador}) · proyecto=${projectId}`
    : `PROYECTO REMOTO · proyecto=${projectId}`

  console.log('=================================================================')
  console.log(`S.A.B.U.P.C · Migración de históricos · Modo: ${etiquetaModo}`)
  console.log(`Destino: ${etiquetaDestino}`)
  console.log('=================================================================')

  const operaciones = []
  const conteoPorCategoria = {
    usuarios: 0,
    perfiles_operativos: 0,
    equipos_turno: 0,
    prerregistros: 0,
  }

  // 1. Usuarios: normalizar nombres a Tipo Título y construir mapa en memoria
  const mapaUsuarios = new Map()
  const usuariosSnap = await db.collection('usuarios').get()
  for (const docSnap of usuariosSnap.docs) {
    const d = docSnap.data()
    const cambios = {}
    const detalles = []

    if (typeof d.nombres === 'string') {
      const norm = normalizarNombrePropio(d.nombres)
      if (norm && norm !== d.nombres) {
        cambios.nombres = norm
        detalles.push(`nombres: "${d.nombres}" -> "${norm}"`)
      }
    }
    if (typeof d.apellido_paterno === 'string') {
      const norm = normalizarNombrePropio(d.apellido_paterno)
      if (norm && norm !== d.apellido_paterno) {
        cambios.apellido_paterno = norm
        detalles.push(`apellido_paterno: "${d.apellido_paterno}" -> "${norm}"`)
      }
    }
    if (typeof d.apellido_materno === 'string' && d.apellido_materno.trim() !== '') {
      const norm = normalizarNombrePropio(d.apellido_materno)
      if (norm !== d.apellido_materno) {
        cambios.apellido_materno = norm
        detalles.push(`apellido_materno: "${d.apellido_materno}" -> "${norm}"`)
      }
    }
    if (
      typeof d.contacto_emergencia_nombre === 'string' &&
      d.contacto_emergencia_nombre.trim() !== ''
    ) {
      const norm = normalizarNombrePropio(d.contacto_emergencia_nombre)
      if (norm && norm !== d.contacto_emergencia_nombre) {
        cambios.contacto_emergencia_nombre = norm
        detalles.push(
          `contacto_emergencia_nombre: "${d.contacto_emergencia_nombre}" -> "${norm}"`,
        )
      }
    }

    const fusionado = { ...d, ...cambios }
    mapaUsuarios.set(docSnap.id, fusionado)

    if (Object.keys(cambios).length > 0) {
      conteoPorCategoria.usuarios += 1
      operaciones.push({
        categoria: 'usuarios',
        ruta: docSnap.ref.path,
        ref: docSnap.ref,
        cambios: { ...cambios, actualizado_en: FieldValue.serverTimestamp() },
        resumen: detalles.join(', '),
      })
    }
  }

  // 2. Perfiles operativos: normalizar nombre_completo a Tipo Título y guardar mapa
  const mapaPerfilesOp = new Map()
  const perfilesOpSnap = await db.collection('perfiles_operativos').get()
  for (const docSnap of perfilesOpSnap.docs) {
    const d = docSnap.data()
    mapaPerfilesOp.set(docSnap.id, d)

    if (typeof d.nombre_completo === 'string') {
      const norm = normalizarNombrePropio(d.nombre_completo)
      if (norm && norm !== d.nombre_completo) {
        conteoPorCategoria.perfiles_operativos += 1
        operaciones.push({
          categoria: 'perfiles_operativos',
          ruta: docSnap.ref.path,
          ref: docSnap.ref,
          cambios: {
            nombre_completo: norm,
            actualizado_en: FieldValue.serverTimestamp(),
          },
          resumen: `nombre_completo: "${d.nombre_completo}" -> "${norm}"`,
        })
      }
    }
  }

  // 3. Asistencias: mapa auxiliar para resolver ayudantia_slot de equipos_turno
  const mapaAsistencias = new Map()
  const asistenciasSnap = await db.collection('asistencias_personal').get()
  for (const docSnap of asistenciasSnap.docs) {
    mapaAsistencias.set(docSnap.id, docSnap.data())
  }

  // 4. Equipos de turno: completar ayudantia_slot faltante o inválido
  const equiposSnap = await db.collection('equipos_turno').get()
  for (const docSnap of equiposSnap.docs) {
    const d = docSnap.data()
    if (!AYUDANTIAS_VALIDAS.has(d.ayudantia_slot)) {
      const asis = d.asistencia_id ? mapaAsistencias.get(d.asistencia_id) : null
      const usr = d.usuario_uid ? mapaUsuarios.get(d.usuario_uid) : null
      const perf = d.usuario_uid ? mapaPerfilesOp.get(d.usuario_uid) : null

      const resuelta = resolverAyudantiaValida(
        asis?.ayudantia_slot,
        usr?.ayudantia,
        usr?.ayudantia_slot,
        perf?.ayudantia,
        perf?.ayudantia_slot,
      )

      conteoPorCategoria.equipos_turno += 1
      operaciones.push({
        categoria: 'equipos_turno',
        ruta: docSnap.ref.path,
        ref: docSnap.ref,
        cambios: {
          ayudantia_slot: resuelta,
          actualizado_en: FieldValue.serverTimestamp(),
        },
        resumen: `ayudantia_slot: ${JSON.stringify(d.ayudantia_slot ?? null)} -> "${resuelta}"`,
      })
    }
  }

  // 5. Prerregistros históricos por operativo: completar ayudantia_slot y sanear campos legacy
  const operativosSnap = await db.collection('operativos').get()
  for (const opDoc of operativosSnap.docs) {
    const preSnap = await opDoc.ref.collection('prerregistros').get()
    for (const docSnap of preSnap.docs) {
      const d = docSnap.data()
      const uid = typeof d.usuario_uid === 'string' && d.usuario_uid ? d.usuario_uid : docSnap.id
      const usr = mapaUsuarios.get(uid) ?? null
      const perf = mapaPerfilesOp.get(uid) ?? null

      const cambios = {}
      const detalles = []

      const ayudantiaResuelta = resolverAyudantiaValida(
        d.ayudantia,
        d.ayudantia_slot,
        usr?.ayudantia,
        usr?.ayudantia_slot,
        perf?.ayudantia,
        perf?.ayudantia_slot,
      )

      if (d.ayudantia !== ayudantiaResuelta) {
        cambios.ayudantia = ayudantiaResuelta
        detalles.push(`ayudantia: ${JSON.stringify(d.ayudantia ?? null)} -> "${ayudantiaResuelta}"`)
      }
      if (d.ayudantia_slot !== ayudantiaResuelta) {
        cambios.ayudantia_slot = ayudantiaResuelta
        detalles.push(
          `ayudantia_slot: ${JSON.stringify(d.ayudantia_slot ?? null)} -> "${ayudantiaResuelta}"`,
        )
      }

      const etapaFinal = ETAPAS_VALIDAS.has(d.etapa)
        ? d.etapa
        : resolverEtapaCompatible(d.subgrupo, usr ?? perf)

      if (d.etapa !== etapaFinal) {
        cambios.etapa = etapaFinal
        detalles.push(`etapa: ${JSON.stringify(d.etapa ?? null)} -> "${etapaFinal}"`)
      }

      const subgrupoEsperado =
        etapaFinal === 'Grupo Operativo'
          ? ''
          : typeof d.subgrupo === 'string' && d.subgrupo.trim() !== 'Ninguno'
            ? d.subgrupo.trim()
            : ''

      if (d.subgrupo !== subgrupoEsperado) {
        cambios.subgrupo = subgrupoEsperado
        detalles.push(`subgrupo: ${JSON.stringify(d.subgrupo ?? null)} -> "${subgrupoEsperado}"`)
      }

      const rolAuto = rolOperativoPorAyudantia(ayudantiaResuelta)
      const rolFinal = ROLES_TURNO_VALIDOS.has(d.rol_en_turno) ? d.rol_en_turno : rolAuto
      if (d.rol_en_turno !== rolFinal) {
        cambios.rol_en_turno = rolFinal
        detalles.push(`rol_en_turno: ${JSON.stringify(d.rol_en_turno ?? null)} -> "${rolFinal}"`)
      }

      if (typeof d.rol_editado_manual !== 'boolean') {
        const editado = rolFinal !== rolAuto
        cambios.rol_editado_manual = editado
        detalles.push(`rol_editado_manual: ${JSON.stringify(d.rol_editado_manual ?? null)} -> ${editado}`)
      }

      if (typeof d.usuario_nombre === 'string') {
        const nomNorm = normalizarNombrePropio(d.usuario_nombre)
        if (nomNorm && nomNorm !== d.usuario_nombre) {
          cambios.usuario_nombre = nomNorm
          detalles.push(`usuario_nombre: "${d.usuario_nombre}" -> "${nomNorm}"`)
        }
      }

      if (Object.keys(cambios).length > 0) {
        conteoPorCategoria.prerregistros += 1
        operaciones.push({
          categoria: 'prerregistros',
          ruta: docSnap.ref.path,
          ref: docSnap.ref,
          cambios: { ...cambios, actualizado_en: FieldValue.serverTimestamp() },
          resumen: detalles.join(', '),
        })
      }
    }
  }

  console.log('\nResumen de documentos detectados para actualización:')
  console.log(`  - usuarios (Tipo Título):             ${conteoPorCategoria.usuarios}`)
  console.log(`  - perfiles_operativos (Tipo Título):  ${conteoPorCategoria.perfiles_operativos}`)
  console.log(`  - equipos_turno (ayudantia_slot):     ${conteoPorCategoria.equipos_turno}`)
  console.log(`  - prerregistros (legacy / rol / ay):  ${conteoPorCategoria.prerregistros}`)
  console.log(`  - TOTAL documentos a actualizar:      ${operaciones.length}`)

  if (operaciones.length > 0) {
    console.log('\nDetalle de actualizaciones (muestra hasta 25):')
    for (const op of operaciones.slice(0, 25)) {
      console.log(`  [${op.categoria}] ${op.ruta} -> ${op.resumen}`)
    }
    if (operaciones.length > 25) {
      console.log(`  ... y ${operaciones.length - 25} documento(s) adicional(es).`)
    }
  }

  if (!opciones.modoApply) {
    console.log(
      `\n[DRY-RUN] Simulación completada sin escribir en Firestore (${operaciones.length} cambio(s) pendiente(s)).`,
    )
    return
  }

  if (operaciones.length === 0) {
    console.log('\n[APPLY] No hay documentos pendientes por actualizar.')
    return
  }

  const totalLotes = Math.ceil(operaciones.length / MAX_OPS_POR_LOTE)
  for (let i = 0; i < operaciones.length; i += MAX_OPS_POR_LOTE) {
    const bloque = operaciones.slice(i, i + MAX_OPS_POR_LOTE)
    const numLote = Math.floor(i / MAX_OPS_POR_LOTE) + 1
    const batch = db.batch()
    for (const op of bloque) {
      batch.update(op.ref, op.cambios)
    }
    await batch.commit()
    console.log(`[APPLY] Lote ${numLote}/${totalLotes} confirmado (${bloque.length} operaciones).`)
  }

  console.log(`\n[APPLY] Migración finalizada con éxito: ${operaciones.length} documento(s) actualizado(s).`)
}

main().catch((err) => {
  console.error('\n[ERROR migrar-historicos]:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
