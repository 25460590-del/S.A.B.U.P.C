// Pruebas de reglas de Firestore para S.A.B.U.P.C (emulador local).
// Ejecutar desde esta carpeta:  npm install  &&  npm test
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc,
  query, where, writeBatch, increment, serverTimestamp, Timestamp,
} from 'firebase/firestore';

let env;

const correo = (uid) => `${uid}@ucol.mx`;

// Documento completo de usuario (para sembrar con reglas desactivadas)
function usuarioBase(uid, extra = {}) {
  return {
    uid,
    correo: correo(uid),
    nombres: 'Ana',
    apellido_paterno: 'Pérez',
    apellido_materno: '',
    fecha_nacimiento: '2001-05-14',
    sexo: 'Mujer',
    telefono_fijo: '',
    celular: '3121234567',
    celular_con_whatsapp: true,
    nivel_academico: 'Superior',
    escuela_carrera: 'Facultad de Medicina',
    numero_cuenta: '20201234',
    tipo_sangre: 'O+',
    alergias: '',
    padecimientos_medicamentos: '',
    contacto_emergencia_nombre: 'María López',
    contacto_emergencia_telefono: '3127654321',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    etapa: 'Grupo Operativo',
    subgrupo: '',
    ayudantia: 'Ninguna',
    grupos_a_cargo: [],
    rol_sistema: 'Brigadista',
    autorizado_radio: false,
    clave_personal_radio: null,
    clave_radio: '',
    estatus: 'Pendiente',
    qr_codigo_unico: null,
    tiene_foto: false,
    creado_en: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
    actualizado_en: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
    ...extra,
  };
}

// Documento de alta (lo que manda el cliente al registrarse)
function altaValida(uid, extra = {}) {
  return usuarioBase(uid, {
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
    ...extra,
  });
}

const db = (uid) =>
  env.authenticatedContext(uid, { email: correo(uid) }).firestore();

function eventoValido(actorUid, extra = {}) {
  return {
    tipo: 'APROBACION_USUARIO',
    actor_uid: actorUid,
    actor_nombre: 'Admin Uno',
    objetivo_uid: 'pendiente1',
    objetivo_nombre: 'Ana Pérez',
    detalle: 'Aprobado',
    creado_en: serverTimestamp(),
    ...extra,
  };
}

const TOKEN_ESTATICO_OP = 'ESTATICO-TOKEN-OPABIERTO';
const NONCE_VIGENTE_OP = 'NONCEVIG1';
const NONCE_ANTERIOR_OP = 'NONCEANT1';

function crearEntradaConCandado(f, asistenciaData) {
  const b = writeBatch(f);
  b.set(
    doc(f, `operativos/${asistenciaData.operativo_id}/presentes/${asistenciaData.usuario_uid}`),
    {
      asistencia_id: asistenciaData.id,
      usuario_uid: asistenciaData.usuario_uid,
      operativo_id: asistenciaData.operativo_id,
      ayudantia_slot: asistenciaData.ayudantia_slot,
      creado_en: serverTimestamp(),
    },
  );
  b.set(doc(f, `asistencias_personal/${asistenciaData.id}`), asistenciaData);
  return b.commit();
}

function cerrarSalidaConCandadoTest(f, operativoId, usuarioUid, asistenciaId, extra = {}) {
  const b = writeBatch(f);
  b.update(doc(f, `asistencias_personal/${asistenciaId}`), {
    hora_salida: serverTimestamp(),
    horas_totales: 1.5,
    estado_operativo: 'Retirado',
    actualizado_en: serverTimestamp(),
    ...extra,
  });
  b.delete(doc(f, `operativos/${operativoId}/presentes/${usuarioUid}`));
  return b.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sabupc',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'usuarios/admin1'), usuarioBase('admin1', { estatus: 'Activo', rol_sistema: 'Administrador' }));
    await setDoc(doc(f, 'usuarios/adminInactivo'), usuarioBase('adminInactivo', { estatus: 'Inactivo', rol_sistema: 'Administrador' }));
    await setDoc(doc(f, 'usuarios/activo1'), usuarioBase('activo1', { estatus: 'Activo' }));
    await setDoc(doc(f, 'usuarios/brigRadio'), usuarioBase('brigRadio', { estatus: 'Activo', autorizado_radio: true, clave_radio: 'TESLA-102' }));
    await setDoc(doc(f, 'usuarios/brigAlfa1'), usuarioBase('brigAlfa1', { estatus: 'Activo', etapa: 'Alfa', grupo_operativo: 'Alfa', subgrupo: 'Alfa 1' }));
    await setDoc(doc(f, 'usuarios/brigOmega1'), usuarioBase('brigOmega1', { estatus: 'Activo', etapa: 'Omega', grupo_operativo: 'Omega', subgrupo: 'Omega 1' }));
    await setDoc(doc(f, 'usuarios/encargado1'), usuarioBase('encargado1', { estatus: 'Activo', rol_sistema: 'Encargado' }));
    await setDoc(doc(f, 'usuarios/encRadio'), usuarioBase('encRadio', { estatus: 'Activo', rol_sistema: 'Encargado', autorizado_radio: true, clave_radio: 'LINCE' }));
    await setDoc(doc(f, 'usuarios/encAlfa1'), usuarioBase('encAlfa1', { estatus: 'Activo', rol_sistema: 'Encargado', grupos_a_cargo: ['Alfa 1', 'Alfa 2'] }));
    await setDoc(doc(f, 'usuarios/encAP'), usuarioBase('encAP', { estatus: 'Activo', rol_sistema: 'Encargado', ayudantia: 'Administración de Personal', ayudantia_slot: 'Administración de Personal' }));
    await setDoc(doc(f, 'usuarios/encTesla'), usuarioBase('encTesla', { estatus: 'Activo', rol_sistema: 'Encargado', ayudantia: 'Tesla', ayudantia_slot: 'Tesla' }));
    await setDoc(doc(f, 'usuarios/jefeSocorros'), usuarioBase('jefeSocorros', { estatus: 'Activo', rol_sistema: 'Encargado', etapa: 'Grupo Operativo', ayudantia: 'Socorros', ayudantia_slot: 'Socorros' }));
    await setDoc(doc(f, 'usuarios/jefeLogistica'), usuarioBase('jefeLogistica', { estatus: 'Activo', rol_sistema: 'Encargado', etapa: 'Grupo Operativo', ayudantia: 'Logística', ayudantia_slot: 'Logística' }));
    await setDoc(doc(f, 'usuarios/jefeCapacitacion'), usuarioBase('jefeCapacitacion', { estatus: 'Activo', rol_sistema: 'Encargado', etapa: 'Grupo Operativo', ayudantia: 'Capacitación', ayudantia_slot: 'Capacitación' }));
    await setDoc(doc(f, 'usuarios/brigSocorros'), usuarioBase('brigSocorros', {
      estatus: 'Activo',
      etapa: 'Alfa',
      grupo_operativo: 'Alfa',
      subgrupo: 'Alfa 1',
      ayudantia: 'Socorros',
      ayudantia_slot: 'Socorros',
      alergias: 'Látex',
      contacto_emergencia_nombre: 'Rosa Díaz',
      contacto_emergencia_parentesco: 'Madre',
      contacto_emergencia_telefono: '3121112233',
    }));
    await setDoc(doc(f, 'usuarios/brigLogistica'), usuarioBase('brigLogistica', {
      estatus: 'Activo',
      etapa: 'Grupo Operativo',
      ayudantia: 'Logística',
      ayudantia_slot: 'Logística',
    }));
    await setDoc(doc(f, 'usuarios/brigTesla'), usuarioBase('brigTesla', {
      estatus: 'Activo',
      etapa: 'Grupo Operativo',
      ayudantia: 'Tesla',
      ayudantia_slot: 'Tesla',
    }));
    await setDoc(doc(f, 'usuarios/brigAP'), usuarioBase('brigAP', {
      estatus: 'Activo',
      etapa: 'Omega',
      grupo_operativo: 'Omega',
      subgrupo: 'Omega 1',
      ayudantia: 'Administración de Personal',
      ayudantia_slot: 'Administración de Personal',
    }));
    await setDoc(doc(f, 'usuarios/pendiente1'), usuarioBase('pendiente1'));
    await setDoc(doc(f, 'auditoria_eventos/e1'), { ...eventoValido('admin1'), creado_en: Timestamp.now() });

    await setDoc(doc(f, 'perfiles_operativos/brigOmega1'), {
      uid: 'brigOmega1',
      nombre_completo: 'Ana Pérez',
      numero_cuenta: '20201234',
      estatus: 'Activo',
      etapa: 'Omega',
      subgrupo: 'Omega 1',
      ayudantia: 'Ninguna',
      grupo_operativo: 'Omega',
      ayudantia_slot: 'Ninguna',
      qr_codigo_unico: 'qr-omega-1',
      clave_radio: '',
      actualizado_en: Timestamp.now(),
    });

    await setDoc(doc(f, 'catalogos/subgrupos'), {
      id: 'subgrupos',
      nombre: 'Subgrupos operativos',
      items: ['Alfa 1', 'Alfa 2', 'Omega 1', 'Omega 2'],
      actualizado_en: Timestamp.now(),
      actualizado_por_uid: 'admin1',
    });

    const opBase = (id, extra = {}) => ({
      id,
      nombre: `Operativo ${id}`,
      categoria: 'Guardias Ordinarias',
      sede: 'Campus Central',
      fecha_inicio: '2026-11-22',
      fecha_fin: '2026-11-22',
      descripcion: 'Prueba',
      estatus: 'Activo',
      recepcion_abierta: true,
      modo_qr: 'estatico',
      qr_token_estatico: `tok-${id}`,
      creado_por_uid: 'admin1',
      creado_por_nombre: 'Admin Uno',
      creado_en: Timestamp.now(),
      actualizado_en: Timestamp.now(),
      ...extra,
    });
    await setDoc(doc(f, 'operativos/opAbierto'), opBase('opAbierto', { modo_qr: 'dinamico' }));
    await setDoc(doc(f, 'operativos/opAbierto/secretos/totp'), {
      secreto_base32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      periodo_segundos: 30,
      digitos: 6,
      actualizado_en: Timestamp.now(),
    });
    await setDoc(doc(f, 'operativos/opAbierto/secretos/estatico'), {
      token: TOKEN_ESTATICO_OP,
      actualizado_en: Timestamp.now(),
    });
    await setDoc(doc(f, 'operativos/opAbierto/secretos/vigente'), {
      nonce: NONCE_VIGENTE_OP,
      nonce_anterior: NONCE_ANTERIOR_OP,
      actualizado_en: Timestamp.now(),
    });
    await setDoc(doc(f, 'operativos/opCerrado'), opBase('opCerrado', { recepcion_abierta: false }));
    await setDoc(doc(f, 'operativos/opFinalizado'), opBase('opFinalizado', { estatus: 'Finalizado', recepcion_abierta: false }));

    await setDoc(doc(f, 'canales_radio/canalFin'), {
      id: 'canalFin',
      operativo_id: 'opFinalizado',
      nombre_canal: 'CECOM',
      frecuencia_etiqueta: 'CH-1',
      unidades_participantes: ['CECOM', '58A'],
      creado_por: 'Admin Uno',
      creado_por_uid: 'admin1',
      creado_en: Timestamp.now(),
      actualizado_en: Timestamp.now(),
    });
    await setDoc(doc(f, 'bitacora_radio_registros/regFin'), {
      id: 'regFin',
      canal_id: 'canalFin',
      operativo_id: 'opFinalizado',
      hora_original: '10:15:00',
      origen: 'CECOM',
      destinos: ['58A'],
      actividades: '70 operativo finalizado',
      registrado_por: 'Admin Uno',
      registrado_por_uid: 'admin1',
      fue_editado: false,
      actividad_original_respaldo: null,
      editado_en: null,
      editado_por: null,
      creado_en: Timestamp.now(),
      actualizado_en: Timestamp.now(),
    });

    const asisBase = (id, operativoId, usuarioUid, extra = {}) => ({
      id,
      operativo_id: operativoId,
      operativo_nombre: `Operativo ${operativoId}`,
      usuario_uid: usuarioUid,
      usuario_nombre: 'Ana Pérez',
      usuario_cuenta: '20201234',
      grupo_operativo: 'Omega',
      ayudantia_slot: 'Ninguna',
      rol_en_turno: 'Sin asignar',
      estado_operativo: 'En servicio',
      signos_vitales: null,
      metodo_entrada: 'QR_Operativo_Estatico',
      hora_entrada: Timestamp.now(),
      hora_salida: null,
      horas_totales: null,
      salida_cerrada_manual: false,
      equipos_bupc_pendientes: 0,
      registrado_por_uid: usuarioUid,
      creado_en: Timestamp.now(),
      actualizado_en: Timestamp.now(),
      ...extra,
    });
    await setDoc(doc(f, 'asistencias_personal/asisAbierto'), asisBase('asisAbierto', 'opAbierto', 'brigOmega1'));
    await setDoc(doc(f, 'asistencias_personal/asisCerradoOk'), asisBase('asisCerradoOk', 'opCerrado', 'activo1'));
    await setDoc(doc(f, 'asistencias_personal/asisCerradoPend'), asisBase('asisCerradoPend', 'opCerrado', 'brigAlfa1', { equipos_bupc_pendientes: 1 }));
    await setDoc(doc(f, 'asistencias_personal/asisFinalizado'), asisBase('asisFinalizado', 'opFinalizado', 'activo1'));

    await setDoc(doc(f, 'equipos_turno/eqFinalizado'), {
      id: 'eqFinalizado',
      asistencia_id: 'asisFinalizado',
      operativo_id: 'opFinalizado',
      usuario_uid: 'activo1',
      usuario_nombre: 'Ana Pérez',
      nombre_articulo: 'Radio portátil',
      codigo_inventario: 'RAD-01',
      origen_material: 'BUPC_Asignado',
      estado_reporte: 'OK',
      falla_reportada: '',
      devuelto: false,
      devuelto_en: null,
      devuelto_por_uid: null,
      acta_incidencia: null,
      creado_por_uid: 'encargado1',
      creado_en: Timestamp.now(),
      actualizado_en: Timestamp.now(),
    });

    await setDoc(doc(f, 'incidencias_personal/inc1'), {
      id: 'inc1',
      usuario_uid: 'brigAlfa1',
      usuario_nombre: 'Ana Pérez',
      operativo_id: null,
      tipo: 'Observación',
      gravedad: 'Baja',
      descripcion: 'Registro previo',
      creado_por_uid: 'encAlfa1',
      creado_por_nombre: 'Encargado Alfa 1',
      creado_en: Timestamp.now(),
    });
  });
});

// ---------------- usuarios: create ----------------
test('alta propia válida', () => assertSucceeds(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo'))));
test('alta para otro uid', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/otro'), altaValida('otro'))));
test('alta con rol Administrador', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { rol_sistema: 'Administrador' }))));
test('alta con estatus Activo', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { estatus: 'Activo' }))));
test('alta con autorizado_radio true', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { autorizado_radio: true }))));
test('alta con correo ajeno', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { correo: 'x@y.com' }))));
test('alta con campo extra', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { hack: 1 }))));
test('alta con campo faltante', async () => {
  const d = altaValida('nuevo'); delete d.alergias;
  await assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), d));
});
test('alta con cadena enorme', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { alergias: 'x'.repeat(301) }))));
test('alta con creado_en del pasado', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { creado_en: Timestamp.fromDate(new Date('2020-01-01')) }))));
test('alta con fecha mal formada', () => assertFails(setDoc(doc(db('nuevo'), 'usuarios/nuevo'), altaValida('nuevo', { fecha_nacimiento: '14/05/2001' }))));
test('alta sin sesión', () => assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'usuarios/nuevo'), altaValida('nuevo'))));
test('re-alta sobre documento existente (Pendiente)', () => assertFails(setDoc(doc(db('pendiente1'), 'usuarios/pendiente1'), altaValida('pendiente1'))));

// ---------------- usuarios: read ----------------
test('Pendiente lee su propio doc', () => assertSucceeds(getDoc(doc(db('pendiente1'), 'usuarios/pendiente1'))));
test('usuario sin doc lee su propio doc inexistente', () => assertSucceeds(getDoc(doc(db('nuevo'), 'usuarios/nuevo'))));
test('Pendiente no lee a otro', () => assertFails(getDoc(doc(db('pendiente1'), 'usuarios/activo1'))));
test('Brigadista Activo no lee a otro', () => assertFails(getDoc(doc(db('activo1'), 'usuarios/pendiente1'))));
test('Brigadista Activo no lista', () => assertFails(getDocs(collection(db('activo1'), 'usuarios'))));
test('Admin Activo lee a otro', () => assertSucceeds(getDoc(doc(db('admin1'), 'usuarios/pendiente1'))));
test('Admin Activo lista', () => assertSucceeds(getDocs(collection(db('admin1'), 'usuarios'))));
test('Admin Inactivo no lee a otro', () => assertFails(getDoc(doc(db('adminInactivo'), 'usuarios/pendiente1'))));
test('Admin Inactivo no lista', () => assertFails(getDocs(collection(db('adminInactivo'), 'usuarios'))));
test('sin sesión no lee', () => assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'usuarios/activo1'))));

