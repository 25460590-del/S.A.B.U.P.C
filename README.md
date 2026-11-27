# S.A.B.U.P.C — Brigada Universitaria de Protección Civil

![Versión](https://img.shields.io/badge/versi%C3%B3n-v1.2%20beta-F06514?style=flat-square)
![Firebase](https://img.shields.io/badge/Firebase-Plan%20Spark-3E6E28?style=flat-square)
![React](https://img.shields.io/badge/React-19%20%2B%20TypeScript-18181B?style=flat-square)

Plataforma web progresiva (PWA) **Offline-First** para la gestión operativa, control de asistencia, credencialización digital, resguardo de material y radiocomunicación de la **Brigada Universitaria de Protección Civil (BUPC)** de la **Universidad de Colima**, diseñada para operar **100 % en Firebase Plan Spark (gratuito, sin tarjeta de crédito)** sin Cloud Functions ni Firebase Storage.

> **Estado actual: `v1.2 beta`** — En pruebas operativas en campo. Durante esta etapa se suprime el aviso automático de instalación PWA del navegador y las actualizaciones se aplican únicamente cuando el usuario lo confirma desde un aviso en pantalla, evitando recargas inesperadas durante un turno.

- **Producción:** [https://sabupc-colima.web.app](https://sabupc-colima.web.app)

---

## Descripción General y Roles del Sistema

La aplicación cubre el trabajo diario de voluntarios y mandos tanto en escritorio (Puesto de Mando) como en celular en campo:

- Pase de lista con códigos QR en doble vía y cálculo de horas de servicio.
- Credencial Digital QR y Ficha Médica de Emergencia de acceso inmediato.
- Control de material institucional BUPC y material propio con candado de salida.
- Consola de radiocomunicación multi-canal con catálogo ReBaCE v2.
- Historial personal y archivo operativo global con exportación a PDF y Excel/CSV.

### Roles y alcances

| Rol | Alcance operativo |
| :--- | :--- |
| **`Brigadista`** | Credencial Digital QR, Ficha de Emergencia, convocatorias y prerregistro, escáner QR de entrada/salida, registro de material propio, reporte de fallas e historial personal con constancia PDF. |
| **`Encargado`** *(etapas formativas Alfa / Omega / SIERRA)* | Hereda las funciones de Brigadista y suma la gestión de operativos en campo (control QR, pase de lista, signos vitales, resguardo de material e incidencias), seguimiento de grupos a cargo y consulta del Archivo Global. |
| **`Jefe de Ayudantía`** *(Encargado de `Grupo Operativo` con ayudantía)* | Mando acotado exclusivamente a los integrantes de su ayudantía (`Socorros`, `Capacitación`, `Tesla`, `Logística` o `Administración de Personal`) para pase de lista, prerregistros, roles en turno, material, incidencias y Ficha de Emergencia, con asignación automática del rol operativo inicial según su área. |
| **`Administrador`** | Gestión integral del padrón (aprobaciones, bajas, corrección auditada de identidad, roles, ayudantías y claves de radio), ciclo de vida completo de operativos, catálogos institucionales y auditoría de eventos. |

---

## Módulos y Capacidades Clave

### Control de personal e identidad protegida
- Flujo de registro con verificación de correo, bandeja de revisión y bloqueo inmediato para cuentas marcadas como inactivas.
- Corrección de datos permitida mientras la solicitud permanece en estado `Pendiente`.
- En cuentas `Activas`, los datos identitarios (nombre completo, número de cuenta y correo) permanecen protegidos contra edición propia para preservar la integridad de reportes e incidencias; cada integrante puede actualizar su Ficha de Emergencia, teléfono propio y foto de perfil.
- Corrección de identidad exclusiva y auditada por Administración, más recuperación automática de cuentas autenticadas que aún no cuentan con expediente registrado.

### Operativos, convocatorias y recepción QR blindada
- Convocatorias con prerregistro previo que permanecen visibles para los brigadistas ya apuntados o confirmados incluso después de cerrar la convocatoria.
- Recepción QR en modo fijo y modo dinámico rotativo validados directamente mediante reglas de seguridad compatibles con Plan Spark.
- Bloqueo atómico contra turnos duplicados en escaneos simultáneos y protección anti-rebote (`< 5 min`) que solicita confirmación explícita antes de cerrar una salida anticipada.
- **Modo "Ráfaga en Puerta":** escaneo continuo para filas en acceso que mantiene la cámara activa, ignora re-lecturas repetidas durante unos segundos, muestra una tarjeta flotante de confirmación y emite retroalimentación sonora y táctil.
- Cierre seguro de operativos en pasos (verificación de material pendiente y cierre de salidas abiertas) y baja lógica como `Cancelado` para preservar el historial.

### Bitácora de campo, emergencias y resguardo
- **Tablero vivo de Fuerza de Tarea:** resumen filtrable por rol y descanso calculado en memoria sin consultas adicionales a Firestore, abriendo directamente en Bitácora para operativos en curso.
- Alertas discretas en memoria para sugerir relevo/hidratación tras más de 4 horas continuas en servicio y resaltado visual en signos vitales cuando se registran valores fuera de rango.
- **Parte de novedades para WhatsApp:** generación y copiado en un toque de un resumen estructurado con personal en turno por rol y ayudantía, personal en descanso y material en préstamo, calculado en memoria sin consultas adicionales a Firestore.
- **Emergencias a 1 toque:** acceso directo a la Ficha de Emergencia desde el encabezado móvil, teléfonos clicables (`tel:`) con llamada directa y lectura puntual **"QR → Emergencia"** respetando estrictamente los permisos de privacidad de cada rol.
- **Resguardo con Candado Duro:** impide cerrar la salida de quien tenga material BUPC pendiente, ofrece acceso directo al resguardo desde el aviso para mandos y permite recibir pendientes y cerrar la salida en una sola confirmación.

### Consola de Radio Multi-Canal y ReBaCE v2
- Interfaz móvil optimizada para operación en campo (orden cronológico pegado a la barra de captura y soporte **Screen Wake Lock** para mantener la pantalla encendida durante la guardia).
- Preselección inteligente de unidad de origen/destino recordada por canal durante la sesión, prevención de envíos duplicados, gestión atómica concurrente de unidades participantes e indicador discreto de desfase horario.
- Macros tácticas de 1 toque y autocompletado local en memoria sobre el catálogo **ReBaCE v2** cargado con caché local.

### Soporte offline y arquitectura Plan Spark
- Operación sin conexión con persistencia local compartida entre pestañas, escritura atómica diferida cuando no hay señal, insignias `"Pendiente de sincronizar"` y avisos claros ante cualquier rechazo al reconectar.
- Compresión de fotografías y evidencias a WebP en el cliente (sin Firebase Storage), directorio centralizado por sesión e historiales paginados para cuidar la cuota gratuita de lectura y escritura.

---

## Stack Tecnológico y Estructura del Repositorio

| Capa | Tecnología | Detalle |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Tailwind CSS v4 | Interfaz responsiva móvil/escritorio con tipado estricto (`tsc -b`). |
| **Build & PWA** | Vite 8 + `vite-plugin-pwa` | Empaquetado rápido, caché de activos y actualización controlada. |
| **Backend (Spark)** | Firebase Auth + Cloud Firestore + Hosting | Autenticación, base de datos en tiempo real con persistencia local y reglas declarativas. |
| **Herramientas** | `html5-qrcode`, `qrcode.react`, `jspdf`, `jspdf-autotable`, `xlsx`, `lucide-react`, `oxlint` | Escaneo/generación QR, exportación PDF/Excel/CSV, iconografía y linting estático. |
| **Pruebas de reglas** | `@firebase/rules-unit-testing` + emulador de Firestore | Suite automatizada de 129 pruebas de seguridad en local. |

```text
S.A.B.U.P.C/
├── firebase.json               # Configuración de Firebase Hosting (frontend/dist) y Firestore
├── firestore.rules             # Reglas de seguridad declarativas de Cloud Firestore
├── firestore.indexes.json      # Índices compuestos de Cloud Firestore
├── firestore-tests/            # Suite de pruebas de reglas (reglas.test.js)
├── scripts/
│   └── migrar-historicos.mjs   # Script local único de migración de registros históricos
└── frontend/                   # Aplicación web PWA (React + TypeScript + Vite)
    ├── .env.local              # Variables de entorno locales (no versionado)
    ├── public/                 # Recursos estáticos e ícono institucional
    ├── package.json
    └── src/
        ├── components/
        │   ├── bitacora/       # Tabla de asistencias, modales de campo y hooks de bitácora
        │   ├── grupos/         # Gestión de etapas formativas y promoción en lote
        │   └── operativos/     # Listado, resumen, control QR y modales de cierre
        ├── constants/          # Catálogos operativos y semilla ReBaCE v2
        ├── context/            # Contextos globales de sesión, tema y directorio
        ├── hooks/              # Hooks reutilizables (p. ej. Wake Lock)
        ├── lib/                # Inicialización de Firebase, permisos, cola offline, PWA y WebP
        ├── pages/              # Vistas principales (Panel, Operativos, Radio, Admin, Historial, Credencial)
        ├── services/           # Capa de acceso a datos en Firestore
        └── types/              # Definiciones de tipos TypeScript
```

---

## Requisitos Previos

- **Node.js** (v20 o superior recomendado) y **npm**.
- **Firebase CLI** (`firebase-tools`) para despliegues y emulador.
- **Java (JDK 11 o superior)** instalado y disponible en el `PATH` (requisito obligatorio para ejecutar el emulador local de Cloud Firestore).

---

## Configuración Local y Pruebas

### 1. Variables de entorno

Crea el archivo `frontend/.env.local` con las credenciales públicas de tu aplicación web de Firebase (**Firebase Console → Configuración del proyecto**):

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

> Nunca subas `.env.local` ni llaves de cuenta de servicio al repositorio.

### 2. Instalación, desarrollo, linter y build

Todos los comandos de la aplicación web se ejecutan dentro de `frontend/`:

```bash
cd frontend

# Instalar dependencias
npm install

# Levantar servidor de desarrollo local
npm run dev

# Exponer en red local para probar cámara, escáner QR y UI móvil en celular
npm run dev -- --host

# Ejecutar linter estático (oxlint)
npm run lint

# Verificar tipos TypeScript y generar build de producción (frontend/dist)
npm run build
```

### 3. Suite de pruebas de reglas (emulador local de Firestore)

Instala las dependencias de pruebas una sola vez:

```bash
cd firestore-tests
npm install
cd ..
```

Ejecuta las **129 pruebas** de `firestore-tests/reglas.test.js` desde la **raíz del repositorio**:

```powershell
# PowerShell (Windows)
.\firestore-tests\node_modules\.bin\firebase.cmd emulators:exec --only firestore --project demo-sabupc "node --test firestore-tests/reglas.test.js"
```

```bash
# Alternativa desde firestore-tests/
cd firestore-tests && npm test
```

---

## Mantenimiento y Despliegue Seguro

### Migración única de registros históricos

El script local `scripts/migrar-historicos.mjs` normaliza documentos históricos en Firestore y no forma parte del frontend. **Nunca subas llaves JSON de cuenta de servicio a Git.**

**Paso 1 — Simulación obligatoria (`--dry-run`):** ejecuta primero la simulación y revisa cuidadosamente el resumen impreso en consola antes de escribir cualquier cambio:

```powershell
# Contra el emulador local (recomendado primero)
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
node scripts/migrar-historicos.mjs --dry-run

# Contra un proyecto real (llave local fuera del repositorio)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\segura\serviceAccount.json"
node scripts/migrar-historicos.mjs --project=<tu_project_id> --dry-run
```

> **Advertencia de respaldo previo:** en Firebase **Plan Spark** no está disponible la exportación administrada de Firestore. Valida siempre primero el resultado completo en el emulador local y realiza un respaldo previo de los datos críticos antes de ejecutar `--apply`.

**Paso 2 — Aplicación de cambios (`--apply`):** ejecútalo únicamente tras confirmar el resultado del `--dry-run`:

```powershell
# Contra el emulador local
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
node scripts/migrar-historicos.mjs --apply

# Contra un proyecto real
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\segura\serviceAccount.json"
node scripts/migrar-historicos.mjs --project=<tu_project_id> --apply
```

### Orden seguro de despliegue

> **Regla operativa:** nunca despliegues cambios a producción mientras exista un operativo activo en campo.

Desde la **raíz del repositorio**:

```bash
# 1. Desplegar primero los índices compuestos
firebase deploy --only firestore:indexes

# 2. Esperar en Firebase Console → Firestore → Índices hasta que todos figuren como "Habilitado" (Enabled)

# 3. Verificar linter y compilar el frontend
cd frontend
npm run lint
npm run build
cd ..

# 4. Desplegar reglas de seguridad y la aplicación web en Hosting
firebase deploy --only firestore:rules,hosting
```
