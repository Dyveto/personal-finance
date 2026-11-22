## Resumen Ejecutivo del Release v1.5.2

Este Pull Request promueve a `main` la versión consolidada **v1.5.2** de **Personal Finance System**, integrando la **Identidad Visual Oficial de Marca** (rediseño del logotipo, recorte centrado de favicons/iconos PWA y paleta Dorado Metálico / Ámbar Cálido), **Soporte de Cuota de Manejo y Modalidades de Cobro en Tarjetas de Crédito**, **Ergonomía y Estabilidad Móvil PWA** (bloqueo de scroll lateral, viewport estricto y prevención de auto-zoom en iOS Safari), y **Navegación Temporal con Flechas en los Gráficos del Dashboard** con ventanas de tiempo configurables.

---

### 1. Identidad Oficial de Marca y Logotipo
* **Emblema Oficial:** Monograma corporativo **F** (billetera + flecha ascendente) con gradiente dorado metálico sobre fondo azul marino oscuro (`#0B132B`).
* **Mayor Presencia y Jerarquía Visual:**
  - **Barra Lateral (`Sidebar.tsx`):** Cabecera ampliada a `h-20` con logotipo oficial de 48px (`size="md"`) y halo dorado sutil de fondo.
  - **Cabecera Móvil (`Header.tsx`):** Isotipo oficial visible en pantallas móviles junto al botón del menú drawer.
  - **Pantallas de Autenticación (`auth/layout.tsx`):** Logo escalado a 64px (`size="xl"`) con tipografía corporativa y relieve dorado.
  - **Componente Reutilizable (`BrandLogo.tsx`):** Soporta variantes `full` e `icon`, squircle perimetral y foco accesible.

---

### 2. Favicons Nítidos y Accesos Directos PWA Recortados
* **Encuadre Centrado:** Pipeline en `scripts/generate-brand-assets.ps1` con interpolación bicúbica de alta definición recortando un lienzo centrado de **640x640 px** sobre la imagen fuente de 1024x1024 px.
* **Proporción Visual:** El símbolo **F** abarca el **75%–80%** del marco con un margen perimetral limpio de **~85 px**, evitando que los bordes se corten al ras en tamaños mínimos (16x16 / 32x32).
* **Archivos Generados:** `public/favicon.ico`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `src/app/icon.png`, `src/app/apple-icon.png`.

---

### 3. Migración Cromática a Dorado Metálico / Ámbar Cálido
* **Modo Día (Light Mode):** Botones y acciones principales en ámbar cálido (`bg-amber-600 hover:bg-amber-700 text-white`) y badges en `text-amber-700`, superando el ratio de contraste **WCAG AA (> 5.5:1)** sobre fondos claros.
* **Modo Noche (Dark Mode):** Botones en dorado metálico (`bg-[#D4AF37] hover:bg-[#C5A059] text-slate-950 font-bold`) y acentos `#D4AF37` sobre fondos azul marino profundo (`#0B0F19` / `#131B2E`).
* **Invarianza Contable:** Se preservaron estrictamente los colores semánticos financieros: **Verde esmeralda (`#10B981`)** para ingresos y **Rojo carmesí (`#F43F5E`)** para gastos/deudas.

---

### 4. Cuota de Manejo y Modalidades de Cobro en Tarjetas de Crédito
* **Base de Datos y Tipos (`20260401000000_credit_card_management_fee.sql`):**
  - Campos `management_fee NUMERIC(12,2)` y `management_fee_type TEXT` con CHECK constraint `accounts_management_fee_rules`.
  - Vista `credit_card_balance_summary` actualizada con `WITH (security_invoker = true)` exponiendo las cuotas y modalidades.
* **Lógica Financiera Pura (`src/lib/finance/management-fee.ts`):**
  - `fixed_monthly`: Cobro fijo mensual use o no la tarjeta (ej. Nu con $12,000 COP).
  - `only_on_use`: Cobro únicamente cuando se registran consumos/saldo en el ciclo ($0.00 si no se usa).
  - `exempt_if_used`: Exenta por uso ($0.00 al tener consumo; cobra la tarifa si está inactiva).
  - `exempt`: Sin cobro ($0.00 siempre).
* **UI/UX en Formularios y Tarjetas:** Campos descriptivos en `AccountForm`, selector con explicaciones contextuales dinámicas y badges de estado en `CreditCardsClientView` y `AccountsClientView`.

---

### 5. Estabilidad Móvil, Bloqueo de Scroll Lateral y Restricción de Selección
* **Viewport y Zoom Estable (`src/app/layout.tsx`):** Configurado `Viewport` con `initialScale: 1`, `maximumScale: 1`, `userScalable: false`, `viewportFit: "cover"`.
* **Anti-Zoom en iOS Safari (`src/app/globals.css`):** Tamaño de fuente forzado a mínimo `16px !important` en inputs, selects y textareas móviles, evitando zooms inesperados al enfocar campos.
* **Cero Desplazamiento Lateral:** `html, body { overflow-x: hidden; overscroll-behavior-x: none; max-width: 100vw; }` y contenedor principal del shell con `overflow-x-hidden`.
* **Ergonomía Táctil:** Selección de texto deshabilitada en la interfaz visual (`user-select: none`) para evitar resaltados accidentales, con excepción absoluta en `input`, `textarea` y elementos editables (`user-select: text !important`).

---

### 6. Navegación Temporal con Flechas en Gráficos del Dashboard
* **Motor Temporal Puro (`src/lib/finance/chart-periods.ts`):**
  - Cálculo determinista de ventanas, límites y cubetas adaptadas a la zona horaria `America/Bogota`.
  - Actualización de defaults: **`Semanas = 4`** (reducido de 8), **`Meses = 6`** (configurable de 1 a 24).
  - Aislamiento de **1 mes**: Permite seleccionar `1 mes` y retroceder mes a mes (ej. Mayo 2026, Abril 2026...) actualizando en perfecta sincronía el **Flujo Periódico** y los **Gastos por Categoría**.
* **Controles Interactivos (`FinancialCharts.tsx`):**
  - Flechas `← Anterior` y `Siguiente →` (con desactivación automática en el presente).
  - Indicador destacado del rango de fechas civiles en español e indicador `Histórico`.
  - Botón de un solo toque `Ir a Actual` para retornar inmediatamente al presente.
  - Stepper `[-] [cantidad] [+]` y presets rápidos (`1 m`, `3 m`, `6 m`, `12 m`).

---

### 7. Certificación QA y Gate de Calidad

| Comando | Resultado | Detalles |
|---|---|---|
| `npx tsc --noEmit` | **Código 0** | 0 errores de tipado (TypeScript `strict: true`) |
| `npm run lint` | **Código 0** | 0 errores, 0 advertencias (ESLint) |
| `npm run test:run` | **Código 0** | **23 suites / 313 tests superados** (100% passing) |
| `npm run build` | **Código 0** | Build de producción optimizado en Next.js 14 + Middleware |