// ---------------- usuarios: update por dueño ----------------
test('dueño Activo actualiza celular', () => assertSucceeds(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { celular: '3120000000', tiene_foto: true, actualizado_en: serverTimestamp() })));
test('dueño Activo sin actualizado_en', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { celular: '3120000000' })));
test('dueño Activo cambia su rol', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { rol_sistema: 'Administrador', actualizado_en: serverTimestamp() })));
test('dueño Activo cambia autorizado_radio', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { autorizado_radio: true, actualizado_en: serverTimestamp() })));
test('dueño Activo cambia correo', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { correo: 'otro@ucol.mx', actualizado_en: serverTimestamp() })));
test('dueño Activo cambia creado_en', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { creado_en: serverTimestamp(), actualizado_en: serverTimestamp() })));
test('dueño Activo cadena enorme', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { padecimientos_medicamentos: 'x'.repeat(501), actualizado_en: serverTimestamp() })));
test('dueño Activo tipo inválido', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { celular_con_whatsapp: 'si', actualizado_en: serverTimestamp() })));
test('dueño Activo agrega campo extra', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), { extra: 'x', actualizado_en: serverTimestamp() })));
test('dueño Pendiente corrige celular antes de aprobación', () => assertSucceeds(updateDoc(doc(db('pendiente1'), 'usuarios/pendiente1'), { celular: '3120000000', actualizado_en: serverTimestamp() })));
test('dueño Pendiente no cambia correo ni tiene_foto', () => assertFails(updateDoc(doc(db('pendiente1'), 'usuarios/pendiente1'), { correo: 'otro@ucol.mx', tiene_foto: true, actualizado_en: serverTimestamp() })));
test('dueño Pendiente no se auto-aprueba', () => assertFails(updateDoc(doc(db('pendiente1'), 'usuarios/pendiente1'), { estatus: 'Activo', actualizado_en: serverTimestamp() })));
test('Brigadista Activo no edita a otro', () => assertFails(updateDoc(doc(db('activo1'), 'usuarios/pendiente1'), { estatus: 'Activo', actualizado_en: serverTimestamp() })));
test('Encargado no edita privilegios de otro', () => assertFails(updateDoc(doc(db('encargado1'), 'usuarios/activo1'), { grupo_operativo: 'Alfa', actualizado_en: serverTimestamp() })));

// ---------------- usuarios: update por admin ----------------
test('Admin aprueba en lote con auditoría', async () => {
  const f = db('admin1');
  const b = writeBatch(f);
  b.update(doc(f, 'usuarios/pendiente1'), {
    estatus: 'Activo', grupo_operativo: 'Alfa', ayudantia_slot: 'Capacitación',
    autorizado_radio: true, clave_personal_radio: 'A-12', qr_codigo_unico: 'qr-abc',
    actualizado_en: serverTimestamp(),
  });
  b.set(doc(collection(f, 'auditoria_eventos')), eventoValido('admin1'));
  await assertSucceeds(b.commit());
});
test('Admin asigna slot con acentos', () => assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { ayudantia_slot: 'Administración de Personal', actualizado_en: serverTimestamp() })));
test('Admin asigna Logística', () => assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { ayudantia_slot: 'Logística', actualizado_en: serverTimestamp() })));
test('Admin no edita datos médicos ni teléfono ajenos', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { celular: '3129998877', alergias: 'Penicilina', actualizado_en: serverTimestamp() })));
test('Admin no cambia correo', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { correo: 'z@z.com', actualizado_en: serverTimestamp() })));
test('Admin enum inválido', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { rol_sistema: 'SuperAdmin', actualizado_en: serverTimestamp() })));
test('Admin clave de radio demasiado larga', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { clave_personal_radio: 'x'.repeat(11), actualizado_en: serverTimestamp() })));
test('Admin sin actualizado_en', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { estatus: 'Inactivo' })));
test('Admin Inactivo no aprueba', () => assertFails(updateDoc(doc(db('adminInactivo'), 'usuarios/pendiente1'), { estatus: 'Activo', actualizado_en: serverTimestamp() })));
test('Admin no borra', () => assertFails(deleteDoc(doc(db('admin1'), 'usuarios/activo1'))));
test('dueño no se borra', () => assertFails(deleteDoc(doc(db('activo1'), 'usuarios/activo1'))));

// ---------------- auditoria_eventos ----------------
test('Brigadista Activo NO crea eventos de auditoría (M-5)', () => assertFails(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('activo1'))));
test('Encargado crea evento operativo propio de su rol', () => assertSucceeds(addDoc(collection(db('encargado1'), 'auditoria_eventos'), eventoValido('encargado1', { tipo: 'ASIGNACION_EQUIPO' }))));
test('Pendiente no crea evento', () => assertFails(addDoc(collection(db('pendiente1'), 'auditoria_eventos'), eventoValido('pendiente1'))));
test('evento con actor suplantado', () => assertFails(addDoc(collection(db('encargado1'), 'auditoria_eventos'), eventoValido('admin1', { tipo: 'ASIGNACION_EQUIPO' }))));
test('evento con fecha falsa', () => assertFails(addDoc(collection(db('encargado1'), 'auditoria_eventos'), eventoValido('encargado1', { tipo: 'ASIGNACION_EQUIPO', creado_en: Timestamp.fromDate(new Date('2020-01-01')) }))));
test('evento con tipo inválido', () => assertFails(addDoc(collection(db('admin1'), 'auditoria_eventos'), eventoValido('admin1', { tipo: 'OTRO' }))));
test('evento con campo extra', () => assertFails(addDoc(collection(db('admin1'), 'auditoria_eventos'), eventoValido('admin1', { x: 1 }))));
test('evento con detalle enorme', () => assertFails(addDoc(collection(db('admin1'), 'auditoria_eventos'), eventoValido('admin1', { detalle: 'x'.repeat(501) }))));
test('Admin lista auditoría', () => assertSucceeds(getDocs(collection(db('admin1'), 'auditoria_eventos'))));
test('Brigadista no lee auditoría', () => assertFails(getDoc(doc(db('activo1'), 'auditoria_eventos/e1'))));
test('Admin no edita auditoría', () => assertFails(updateDoc(doc(db('admin1'), 'auditoria_eventos/e1'), { detalle: 'x' })));
test('Admin no borra auditoría', () => assertFails(deleteDoc(doc(db('admin1'), 'auditoria_eventos/e1'))));

// ---------------- otras rutas ----------------
test('ruta desconocida denegada (Admin)', () => assertFails(setDoc(doc(db('admin1'), 'otra/x'), { a: 1 })));
test('subcolección de usuario denegada', () => assertFails(getDoc(doc(db('activo1'), 'usuarios/activo1/privado/x'))));

// ============================================================================
// PRUEBAS v1.1: RBAC ADITIVO, TESLA, AP, OPCIÓN B, OPERATIVOS Y CONCURRENCIA
// ============================================================================

