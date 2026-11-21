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
  writeBatch, serverTimestamp, Timestamp,
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
    rol_sistema: 'Brigadista',
    autorizado_radio: false,
    clave_personal_radio: null,
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
    await setDoc(doc(f, 'usuarios/encargado1'), usuarioBase('encargado1', { estatus: 'Activo', rol_sistema: 'Encargado' }));
    await setDoc(doc(f, 'usuarios/pendiente1'), usuarioBase('pendiente1'));
    await setDoc(doc(f, 'auditoria_eventos/e1'), { ...eventoValido('admin1'), creado_en: Timestamp.now() });
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
