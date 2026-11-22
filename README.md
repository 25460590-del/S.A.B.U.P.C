# S.A.B.U.P.C — Brigada Universitaria de Protección Civil

Plataforma web progresiva (PWA) para la gestión operativa, control de asistencia, credencialización digital y radiocomunicación de la **Brigada Universitaria de Protección Civil de la Universidad de Colima**.

- **Producción:** [https://sabupc-colima.web.app](https://sabupc-colima.web.app)

---

## Arquitectura y Stack (Firebase Plan Spark)

Diseñada para operar **100 % en Firebase Plan Spark (gratuito, sin tarjeta de crédito)** con enfoque **Offline-First**, prescindiendo por completo de Cloud Functions y Firebase Storage.

| Capa | Tecnología | Detalle |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Tailwind CSS v4 | Interfaz responsiva y tipado estricto (`tsc -b`). |
| **Build & PWA** | Vite + `vite-plugin-pwa` | Instalación móvil, caché de activos y operación sin señal. |
| **Autenticación** | Firebase Authentication | Registro, verificación de correo y control de sesiones. |
| **Base de datos** | Cloud Firestore (`persistentLocalCache`) | Caché persistente en IndexedDB compartida entre pestañas (`persistentMultipleTabManager`). |
| **Imágenes** | WebP en Firestore | Compresión en cliente a WebP almacenada en las colecciones dedicadas `fotos_perfiles` y `evidencias_equipos` (sin Firebase Storage). |
| **Seguridad** | `firestore.rules` | Reglas declarativas de acceso por rol y validación directa en Firestore (sin Cloud Functions). |
| **Herramientas** | `html5-qrcode`, `qrcode.react`, `otpauth`, `jspdf`, `jspdf-autotable`, `xlsx`, `lucide-react`, `oxlint` | Escaneo/generación QR, TOTP, exportación de reportes y linting. |

---

## Módulos Principales

1. **Roles RBAC + Grupo/Ayudantía**
   Control de acceso basado en roles con consola de administración, flujo de verificación de correo, cuentas en revisión, gestión de perfiles activos/inactivos y organización por grupos y ayudantías.
2. **Credencial Digital QR Offline + Reverso Médico**
   Credencial oficial accesible sin conexión a internet con código QR de identificación y reverso con información médica de emergencia del brigadista.
3. **Operativos con QR Estático y Dinámico TOTP**
   Creación y control de operativos con registro de asistencia mediante códigos QR estáticos y códigos dinámicos basados en tiempo (TOTP con `otpauth`).
4. **Escáner Dual + Candado Duro de Salida**
   Escáner de cámara en campo (`html5-qrcode`) con flujo dual de entrada/salida y candado duro que impide cerrar la salida sin completar las validaciones y entregas requeridas.
5. **Consola de Radio Multi-Canal + Claves ReBaCE v2 + Wake Lock**
   Bitácora y operación de radio en múltiples canales, catálogo integrado de claves **ReBaCE v2** y soporte de **Screen Wake Lock** para mantener la pantalla encendida durante el servicio.
6. **Historial Dual con PDF/Excel y Auditoría**
   Consulta de historiales operativos y personales con trazabilidad de auditoría y exportación directa a **PDF** (`jspdf` + `jspdf-autotable`) y **Excel** (`xlsx`).

---

## Estructura del Proyecto

```text
S.A.B.U.P.C/
├── firebase.json              # Configuración de Firebase Hosting (frontend/dist) y reglas
├── firestore.rules            # Reglas de seguridad de Cloud Firestore
├── firestore-tests/           # Pruebas de reglas de seguridad (reglas.test.js)
└── frontend/                  # Aplicación PWA (React + TypeScript + Vite)
    ├── .env.local             # Variables de entorno locales (no versionado)
    ├── public/                # Recursos estáticos e íconos PWA
    ├── package.json
    └── src/
        ├── components/        # Componentes reutilizables de UI
        ├── constants/         # Catálogos y constantes (p. ej. claves ReBaCE v2)
        ├── context/           # Contextos globales (autenticación, estado)
        ├── hooks/             # Hooks personalizados (p. ej. Wake Lock, sesión)
        ├── lib/               # Inicialización de Firebase y compresión WebP
        ├── pages/             # Vistas por módulo (Admin, Radio, Operativos, Credencial, Historial)
        ├── services/          # Capa de acceso a datos en Firestore
        └── types/             # Definiciones de tipos TypeScript
```

---

## Configuración Local

### 1. Variables de entorno

Crea el archivo `frontend/.env.local` con las credenciales públicas de tu aplicación web de Firebase (obtenidas en **Firebase Console → Configuración del proyecto**):

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

> Nunca subas `.env.local` ni credenciales reales al repositorio.

### 2. Instalación y desarrollo

Todos los comandos de la aplicación se ejecutan dentro de `frontend/`:

```bash
cd frontend

# Instalar dependencias
npm install

# Levantar servidor de desarrollo local
npm run dev

# Ejecutar linter (oxlint)
npm run lint

# Verificar tipos TypeScript y generar build de producción (frontend/dist)
npm run build
```

---

## Despliegue en Firebase Hosting

Desde la **raíz del repositorio** (`S.A.B.U.P.C/`), después de generar el build en `frontend/dist`:

```bash
# 1. Compilar el frontend
cd frontend
npm run build
cd ..

# 2. Desplegar únicamente la app web en Firebase Hosting
firebase deploy --only hosting

# (Opcional) Desplegar reglas de Firestore si hubo cambios en firestore.rules
firebase deploy --only firestore:rules
```