// ---------------- RBAC aditivo: herencia de Radio ----------------
test('Admin hereda acceso a Radio sin autorizado_radio=true', () => assertSucceeds(
  setDoc(doc(db('admin1'), 'canales_radio/c1'), {
    id: 'c1',
    operativo_id: 'opAbierto',
    nombre_canal: 'Canal Alfa',
    frecuencia_etiqueta: 'CH-1',
    unidades_participantes: ['BASE'],
    creado_por: 'Admin Uno',
    creado_por_uid: 'admin1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado sin autorizado_radio NO accede a Radio', () => assertFails(
  getDocs(collection(db('encargado1'), 'canales_radio')),
));
test('Encargado con autorizado_radio=true accede a Radio', () => assertSucceeds(
  getDocs(collection(db('encRadio'), 'canales_radio')),
));
test('Brigadista sin autorizado_radio no accede a Radio', () => assertFails(
  getDocs(collection(db('activo1'), 'canales_radio')),
));
test('Brigadista con autorizado_radio=true accede a Radio', () => assertSucceeds(
  getDocs(collection(db('brigRadio'), 'canales_radio')),
));

// ---------------- Dominio exclusivo de TESLA + aislamiento por ayudantía ----------------
test('Encargado Tesla asigna clave_radio y autorizado_radio a integrante de su misma ayudantía Tesla', () => assertSucceeds(
  updateDoc(doc(db('encTesla'), 'usuarios/brigTesla'), {
    clave_radio: 'TESLA-205',
    clave_personal_radio: 'TESLA-205',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Tesla NO puede asignar clave_radio ni leer perfiles fuera de Tesla', async () => {
  await assertFails(getDoc(doc(db('encTesla'), 'usuarios/brigSocorros')));
  await assertFails(updateDoc(doc(db('encTesla'), 'usuarios/activo1'), {
    clave_radio: 'TESLA-205',
    clave_personal_radio: 'TESLA-205',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }));
});
test('Encargado Tesla NO puede autoasignarse clave_radio ni autorizado_radio', () => assertFails(
  updateDoc(doc(db('encTesla'), 'usuarios/encTesla'), {
    clave_radio: 'TESLA-001',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Tesla NO puede cambiar estatus ni rol de otro usuario', () => assertFails(
  updateDoc(doc(db('encTesla'), 'usuarios/brigTesla'), {
    estatus: 'Inactivo',
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Tesla lista perfiles únicamente con filtro exacto por su ayudantía Tesla', async () => {
  await assertSucceeds(getDocs(query(collection(db('encTesla'), 'usuarios'), where('ayudantia', '==', 'Tesla'))));
  await assertFails(getDocs(collection(db('encTesla'), 'usuarios')));
  await assertFails(getDocs(query(collection(db('encTesla'), 'usuarios'), where('ayudantia', '==', 'Socorros'))));
});

// ---------------- Jefe de Ayudantía Administración de Personal (acotado a su ayudantía) ----------------
test('Encargado AP gestiona etapa/subgrupo/estatus de Brigadista dentro de Administración de Personal', () => assertSucceeds(
  updateDoc(doc(db('encAP'), 'usuarios/brigAP'), {
    estatus: 'Activo',
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Administración de Personal',
    ayudantia_slot: 'Administración de Personal',
    qr_codigo_unico: 'qr-ap-1',
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado AP NO puede leer ni editar integrantes de otras ayudantías ni pendientes sin ayudantía', async () => {
  await assertFails(getDoc(doc(db('encAP'), 'usuarios/brigSocorros')));
  await assertFails(getDoc(doc(db('encAP'), 'usuarios/pendiente1')));
  await assertFails(getDocs(collection(db('encAP'), 'usuarios')));
  await assertSucceeds(getDocs(query(collection(db('encAP'), 'usuarios'), where('ayudantia', '==', 'Administración de Personal'))));
  await assertFails(updateDoc(doc(db('encAP'), 'usuarios/brigSocorros'), {
    subgrupo: 'Alfa 2',
    actualizado_en: serverTimestamp(),
  }));
});
test('Encargado AP NO puede editar clave_radio ni autorizado_radio', () => assertFails(
  updateDoc(doc(db('encAP'), 'usuarios/brigAP'), {
    clave_radio: 'LINCE',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado AP NO puede promover rol_sistema ni editar grupos_a_cargo', () => assertFails(
  updateDoc(doc(db('encAP'), 'usuarios/brigAP'), {
    rol_sistema: 'Encargado',
    grupos_a_cargo: ['Alfa 1'],
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado AP NO puede modificar cuenta de Encargado o Administrador', () => assertFails(
  updateDoc(doc(db('encAP'), 'usuarios/encargado1'), {
    estatus: 'Inactivo',
    actualizado_en: serverTimestamp(),
  }),
));

// ---------------- Encargado normal (Opción B) ----------------
test('Encargado Opción B lee y edita campos operativos de Brigadista en su grupo a cargo', async () => {
  await assertSucceeds(getDoc(doc(db('encAlfa1'), 'usuarios/brigAlfa1')));
  await assertSucceeds(updateDoc(doc(db('encAlfa1'), 'usuarios/brigAlfa1'), {
    etapa: 'Alfa',
    grupo_operativo: 'Alfa',
    subgrupo: 'Alfa 2',
    actualizado_en: serverTimestamp(),
  }));
  // Opción B NO puede mover al brigadista fuera de sus grupos a cargo ni a Omega ajena
  await assertFails(updateDoc(doc(db('encAlfa1'), 'usuarios/brigAlfa1'), {
    etapa: 'Omega',
    grupo_operativo: 'Omega',
    subgrupo: 'Omega 1',
    actualizado_en: serverTimestamp(),
  }));
});
test('Encargado Opción B NO lee expediente completo de Brigadista fuera de sus grupos_a_cargo', () => assertFails(
  getDoc(doc(db('encAlfa1'), 'usuarios/brigOmega1')),
));
test('Encargado Opción B sí lee proyección mínima perfiles_operativos en campo', () => assertSucceeds(
  getDoc(doc(db('encAlfa1'), 'perfiles_operativos/brigOmega1')),
));
test('Encargado Opción B NO edita Brigadista fuera de sus grupos_a_cargo', () => assertFails(
  updateDoc(doc(db('encAlfa1'), 'usuarios/brigOmega1'), {
    subgrupo: 'Alfa 1',
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Opción B NO puede dar de baja (estatus) ni editar radio/rol', async () => {
  await assertFails(updateDoc(doc(db('encAlfa1'), 'usuarios/brigAlfa1'), {
    estatus: 'Inactivo',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('encAlfa1'), 'usuarios/brigAlfa1'), {
    clave_radio: '42',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('encAlfa1'), 'usuarios/brigAlfa1'), {
    rol_sistema: 'Encargado',
    actualizado_en: serverTimestamp(),
  }));
});

// ---------------- Operativos: Recepción Cerrada + Candado Duro ----------------
test('Recepción Cerrada BLOQUEA creación de nuevas entradas', () => assertFails(
  setDoc(doc(db('encargado1'), 'asistencias_personal/nuevaEnCerrado'), {
    id: 'nuevaEnCerrado',
    operativo_id: 'opCerrado',
    operativo_nombre: 'Operativo opCerrado',
    usuario_uid: 'brigOmega1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Omega',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin asignar',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'Manual',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'encargado1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }),
));
test('Recepción Cerrada PERMITE registrar hora_salida si equipos_bupc_pendientes == 0', () => assertSucceeds(
  updateDoc(doc(db('activo1'), 'asistencias_personal/asisCerradoOk'), {
    hora_salida: serverTimestamp(),
    horas_totales: 2,
    estado_operativo: 'Retirado',
    actualizado_en: serverTimestamp(),
  }),
));
test('Recepción Cerrada mantiene Candado Duro de Salida si equipos_bupc_pendientes > 0', () => assertFails(
  updateDoc(doc(db('encargado1'), 'asistencias_personal/asisCerradoPend'), {
    hora_salida: serverTimestamp(),
    horas_totales: 2,
    estado_operativo: 'Retirado',
    salida_cerrada_manual: true,
    actualizado_en: serverTimestamp(),
  }),
));

// ---------------- Operativo Finalizado (irreversible) y borrado controlado ----------------
test('Operativo Finalizado es irreversible: ni Admin puede reabrirlo', () => assertFails(
  updateDoc(doc(db('admin1'), 'operativos/opFinalizado'), {
    estatus: 'Activo',
    recepcion_abierta: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Operativo Finalizado bloquea salidas y devoluciones de equipo', async () => {
  await assertFails(updateDoc(doc(db('encargado1'), 'asistencias_personal/asisFinalizado'), {
    hora_salida: serverTimestamp(),
    horas_totales: 1,
    estado_operativo: 'Retirado',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('encargado1'), 'equipos_turno/eqFinalizado'), {
    devuelto: true,
    estado_reporte: 'Devuelto',
    devuelto_en: serverTimestamp(),
    devuelto_por_uid: 'encargado1',
    actualizado_en: serverTimestamp(),
  }));
});
test('Borrado de operativos: prohibido para Encargado, permitido solo para Admin', async () => {
  await assertFails(deleteDoc(doc(db('encargado1'), 'operativos/opAbierto')));
  await assertSucceeds(deleteDoc(doc(db('admin1'), 'operativos/opAbierto')));
});

// ---------------- Concurrencia multi-encargado en materiales ----------------
test('Dos encargados distintos asignan material independiente y actualizan contador en campo', async () => {
  const f1 = db('encargado1');
  const b1 = writeBatch(f1);
  b1.set(doc(f1, 'equipos_turno/eqConc1'), {
    id: 'eqConc1',
    asistencia_id: 'asisAbierto',
    operativo_id: 'opAbierto',
    usuario_uid: 'brigOmega1',
    usuario_nombre: 'Ana Pérez',
    nombre_articulo: 'Radio portátil',
    codigo_inventario: 'R-10',
    origen_material: 'BUPC_Asignado',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'encargado1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });
  b1.update(doc(f1, 'asistencias_personal/asisAbierto'), {
    equipos_bupc_pendientes: 1,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(b1.commit());

  const f2 = db('encAlfa1');
  const b2 = writeBatch(f2);
  b2.set(doc(f2, 'equipos_turno/eqConc2'), {
    id: 'eqConc2',
    asistencia_id: 'asisAbierto',
    operativo_id: 'opAbierto',
    usuario_uid: 'brigOmega1',
    usuario_nombre: 'Ana Pérez',
    nombre_articulo: 'Botiquín de trauma',
    codigo_inventario: 'BOT-03',
    origen_material: 'BUPC_Asignado',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'encAlfa1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });
  b2.update(doc(f2, 'asistencias_personal/asisAbierto'), {
    equipos_bupc_pendientes: 2,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(b2.commit());
});

// ---------------- Catálogos dinámicos e Incidencias de personal ----------------
test('Catálogos dinámicos: lectura por Activo, escritura exclusiva de Admin', async () => {
  await assertSucceeds(getDoc(doc(db('activo1'), 'catalogos/subgrupos')));
  await assertFails(setDoc(doc(db('encAP'), 'catalogos/subgrupos'), {
    id: 'subgrupos',
    nombre: 'Subgrupos operativos',
    items: ['Alfa 1'],
    actualizado_en: serverTimestamp(),
    actualizado_por_uid: 'encAP',
  }));
  await assertSucceeds(setDoc(doc(db('admin1'), 'catalogos/subgrupos'), {
    id: 'subgrupos',
    nombre: 'Subgrupos operativos',
    items: ['Alfa 1', 'Alfa 2', 'Alfa 3', 'Alfa 4', 'Omega 1', 'Omega 2'],
    actualizado_en: serverTimestamp(),
    actualizado_por_uid: 'admin1',
  }));
});

test('Incidencias de personal: creación controlada e inmutabilidad', async () => {
  const incDoc = (id, uid, opId, actor) => ({
    id,
    usuario_uid: uid,
    usuario_nombre: 'Ana Pérez',
    operativo_id: opId,
    tipo: 'Retardo',
    gravedad: 'Baja',
    descripcion: 'Llegada 15 min tarde',
    creado_por_uid: actor,
    creado_por_nombre: 'Encargado',
    creado_en: serverTimestamp(),
  });
  await assertSucceeds(setDoc(doc(db('encAlfa1'), 'incidencias_personal/incAlfaOk'), incDoc('incAlfaOk', 'brigAlfa1', null, 'encAlfa1')));
  await assertFails(setDoc(doc(db('encAlfa1'), 'incidencias_personal/incAjenoFail'), incDoc('incAjenoFail', 'brigOmega1', null, 'encAlfa1')));
  await assertSucceeds(setDoc(doc(db('encAlfa1'), 'incidencias_personal/incOpOk'), incDoc('incOpOk', 'brigOmega1', 'opAbierto', 'encAlfa1')));
  await assertFails(deleteDoc(doc(db('admin1'), 'incidencias_personal/inc1')));
});

// ============================================================================
// PRUEBAS: FLUJO REAL ESCÁNER QR (ENTRADA/SALIDA + LECTURAS EN SERVICIO)
// Y BLOQUEO DE CONSOLA DE RADIO EN OPERATIVOS FINALIZADOS
// ============================================================================

test('Flujo real Brigadista QR: entrada con prueba_qr y candado, bloqueo de secretos/*, lecturas En servicio y salida atómica', async () => {
  const f = db('activo1');

  // 1. Operativo legible por Activo, pero secretos QR jamás legibles por Brigadista (C-3)
  await assertSucceeds(getDoc(doc(f, 'operativos/opAbierto')));
  await assertFails(getDoc(doc(f, 'operativos/opAbierto/secretos/totp')));
  await assertFails(getDoc(doc(f, 'operativos/opAbierto/secretos/estatico')));
  await assertFails(getDoc(doc(f, 'operativos/opAbierto/secretos/vigente')));

  // 2. Auto-registro de entrada por QR con candado determinista `presentes/{uid}` y `prueba_qr`
  await assertSucceeds(crearEntradaConCandado(f, {
    id: 'asisQrReal',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'activo1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Operativo_TOTP',
    prueba_qr: NONCE_VIGENTE_OP,
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'activo1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  // 3. Lecturas secundarias al pasar a "En servicio" (acotadas al propio uid)
  await assertSucceeds(getDocs(query(
    collection(f, 'asistencias_personal'),
    where('usuario_uid', '==', 'activo1'),
  )));
  await assertSucceeds(getDocs(query(
    collection(f, 'equipos_turno'),
    where('usuario_uid', '==', 'activo1'),
    where('asistencia_id', '==', 'asisQrReal'),
  )));
  // Foto de perfil inexistente debe devolver snapshot vacío sin permission-denied
  await assertSucceeds(getDoc(doc(f, 'fotos_perfiles/activo1')));

  // 4. Seguridad preservada: Brigadista NO puede listar equipos_turno sin filtrar su usuario_uid
  await assertFails(getDocs(query(
    collection(f, 'equipos_turno'),
    where('asistencia_id', '==', 'asisQrReal'),
  )));

  // 5. Registro de salida propia con 0 equipos BUPC pendientes + liberación atómica de `presentes/activo1`
  await assertSucceeds(cerrarSalidaConCandadoTest(f, 'opAbierto', 'activo1', 'asisQrReal'));
});

test('Radio en operativo Finalizado: bloquea create/update en canales y bitácora, permite lectura histórica', async () => {
  // Rechaza crear nuevo canal en operativo Finalizado (incluso Admin y Encargado con radio)
  const nuevoCanal = {
    id: 'canalFinNuevo',
    operativo_id: 'opFinalizado',
    nombre_canal: 'Canal 2',
    frecuencia_etiqueta: 'CH-2',
    unidades_participantes: ['CECOM'],
    creado_por: 'Admin Uno',
    creado_por_uid: 'admin1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  };
  await assertFails(setDoc(doc(db('admin1'), 'canales_radio/canalFinNuevo'), nuevoCanal));
  await assertFails(setDoc(doc(db('encRadio'), 'canales_radio/canalFinNuevo'), {
    ...nuevoCanal,
    creado_por_uid: 'encRadio',
  }));

  // Rechaza agregar unidades o editar canal de operativo Finalizado
  await assertFails(updateDoc(doc(db('admin1'), 'canales_radio/canalFin'), {
    unidades_participantes: ['CECOM', '58A', 'BUPC-2'],
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('encRadio'), 'canales_radio/canalFin'), {
    unidades_participantes: ['CECOM', '58A', 'BUPC-2'],
    actualizado_en: serverTimestamp(),
  }));

  // Rechaza crear nuevo mensaje de radio en operativo Finalizado
  const nuevoMensaje = {
    id: 'regFinNuevo',
    canal_id: 'canalFin',
    operativo_id: 'opFinalizado',
    hora_original: '11:00:00',
    origen: 'CECOM',
    destinos: ['58A'],
    actividades: 'Intento tardío',
    registrado_por: 'Admin Uno',
    registrado_por_uid: 'admin1',
    fue_editado: false,
    actividad_original_respaldo: null,
    editado_en: null,
    editado_por: null,
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  };
  await assertFails(setDoc(doc(db('admin1'), 'bitacora_radio_registros/regFinNuevo'), nuevoMensaje));
  await assertFails(setDoc(doc(db('encRadio'), 'bitacora_radio_registros/regFinNuevo'), {
    ...nuevoMensaje,
    registrado_por_uid: 'encRadio',
  }));

  // Rechaza editar registro existente de radio en operativo Finalizado
  await assertFails(updateDoc(doc(db('admin1'), 'bitacora_radio_registros/regFin'), {
    actividades: 'Texto alterado tras cierre',
    fue_editado: true,
    actividad_original_respaldo: '70 operativo finalizado',
    editado_en: serverTimestamp(),
    editado_por: 'Admin Uno',
    actualizado_en: serverTimestamp(),
  }));

  // Lectura histórica sigue permitida en Archivo para usuarios autorizados de Radio
  await assertSucceeds(getDoc(doc(db('admin1'), 'canales_radio/canalFin')));
  await assertSucceeds(getDocs(query(
    collection(db('encRadio'), 'canales_radio'),
    where('operativo_id', '==', 'opFinalizado'),
  )));
  await assertSucceeds(getDoc(doc(db('encRadio'), 'bitacora_radio_registros/regFin')));
  await assertSucceeds(getDocs(query(
    collection(db('brigRadio'), 'bitacora_radio_registros'),
    where('canal_id', '==', 'canalFin'),
  )));
});

test('Material Propio: Brigadista registra artículo propio y Encargado/Admin lo consulta en el operativo', async () => {
  const equipoPropio = (asistenciaId, operativoId) => ({
    id: 'eqPropio1',
    asistencia_id: asistenciaId,
    operativo_id: operativoId,
    operativo_nombre: `Operativo ${operativoId}`,
    usuario_uid: 'activo1',
    usuario_nombre: 'Ana Pérez',
    ayudantia_slot: 'Ninguna',
    nombre_articulo: 'Uniforme de Alfa',
    codigo_inventario: '',
    cantidad: 1,
    origen_material: 'Propio',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'activo1',
    creado_por_nombre: 'Ana Pérez',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });
  // M-6: asistencia ajena (asisAbierto pertenece a brigOmega1) -> rechazado
  await assertFails(setDoc(doc(db('activo1'), 'equipos_turno/eqPropio1'), equipoPropio('asisAbierto', 'opAbierto')));
  // Asistencia propia (asisCerradoOk de activo1 en opCerrado) -> permitido
  await assertSucceeds(setDoc(doc(db('activo1'), 'equipos_turno/eqPropio1'), equipoPropio('asisCerradoOk', 'opCerrado')));

  await assertSucceeds(getDocs(query(
    collection(db('encargado1'), 'equipos_turno'),
    where('operativo_id', '==', 'opCerrado'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db('admin1'), 'equipos_turno'),
    where('operativo_id', '==', 'opCerrado'),
  )));
});

test('fotos_perfiles: dueño Activo guarda WebP o JPEG comprimido y se rechazan formatos no permitidos', async () => {
  const payloadBase64 = 'A'.repeat(80);
  await assertSucceeds(setDoc(doc(db('activo1'), 'fotos_perfiles/activo1'), {
    uid: 'activo1',
    imagen_webp_base64: `data:image/webp;base64,${payloadBase64}`,
    actualizado_en: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(doc(db('activo1'), 'fotos_perfiles/activo1'), {
    uid: 'activo1',
    imagen_webp_base64: `data:image/jpeg;base64,${payloadBase64}`,
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db('activo1'), 'fotos_perfiles/activo1'), {
    uid: 'activo1',
    imagen_webp_base64: `data:image/svg+xml;base64,${payloadBase64}`,
    actualizado_en: serverTimestamp(),
  }));
});

test('contacto_emergencia_parentesco: alta y actualización por dueño Activo, bloqueado para Admin', async () => {
  // 1. Alta nueva incluyendo parentesco
  await assertSucceeds(setDoc(doc(db('nuevoConParentesco'), 'usuarios/nuevoConParentesco'), altaValida('nuevoConParentesco', {
    contacto_emergencia_parentesco: 'Madre',
  })));

  // 2. Cuenta existente sin campo parentesco puede completarlo/actualizar sus 3 campos de emergencia
  await assertSucceeds(updateDoc(doc(db('activo1'), 'usuarios/activo1'), {
    contacto_emergencia_nombre: 'María López',
    contacto_emergencia_parentesco: 'Madre',
    contacto_emergencia_telefono: '3127654321',
    actualizado_en: serverTimestamp(),
  }));

  // 3. Longitud excesiva en parentesco se rechaza (> 60 caracteres)
  await assertFails(updateDoc(doc(db('activo1'), 'usuarios/activo1'), {
    contacto_emergencia_parentesco: 'P'.repeat(61),
    actualizado_en: serverTimestamp(),
  }));

  // 4. Admin sigue sin poder modificar datos de contacto de emergencia ajenos
  await assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), {
    contacto_emergencia_parentesco: 'Padre',
    actualizado_en: serverTimestamp(),
  }));
});

// ============================================================================
// PRUEBAS: ETAPA SIERRA, AYUDANTÍA OBLIGATORIA EN GRUPO OPERATIVO Y PROMOCIÓN EN LOTE
// ============================================================================

test('Etapa SIERRA: asignación válida con y sin ayudantía por Admin y Jefe de Ayudantía en su alcance', async () => {
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigAlfa1'), {
    etapa: 'SIERRA',
    grupo_operativo: 'Ninguno',
    subgrupo: 'Sierra 1',
    ayudantia: 'Ninguna',
    ayudantia_slot: 'Ninguna',
    actualizado_en: serverTimestamp(),
  }));

  await assertSucceeds(updateDoc(doc(db('jefeSocorros'), 'usuarios/brigSocorros'), {
    etapa: 'SIERRA',
    grupo_operativo: 'Ninguno',
    subgrupo: 'Sierra 1',
    ayudantia: 'Socorros',
    ayudantia_slot: 'Socorros',
    actualizado_en: serverTimestamp(),
  }));

  await assertSucceeds(setDoc(doc(db('admin1'), 'perfiles_operativos/brigAlfa1'), {
    uid: 'brigAlfa1',
    nombre_completo: 'Ana Pérez',
    numero_cuenta: '20201234',
    estatus: 'Activo',
    etapa: 'SIERRA',
    subgrupo: 'Sierra 1',
    ayudantia: 'Ninguna',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    qr_codigo_unico: 'qr-sierra-proj',
    clave_radio: '',
    actualizado_en: serverTimestamp(),
  }));
});

test('Promoción directa SIERRA -> Grupo Operativo en lote con ayudantía y evento PROMOCION_LOTE', async () => {
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigAlfa1'), {
    etapa: 'SIERRA',
    grupo_operativo: 'Ninguno',
    subgrupo: 'Sierra 1',
    actualizado_en: serverTimestamp(),
  }));

  const f = db('admin1');
  const b = writeBatch(f);
  b.update(doc(f, 'usuarios/brigAlfa1'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Socorros',
    ayudantia_slot: 'Socorros',
    actualizado_en: serverTimestamp(),
  });
  b.update(doc(f, 'usuarios/brigOmega1'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Logística',
    ayudantia_slot: 'Logística',
    actualizado_en: serverTimestamp(),
  });
  b.set(doc(collection(f, 'auditoria_eventos')), eventoValido('admin1', {
    tipo: 'PROMOCION_LOTE',
    objetivo_uid: 'Sierra 1',
    objetivo_nombre: 'Sierra 1 → Grupo Operativo',
    detalle: 'Promoción en lote (2): Sierra 1 (SIERRA) → Grupo Operativo',
  }));
  await assertSucceeds(b.commit());
});

test('Grupo Operativo: rechaza asignar sin ayudantía o conservando subgrupo formativo', async () => {
  // Admin intenta promover a Grupo Operativo sin ayudantía
  await assertFails(updateDoc(doc(db('admin1'), 'usuarios/brigOmega1'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Ninguna',
    ayudantia_slot: 'Ninguna',
    actualizado_en: serverTimestamp(),
  }));

  // Jefe de Ayudantía intenta quitar la ayudantía al promover a Grupo Operativo
  await assertFails(updateDoc(doc(db('jefeSocorros'), 'usuarios/brigSocorros'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Ninguna',
    ayudantia_slot: 'Ninguna',
    actualizado_en: serverTimestamp(),
  }));

  // Admin intenta promover a Grupo Operativo dejando subgrupo formativo lleno
  await assertFails(updateDoc(doc(db('admin1'), 'usuarios/brigOmega1'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: 'Omega 1',
    ayudantia: 'Socorros',
    ayudantia_slot: 'Socorros',
    actualizado_en: serverTimestamp(),
  }));

  // Admin asigna ayudantía válida y luego intenta quitarla en Grupo Operativo
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigOmega1'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Tesla',
    ayudantia_slot: 'Tesla',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('admin1'), 'usuarios/brigOmega1'), {
    ayudantia: 'Ninguna',
    ayudantia_slot: 'Ninguna',
    actualizado_en: serverTimestamp(),
  }));
});

test('Retrocompatibilidad Grupo Operativo sin ayudantía: lectura y Ficha de Emergencia propias permitidas', async () => {
  // activo1 está sembrado como cuenta legada en Grupo Operativo con ayudantia: 'Ninguna'
  await assertSucceeds(getDoc(doc(db('activo1'), 'usuarios/activo1')));
  await assertSucceeds(updateDoc(doc(db('activo1'), 'usuarios/activo1'), {
    alergias: 'Penicilina',
    contacto_emergencia_nombre: 'Carlos Pérez',
    contacto_emergencia_parentesco: 'Padre',
    contacto_emergencia_telefono: '3129876543',
    actualizado_en: serverTimestamp(),
  }));
  // Admin puede cambiar estatus sin tocar adscripción en cuenta legada
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/activo1'), {
    estatus: 'Inactivo',
    actualizado_en: serverTimestamp(),
  }));
});

// ============================================================================
// PRUEBAS: PRERREGISTRO PREVIO EN OPERATIVOS Y CONFIRMACIÓN VÍA QR
// ============================================================================

function prerregistroBase(uid, registradoPorUid, origen, extra = {}) {
  return {
    usuario_uid: uid,
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    etapa: 'Alfa',
    subgrupo: 'Alfa 1',
    ayudantia: 'Ninguna',
    origen,
    registrado_por_uid: registradoPorUid,
    fecha_registro: serverTimestamp(),
    ...extra,
  };
}

test('Prerregistro propio: Brigadista Activo se apunta, lee su doc y cancela actualizando meta/contador (sin tocar operativos/{id})', async () => {
  // Encargado abre convocatoria con cupo sugerido = 2 en operativo Programado (opCerrado)
  await assertSucceeds(updateDoc(doc(db('encargado1'), 'operativos/opCerrado'), {
    convocatoria_abierta: true,
    cupo_sugerido: 2,
    actualizado_en: serverTimestamp(),
  }));

  // 1. Brigadista se apunta atómicamente actualizando meta/contador +1 (sin escribir en operativos/opCerrado)
  const f = db('brigAlfa1');
  const bAlta = writeBatch(f);
  bAlta.set(
    doc(f, 'operativos/opCerrado/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro'),
  );
  bAlta.set(doc(f, 'operativos/opCerrado/meta/contador'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(bAlta.commit());

  // 2. Brigadista lee su propio documento puntualmente (get), pero NO puede listar (list) ni leer ajenos
  await assertSucceeds(getDoc(doc(f, 'operativos/opCerrado/prerregistros/brigAlfa1')));
  await assertFails(getDocs(collection(f, 'operativos/opCerrado/prerregistros')));
  await assertFails(getDoc(doc(f, 'operativos/opCerrado/prerregistros/brigOmega1')));

  // 3. No se permite update sobre prerregistros (solo create/delete limpios)
  await assertFails(updateDoc(doc(f, 'operativos/opCerrado/prerregistros/brigAlfa1'), {
    subgrupo: 'Alfa 2',
  }));

  // 4. Brigadista cancela su prerregistro atómicamente bajando meta/contador -1
  const bBaja = writeBatch(f);
  bBaja.delete(doc(f, 'operativos/opCerrado/prerregistros/brigAlfa1'));
  bBaja.update(doc(f, 'operativos/opCerrado/meta/contador'), {
    prerregistros_count: 0,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(bBaja.commit());
});

test('Prerregistro propio: rechaza apuntar a otro uid, convocatoria cerrada, operativo Finalizado y exceso de cupo', async () => {
  // Convocatoria cerrada (opAbierto no tiene convocatoria_abierta=true)
  await assertFails(setDoc(
    doc(db('brigAlfa1'), 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro'),
  ));

  // Operativo Finalizado
  await assertFails(setDoc(
    doc(db('brigAlfa1'), 'operativos/opFinalizado/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro'),
  ));

  // Encargado abre convocatoria con cupo = 1 en opAbierto
  await assertSucceeds(updateDoc(doc(db('encargado1'), 'operativos/opAbierto'), {
    convocatoria_abierta: true,
    cupo_sugerido: 1,
    actualizado_en: serverTimestamp(),
  }));

  // Brigadista intenta apuntar a otro uid -> rechazado
  await assertFails(setDoc(
    doc(db('brigAlfa1'), 'operativos/opAbierto/prerregistros/brigOmega1'),
    prerregistroBase('brigOmega1', 'brigAlfa1', 'Autoregistro'),
  ));

  // Brigadista intenta usar origen Manual_Encargado -> rechazado
  await assertFails(setDoc(
    doc(db('brigAlfa1'), 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Manual_Encargado'),
  ));

  // Brigadista NO puede editar convocatoria_abierta ni cupo_sugerido ni escribir en operativos/{id}
  await assertFails(updateDoc(doc(db('brigAlfa1'), 'operativos/opAbierto'), {
    convocatoria_abierta: false,
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('brigAlfa1'), 'operativos/opAbierto'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  }));

  // Primer brigadista llena el cupo (1/1) en meta/contador
  const f1 = db('brigAlfa1');
  const b1 = writeBatch(f1);
  b1.set(
    doc(f1, 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro'),
  );
  b1.set(doc(f1, 'operativos/opAbierto/meta/contador'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(b1.commit());

  // Segundo brigadista intenta superar cupo_sugerido (2 > 1) en meta/contador -> rechazado
  const f2 = db('brigOmega1');
  const b2 = writeBatch(f2);
  b2.set(
    doc(f2, 'operativos/opAbierto/prerregistros/brigOmega1'),
    prerregistroBase('brigOmega1', 'brigOmega1', 'Autoregistro', { etapa: 'Omega', subgrupo: 'Omega 1' }),
  );
  b2.update(doc(f2, 'operativos/opAbierto/meta/contador'), {
    prerregistros_count: 2,
    actualizado_en: serverTimestamp(),
  });
  await assertFails(b2.commit());
});

test('Prerregistro manual: Encargado/Admin registra, lista y quita en Programado/Activo, rechazado en Finalizado', async () => {
  // Encargado registra manualmente en operativo Programado (recepcion_abierta: false, convocatoria_abierta: false)
  await assertSucceeds(setDoc(
    doc(db('encargado1'), 'operativos/opCerrado/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'encargado1', 'Manual_Encargado'),
  ));
  await assertSucceeds(getDocs(collection(db('encargado1'), 'operativos/opCerrado/prerregistros')));
  await assertSucceeds(deleteDoc(doc(db('encargado1'), 'operativos/opCerrado/prerregistros/brigAlfa1')));

  // Admin registra manualmente en operativo Activo
  await assertSucceeds(setDoc(
    doc(db('admin1'), 'operativos/opAbierto/prerregistros/brigOmega1'),
    prerregistroBase('brigOmega1', 'admin1', 'Manual_Encargado', { etapa: 'Omega', subgrupo: 'Omega 1' }),
  ));

  // Rechazo total en operativo Finalizado (ni Admin puede crear ni borrar prerregistros)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), 'operativos/opFinalizado/prerregistros/brigAlfa1'),
      prerregistroBase('brigAlfa1', 'admin1', 'Manual_Encargado'),
    );
  });
  await assertFails(setDoc(
    doc(db('admin1'), 'operativos/opFinalizado/prerregistros/brigOmega1'),
    prerregistroBase('brigOmega1', 'admin1', 'Manual_Encargado'),
  ));
  await assertFails(deleteDoc(doc(db('admin1'), 'operativos/opFinalizado/prerregistros/brigAlfa1')));
  // En operativo finalizado sí se permite lectura histórica de prerregistros ("No asistió")
  await assertSucceeds(getDocs(collection(db('encargado1'), 'operativos/opFinalizado/prerregistros')));
});

test('Brigadista SIN prerregistro puede escanear QR y registrar asistencia normalmente', async () => {
  // Abrimos convocatoria en opAbierto y apuntamos a brigAlfa1, pero NO a activo1
  await assertSucceeds(updateDoc(doc(db('encargado1'), 'operativos/opAbierto'), {
    convocatoria_abierta: true,
    cupo_sugerido: 1,
    actualizado_en: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(
    doc(db('encargado1'), 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'encargado1', 'Manual_Encargado'),
  ));

  // activo1 NO está prerregistrado y el cupo sugerido ya está en 1/1: igual entra con QR sin bloqueos
  await assertSucceeds(crearEntradaConCandado(db('activo1'), {
    id: 'asisSinPre',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'activo1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Operativo_TOTP',
    prueba_qr: NONCE_VIGENTE_OP,
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'activo1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));
});

// ============================================================================
// PRUEBAS: JEFE DE AYUDANTÍA (ACTIVACIÓN AUTOMÁTICA, AISLAMIENTO ESTRICTO,
// OPERATIVOS / PASE DE LISTA / ROLES / MATERIAL PROPIO Y NO REGRESIÓN)
// ============================================================================

test('Jefe de Ayudantía: activación automática sin grupos_a_cargo, consulta Ficha de Emergencia y edita info operativa de su ayudantía', async () => {
  const f = db('jefeSocorros');

  // 1. Consulta puntual (incluye Ficha de Emergencia) y listado filtrado por ayudantía exacta
  const snap = await assertSucceeds(getDoc(doc(f, 'usuarios/brigSocorros')));
  if (snap.data()?.alergias !== 'Látex') {
    throw new Error('Se esperaba poder consultar la Ficha de Emergencia del integrante de su ayudantía.');
  }
  await assertSucceeds(getDocs(query(collection(f, 'usuarios'), where('ayudantia', '==', 'Socorros'))));

  // 2. Edita información operativa (etapa, subgrupo) de un brigadista de su misma ayudantía
  await assertSucceeds(updateDoc(doc(f, 'usuarios/brigSocorros'), {
    etapa: 'Omega',
    grupo_operativo: 'Omega',
    subgrupo: 'Omega 1',
    ayudantia: 'Socorros',
    ayudantia_slot: 'Socorros',
    actualizado_en: serverTimestamp(),
  }));

  // 3. Registra incidencia administrativa de personal para integrante de su ayudantía
  await assertSucceeds(setDoc(doc(f, 'incidencias_personal/incSocorrosOk'), {
    id: 'incSocorrosOk',
    usuario_uid: 'brigSocorros',
    usuario_nombre: 'Ana Pérez',
    operativo_id: null,
    tipo: 'Reconocimiento',
    gravedad: 'Baja',
    descripcion: 'Desempeño destacado en guardia de Socorros',
    creado_por_uid: 'jefeSocorros',
    creado_por_nombre: 'Jefe Socorros',
    creado_en: serverTimestamp(),
  }));
});

test('Jefe de Ayudantía: bloqueo estricto al intentar leer o editar perfiles e incidencias de otras ayudantías', async () => {
  // Incluso si tuviera entradas residuales en grupos_a_cargo, sigue aislado estrictamente a su ayudantía
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'usuarios/jefeSocorros'), {
      grupos_a_cargo: ['Logística', 'Alfa 1'],
    });
  });

  const f = db('jefeSocorros');

  // Bloqueo de lectura puntual hacia otras ayudantías o sin ayudantía
  await assertFails(getDoc(doc(f, 'usuarios/brigLogistica')));
  await assertFails(getDoc(doc(f, 'usuarios/brigTesla')));
  await assertFails(getDoc(doc(f, 'usuarios/brigAlfa1')));
  await assertFails(getDoc(doc(f, 'usuarios/pendiente1')));
  await assertFails(getDoc(doc(f, 'perfiles_operativos/brigOmega1')));

  // Bloqueo de listados sin filtro o filtrando otra ayudantía
  await assertFails(getDocs(collection(f, 'usuarios')));
  await assertFails(getDocs(query(collection(f, 'usuarios'), where('ayudantia', '==', 'Logística'))));
  await assertFails(getDocs(query(collection(f, 'usuarios'), where('estatus', '==', 'Activo'))));

  // Bloqueo de edición sobre otra ayudantía
  await assertFails(updateDoc(doc(f, 'usuarios/brigLogistica'), {
    etapa: 'Grupo Operativo',
    grupo_operativo: 'Ninguno',
    subgrupo: '',
    ayudantia: 'Logística',
    ayudantia_slot: 'Logística',
    actualizado_en: serverTimestamp(),
  }));

  // Bloqueo al intentar transferir a un integrante propio hacia otra ayudantía o escalar su rol
  await assertFails(updateDoc(doc(f, 'usuarios/brigSocorros'), {
    ayudantia: 'Logística',
    ayudantia_slot: 'Logística',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(f, 'usuarios/brigSocorros'), {
    rol_sistema: 'Encargado',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(f, 'usuarios/brigSocorros'), {
    nombres: 'Alterado',
    actualizado_en: serverTimestamp(),
  }));

  // Bloqueo al crear incidencia contra integrante de otra ayudantía
  await assertFails(setDoc(doc(f, 'incidencias_personal/incCruzadaFail'), {
    id: 'incCruzadaFail',
    usuario_uid: 'brigLogistica',
    usuario_nombre: 'Ana Pérez',
    operativo_id: 'opAbierto',
    tipo: 'Observación',
    gravedad: 'Baja',
    descripcion: 'Intento cruzado',
    creado_por_uid: 'jefeSocorros',
    creado_por_nombre: 'Jefe Socorros',
    creado_en: serverTimestamp(),
  }));

  // Encargado en etapa formativa (Alfa) con ayudantía NO actúa como Jefe de Ayudantía
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'usuarios/encFormativoSocorros'), usuarioBase('encFormativoSocorros', {
      estatus: 'Activo',
      rol_sistema: 'Encargado',
      etapa: 'Alfa',
      grupo_operativo: 'Alfa',
      subgrupo: 'Alfa 2',
      ayudantia: 'Socorros',
      ayudantia_slot: 'Socorros',
    }));
  });
  await assertFails(getDoc(doc(db('encFormativoSocorros'), 'usuarios/brigSocorros')));
});

test('Jefe de Ayudantía en operativos: pasa/aprueba lista, asigna roles y consulta Material propio solo de su ayudantía', async () => {
  const fJefe = db('jefeSocorros');
  const fBrig = db('brigSocorros');

  // 1. Prerregistro manual de integrante de su ayudantía permitido; otra ayudantía bloqueada
  await assertSucceeds(setDoc(
    doc(fJefe, 'operativos/opAbierto/prerregistros/brigSocorros'),
    prerregistroBase('brigSocorros', 'jefeSocorros', 'Manual_Encargado', { ayudantia: 'Socorros' }),
  ));
  await assertFails(setDoc(
    doc(fJefe, 'operativos/opAbierto/prerregistros/brigLogistica'),
    prerregistroBase('brigLogistica', 'jefeSocorros', 'Manual_Encargado', {
      etapa: 'Grupo Operativo',
      subgrupo: '',
      ayudantia: 'Logística',
    }),
  ));
  await assertSucceeds(getDocs(query(
    collection(fJefe, 'operativos/opAbierto/prerregistros'),
    where('ayudantia', '==', 'Socorros'),
  )));
  await assertFails(getDocs(collection(fJefe, 'operativos/opAbierto/prerregistros')));

  // 2. Pase/aprobación de lista para brigSocorros permitido; para brigLogistica bloqueado
  await assertSucceeds(crearEntradaConCandado(fJefe, {
    id: 'asisSocorros1',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigSocorros',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Socorros',
    rol_en_turno: 'Primeros Auxilios',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'Manual',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'jefeSocorros',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  await assertFails(setDoc(doc(fJefe, 'asistencias_personal/asisLogisticaFail'), {
    id: 'asisLogisticaFail',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigLogistica',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Logística',
    rol_en_turno: 'Logística',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'Manual',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'jefeSocorros',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  // 3. Listado de asistencias exige filtro por su ayudantía; asignar/ajustar rol en su ayudantía permitido y bloqueado en otra
  await assertSucceeds(getDocs(query(
    collection(fJefe, 'asistencias_personal'),
    where('operativo_id', '==', 'opAbierto'),
    where('ayudantia_slot', '==', 'Socorros'),
  )));
  await assertFails(getDocs(query(
    collection(fJefe, 'asistencias_personal'),
    where('operativo_id', '==', 'opAbierto'),
  )));

  await assertSucceeds(updateDoc(doc(fJefe, 'asistencias_personal/asisSocorros1'), {
    rol_en_turno: 'Búsqueda y Rescate',
    estado_operativo: 'Reserva',
    actualizado_en: serverTimestamp(),
  }));
  // asisAbierto pertenece a brigOmega1 (ayudantia_slot: 'Ninguna') -> bloqueado para jefeSocorros
  await assertFails(updateDoc(doc(fJefe, 'asistencias_personal/asisAbierto'), {
    rol_en_turno: 'Evacuación',
    actualizado_en: serverTimestamp(),
  }));

  // 4. Brigadista de Socorros registra Material propio y Jefe de Socorros lo consulta;
  //    Jefe de Socorros NO puede asignar equipo sobre asistencia de otra ayudantía
  await assertSucceeds(setDoc(doc(fBrig, 'equipos_turno/eqPropioSocorros'), {
    id: 'eqPropioSocorros',
    asistencia_id: 'asisSocorros1',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigSocorros',
    usuario_nombre: 'Ana Pérez',
    nombre_articulo: 'Botiquín personal equipado',
    codigo_inventario: '',
    cantidad: 1,
    ayudantia_slot: 'Socorros',
    origen_material: 'Propio',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'brigSocorros',
    creado_por_nombre: 'Ana Pérez',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));
  await assertSucceeds(getDocs(query(
    collection(fJefe, 'equipos_turno'),
    where('usuario_uid', '==', 'brigSocorros'),
    where('ayudantia_slot', '==', 'Socorros'),
  )));
  // Sin el filtro por ayudantía la consulta es rechazada (A-5)
  await assertFails(getDocs(query(
    collection(fJefe, 'equipos_turno'),
    where('usuario_uid', '==', 'brigSocorros'),
  )));

  await assertFails(setDoc(doc(fJefe, 'equipos_turno/eqCruzadoFail'), {
    id: 'eqCruzadoFail',
    asistencia_id: 'asisAbierto',
    operativo_id: 'opAbierto',
    usuario_uid: 'brigOmega1',
    usuario_nombre: 'Ana Pérez',
    nombre_articulo: 'Chaleco alta visibilidad',
    codigo_inventario: '',
    origen_material: 'BUPC_Asignado',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'jefeSocorros',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));
});

test('No regresión Admin y Brigadista regular frente al aislamiento de Jefe de Ayudantía', async () => {
  // Admin mantiene acceso global de lectura y edición sobre cualquier ayudantía
  await assertSucceeds(getDocs(collection(db('admin1'), 'usuarios')));
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigLogistica'), {
    rol_sistema: 'Encargado',
    actualizado_en: serverTimestamp(),
  }));
  await assertSucceeds(getDocs(query(
    collection(db('admin1'), 'asistencias_personal'),
    where('operativo_id', '==', 'opAbierto'),
  )));

  // Brigadista regular mantiene acceso propio pero NO ve ni a compañeros de su misma ayudantía
  await assertSucceeds(getDoc(doc(db('brigSocorros'), 'usuarios/brigSocorros')));
  await assertFails(getDoc(doc(db('brigSocorros'), 'usuarios/jefeSocorros')));
  await assertFails(getDocs(query(
    collection(db('brigSocorros'), 'usuarios'),
    where('ayudantia', '==', 'Socorros'),
  )));
});

// ============================================================================
// PRUEBAS: ASIGNACIÓN AUTOMÁTICA DE ROL OPERATIVO POR AYUDANTÍA,
// EDICIÓN EN CONVOCATORIA, CONSERVACIÓN EN QR Y PERSISTENCIA DE ayudantia_slot
// ============================================================================

test('Mapeo automático de rol operativo por ayudantía (5 ayudantías + Sin definir) en prerregistro y QR', async () => {
  const casos = [
    { uid: 'brigCapMap', etapa: 'Grupo Operativo', subgrupo: '', ayudantia: 'Capacitación', rolEsperado: 'Búsqueda y Rescate', rolIncorrecto: 'Radios' },
    { uid: 'brigTeslaMap', etapa: 'Grupo Operativo', subgrupo: '', ayudantia: 'Tesla', rolEsperado: 'Radios', rolIncorrecto: 'Atención' },
    { uid: 'brigApMap', etapa: 'Grupo Operativo', subgrupo: '', ayudantia: 'Administración de Personal', rolEsperado: 'Encargados', rolIncorrecto: 'Abastecedores' },
    { uid: 'brigLogMap', etapa: 'Grupo Operativo', subgrupo: '', ayudantia: 'Logística', rolEsperado: 'Abastecedores', rolIncorrecto: 'Encargados' },
    { uid: 'brigSocMap', etapa: 'Grupo Operativo', subgrupo: '', ayudantia: 'Socorros', rolEsperado: 'Atención', rolIncorrecto: 'Búsqueda y Rescate' },
    { uid: 'brigAlfaMap', etapa: 'Alfa', subgrupo: 'Alfa 1', ayudantia: 'Ninguna', rolEsperado: 'Sin definir', rolIncorrecto: 'Atención' },
    { uid: 'brigOmegaMap', etapa: 'Omega', subgrupo: 'Omega 1', ayudantia: 'Ninguna', rolEsperado: 'Sin definir', rolIncorrecto: 'Radios' },
    { uid: 'brigSierraMap', etapa: 'SIERRA', subgrupo: '', ayudantia: 'Ninguna', rolEsperado: 'Sin definir', rolIncorrecto: 'Abastecedores' },
  ];

  // Sembrar usuarios de prueba y abrir convocatoria en opAbierto
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await updateDoc(doc(f, 'operativos/opAbierto'), {
      convocatoria_abierta: true,
      cupo_sugerido: 50,
    });
    for (const c of casos) {
      await setDoc(doc(f, `usuarios/${c.uid}`), usuarioBase(c.uid, {
        estatus: 'Activo',
        rol_sistema: 'Brigadista',
        etapa: c.etapa,
        grupo_operativo: c.etapa === 'Alfa' || c.etapa === 'Omega' ? c.etapa : 'Ninguno',
        subgrupo: c.subgrupo,
        ayudantia: c.ayudantia,
        ayudantia_slot: c.ayudantia,
      }));
    }
  });

  for (const c of casos) {
    const f = db(c.uid);

    // 1. Prerregistro con rol distinto al mapeado -> rechazado
    await assertFails(setDoc(
      doc(f, `operativos/opAbierto/prerregistros/${c.uid}`),
      prerregistroBase(c.uid, c.uid, 'Autoregistro', {
        etapa: c.etapa,
        subgrupo: c.subgrupo,
        ayudantia: c.ayudantia,
        ayudantia_slot: c.ayudantia,
        rol_en_turno: c.rolIncorrecto,
        rol_editado_manual: false,
        actualizado_en: serverTimestamp(),
      }),
    ));

    // 2. Prerregistro con rol mapeado exacto y ayudantia_slot persistido -> permitido
    await assertSucceeds(setDoc(
      doc(f, `operativos/opAbierto/prerregistros/${c.uid}`),
      prerregistroBase(c.uid, c.uid, 'Autoregistro', {
        etapa: c.etapa,
        subgrupo: c.subgrupo,
        ayudantia: c.ayudantia,
        ayudantia_slot: c.ayudantia,
        rol_en_turno: c.rolEsperado,
        rol_editado_manual: false,
        actualizado_en: serverTimestamp(),
      }),
    ));

    // 3. Auto-registro QR con rol suplantado -> rechazado
    await assertFails(crearEntradaConCandado(f, {
      id: `asisBad_${c.uid}`,
      operativo_id: 'opAbierto',
      operativo_nombre: 'Operativo opAbierto',
      usuario_uid: c.uid,
      usuario_nombre: 'Ana Pérez',
      usuario_cuenta: '20201234',
      grupo_operativo: c.etapa === 'Alfa' || c.etapa === 'Omega' ? c.etapa : 'Ninguno',
      ayudantia_slot: c.ayudantia,
      rol_en_turno: c.rolIncorrecto,
      estado_operativo: 'En servicio',
      signos_vitales: null,
      metodo_entrada: 'QR_Operativo_TOTP',
      prueba_qr: NONCE_VIGENTE_OP,
      hora_entrada: serverTimestamp(),
      hora_salida: null,
      horas_totales: null,
      salida_cerrada_manual: false,
      equipos_bupc_pendientes: 0,
      registrado_por_uid: c.uid,
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    }));

    // 4. Auto-registro QR con rol mapeado exacto y ayudantia_slot exacto -> permitido
    await assertSucceeds(crearEntradaConCandado(f, {
      id: `asisOk_${c.uid}`,
      operativo_id: 'opAbierto',
      operativo_nombre: 'Operativo opAbierto',
      usuario_uid: c.uid,
      usuario_nombre: 'Ana Pérez',
      usuario_cuenta: '20201234',
      grupo_operativo: c.etapa === 'Alfa' || c.etapa === 'Omega' ? c.etapa : 'Ninguno',
      ayudantia_slot: c.ayudantia,
      rol_en_turno: c.rolEsperado,
      estado_operativo: 'En servicio',
      signos_vitales: null,
      metodo_entrada: 'QR_Operativo_TOTP',
      prueba_qr: NONCE_VIGENTE_OP,
      hora_entrada: serverTimestamp(),
      hora_salida: null,
      horas_totales: null,
      salida_cerrada_manual: false,
      equipos_bupc_pendientes: 0,
      registrado_por_uid: c.uid,
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    }));
  }
});

test('Conservación de rol editado manualmente en convocatoria al confirmar por QR y alcance de Jefe de Ayudantía', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'operativos/opAbierto'), {
      convocatoria_abierta: true,
    });
  });

  // 1. Brigadista de Socorros se prerregistra con su rol automático ("Atención") y ayudantia_slot: "Socorros"
  await assertSucceeds(setDoc(
    doc(db('brigSocorros'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    prerregistroBase('brigSocorros', 'brigSocorros', 'Autoregistro', {
      etapa: 'Alfa',
      subgrupo: 'Alfa 1',
      ayudantia: 'Socorros',
      ayudantia_slot: 'Socorros',
      rol_en_turno: 'Atención',
      rol_editado_manual: false,
      actualizado_en: serverTimestamp(),
    }),
  ));

  // 2. Brigadista NO puede editar su propio rol en el prerregistro
  await assertFails(updateDoc(
    doc(db('brigSocorros'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    {
      rol_en_turno: 'Encargados',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));

  // 3. Jefe de Socorros edita manualmente el rol del prerregistro a "Búsqueda y Rescate"
  await assertSucceeds(updateDoc(
    doc(db('jefeSocorros'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    {
      rol_en_turno: 'Búsqueda y Rescate',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));

  // 4. Al confirmar entrada por QR del operativo, brigSocorros DEBE conservar "Búsqueda y Rescate"
  //    (intentar sobrescribir de vuelta a "Atención" es rechazado por las reglas)
  await assertFails(crearEntradaConCandado(db('brigSocorros'), {
    id: 'asisSocOverwriteFail',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigSocorros',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Socorros',
    rol_en_turno: 'Atención',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Operativo_TOTP',
    prueba_qr: NONCE_VIGENTE_OP,
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'brigSocorros',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  await assertSucceeds(crearEntradaConCandado(db('brigSocorros'), {
    id: 'asisSocQrConservado',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigSocorros',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Socorros',
    rol_en_turno: 'Búsqueda y Rescate',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Operativo_TOTP',
    prueba_qr: NONCE_VIGENTE_OP,
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'brigSocorros',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  // 5. Jefe de Socorros NO puede editar prerregistro de otra ayudantía (Logística); Admin sí puede
  await assertSucceeds(setDoc(
    doc(db('admin1'), 'operativos/opAbierto/prerregistros/brigLogistica'),
    prerregistroBase('brigLogistica', 'admin1', 'Manual_Encargado', {
      etapa: 'Grupo Operativo',
      subgrupo: '',
      ayudantia: 'Logística',
      ayudantia_slot: 'Logística',
      rol_en_turno: 'Abastecedores',
      rol_editado_manual: false,
      actualizado_en: serverTimestamp(),
    }),
  ));
  await assertFails(updateDoc(
    doc(db('jefeSocorros'), 'operativos/opAbierto/prerregistros/brigLogistica'),
    {
      rol_en_turno: 'Radios',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));
  await assertSucceeds(updateDoc(
    doc(db('admin1'), 'operativos/opAbierto/prerregistros/brigLogistica'),
    {
      rol_en_turno: 'Radios',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));

  // 6. Persistencia e integridad de ayudantia_slot en prerregistros, asistencias_personal y equipos_turno
  const preSnap = await assertSucceeds(getDocs(query(
    collection(db('jefeSocorros'), 'operativos/opAbierto/prerregistros'),
    where('ayudantia_slot', '==', 'Socorros'),
  )));
  if (preSnap.docs.length !== 1 || preSnap.docs[0].data().rol_en_turno !== 'Búsqueda y Rescate') {
    throw new Error('El prerregistro con ayudantia_slot="Socorros" debe preservar su rol editado y ser consultable por el Jefe.');
  }

  const asisSnap = await assertSucceeds(getDocs(query(
    collection(db('jefeSocorros'), 'asistencias_personal'),
    where('operativo_id', '==', 'opAbierto'),
    where('ayudantia_slot', '==', 'Socorros'),
  )));
  if (asisSnap.docs.length !== 1 || asisSnap.docs[0].data().rol_en_turno !== 'Búsqueda y Rescate') {
    throw new Error('La asistencia confirmada por QR debe conservar rol_en_turno y ayudantia_slot="Socorros".');
  }

  // Material asignado persiste ayudantia_slot y no permite alterarlo en update
  await assertSucceeds(setDoc(doc(db('jefeSocorros'), 'equipos_turno/eqSocSlot'), {
    id: 'eqSocSlot',
    asistencia_id: 'asisSocQrConservado',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigSocorros',
    usuario_nombre: 'Ana Pérez',
    ayudantia_slot: 'Socorros',
    nombre_articulo: 'Radio portátil',
    codigo_inventario: 'RAD-07',
    cantidad: 1,
    origen_material: 'BUPC_Asignado',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'jefeSocorros',
    creado_por_nombre: 'Jefe Socorros',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  await assertFails(updateDoc(doc(db('jefeSocorros'), 'equipos_turno/eqSocSlot'), {
    ayudantia_slot: 'Logística',
    actualizado_en: serverTimestamp(),
  }));

  // Brigadista con "Sin definir" puede recibir rol fácilmente en campo por Encargado/Admin
  await assertSucceeds(crearEntradaConCandado(db('admin1'), {
    id: 'asisSinDefCampo',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigAlfa1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Credencial',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'admin1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(doc(db('admin1'), 'asistencias_personal/asisSinDefCampo'), {
    rol_en_turno: 'Atención',
    actualizado_en: serverTimestamp(),
  }));
});

// ============================================================================
// PRUEBAS: CONVOCATORIA CERRADA VS OPERATIVO FINALIZADO Y NO REGRESIÓN
// PARA ENCARGADOS EN ALFA / OMEGA / SIERRA SIN AYUDANTÍA
// ============================================================================

test('Convocatoria cerrada bloquea autoregistro externo pero permite altas manuales, edición de roles y QR; Finalizado es solo lectura', async () => {
  // 1. Cerrar convocatoria en opAbierto (manteniendo recepción abierta)
  await assertSucceeds(updateDoc(doc(db('admin1'), 'operativos/opAbierto'), {
    convocatoria_abierta: false,
    actualizado_en: serverTimestamp(),
  }));

  // 2. Nuevo prerregistro abierto (Autoregistro) por brigadista -> BLOQUEADO
  await assertFails(setDoc(
    doc(db('brigAlfa1'), 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro', {
      etapa: 'Alfa',
      subgrupo: 'Alfa 1',
      ayudantia: 'Ninguna',
      ayudantia_slot: 'Ninguna',
      rol_en_turno: 'Sin definir',
      rol_editado_manual: false,
      actualizado_en: serverTimestamp(),
    }),
  ));

  // 3. Con convocatoria cerrada, Encargado/Admin SÍ puede dar alta manual en prerregistro,
  //    editar rol en prerregistro, dar alta manual de asistencia y confirmar por QR
  await assertSucceeds(setDoc(
    doc(db('encargado1'), 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'encargado1', 'Manual_Encargado', {
      etapa: 'Alfa',
      subgrupo: 'Alfa 1',
      ayudantia: 'Ninguna',
      ayudantia_slot: 'Ninguna',
      rol_en_turno: 'Sin definir',
      rol_editado_manual: false,
      actualizado_en: serverTimestamp(),
    }),
  ));

  await assertSucceeds(updateDoc(
    doc(db('encargado1'), 'operativos/opAbierto/prerregistros/brigAlfa1'),
    {
      rol_en_turno: 'Abastecedores',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));

  // Brigadista con convocatoria cerrada puede confirmar asistencia por QR respetando el rol editado
  await assertSucceeds(crearEntradaConCandado(db('brigAlfa1'), {
    id: 'asisConvCerradaQr',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigAlfa1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Abastecedores',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Operativo_TOTP',
    prueba_qr: NONCE_VIGENTE_OP,
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'brigAlfa1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  // Encargado puede editar rol en turno y dar alta manual de otro participante con convocatoria cerrada
  await assertSucceeds(updateDoc(doc(db('encargado1'), 'asistencias_personal/asisConvCerradaQr'), {
    rol_en_turno: 'Atención',
    actualizado_en: serverTimestamp(),
  }));

  await assertSucceeds(crearEntradaConCandado(db('encargado1'), {
    id: 'asisConvCerradaManual',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigOmega1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Omega',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'Manual',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'encargado1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));

  // 4. Operativo Finalizado: estrictamente solo lectura (no reabrir convocatoria, no editar, no altas),
  //    pero mantiene lectura histórica para consulta y exportación CSV
  await assertFails(updateDoc(doc(db('admin1'), 'operativos/opFinalizado'), {
    convocatoria_abierta: true,
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db('admin1'), 'asistencias_personal/asisFinFail'), {
    id: 'asisFinFail',
    operativo_id: 'opFinalizado',
    operativo_nombre: 'Operativo opFinalizado',
    usuario_uid: 'brigAlfa1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'Manual',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'admin1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(doc(db('admin1'), 'operativos/opFinalizado')));
  await assertSucceeds(getDocs(query(
    collection(db('admin1'), 'asistencias_personal'),
    where('operativo_id', '==', 'opFinalizado'),
  )));
});

test('No regresión: Encargados en Alfa, Omega y SIERRA sin ayudantía operan convocatorias, altas y asistencias sin bloqueo', async () => {
  const encargadosFormativos = [
    { uid: 'encAlfaSinAy', etapa: 'Alfa', grupo: 'Alfa', subgrupo: 'Alfa 1', grupos: ['Alfa 1'] },
    { uid: 'encOmegaSinAy', etapa: 'Omega', grupo: 'Omega', subgrupo: 'Omega 1', grupos: ['Omega 1'] },
    { uid: 'encSierraSinAy', etapa: 'SIERRA', grupo: 'Ninguno', subgrupo: 'Sierra 1', grupos: ['SIERRA'] },
  ];

  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    for (const e of encargadosFormativos) {
      await setDoc(doc(f, `usuarios/${e.uid}`), usuarioBase(e.uid, {
        estatus: 'Activo',
        rol_sistema: 'Encargado',
        etapa: e.etapa,
        grupo_operativo: e.grupo,
        subgrupo: e.subgrupo,
        ayudantia: 'Ninguna',
        ayudantia_slot: 'Ninguna',
        grupos_a_cargo: e.grupos,
      }));
    }
  });

  for (const e of encargadosFormativos) {
    const f = db(e.uid);
    const preId = `target_${e.uid}`;
    const asisId = `asis_${e.uid}`;

    // 1. Abrir y cerrar convocatoria en operativo activo
    await assertSucceeds(updateDoc(doc(f, 'operativos/opAbierto'), {
      convocatoria_abierta: true,
      actualizado_en: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(f, 'operativos/opAbierto'), {
      convocatoria_abierta: false,
      actualizado_en: serverTimestamp(),
    }));

    // 2. Prerregistro manual + edición de rol + listado incluso con convocatoria cerrada
    await assertSucceeds(setDoc(
      doc(f, `operativos/opAbierto/prerregistros/${preId}`),
      prerregistroBase(preId, e.uid, 'Manual_Encargado', {
        etapa: e.etapa,
        subgrupo: e.subgrupo,
        ayudantia: 'Ninguna',
        ayudantia_slot: 'Ninguna',
        rol_en_turno: 'Sin definir',
        rol_editado_manual: false,
        actualizado_en: serverTimestamp(),
      }),
    ));
    await assertSucceeds(updateDoc(
      doc(f, `operativos/opAbierto/prerregistros/${preId}`),
      {
        rol_en_turno: 'Atención',
        rol_editado_manual: true,
        actualizado_en: serverTimestamp(),
      },
    ));
    await assertSucceeds(getDocs(collection(f, 'operativos/opAbierto/prerregistros')));

    // 3. Alta de asistencia, listado y edición de rol en campo
    await assertSucceeds(crearEntradaConCandado(f, {
      id: asisId,
      operativo_id: 'opAbierto',
      operativo_nombre: 'Operativo opAbierto',
      usuario_uid: preId,
      usuario_nombre: 'Ana Pérez',
      usuario_cuenta: '20201234',
      grupo_operativo: e.grupo,
      ayudantia_slot: 'Ninguna',
      rol_en_turno: 'Atención',
      estado_operativo: 'En servicio',
      signos_vitales: null,
      metodo_entrada: 'Manual',
      hora_entrada: serverTimestamp(),
      hora_salida: null,
      horas_totales: null,
      salida_cerrada_manual: false,
      equipos_bupc_pendientes: 0,
      registrado_por_uid: e.uid,
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(f, `asistencias_personal/${asisId}`), {
      rol_en_turno: 'Radios',
      actualizado_en: serverTimestamp(),
    }));
    await assertSucceeds(getDocs(query(
      collection(f, 'asistencias_personal'),
      where('operativo_id', '==', 'opAbierto'),
    )));

    // 4. Operativo finalizado sigue bloqueado en escritura
    await assertFails(updateDoc(doc(f, 'operativos/opFinalizado'), {
      convocatoria_abierta: true,
      actualizado_en: serverTimestamp(),
    }));
  }
});

// ============================================================================
// PRUEBAS OBLIGATORIAS: PROTECCIÓN DE IDENTIDAD, CORRECCIÓN EN PENDIENTE,
// RECUPERACIÓN DE CUENTAS HUÉRFANAS Y EDICIÓN DE PRERREGISTROS LEGACY
// ============================================================================

test('1) Usuario Activo edita Ficha de Emergencia y teléfono, pero es rechazado al cambiar nombre, número de cuenta o correo; Admin corrige identidad con auditoría', async () => {
  const fActivo = db('activo1');

  // Permitido: Ficha de Emergencia + teléfono propio + tiene_foto
  await assertSucceeds(updateDoc(doc(fActivo, 'usuarios/activo1'), {
    tipo_sangre: 'A-',
    alergias: 'Penicilina',
    padecimientos_medicamentos: 'Asma controlada con salbutamol',
    contacto_emergencia_nombre: 'Carlos Pérez',
    contacto_emergencia_parentesco: 'Padre',
    contacto_emergencia_telefono: '3125550199',
    celular: '3129876543',
    celular_con_whatsapp: false,
    telefono_fijo: '3123120000',
    tiene_foto: true,
    actualizado_en: serverTimestamp(),
  }));

  // Bloqueado estrictamente para usuario Activo: nombre completo, número de cuenta, correo y datos académicos
  await assertFails(updateDoc(doc(fActivo, 'usuarios/activo1'), {
    nombres: 'Otro Nombre',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(fActivo, 'usuarios/activo1'), {
    apellido_paterno: 'Otro Apellido',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(fActivo, 'usuarios/activo1'), {
    apellido_materno: 'Materno Falso',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(fActivo, 'usuarios/activo1'), {
    numero_cuenta: '99999999',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(fActivo, 'usuarios/activo1'), {
    correo: 'evasion@ucol.mx',
    actualizado_en: serverTimestamp(),
  }));
  // Usuario Activo tampoco puede sobrescribir directamente su proyección en perfiles_operativos
  await assertFails(setDoc(doc(fActivo, 'perfiles_operativos/activo1'), {
    uid: 'activo1',
    nombre_completo: 'Identidad Falsa',
    numero_cuenta: '99999999',
    estatus: 'Activo',
    actualizado_en: serverTimestamp(),
  }));

  // Administración sí puede corregir identidad, propagando a perfiles_operativos y registrando CORRECCION_IDENTIDAD
  const fAdmin = db('admin1');

  // CORRECCION_IDENTIDAD sin valor_anterior / valor_nuevo es rechazado por firestore.rules
  await assertFails(addDoc(collection(fAdmin, 'auditoria_eventos'), {
    tipo: 'CORRECCION_IDENTIDAD',
    actor_uid: 'admin1',
    actor_nombre: 'Admin Uno',
    objetivo_uid: 'activo1',
    objetivo_nombre: 'Ana María Pérez Gómez',
    detalle: 'Intento sin valores trazables',
    creado_en: serverTimestamp(),
  }));

  const loteAdmin = writeBatch(fAdmin);
  loteAdmin.update(doc(fAdmin, 'usuarios/activo1'), {
    nombres: 'Ana María',
    apellido_paterno: 'Pérez',
    apellido_materno: 'Gómez',
    numero_cuenta: '20205678',
    actualizado_en: serverTimestamp(),
  });
  loteAdmin.set(doc(fAdmin, 'perfiles_operativos/activo1'), {
    uid: 'activo1',
    nombre_completo: 'Ana María Pérez Gómez',
    numero_cuenta: '20205678',
    estatus: 'Activo',
    etapa: 'Alfa',
    subgrupo: 'Alfa 1',
    ayudantia: 'Ninguna',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Ninguna',
    qr_codigo_unico: 'qr-activo-1',
    clave_radio: '',
    actualizado_en: serverTimestamp(),
  });
  loteAdmin.set(doc(collection(fAdmin, 'auditoria_eventos')), {
    tipo: 'CORRECCION_IDENTIDAD',
    actor_uid: 'admin1',
    actor_nombre: 'Admin Uno',
    objetivo_uid: 'activo1',
    objetivo_nombre: 'Ana María Pérez Gómez',
    detalle: 'Nombre: Ana Pérez → Ana María Pérez Gómez · No. de cuenta: 20201234 → 20205678',
    valor_anterior: 'Nombre: Ana Pérez | Cuenta: 20201234',
    valor_nuevo: 'Nombre: Ana María Pérez Gómez | Cuenta: 20205678',
    creado_en: serverTimestamp(),
  });
  await assertSucceeds(loteAdmin.commit());
});

test('2) Usuario Pendiente puede corregir sus datos enviados antes de aprobación (con validación de esquema y sin escalar privilegios)', async () => {
  const fPend = db('pendiente1');

  const loteCorreccion = writeBatch(fPend);
  loteCorreccion.update(doc(fPend, 'usuarios/pendiente1'), {
    nombres: 'Lucía Fernanda',
    apellido_paterno: 'Ramírez',
    apellido_materno: 'Soto',
    fecha_nacimiento: '2002-08-19',
    sexo: 'Mujer',
    celular: '3124445566',
    celular_con_whatsapp: true,
    telefono_fijo: '',
    nivel_academico: 'Superior',
    escuela_carrera: 'Facultad de Enfermería',
    numero_cuenta: '20219876',
    tipo_sangre: 'B+',
    alergias: 'Polen',
    padecimientos_medicamentos: 'Ninguno',
    contacto_emergencia_nombre: 'Jorge Ramírez',
    contacto_emergencia_parentesco: 'Padre',
    contacto_emergencia_telefono: '3121119999',
    actualizado_en: serverTimestamp(),
  });
  loteCorreccion.set(doc(fPend, 'perfiles_operativos/pendiente1'), {
    uid: 'pendiente1',
    nombre_completo: 'Lucía Fernanda Ramírez Soto',
    numero_cuenta: '20219876',
    estatus: 'Pendiente',
    etapa: 'Alfa',
    subgrupo: '',
    ayudantia: 'Ninguna',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    qr_codigo_unico: null,
    clave_radio: '',
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(loteCorreccion.commit());

  // Validación de esquema sigue activa (fecha inválida -> rechazado)
  await assertFails(updateDoc(doc(fPend, 'usuarios/pendiente1'), {
    fecha_nacimiento: '19-08-2002',
    actualizado_en: serverTimestamp(),
  }));

  // Bloqueo de auto-escalamiento en usuario Pendiente y en perfiles_operativos
  await assertFails(updateDoc(doc(fPend, 'usuarios/pendiente1'), {
    rol_sistema: 'Encargado',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(fPend, 'perfiles_operativos/pendiente1'), {
    uid: 'pendiente1',
    nombre_completo: 'Lucía Fernanda Ramírez Soto',
    numero_cuenta: '20219876',
    estatus: 'Activo',
    actualizado_en: serverTimestamp(),
  }));
});

test('3) Cuenta autenticada huérfana (sin usuarios/{uid}) puede recrear su registro en estado Pendiente reutilizando su UID', async () => {
  // Caso A: Ni usuarios/{uid} ni perfiles_operativos/{uid} existen
  const fHuerfanaA = db('huerfanaSinDocs');
  const loteA = writeBatch(fHuerfanaA);
  loteA.set(doc(fHuerfanaA, 'usuarios/huerfanaSinDocs'), altaValida('huerfanaSinDocs', {
    etapa: 'Alfa',
    subgrupo: '',
  }));
  loteA.set(doc(fHuerfanaA, 'perfiles_operativos/huerfanaSinDocs'), {
    uid: 'huerfanaSinDocs',
    nombre_completo: 'Ana Pérez',
    numero_cuenta: '20201234',
    estatus: 'Pendiente',
    etapa: 'Alfa',
    subgrupo: '',
    ayudantia: 'Ninguna',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    qr_codigo_unico: null,
    clave_radio: '',
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(loteA.commit());

  // Caso B: usuarios/{uid} fue borrado en consola pero quedó perfiles_operativos/{uid} residual
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'perfiles_operativos/huerfanaConResidual'), {
      uid: 'huerfanaConResidual',
      nombre_completo: 'Registro Residual',
      numero_cuenta: '20190001',
      estatus: 'Activo',
      etapa: 'Grupo Operativo',
      subgrupo: '',
      ayudantia: 'Socorros',
      grupo_operativo: 'Ninguno',
      ayudantia_slot: 'Socorros',
      qr_codigo_unico: 'qr-viejo',
      clave_radio: '',
      actualizado_en: Timestamp.now(),
    });
  });

  const fHuerfanaB = db('huerfanaConResidual');
  // No puede recrear perfiles_operativos en solitario sin crear usuarios/{uid} en Pendiente
  await assertFails(setDoc(doc(fHuerfanaB, 'perfiles_operativos/huerfanaConResidual'), {
    uid: 'huerfanaConResidual',
    nombre_completo: 'Ana Pérez',
    numero_cuenta: '20201234',
    estatus: 'Pendiente',
    actualizado_en: serverTimestamp(),
  }));

  const loteB = writeBatch(fHuerfanaB);
  loteB.set(doc(fHuerfanaB, 'usuarios/huerfanaConResidual'), altaValida('huerfanaConResidual', {
    etapa: 'Alfa',
    subgrupo: '',
  }));
  loteB.set(doc(fHuerfanaB, 'perfiles_operativos/huerfanaConResidual'), {
    uid: 'huerfanaConResidual',
    nombre_completo: 'Ana Pérez',
    numero_cuenta: '20201234',
    estatus: 'Pendiente',
    etapa: 'Alfa',
    subgrupo: '',
    ayudantia: 'Ninguna',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    qr_codigo_unico: null,
    clave_radio: '',
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(loteB.commit());
});

test('4) Jefe de Ayudantía puede editar rol_en_turno en un prerregistro histórico con campos legacy incompatibles', async () => {
  // Sembrar prerregistro histórico con valores legacy que antes fallaban esPrerregistroValido completo:
  // etapa: 'Ninguno', sin subgrupo, sin ayudantia (solo ayudantia_slot), sin rol_en_turno y con campo extra histórico
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'operativos/opAbierto/prerregistros/brigSocorros'), {
      usuario_uid: 'brigSocorros',
      usuario_nombre: 'ANA PÉREZ',
      usuario_cuenta: '20201234',
      etapa: 'Ninguno',
      ayudantia_slot: 'Socorros',
      origen: 'Autoregistro',
      campo_legacy_v1: 'valor_historico',
      fecha_registro: Timestamp.now(),
    });
  });

  // Jefe de otra ayudantía (Logística) sigue bloqueado
  await assertFails(updateDoc(
    doc(db('jefeLogistica'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    {
      rol_en_turno: 'Búsqueda y Rescate',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));

  // Jefe de Socorros tampoco puede alterar otros campos del documento en ese update
  await assertFails(updateDoc(
    doc(db('jefeSocorros'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    {
      rol_en_turno: 'Búsqueda y Rescate',
      usuario_nombre: 'Nombre Alterado',
      actualizado_en: serverTimestamp(),
    },
  ));

  // Jefe de Socorros SÍ puede actualizar rol_en_turno y rol_editado_manual sin bloqueo por campos legacy
  await assertSucceeds(updateDoc(
    doc(db('jefeSocorros'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    {
      rol_en_turno: 'Búsqueda y Rescate',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    },
  ));
});

// ============================================================================
// BONCHE 6: CICLO DE VIDA DE OPERATIVOS, AISLAMIENTO DE MATERIAL Y BRECHAS POR ROL
// ============================================================================

const asistenciaPropiaQr = (id, uid, extra = {}) => ({
  id,
  operativo_id: 'opAbierto',
  operativo_nombre: 'Operativo opAbierto',
  usuario_uid: uid,
  usuario_nombre: 'Ana Pérez',
  usuario_cuenta: '20201234',
  grupo_operativo: 'Ninguno',
  ayudantia_slot: 'Ninguna',
  rol_en_turno: 'Sin definir',
  estado_operativo: 'En servicio',
  signos_vitales: null,
  metodo_entrada: 'QR_Operativo_TOTP',
  prueba_qr: NONCE_VIGENTE_OP,
  hora_entrada: serverTimestamp(),
  hora_salida: null,
  horas_totales: null,
  salida_cerrada_manual: false,
  equipos_bupc_pendientes: 0,
  registrado_por_uid: uid,
  creado_en: serverTimestamp(),
  actualizado_en: serverTimestamp(),
  ...extra,
});

const equipoSeed = (id, asistenciaId, operativoId, uid, extra = {}) => ({
  id,
  asistencia_id: asistenciaId,
  operativo_id: operativoId,
  usuario_uid: uid,
  usuario_nombre: 'Ana Pérez',
  nombre_articulo: 'Radio portátil',
  codigo_inventario: `COD-${id}`,
  origen_material: 'BUPC_Asignado',
  estado_reporte: 'OK',
  falla_reportada: '',
  devuelto: false,
  devuelto_en: null,
  devuelto_por_uid: null,
  acta_incidencia: null,
  creado_por_uid: 'admin1',
  creado_en: Timestamp.now(),
  actualizado_en: Timestamp.now(),
  ...extra,
});

test('B6-1) Jefe de Ayudantía y Encargado rechazados al cambiar estatus a Finalizado/Cancelado; Encargado solo toca su lista blanca; Admin sí cancela', async () => {
  for (const uid of ['jefeSocorros', 'encargado1']) {
    await assertFails(updateDoc(doc(db(uid), 'operativos/opAbierto'), { estatus: 'Finalizado', recepcion_abierta: false, actualizado_en: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(uid), 'operativos/opAbierto'), { estatus: 'Cancelado', recepcion_abierta: false, actualizado_en: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(uid), 'operativos/opAbierto'), { qr_token_estatico: 'robado', actualizado_en: serverTimestamp() }));
  }
  // Jefe de Ayudantía no modifica configuración global
  await assertFails(updateDoc(doc(db('jefeSocorros'), 'operativos/opAbierto'), { recepcion_abierta: false, actualizado_en: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('jefeSocorros'), 'operativos/opAbierto'), { modo_qr: 'estatico', actualizado_en: serverTimestamp() }));
  // Encargado sin ayudantía sí puede abrir/cerrar recepción y convocatoria
  await assertSucceeds(updateDoc(doc(db('encargado1'), 'operativos/opAbierto'), { recepcion_abierta: false, convocatoria_abierta: true, actualizado_en: serverTimestamp() }));
  // Administrador sí cancela
  await assertSucceeds(updateDoc(doc(db('admin1'), 'operativos/opAbierto'), { estatus: 'Cancelado', recepcion_abierta: false, convocatoria_abierta: false, actualizado_en: serverTimestamp() }));
});

test('B6-2) Válvula de escape: solo Administrador registra devolución/acta en equipos_turno de operativo Finalizado', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await updateDoc(doc(f, 'asistencias_personal/asisFinalizado'), { equipos_bupc_pendientes: 2 });
    await setDoc(doc(f, 'equipos_turno/eqFin2'), equipoSeed('eqFin2', 'asisFinalizado', 'opFinalizado', 'activo1'));
  });
  const devolucion = { devuelto: true, estado_reporte: 'Devuelto', devuelto_en: serverTimestamp(), devuelto_por_uid: 'x', actualizado_en: serverTimestamp() };
  const acta = (uid) => ({
    estado_reporte: 'Incidencia',
    acta_incidencia: { motivo: 'Extravío', evidencia_id: null, registrado_por_uid: uid, registrado_por_nombre: 'Admin Uno', registrado_en: serverTimestamp() },
    actualizado_en: serverTimestamp(),
  });
  // Encargado y Brigadista dueño: rechazados
  await assertFails(updateDoc(doc(db('encargado1'), 'equipos_turno/eqFinalizado'), { ...devolucion, devuelto_por_uid: 'encargado1' }));
  await assertFails(updateDoc(doc(db('activo1'), 'equipos_turno/eqFinalizado'), { ...devolucion, devuelto_por_uid: 'activo1' }));
  await assertFails(updateDoc(doc(db('encargado1'), 'equipos_turno/eqFin2'), acta('encargado1')));
  // Admin: devolución con decremento atómico del contador
  const fa = db('admin1');
  const b = writeBatch(fa);
  b.update(doc(fa, 'equipos_turno/eqFinalizado'), { ...devolucion, devuelto_por_uid: 'admin1' });
  b.update(doc(fa, 'asistencias_personal/asisFinalizado'), { equipos_bupc_pendientes: 1, actualizado_en: serverTimestamp() });
  await assertSucceeds(b.commit());
  // Admin: acta de incidencia
  const b2 = writeBatch(fa);
  b2.update(doc(fa, 'equipos_turno/eqFin2'), acta('admin1'));
  b2.update(doc(fa, 'asistencias_personal/asisFinalizado'), { equipos_bupc_pendientes: 0, actualizado_en: serverTimestamp() });
  await assertSucceeds(b2.commit());
  // La válvula NO permite alterar el dueño ni reabrir salidas
  await assertFails(updateDoc(doc(fa, 'equipos_turno/eqFin2'), { usuario_uid: 'otro', actualizado_en: serverTimestamp() }));
  await assertFails(updateDoc(doc(fa, 'asistencias_personal/asisFinalizado'), { hora_salida: serverTimestamp(), actualizado_en: serverTimestamp() }));
});

test('B6-3) Operativo Cancelado queda en solo lectura (incluso para Admin)', async () => {
  await assertSucceeds(updateDoc(doc(db('admin1'), 'operativos/opAbierto'), { estatus: 'Cancelado', recepcion_abierta: false, actualizado_en: serverTimestamp() }));
  // Lectura permitida
  await assertSucceeds(getDoc(doc(db('admin1'), 'operativos/opAbierto')));
  await assertSucceeds(getDoc(doc(db('encargado1'), 'operativos/opAbierto')));
  // Escrituras bloqueadas: no reabrir, no editar, no altas
  await assertFails(updateDoc(doc(db('admin1'), 'operativos/opAbierto'), { estatus: 'Activo', recepcion_abierta: true, actualizado_en: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('admin1'), 'operativos/opAbierto'), { nombre: 'Renombrado', actualizado_en: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('encargado1'), 'operativos/opAbierto'), { convocatoria_abierta: true, actualizado_en: serverTimestamp() }));
  await assertFails(setDoc(doc(db('admin1'), 'asistencias_personal/asisCancelado'), asistenciaPropiaQr('asisCancelado', 'brigOmega1', { metodo_entrada: 'Manual', registrado_por_uid: 'admin1', grupo_operativo: 'Omega' })));
  await assertFails(setDoc(doc(db('admin1'), 'operativos/opAbierto/prerregistros/brigAlfa1'), prerregistroBase('brigAlfa1', 'admin1', 'Manual_Encargado')));
});

test('B6-4) Jefe de Ayudantía solo lee equipos_turno y evidencias_equipos de su ayudantía', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'equipos_turno/eqSoc'), equipoSeed('eqSoc', 'asisAbierto', 'opAbierto', 'brigSocorros', { ayudantia_slot: 'Socorros' }));
    await setDoc(doc(f, 'equipos_turno/eqLog'), equipoSeed('eqLog', 'asisAbierto', 'opAbierto', 'brigLogistica', { ayudantia_slot: 'Logística' }));
    for (const [id, eq] of [['evSoc', 'eqSoc'], ['evLog', 'eqLog']]) {
      await setDoc(doc(f, `evidencias_equipos/${id}`), {
        id, equipo_id: eq, asistencia_id: 'asisAbierto', operativo_id: 'opAbierto',
        imagen_webp_base64: `data:image/webp;base64,${'A'.repeat(80)}`,
        creado_por_uid: 'admin1', creado_en: Timestamp.now(),
      });
    }
  });
  const fJefe = db('jefeSocorros');
  await assertSucceeds(getDoc(doc(fJefe, 'equipos_turno/eqSoc')));
  await assertFails(getDoc(doc(fJefe, 'equipos_turno/eqLog')));
  await assertSucceeds(getDocs(query(collection(fJefe, 'equipos_turno'), where('operativo_id', '==', 'opAbierto'), where('ayudantia_slot', '==', 'Socorros'))));
  await assertFails(getDocs(query(collection(fJefe, 'equipos_turno'), where('operativo_id', '==', 'opAbierto'), where('ayudantia_slot', '==', 'Logística'))));
  await assertFails(getDocs(query(collection(fJefe, 'equipos_turno'), where('operativo_id', '==', 'opAbierto'))));
  await assertSucceeds(getDoc(doc(fJefe, 'evidencias_equipos/evSoc')));
  await assertFails(getDoc(doc(fJefe, 'evidencias_equipos/evLog')));
  // Admin y Encargado sin ayudantía conservan su alcance
  await assertSucceeds(getDoc(doc(db('admin1'), 'evidencias_equipos/evLog')));
  await assertSucceeds(getDoc(doc(db('encargado1'), 'equipos_turno/eqLog')));
});

test('B6-5) Brigadista no falsifica auditoría, nombre/cuenta en auto-registro ni material Propio en asistencia ajena', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'operativos/opAbierto'), { convocatoria_abierta: true });
  });
  const f = db('activo1');
  // Auditoría falsa
  await assertFails(addDoc(collection(f, 'auditoria_eventos'), eventoValido('activo1', { tipo: 'APROBACION_USUARIO' })));
  await assertFails(addDoc(collection(f, 'auditoria_eventos'), eventoValido('activo1', { tipo: 'FINALIZACION_OPERATIVO' })));
  // Prerregistro propio con nombre o cuenta falsificados
  const pre = (extra) => prerregistroBase('activo1', 'activo1', 'Autoregistro', {
    etapa: 'Grupo Operativo', subgrupo: '', ayudantia: 'Ninguna', ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir', rol_editado_manual: false, actualizado_en: serverTimestamp(), ...extra,
  });
  await assertFails(setDoc(doc(f, 'operativos/opAbierto/prerregistros/activo1'), pre({ usuario_nombre: 'Falso Nombre' })));
  await assertFails(setDoc(doc(f, 'operativos/opAbierto/prerregistros/activo1'), pre({ usuario_cuenta: '99999999' })));
  await assertSucceeds(setDoc(doc(f, 'operativos/opAbierto/prerregistros/activo1'), pre({})));
  // Auto-registro QR con nombre o cuenta falsificados
  await assertFails(crearEntradaConCandado(f, asistenciaPropiaQr('asisFalsa1', 'activo1', { usuario_nombre: 'Falso Nombre' })));
  await assertFails(crearEntradaConCandado(f, asistenciaPropiaQr('asisFalsa2', 'activo1', { usuario_cuenta: '99999999' })));
  await assertSucceeds(crearEntradaConCandado(f, asistenciaPropiaQr('asisPropiaOk', 'activo1')));
  // Material Propio: asistencia ajena rechazada, propia permitida
  const propio = (asistenciaId) => ({
    ...equipoSeed('eqPropioB6', asistenciaId, 'opAbierto', 'activo1', {
      origen_material: 'Propio', codigo_inventario: '', cantidad: 1, ayudantia_slot: 'Ninguna',
      creado_por_uid: 'activo1', creado_por_nombre: 'Ana Pérez',
      creado_en: serverTimestamp(), actualizado_en: serverTimestamp(),
    }),
  });
  await assertFails(setDoc(doc(f, 'equipos_turno/eqPropioB6'), propio('asisAbierto')));
  await assertSucceeds(setDoc(doc(f, 'equipos_turno/eqPropioB6'), propio('asisPropiaOk')));
});

test('B6-6) Encargado sin ayudantía (Opción B) no cambia ayudantia ni ayudantia_slot; Jefe tampoco reasigna ayudantía', async () => {
  const f = db('encAlfa1');
  await assertFails(updateDoc(doc(f, 'usuarios/brigAlfa1'), { ayudantia: 'Socorros', ayudantia_slot: 'Socorros', actualizado_en: serverTimestamp() }));
  await assertFails(updateDoc(doc(f, 'usuarios/brigAlfa1'), { ayudantia_slot: 'Tesla', actualizado_en: serverTimestamp() }));
  await assertFails(updateDoc(doc(f, 'usuarios/brigAlfa1'), { etapa: 'Grupo Operativo', grupo_operativo: 'Ninguno', subgrupo: '', actualizado_en: serverTimestamp() }));
  // Ajuste permitido dentro de sus grupos a cargo
  await assertSucceeds(updateDoc(doc(f, 'usuarios/brigAlfa1'), { subgrupo: 'Alfa 2', actualizado_en: serverTimestamp() }));
  // Jefe de Ayudantía no puede reasignar la ayudantía de su integrante
  await assertFails(updateDoc(doc(db('jefeSocorros'), 'usuarios/brigSocorros'), { ayudantia: 'Tesla', ayudantia_slot: 'Tesla', actualizado_en: serverTimestamp() }));
  // Administrador sí puede
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigAlfa1'), { ayudantia: 'Socorros', ayudantia_slot: 'Socorros', actualizado_en: serverTimestamp() }));
});

// ============================================================================
// BONCHE 7: CANDADO DETERMINISTA ANTI-DUPLICADOS, PRUEBA DE PRESENCIA QR,
// DESBLOQUEO DE ENCARGADO SIN AYUDANTÍA Y COHERENCIA DE ROL POR AYUDANTÍA
// ============================================================================

test('B7-1) Candado determinista presentes/{uid}: bloquea entradas sin candado y duplicadas; tras cerrar salida y borrar candado permite segundo turno', async () => {
  const fBrig = db('activo1');
  const fEnc = db('encargado1');

  // 1. Crear asistencia sin candado presentes/{uid} -> rechazado
  await assertFails(setDoc(
    doc(fBrig, 'asistencias_personal/asisSinCandado'),
    asistenciaPropiaQr('asisSinCandado', 'activo1'),
  ));

  // 2. Primera entrada con candado atómico -> permitida
  await assertSucceeds(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisTurno1', 'activo1')));

  // 3. Intento concurrente/duplicado para mismo uid en mismo operativo (VÍA 1 y VÍA 2) -> rechazado
  await assertFails(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisTurnoDup1', 'activo1')));
  await assertFails(crearEntradaConCandado(fEnc, asistenciaPropiaQr('asisTurnoDup2', 'activo1', {
    metodo_entrada: 'QR_Credencial',
    registrado_por_uid: 'encargado1',
  })));

  // 4. Cerrar salida sin eliminar el candado presentes/activo1 -> rechazado
  await assertFails(updateDoc(doc(fBrig, 'asistencias_personal/asisTurno1'), {
    hora_salida: serverTimestamp(),
    horas_totales: 1,
    estado_operativo: 'Retirado',
    actualizado_en: serverTimestamp(),
  }));

  // 5. Cerrar salida eliminando atómicamente presentes/activo1 -> permitido
  await assertSucceeds(cerrarSalidaConCandadoTest(fBrig, 'opAbierto', 'activo1', 'asisTurno1'));

  // 6. Una vez liberado el candado, un segundo turno del mismo brigadista SÍ se permite
  await assertSucceeds(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisTurno2', 'activo1')));
});

test('B7-2) Prueba de presencia QR (Plan Spark): Brigadista bloqueado de secretos/*; rechazado sin prueba_qr o token inválido; aprobado con vigente, nonce_anterior y estático', async () => {
  const fBrig = db('activo1');
  const fEnc = db('encargado1');

  // 1. Brigadista jamás lee secretos QR; Encargado/Admin sí leen y rotan secretos
  await assertFails(getDoc(doc(fBrig, 'operativos/opAbierto/secretos/estatico')));
  await assertFails(getDoc(doc(fBrig, 'operativos/opAbierto/secretos/vigente')));
  await assertFails(getDoc(doc(fBrig, 'operativos/opAbierto/secretos/totp')));
  await assertSucceeds(getDoc(doc(fEnc, 'operativos/opAbierto/secretos/estatico')));
  await assertSucceeds(getDoc(doc(fEnc, 'operativos/opAbierto/secretos/vigente')));

  // 2. Modo dinámico: sin prueba_qr o con nonce inválido -> rechazado
  const sinPrueba = asistenciaPropiaQr('asisSinPrueba', 'activo1');
  delete sinPrueba.prueba_qr;
  await assertFails(crearEntradaConCandado(fBrig, sinPrueba));
  await assertFails(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisBadNonce', 'activo1', {
    prueba_qr: 'INVALID9',
  })));

  // 3. Modo dinámico: aprobado con nonce vigente y aprobado con nonce_anterior (ventana de gracia)
  await assertSucceeds(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisVigOk', 'activo1', {
    prueba_qr: NONCE_VIGENTE_OP,
  })));
  await assertSucceeds(cerrarSalidaConCandadoTest(fBrig, 'opAbierto', 'activo1', 'asisVigOk'));

  await assertSucceeds(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisGraciaOk', 'activo1', {
    prueba_qr: NONCE_ANTERIOR_OP,
  })));
  await assertSucceeds(cerrarSalidaConCandadoTest(fBrig, 'opAbierto', 'activo1', 'asisGraciaOk'));

  // 4. Modo dinámico expirado (> 120s sin rotación) -> rechazado
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'operativos/opAbierto/secretos/vigente'), {
      actualizado_en: Timestamp.fromMillis(Date.now() - 180_000),
    });
  });
  await assertFails(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisExpFail', 'activo1', {
    prueba_qr: NONCE_VIGENTE_OP,
  })));

  // 5. Modo estático: rechaza token incorrecto o método dinámico; aprueba secretos/estatico.token
  await assertSucceeds(updateDoc(doc(fEnc, 'operativos/opAbierto'), {
    modo_qr: 'estatico',
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisEstBad', 'activo1', {
    metodo_entrada: 'QR_Operativo_Estatico',
    prueba_qr: 'TOKEN-FALSO-123',
  })));
  await assertSucceeds(crearEntradaConCandado(fBrig, asistenciaPropiaQr('asisEstOk', 'activo1', {
    metodo_entrada: 'QR_Operativo_Estatico',
    prueba_qr: TOKEN_ESTATICO_OP,
  })));
});

test('B7-3) Encargado sin ayudantía (Alfa/Omega/SIERRA) lee perfiles_operativos y registra VÍA 2 de brigadista ajeno sin permission-denied, sin leer usuarios/{uid}', async () => {
  const fEncAlfa = db('encAlfa1');

  // 1. Sigue estrictamente bloqueado de leer la Ficha de Emergencia / usuarios/{uid} de brigOmega1
  await assertFails(getDoc(doc(fEncAlfa, 'usuarios/brigOmega1')));

  // 2. SÍ lee perfiles_operativos/brigOmega1 y lista perfiles_operativos activos
  const snapPerfil = await assertSucceeds(getDoc(doc(fEncAlfa, 'perfiles_operativos/brigOmega1')));
  if (snapPerfil.data()?.qr_codigo_unico !== 'qr-omega-1') {
    throw new Error('Se esperaba leer qr_codigo_unico desde perfiles_operativos.');
  }
  await assertSucceeds(getDocs(query(
    collection(fEncAlfa, 'perfiles_operativos'),
    where('estatus', 'in', ['Activo', 'Inactivo']),
  )));

  // 3. Registra entrada VÍA 2 (QR_Credencial + candado presentes/brigOmega1) para brigOmega1 sin bloqueo
  await assertSucceeds(crearEntradaConCandado(fEncAlfa, {
    id: 'asisVia2Ajeno',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigOmega1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Omega',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Credencial',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'encAlfa1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  }));
});

test('B7-4) Cambio de ayudantía entre prerregistro y escaneo QR: recalcula rol si rol_editado_manual == false y respeta rol_en_turno si rol_editado_manual == true', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'operativos/opAbierto'), {
      convocatoria_abierta: true,
    });
  });

  // Caso A (rol_editado_manual == false): brigSocorros se prerregistra en Socorros ('Atención'),
  // luego Admin lo reasigna a Logística -> al escanear QR DEBE recalcular a 'Abastecedores'.
  await assertSucceeds(setDoc(
    doc(db('brigSocorros'), 'operativos/opAbierto/prerregistros/brigSocorros'),
    prerregistroBase('brigSocorros', 'brigSocorros', 'Autoregistro', {
      etapa: 'Alfa',
      subgrupo: 'Alfa 1',
      ayudantia: 'Socorros',
      ayudantia_slot: 'Socorros',
      rol_en_turno: 'Atención',
      rol_editado_manual: false,
      actualizado_en: serverTimestamp(),
    }),
  ));
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigSocorros'), {
    ayudantia: 'Logística',
    ayudantia_slot: 'Logística',
    actualizado_en: serverTimestamp(),
  }));

  // Rol viejo ('Atención') rechazado; rol recalculado ('Abastecedores') aprobado
  await assertFails(crearEntradaConCandado(db('brigSocorros'), asistenciaPropiaQr('asisCambioViejo', 'brigSocorros', {
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Logística',
    rol_en_turno: 'Atención',
  })));
  await assertSucceeds(crearEntradaConCandado(db('brigSocorros'), asistenciaPropiaQr('asisCambioRecalc', 'brigSocorros', {
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Logística',
    rol_en_turno: 'Abastecedores',
  })));

  // Caso B (rol_editado_manual == true): brigLogistica tiene rol editado manualmente a 'Radios',
  // luego Admin lo reasigna a Capacitación -> al escanear QR DEBE conservar 'Radios'.
  await assertSucceeds(setDoc(
    doc(db('admin1'), 'operativos/opAbierto/prerregistros/brigLogistica'),
    prerregistroBase('brigLogistica', 'admin1', 'Manual_Encargado', {
      etapa: 'Grupo Operativo',
      subgrupo: '',
      ayudantia: 'Logística',
      ayudantia_slot: 'Logística',
      rol_en_turno: 'Radios',
      rol_editado_manual: true,
      actualizado_en: serverTimestamp(),
    }),
  ));
  await assertSucceeds(updateDoc(doc(db('admin1'), 'usuarios/brigLogistica'), {
    ayudantia: 'Capacitación',
    ayudantia_slot: 'Capacitación',
    actualizado_en: serverTimestamp(),
  }));

  await assertFails(crearEntradaConCandado(db('brigLogistica'), asistenciaPropiaQr('asisManualIgnorado', 'brigLogistica', {
    ayudantia_slot: 'Capacitación',
    rol_en_turno: 'Búsqueda y Rescate',
  })));
  await assertSucceeds(crearEntradaConCandado(db('brigLogistica'), asistenciaPropiaQr('asisManualConservado', 'brigLogistica', {
    ayudantia_slot: 'Capacitación',
    rol_en_turno: 'Radios',
  })));
});

// ============================================================================
// BONCHE 8: OPTIMIZACIÓN PLAN SPARK — SUBDOCUMENTO `meta/contador` SIN HOT DOC
// ============================================================================

test('B8-1) meta/contador elimina escrituras calientes en operativos/{id}: Brigadista y Jefe bloqueados en operativos/{id}, actualizan meta/contador atómicamente', async () => {
  // 1. Jefe de Ayudantía y Encargado sin ayudantía NO pueden escribir `prerregistros_count` en operativos/{id}
  await assertFails(updateDoc(doc(db('jefeSocorros'), 'operativos/opAbierto'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(db('encargado1'), 'operativos/opAbierto'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  }));

  // 2. Encargado abre convocatoria con cupo = 2 (sin tocar prerregistros_count en operativos/{id})
  await assertSucceeds(updateDoc(doc(db('encargado1'), 'operativos/opAbierto'), {
    convocatoria_abierta: true,
    cupo_sugerido: 2,
    actualizado_en: serverTimestamp(),
  }));

  // 3. Brigadista intenta escribir en operativos/{id} -> bloqueado; SÍ escribe atómicamente en meta/contador
  const fBrig = db('brigAlfa1');
  const bHotFail = writeBatch(fBrig);
  bHotFail.set(
    doc(fBrig, 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro'),
  );
  bHotFail.update(doc(fBrig, 'operativos/opAbierto'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  });
  await assertFails(bHotFail.commit());

  const bMetaOk = writeBatch(fBrig);
  bMetaOk.set(
    doc(fBrig, 'operativos/opAbierto/prerregistros/brigAlfa1'),
    prerregistroBase('brigAlfa1', 'brigAlfa1', 'Autoregistro'),
  );
  bMetaOk.set(doc(fBrig, 'operativos/opAbierto/meta/contador'), {
    prerregistros_count: 1,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(bMetaOk.commit());

  // 4. Brigadista NO puede alterar meta/contador sin su prerregistro ni borrar meta/contador
  await assertFails(updateDoc(doc(fBrig, 'operativos/opAbierto/meta/contador'), {
    prerregistros_count: 5,
    actualizado_en: serverTimestamp(),
  }));
  await assertFails(deleteDoc(doc(fBrig, 'operativos/opAbierto/meta/contador')));

  // 5. Jefe de Ayudantía registra prerregistro manual y actualiza meta/contador sin tocar operativos/{id}
  const fJefe = db('jefeSocorros');
  const bJefe = writeBatch(fJefe);
  bJefe.set(
    doc(fJefe, 'operativos/opAbierto/prerregistros/brigSocorros'),
    prerregistroBase('brigSocorros', 'jefeSocorros', 'Manual_Encargado', {
      ayudantia: 'Socorros',
      ayudantia_slot: 'Socorros',
    }),
  );
  bJefe.set(doc(fJefe, 'operativos/opAbierto/meta/contador'), {
    prerregistros_count: 2,
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(bJefe.commit());

  // 6. Cualquier usuario Activo puede leer meta/contador puntualmente (get), pero nunca listarlo
  await assertSucceeds(getDoc(doc(db('activo1'), 'operativos/opAbierto/meta/contador')));
  await assertFails(getDocs(collection(db('activo1'), 'operativos/opAbierto/meta')));
});

// ============================================================================
// BONCHE 9: SOPORTE OFFLINE CON writeBatch DETERMINISTA Y VERSIÓN REBACE
// ============================================================================

test('B9-1) Modo offline writeBatch determinista (VÍA 2, material genérico, devolución OK, salida con candado) y catalogos/claves_version', async () => {
  const fEnc = db('encargado1');
  const asisId = 'asis_opAbierto_brigAlfa1_offline1';

  // 1. Entrada VÍA 2 offline por writeBatch creando candado presentes/{uid} + asistencia
  const bEntrada = writeBatch(fEnc);
  bEntrada.set(doc(fEnc, 'operativos/opAbierto/presentes/brigAlfa1'), {
    asistencia_id: asisId,
    usuario_uid: 'brigAlfa1',
    operativo_id: 'opAbierto',
    ayudantia_slot: 'Ninguna',
    creado_en: serverTimestamp(),
  });
  bEntrada.set(doc(fEnc, `asistencias_personal/${asisId}`), {
    id: asisId,
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigAlfa1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Credencial',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'encargado1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });
  await assertSucceeds(bEntrada.commit());

  // 2. Un segundo writeBatch duplicado al reconectar es rechazado por el candado presentes/brigAlfa1
  const bDup = writeBatch(fEnc);
  bDup.set(doc(fEnc, 'operativos/opAbierto/presentes/brigAlfa1'), {
    asistencia_id: 'asis_opAbierto_brigAlfa1_offline2',
    usuario_uid: 'brigAlfa1',
    operativo_id: 'opAbierto',
    ayudantia_slot: 'Ninguna',
    creado_en: serverTimestamp(),
  });
  bDup.set(doc(fEnc, 'asistencias_personal/asis_opAbierto_brigAlfa1_offline2'), {
    id: 'asis_opAbierto_brigAlfa1_offline2',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigAlfa1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Alfa',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin definir',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Credencial',
    hora_entrada: serverTimestamp(),
    hora_salida: null,
    horas_totales: null,
    salida_cerrada_manual: false,
    equipos_bupc_pendientes: 0,
    registrado_por_uid: 'encargado1',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });
  await assertFails(bDup.commit());

  // 3. Asignación genérica offline con ID determinista + increment(1) + auditoría determinista
  const eqId = `eq_${asisId}_n1`;
  const bAsig = writeBatch(fEnc);
  bAsig.set(doc(fEnc, `equipos_turno/${eqId}`), {
    id: eqId,
    asistencia_id: asisId,
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'brigAlfa1',
    usuario_nombre: 'Ana Pérez',
    ayudantia_slot: 'Ninguna',
    nombre_articulo: 'Chaleco reflejante',
    codigo_inventario: '',
    cantidad: 1,
    origen_material: 'BUPC_Asignado',
    estado_reporte: 'OK',
    falla_reportada: '',
    devuelto: false,
    devuelto_en: null,
    devuelto_por_uid: null,
    acta_incidencia: null,
    creado_por_uid: 'encargado1',
    creado_por_nombre: 'Encargado Uno',
    creado_en: serverTimestamp(),
    actualizado_en: serverTimestamp(),
  });
  bAsig.update(doc(fEnc, `asistencias_personal/${asisId}`), {
    equipos_bupc_pendientes: increment(1),
    actualizado_en: serverTimestamp(),
  });
  bAsig.set(doc(fEnc, `auditoria_eventos/aud_${eqId}`), {
    tipo: 'ASIGNACION_EQUIPO',
    actor_uid: 'encargado1',
    actor_nombre: 'Encargado Uno',
    objetivo_uid: 'brigAlfa1',
    objetivo_nombre: 'Ana Pérez',
    detalle: 'Asignado: Chaleco reflejante',
    creado_en: serverTimestamp(),
  });
  await assertSucceeds(bAsig.commit());

  // 4. Devolución OK offline con writeBatch + increment(-1) + auditoría determinista
  const bDev = writeBatch(fEnc);
  bDev.update(doc(fEnc, `equipos_turno/${eqId}`), {
    devuelto: true,
    estado_reporte: 'Devuelto',
    devuelto_en: serverTimestamp(),
    devuelto_por_uid: 'encargado1',
    actualizado_en: serverTimestamp(),
  });
  bDev.update(doc(fEnc, `asistencias_personal/${asisId}`), {
    equipos_bupc_pendientes: increment(-1),
    actualizado_en: serverTimestamp(),
  });
  bDev.set(doc(fEnc, `auditoria_eventos/aud_dev_${eqId}`), {
    tipo: 'DEVOLUCION_EQUIPO',
    actor_uid: 'encargado1',
    actor_nombre: 'Encargado Uno',
    objetivo_uid: 'brigAlfa1',
    objetivo_nombre: 'Ana Pérez',
    detalle: 'Devolución OK: Chaleco reflejante',
    creado_en: serverTimestamp(),
  });
  await assertSucceeds(bDev.commit());

  // 5. Cierre de salida offline con writeBatch eliminando candado presentes/brigAlfa1
  const bSal = writeBatch(fEnc);
  bSal.update(doc(fEnc, `asistencias_personal/${asisId}`), {
    hora_salida: serverTimestamp(),
    horas_totales: 1.5,
    estado_operativo: 'Retirado',
    salida_cerrada_manual: true,
    actualizado_en: serverTimestamp(),
  });
  bSal.delete(doc(fEnc, 'operativos/opAbierto/presentes/brigAlfa1'));
  bSal.set(doc(fEnc, `auditoria_eventos/aud_sal_${asisId}`), {
    tipo: 'SALIDA_MANUAL',
    actor_uid: 'encargado1',
    actor_nombre: 'Encargado Uno',
    objetivo_uid: 'brigAlfa1',
    objetivo_nombre: 'Ana Pérez',
    detalle: 'Salida cerrada manualmente en Operativo opAbierto (1.5 h)',
    creado_en: serverTimestamp(),
  });
  await assertSucceeds(bSal.commit());

  // 6. catalogos/claves_version: Admin escribe versión ReBaCE, Activo la lee y Brigadista no puede escribirla
  await assertSucceeds(setDoc(doc(db('admin1'), 'catalogos/claves_version'), {
    id: 'claves_version',
    nombre: 'Versión catálogo ReBaCE',
    items: ['1732650000000'],
    actualizado_en: serverTimestamp(),
    actualizado_por_uid: 'admin1',
  }));
  await assertSucceeds(getDoc(doc(db('activo1'), 'catalogos/claves_version')));
  await assertFails(setDoc(doc(db('activo1'), 'catalogos/claves_version'), {
    id: 'claves_version',
    nombre: 'Alterado',
    items: ['1'],
    actualizado_en: serverTimestamp(),
    actualizado_por_uid: 'activo1',
  }));
});
