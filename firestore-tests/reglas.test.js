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
  query, where, writeBatch, serverTimestamp, Timestamp,
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
    await setDoc(doc(f, 'usuarios/encAlfa1'), usuarioBase('encAlfa1', { estatus: 'Activo', rol_sistema: 'Encargado', grupos_a_cargo: ['Alfa 1'] }));
    await setDoc(doc(f, 'usuarios/encAP'), usuarioBase('encAP', { estatus: 'Activo', rol_sistema: 'Encargado', ayudantia: 'Administración de Personal', ayudantia_slot: 'Administración de Personal' }));
    await setDoc(doc(f, 'usuarios/encTesla'), usuarioBase('encTesla', { estatus: 'Activo', rol_sistema: 'Encargado', ayudantia: 'Tesla', ayudantia_slot: 'Tesla' }));
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
    await setDoc(doc(f, 'operativos/opAbierto'), opBase('opAbierto'));
    await setDoc(doc(f, 'operativos/opAbierto/secretos/totp'), {
      secreto_base32: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      periodo_segundos: 30,
      digitos: 6,
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
test('dueño Pendiente no actualiza', () => assertFails(updateDoc(doc(db('pendiente1'), 'usuarios/pendiente1'), { celular: '3120000000', actualizado_en: serverTimestamp() })));
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
test('Admin no edita datos personales ajenos', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { nombres: 'Otro', actualizado_en: serverTimestamp() })));
test('Admin no cambia correo', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { correo: 'z@z.com', actualizado_en: serverTimestamp() })));
test('Admin enum inválido', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { rol_sistema: 'SuperAdmin', actualizado_en: serverTimestamp() })));
test('Admin clave de radio demasiado larga', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { clave_personal_radio: 'x'.repeat(11), actualizado_en: serverTimestamp() })));
test('Admin sin actualizado_en', () => assertFails(updateDoc(doc(db('admin1'), 'usuarios/activo1'), { estatus: 'Inactivo' })));
test('Admin Inactivo no aprueba', () => assertFails(updateDoc(doc(db('adminInactivo'), 'usuarios/pendiente1'), { estatus: 'Activo', actualizado_en: serverTimestamp() })));
test('Admin no borra', () => assertFails(deleteDoc(doc(db('admin1'), 'usuarios/activo1'))));
test('dueño no se borra', () => assertFails(deleteDoc(doc(db('activo1'), 'usuarios/activo1'))));

// ---------------- auditoria_eventos ----------------
test('Activo crea evento', () => assertSucceeds(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('activo1'))));
test('Pendiente no crea evento', () => assertFails(addDoc(collection(db('pendiente1'), 'auditoria_eventos'), eventoValido('pendiente1'))));
test('evento con actor suplantado', () => assertFails(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('admin1'))));
test('evento con fecha falsa', () => assertFails(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('activo1', { creado_en: Timestamp.fromDate(new Date('2020-01-01')) }))));
test('evento con tipo inválido', () => assertFails(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('activo1', { tipo: 'OTRO' }))));
test('evento con campo extra', () => assertFails(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('activo1', { x: 1 }))));
test('evento con detalle enorme', () => assertFails(addDoc(collection(db('activo1'), 'auditoria_eventos'), eventoValido('activo1', { detalle: 'x'.repeat(501) }))));
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

// ---------------- Dominio exclusivo de TESLA + cero autoasignación ----------------
test('Encargado Tesla asigna clave_radio y autorizado_radio a otro usuario', () => assertSucceeds(
  updateDoc(doc(db('encTesla'), 'usuarios/activo1'), {
    clave_radio: 'TESLA-205',
    clave_personal_radio: 'TESLA-205',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Tesla NO puede autoasignarse clave_radio ni autorizado_radio', () => assertFails(
  updateDoc(doc(db('encTesla'), 'usuarios/encTesla'), {
    clave_radio: 'TESLA-001',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Tesla NO puede cambiar estatus ni rol de otro usuario', () => assertFails(
  updateDoc(doc(db('encTesla'), 'usuarios/activo1'), {
    estatus: 'Inactivo',
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado Tesla puede listar perfiles para asignar claves', () => assertSucceeds(
  getDocs(collection(db('encTesla'), 'usuarios')),
));

// ---------------- Encargado Administración de Personal (AP) ----------------
test('Encargado AP aprueba ingreso y asigna etapa/subgrupo/ayudantía a Brigadista', () => assertSucceeds(
  updateDoc(doc(db('encAP'), 'usuarios/pendiente1'), {
    estatus: 'Activo',
    etapa: 'Alfa',
    grupo_operativo: 'Alfa',
    subgrupo: 'Alfa 2',
    ayudantia: 'Socorros',
    ayudantia_slot: 'Socorros',
    qr_codigo_unico: 'qr-ap-1',
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado AP NO puede editar clave_radio ni autorizado_radio', () => assertFails(
  updateDoc(doc(db('encAP'), 'usuarios/activo1'), {
    clave_radio: 'LINCE',
    autorizado_radio: true,
    actualizado_en: serverTimestamp(),
  }),
));
test('Encargado AP NO puede promover rol_sistema ni editar grupos_a_cargo', () => assertFails(
  updateDoc(doc(db('encAP'), 'usuarios/activo1'), {
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

test('Flujo real Brigadista QR: entrada, lecturas posteriores En servicio y salida sin permission-denied', async () => {
  const f = db('activo1');

  // 1. Validación previa de operativo y secreto QR
  await assertSucceeds(getDoc(doc(f, 'operativos/opAbierto')));
  await assertSucceeds(getDoc(doc(f, 'operativos/opAbierto/secretos/totp')));

  // 2. Auto-registro de entrada por QR
  await assertSucceeds(setDoc(doc(f, 'asistencias_personal/asisQrReal'), {
    id: 'asisQrReal',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'activo1',
    usuario_nombre: 'Ana Pérez',
    usuario_cuenta: '20201234',
    grupo_operativo: 'Ninguno',
    ayudantia_slot: 'Ninguna',
    rol_en_turno: 'Sin asignar',
    estado_operativo: 'En servicio',
    signos_vitales: null,
    metodo_entrada: 'QR_Operativo_TOTP',
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

  // 5. Registro de salida propia con 0 equipos BUPC pendientes
  await assertSucceeds(updateDoc(doc(f, 'asistencias_personal/asisQrReal'), {
    hora_salida: serverTimestamp(),
    horas_totales: 1.5,
    estado_operativo: 'Retirado',
    actualizado_en: serverTimestamp(),
  }));
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
  await assertSucceeds(setDoc(doc(db('activo1'), 'equipos_turno/eqPropio1'), {
    id: 'eqPropio1',
    asistencia_id: 'asisAbierto',
    operativo_id: 'opAbierto',
    operativo_nombre: 'Operativo opAbierto',
    usuario_uid: 'activo1',
    usuario_nombre: 'Ana Pérez',
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
  }));

  await assertSucceeds(getDocs(query(
    collection(db('encargado1'), 'equipos_turno'),
    where('operativo_id', '==', 'opAbierto'),
  )));
  await assertSucceeds(getDocs(query(
    collection(db('admin1'), 'equipos_turno'),
    where('operativo_id', '==', 'opAbierto'),
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
