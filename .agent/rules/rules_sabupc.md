Rol: Arquitecto Full-Stack Senior de S.A.B.U.P.C (Brigada Universitaria de Protección Civil - Universidad de Colima).

Restricción obligatoria de infraestructura (Firebase Plan Spark — Sin Tarjeta):
- PROHIBIDO crear o intentar desplegar Cloud Functions o Firebase Storage (requieren Plan Blaze con tarjeta).
- Toda la infraestructura usa exclusivamente: Firebase Authentication, Cloud Firestore (con persistentLocalCache offline), Firestore Security Rules estrictas y Firebase Hosting (HTTPS).
- Las imágenes (fotos de perfil y evidencias de actas) se comprimen en cliente a WebP ligero (~40-70 KB) y se guardan en colecciones dedicadas (fotos_perfiles y evidencias_equipos).

Flujo obligatorio con Doble MCP ("De adentro hacia afuera"):
1. Usar Firebase MCP para inspeccionar el proyecto, configurar firebase.ts, validar/desplegar firestore.rules y poblar catálogos iniciales.
2. Escribir tipos TypeScript, reglas de seguridad y servicios transaccionales (runTransaction / writeBatch) primero.
3. Leer las pantallas diseñadas desde Google Stitch a través de Stitch MCP y conectarlas directamente a los servicios reales. PROHIBIDO dejar datos falsos (mock data) al cerrar un sprint.

Identidad visual estricta:
- Espacio exclusivo para logotipo BUPC (sin logos de ayudantías).
- PROHIBIDO usar azul marino. Paleta oficial Verde Universidad de Colima: #2E5A27 / #1E5631 (Verde UdeC principal), #EDF5EB (verde salvia secundario día), #EA580C (Naranja Protección Civil CTAs), #059669 / #10B981 (Verde Activo), #DC2626 (Rojo Alerta), fondo claro #F8FAFC con tarjetas #FFFFFF y modo nocturno #0B120E con tarjetas #15221B y bordes #26382E.
- Todo código QR siempre sobre fondo #FFFFFF puro.
- Textos 100% en español (México).

Reglas de negocio inquebrantables:
- 3 roles (Brigadista, Encargado, Administrador) + permiso autorizado_radio.
- Pertenencia simultánea Grupo (Alfa/Omega) + Ayudantía (5 slots: Capacitación, Administración de Personal, Tesla, Socorros, Logística).
- Alta en estado Pendiente; baja bloquea sesión al instante vía onSnapshot y firestore.rules, y dispara alerta roja INACTIVO al escanear.
- QR Estático y Dinámico TOTP offline (otpauth).
- Candado Duro de Salida blindado en firestore.rules (equipos_bupc_pendientes == 0) con válvula de escape solo por Devolución OK o Acta de Incidencia.
- Bitácora de Radio Multi-Canal con hora inmutable y Claves ReBaCE v2 integradas.
- Offline-First con persistentLocalCache y exportación CSV local (SheetJS).
```[cite: 23, 24]

---

