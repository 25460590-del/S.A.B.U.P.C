# DESIGN.md — Sistema de Diseño: S.A.B.U.P.C. (Control de Asistencia BUPC)

## 1. Contexto y Principios Operativos
Aplicación web para la **Brigada Universitaria de Protección Civil (BUPC) - Universidad de Colima** enfocada en registro de asistencia por QR para guardias ordinarias, operativos masivos, proyectos técnicos y capacitaciones.

- **Uso en campo (Mobile-First):** La interfaz se usa de pie, en exteriores, bajo luz solar directa y a veces con prisa o guantes. Prioriza legibilidad, alto contraste y botones grandes sobre la decoración.
- **Cero fricción:** Registrar una entrada o salida mediante QR debe tomar máximo 2 toques desde que se abre la app.
- **Densidad inteligente:** Vista móvil limpia y directa para brigadistas; vista de escritorio densa y escaneable para Puesto de Mando / Encargados.

---

## 2. Paleta de Colores (Identidad Institucional + Operativa)
Usa exclusivamente estos tokens (Tailwind CSS o CSS Custom Properties). Todo texto debe cumplir contraste mínimo WCAG AA (idealmente AAA en exteriores).

### Superficies y Texto
- **Fondo principal (`--bg-canvas`):** `#F4F6F8`
- **Superficie de tarjeta (`--bg-surface`):** `#FFFFFF`
- **Fondo de inputs (`--bg-input`):** `#F8FAFC`
- **Bordes y divisores (`--border-subtle`):** `#E2E8F0`
- **Texto primario (`--text-primary`):** `#111827`
- **Texto secundario (`--text-secondary`):** `#4B5563`

### Identidad Institucional (UdeC / BUPC)
- **Primario Institucional (`--brand-green`):** `#3E6E28` (Hover / Oscuro: `#2D521D`) — Encabezados, barra de navegación, pestañas activas, checkboxes y enlaces clave.
- **Superficie Verde Suave (`--brand-green-soft`):** `#EAF2E4` (Borde: `#C8DDB9`, Texto: `#284A19`) — Botones secundarios, etiquetas institucionales y estados seleccionados suaves.
- **Acción Principal / CTA (`--brand-orange`):** `#E65300` (Hover: `#C94700`) — Reservado para acciones críticas (Escanear QR, Generar QR, Iniciar Operativo) y la línea delgada de acento (`3px`) debajo de encabezados verdes.
  - *Nota de contraste:* Sobre `--brand-orange`, usar texto oscuro (`#111827`, `font-semibold` o `font-bold`) para máxima legibilidad bajo luz solar directa.

### Estados Semánticos
- **En Servicio / Éxito (`--status-active`):** `#059669` (Fondo suave: `#ECFDF5`, Texto: `#065F46`) — Tono esmeralda más brillante para diferenciarlo del verde olivo institucional.
- **Alerta / Error / Incidencia (`--status-error`):** `#DC2626` (Fondo suave: `#FEF2F2`, Texto: `#991B1B`)
- **Advertencia / Turno por cerrar (`--status-warn`):** `#D97706` (Fondo suave: `#FFFBEB`, Texto: `#92400E`)

### Etiquetas de Tipo de Actividad (Badges)
- **Operativo Masivo** (ej. Loromanía, Carrera FEUC, Feria por la Paz): Fondo `#FFEDD5`, Texto `#9A3412`
- **Proyecto / Soporte Técnico** (ej. Proyecto Tesla): Fondo `#E0E7FF`, Texto `#3730A3`
- **Guardia Ordinaria:** Fondo `#EAF2E4`, Texto `#284A19`
- **Capacitación / Simulacro / Difusión:** Fondo `#F1F5F9`, Texto `#334155`

---

## 3. Tipografía y Datos
- **Familia única:** `Montserrat` (Google Fonts, pesos cargados: `400`, `500`, `600`, `700`, `800`). Fallback: `sans-serif`.
- **Números tabulares obligatorios:** Aplicar `font-variant-numeric: tabular-nums` (`tabular-nums` en Tailwind) en TODAS las horas, cronómetros, conteos de horas acumuladas, matrículas y tablas de asistencia.
- **Formato de hora:** Siempre en formato 24 horas (`HH:mm` o `HH:mm:ss`, ej. `08:05`, `19:30`).
- **Escala:**
  - Título de pantalla: `20px`–`24px` (`font-bold`, tracking `-0.02em`)
  - Título de sección / tarjeta: `16px` (`font-semibold`)
  - Cuerpo, inputs y celdas de tabla: `14px`–`15px` (`font-normal` / `font-medium`)
  - Etiquetas, badges y timestamps: `11px`–`12px` (`font-semibold`, uppercase opcional con `tracking-wider` en cintillos institucionales)

