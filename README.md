# S.A.B.U.P.C — Sistema de Administración de la Brigada Universitaria de Protección Civil

![Versión](https://img.shields.io/badge/versi%C3%B3n-v1.2%20beta-F06514?style=flat-square)
![Firebase](https://img.shields.io/badge/Firebase-Plan%20Spark-3E6E28?style=flat-square)
![React](https://img.shields.io/badge/React-19%20%2B%20TypeScript-18181B?style=flat-square)

> **Estado actual: `v1.2 beta`** — En pruebas operativas en campo con voluntarios y mandos de la **Brigada Universitaria de Protección Civil (BUPC)** de la **Universidad de Colima**. Durante la fase beta se bloquea el aviso automático de instalación PWA (`beforeinstallprompt`) y las nuevas versiones se aplican mediante un banner controlado (`registerType: 'prompt'`) para evitar recargas inesperadas en medio de un turno.

- **Aplicación web:** [https://sabupc-colima.web.app](https://sabupc-colima.web.app)

---

## Descripción General y Roles del Sistema

**S.A.B.U.P.C** digitaliza la operación diaria y de campo de la BUPC en escritorio (Puesto de Mando) y teléfono móvil (operación en exteriores), resolviendo en una sola interfaz:

- Control de asistencia con QR en doble vía (entrada/salida) y registro de horas acumuladas.
- Resguardo de material institucional BUPC y material propio con Candado Duro de salida.
- Consola de radiocomunicación multi-canal con catálogo ReBaCE v2.
- Credencial Digital QR y Ficha Médica de Emergencia accesible en 1 toque.
- Historial personal y archivo operativo global con exportación a PDF y Excel/CSV.

### Roles y alcances (RBAC aditivo)

| Rol | Alcance operativo y de datos |
| :--- | :--- |
| **`Brigadista`** | Acceso a su Credencial Digital QR, Ficha de Emergencia, convocatorias y prerregistro, escáner QR de entrada/salida (VÍA 1), consulta/registro de material propio, reporte de fallas e historial personal con constancia PDF. |
| **`Encargado`** *(etapas formativas Alfa / Omega / SIERRA)* | Hereda vistas de Brigadista y añade gestión de operativos en campo (control QR, pase de lista VÍA 2/manual, signos vitales, material BUPC/Propio, incidencias), grupos a cargo (`grupos_a_cargo`) y Archivo Global. |
| **`Jefe de Ayudantía`** *(Encargado adscrito a `Grupo Operativo` con ayudantía)* | Mando acotado estrictamente a su ayudantía (`Socorros`, `Capacitación`, `Tesla`, `Logística`, `Administración de Personal`). Gestiona pase de lista, prerregistros, roles en turno, material, incidencias y Ficha de Emergencia solo de integrantes de su ayudantía, con mapeo automático de rol operativo inicial (`Socorros → Atención`, `Capacitación → Búsqueda y Rescate`, `Tesla → Radios`, `Logística → Abastecedores`, `Administración de Personal → Encargados`). |
| **`Administrador`** | Control total del padrón (aprobación/baja, corrección auditada de identidad, asignación de roles, ayudantías y claves de radio), creación/cierre definitivo o cancelación de operativos, catálogos institucionales y bitácora de auditoría. |

---

## Módulos y Capacidades Clave (`v1.2 beta`)

### 1. Control de personal e identidad protegida
- Flujo de registro con verificación de correo, bandeja de aprobación y bloqueo inmediato de cuentas marcadas como `Inactivo`.
- **Corrección previa en `Pendiente`:** mientras la cuenta está en revisión, el solicitante puede corregir sus datos enviados con validación de esquema.
- **Identidad protegida en cuentas `Activas`:** los campos identitarios (nombre completo, número de cuenta y correo) quedan bloqueados tanto en UI como en `firestore.rules` para evitar evasión de reportes; el brigadista puede editar por sí mismo su Ficha de Emergencia, teléfono propio y foto de perfil (WebP).
- **Corrección auditada y recuperación:** Administración puede corregir nombre o número de cuenta desde el expediente unificado (sincronizando `perfiles_operativos` y registrando valor anterior/nuevo en `auditoria_eventos`). Las cuentas huérfanas (autenticadas en Firebase Auth sin documento en `usuarios/{uid}`) se recuperan automáticamente redirigiendo al alta de perfil.

### 2. Operativos, convocatorias y recepción QR blindada
- **Convocatorias y prerregistros persistentes:** los operativos donde el brigadista ya está prerregistrado o tiene asistencia permanecen visibles en su panel incluso después de cerrar la convocatoria.
- **Prueba de presencia QR en Plan Spark:** sustituye dependencias externas por subdocumentos de secretos validados en `firestore.rules`: `operativos/{id}/secretos/estatico` (QR Fijo) y `operativos/{id}/secretos/vigente` (QR Dinámico con nonce rotativo cada 30 s).
- **Candado atómico contra duplicados:** cada entrada crea atómicamente `operativos/{id}/presentes/{uid}` (liberado al cerrar salida), impidiendo turnos duplicados por carrera entre VÍA 1, VÍA 2 o múltiples encargados.
- **Protección anti-rebote (`< 5 min`):** si se escanea nuevamente antes de 5 minutos desde la entrada, se exige confirmación explícita antes de registrar una salida anticipada.
- **Modo "Ráfaga en Puerta":** switch **"Escaneo continuo (fila)"** para VÍA 2 que mantiene la cámara abierta, ignora re-lecturas del mismo UID por 8 segundos, muestra tarjeta flotante (~2.5 s) con nombre, grupo y rol, y emite feedback háptico (`navigator.vibrate`) + tonos sintéticos vía Web Audio API.
- **Cierre seguro y baja lógica:** flujo de pre-cierre en pasos (verificación de deudores de material y cierre masivo de salidas abiertas) más baja lógica `Cancelado` para conservar el historial sin borrado destructivo.

### 3. Bitácora de campo, emergencias y resguardo
- **Tablero vivo de Fuerza de Tarea (0 lecturas extra):** chips filtrables en memoria por rol (`Atención`, `Búsqueda y Rescate`, `Radios`, `Abastecedores`, `Encargados`, `Sin definir` resaltado en ámbar cuando `> 0`) y estado (`En descanso`), con apertura directa en Bitácora para operativos `En curso`.
- **Alertas operativas y clínicas en memoria:** indicador discreto de relevo/hidratación para turnos continuos `> 4 h` en `"En servicio"` y resaltado semántico en el badge `SV` ante signos vitales fuera de rango seguro (`SpO2 < 94%`, `FC > 110` o `< 50`, `FR > 24` o `< 10`, `Temp >= 38 °C` o `< 35 °C`).
- **Parte de novedades para WhatsApp:** botón **"Copiar parte"** que arma en memoria y copia al portapapeles el corte estructurado (operativo, sede, hora, desglose por rol/ayudantía, personal en descanso y material BUPC en préstamo).
- **Emergencias a 1 toque y privacidad:** botón rojo de acceso directo a la **Ficha de Emergencia** en el encabezado móvil (sin girar manualmente la credencial), teléfonos clicables (`tel:`) con botón de llamada directa, y modo **"QR → Emergencia"** (1 `getDoc` puntual sin modificar asistencias) que respeta estrictamente el alcance de lectura de `firestore.rules`.
- **Material BUPC / Propio y Candado Duro:** bloqueo de salida mientras existan artículos BUPC pendientes, acceso directo al resguardo desde el modal de Candado Duro para mandos y acción **"Recibir pendientes OK y Cerrar Salida"** con confirmación en 2 toques.

### 4. Consola de Radio Multi-Canal y ReBaCE v2
- Layout móvil elástico con orden cronológico ascendente (último mensaje junto a la barra de captura) y tabla descendente en escritorio, más **Screen Wake Lock** para evitar bloqueo de pantalla en guardia.
- Preselección inteligente de `ORIGEN → DESTINO` recordada por canal en `sessionStorage`, ID determinista por borrador contra envíos duplicados, actualización atómica de unidades con `arrayUnion`/`arrayRemove` e indicador de desfase horario (`> 60 s`).
- Tira deslizable de 6 macros tácticas 1-toque y autocompletado local en memoria sobre el catálogo **ReBaCE v2** cargado una vez por sesión con caché local y validación ligera en `catalogos/claves_version`.

### 5. Soporte offline y arquitectura Firebase Plan Spark
- **100 % compatible con Plan Spark** (sin Cloud Functions ni Firebase Storage): imágenes comprimidas en cliente a WebP en `fotos_perfiles` y `evidencias_equipos`.
- **Escritura dual (online/offline):** transacciones estrictas con señal (`runTransaction`) y `writeBatch` determinista sin conexión encolado en caché persistente (`persistentLocalCache` + `persistentMultipleTabManager`), con insignias `"Pendiente de sincronizar"` y alertas globales en `BarraEstado` ante rechazos diferidos al reconectar.
- **Control de lecturas y contención:** contador desacoplado de prerregistros en `operativos/{id}/meta/contador`, `DirectorioContext` centralizado por sesión, consultas en vivo filtradas por operativos activos e historiales paginados.

---

## Stack Tecnológico y Estructura del Repositorio

| Capa | Tecnología | Uso principal |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Tailwind CSS v4 | Interfaz responsiva móvil/escritorio (tokens y ergonomía en `DESING.md`). |
| **Build & PWA** | Vite 8 + `vite-plugin-pwa` (`registerType: 'prompt'`) | Empaquetado, Service Worker controlado y operación offline. |
| **Backend (Spark)** | Firebase Auth + Cloud Firestore + Hosting | Autenticación, base de datos en tiempo real con caché IndexedDB y reglas declarativas. |
| **Utilidades UI/Campo** | `html5-qrcode`, `qrcode.react`, `jspdf`, `jspdf-autotable`, `xlsx`, `lucide-react` | Escaneo/generación QR, exportación PDF/Excel/CSV e iconografía. |
| **Calidad y pruebas** | `oxlint`, `tsc -b`, `@firebase/rules-unit-testing` | Linting estático, chequeo estricto de tipos y suite de reglas en emulador local. |

```text
S.A.B.U.P.C/
├── DESING.md                       # Sistema de diseño, paleta WCAG AA y ergonomía táctil
├── firebase.json                   # Configuración de Firebase Hosting (frontend/dist) y Firestore
├── firestore.rules                 # Reglas de seguridad declarativas y validadores de esquema
├── firestore.indexes.json          # Índices compuestos de Cloud Firestore
├── firestore-tests/                # Suite de pruebas de reglas (reglas.test.js)
├── scripts/
│   └── migrar-historicos.mjs       # Script único local de migración de registros históricos
└── frontend/                       # Aplicación web PWA (React + TypeScript + Vite)
    ├── .env.local                  # Variables de entorno locales (no versionado)
    ├── public/                     # Activos públicos e ícono BUPC
    ├── package.json
    └── src/
        ├── components/
        │   ├── bitacora/           # TablaAsistencias, modales de material/vitales/emergencia/manual y hooks
        │   ├── grupos/             # Modales y gestión de etapas formativas y promoción en lote
        │   └── operativos/         # ListaOperativos, ResumenOperativo, ControlQrOperativo y cierre
        ├── constants/              # Catálogos operativos y semilla ReBaCE v2
        ├── context/                # SesionContext, TemaContext y DirectorioContext
        ├── hooks/                  # Hooks reutilizables (p. ej. useWakeLock)
        ├── lib/                    # Firebase, permisos RBAC, colaOffline, pwaBeta, feedbackCampo, WebP
        ├── pages/                  # Vistas principales (PanelActivo, Operativos, Radio, Admin, Historial, Credencial)
        ├── services/               # Capa de acceso a Firestore (asistencias, operativos, equipos, radio, auth)
        └── types/                  # Modelos y tipos TypeScript del dominio
```

---

## Desarrollo Local, Pruebas y Despliegue Seguro

### 1. Variables de entorno

Crea `frontend/.env.local` con las credenciales públicas de tu app web en Firebase Console (**nunca subas este archivo a Git**):

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 2. Servidor local, linter y build

Todos los comandos del frontend se ejecutan dentro de `frontend/`:

```bash
cd frontend

# Instalar dependencias
npm install

# Levantar servidor de desarrollo local
npm run dev

# Exponer en red local para probar en celular (cámara/escáner/móvil)
npm run dev -- --host

# Ejecutar linter estático (oxlint)
npm run lint

# Verificar tipos TypeScript y generar build de producción (frontend/dist)
npm run build
```

### 3. Pruebas de reglas en el emulador local de Firestore

Primero instala las dependencias de pruebas (una sola vez):

```bash
cd firestore-tests
npm install
cd ..
```

Para ejecutar la suite completa (`firestore-tests/reglas.test.js`) desde la **raíz del repositorio**:

```powershell
# PowerShell (Windows)
.\firestore-tests\node_modules\.bin\firebase.cmd emulators:exec --only firestore --project demo-sabupc "node --test firestore-tests/reglas.test.js"
```

```bash
# Alternativa desde la carpeta firestore-tests/
cd firestore-tests && npm test
```

---

## Mantenimiento y Despliegue Seguro (`v1.2 beta`)

### Migración única de registros históricos

El script local `scripts/migrar-historicos.mjs` normaliza documentos históricos en Firestore (no forma parte del frontend). Ejecútalo siempre primero en modo simulación (`--dry-run`) y **nunca subas llaves JSON de cuenta de servicio a Git**:

```powershell
# 1. Prueba recomendada contra el emulador local
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
node scripts/migrar-historicos.mjs --dry-run
node scripts/migrar-historicos.mjs --apply

# 2. Ejecución contra proyecto real (llave local fuera del repositorio)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\segura\serviceAccount.json"
node scripts/migrar-historicos.mjs --project=sabupc-colima --dry-run
node scripts/migrar-historicos.mjs --project=sabupc-colima --apply
```

### Orden seguro de despliegue

> **Regla operativa:** nunca ejecutes un despliegue a producción mientras exista un operativo activo en campo.

Desde la **raíz del repositorio**:

```bash
# 1. Desplegar índices compuestos primero
firebase deploy --only firestore:indexes

# 2. Esperar en Firebase Console → Firestore → Índices hasta que todos estén en estado "Habilitado" (Enabled)

# 3. Compilar el frontend verificado (oxlint + tsc -b + vite build)
cd frontend
npm run lint
npm run build
cd ..

# 4. Desplegar reglas de seguridad y aplicación web en Hosting
firebase deploy --only firestore:rules,hosting
```