---

## 4. Layout, Espaciado y Ergonomía Táctil
- **Sistema base:** Grilla de múltiplos de `4px` (`4, 8, 12, 16, 24, 32`).
- **Áreas táctiles:** Todo botón, pestaña o control interactivo en móvil debe medir mínimo **`48px` de alto** (`min-h-12`).
- **Bordes redondeados:** `8px` (`rounded-lg`) para botones e inputs; `12px` (`rounded-xl`) para tarjetas y modales. Consistencia estricta.
- **Navegación:**
  - **Móvil (`< 768px`):** Barra inferior fija con máximo 4 destinos: *Escáner*, *Operativos*, *Mi QR*, *Historial*.
  - **Escritorio (`>= 768px`):** Barra lateral izquierda colapsable (`240px`) + área principal con ancho máximo fluido para tablas de bitácora.

---

## 5. Estados Obligatorios en Cada Vista
Ninguna pantalla o componente está terminado si no incluye explícitamente:
1. **Estado de carga:** *Skeletons* simples que imiten la estructura real (no spinners genéricos centrados en pantalla blanca).
2. **Estado vacío (*Empty state*):** Mensaje claro y accionable (ej. *"No hay operativos activos hoy"* + botón para crear uno si es encargado).
3. **Estado de confirmación de escaneo:** Feedback visual inequívoco en verde esmeralda con marca de tiempo exacta, nombre del operativo y rol asignado.
4. **Estado de error / sin red:** Banner persistente en rojo si falla la cámara, el QR ya fue registrado o se perdió conexión.

---

## 6. Reglas Negativas (PROHIBICIONES ESTRICTAS — Anti-AI Slop)
El agente de código tiene **estrictamente prohibido** romper estas reglas:

- **NO usar degradados (gradients):** Prohibidos los fondos, botones o textos con degradado (`bg-gradient-to-*`). Usa colores planos y contraste nítido.
- **NO usar efectos "SaaS futurista":** Prohibido *glassmorphism* (`backdrop-blur`), sombras enormes difusas (`shadow-xl`, `shadow-2xl`), brillos neón o fondos oscuros morado/azul por defecto. Usa bordes de `1px` (`border-slate-200`) y, como máximo, `shadow-xs` o `shadow-sm`.
- **NO poner más de 1 CTA primario naranja por vista:** Si hay dos botones juntos, el secundario debe usar `--brand-green-soft` con borde `#C8DDB9` o estilo *ghost*. Nunca dos botones naranjas compitiendo.
- **NO mezclar fuentes:** Prohibido usar `Inter`, `Roboto`, fuentes serif o manuscritas. Toda la interfaz debe renderizar exclusivamente en `Montserrat`.
- **NO anidar tarjetas dentro de tarjetas:** Prohibido el patrón *card-in-card*. Usa divisores horizontales (`border-b`) o espaciado limpio dentro de una sola tarjeta.
- **NO depender de `:hover` para acciones críticas:** En móvil no existe *hover*. Botones como "Registrar salida", "Descargar QR" o "Ver observaciones" deben ser visibles directamente.
- **NO escribir texto de relleno ni marketing:** Prohibidos saludos inflados. Usa etiquetas cortas, directas y en español de México (*"Operativos activos"*, *"Registrar entrada"*, *"Exportar lista"*).
- **NO usar emojis como iconos de interfaz:** Usa exclusivamente una librería de iconos consistente con trazo limpio (`Lucide React`, grosor `strokeWidth={2}`).
- **NO ocultar el botón de exportar en escritorio:** En las tablas de bitácora y asistencia, el botón de exportar (CSV / Excel / Google Sheets) debe estar siempre visible en la barra superior de la tabla.

---

## 7. Guía de Copy y Terminología (Español México)
- Usar siempre: **Brigadista**, **Operativo**, **Guardia**, **Puesto de Mando**, **Bitácora**, **Entrada / Salida**, **Matrícula UdeC**.
- Roles estándar: `Primeros Auxilios`, `Radiocomunicación`, `Búsqueda y Rescate`, `Evacuación`, `Logística`, `Encargado`.
- Equipo asignado estándar: `Radio`, `Botiquín`, `Chaleco`.