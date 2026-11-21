## Resumen Ejecutivo de la Versión

Este Pull Request promueve a `main` la versión consolidada de **Personal Finance System**, integrando la **Identidad Visual Oficial de Marca**, el rediseño y protagonismo del logotipo, el recorte nítido de favicons/iconos PWA, la migración cromática hacia la paleta **Dorado Metálico / Ámbar Cálido y Azul Marino**, junto con el hotfix de estabilidad para Safari iOS (`v1.5.1`), el parser de SMS bancarios de alta precisión y el campo dinámico de partículas estilo Antigravity.

---

### 1. Identidad Oficial de Marca y Logotipo
* **Emblema Oficial:** Se adoptó el monograma oficial **F** (billetera + flecha ascendente) con gradiente dorado metálico sobre fondo azul marino oscuro (`#0B132B`).
* **Mayor Presencia y Visibilidad en Pantalla:**
  - **Barra Lateral (`Sidebar.tsx`):** Cabecera ampliada a `h-20` con logotipo a 48px (`size="md"`) y halo dorado sutil de fondo (`drop-shadow-[0_0_12px_rgba(212,175,55,0.35)]`).
  - **Cabecera Móvil (`Header.tsx`):** Isotipo oficial visible en pantallas móviles junto al disparador del menú.
  - **Pantallas de Autenticación (`auth/layout.tsx`):** Logo escalado a 64px (`size="xl"`) con tipografía corporativa y relieve dorado.
  - **Componente Reutilizable (`BrandLogo.tsx`):** Soporta variantes `full` e `icon`, encapsulamiento squircle y foco accesible.

---

### 2. Recorte Centrado y Escalado Nítido de Favicons y Accesos PWA
* **Encuadre Centrado:** Pipeline en `scripts/generate-brand-assets.ps1` con interpolación bicúbica de alta definición recortando un lienzo centrado de **640x640 px** sobre la imagen fuente de 1024x1024 px.
* **Proporción Visual:** El símbolo **F** abarca el **75%–80%** del marco con un margen perimetral limpio de **~85 px**, evitando que los bordes se corten al ras en tamaños mínimos (16x16 / 32x32).
* **Archivos Generados:**
  - `public/favicon.ico` (32x32)
  - `public/favicon-16x16.png` y `public/favicon-32x32.png`
  - `public/icon-192.png` y `public/icon-512.png` (PWA Android / Chrome Web App)
  - `public/apple-touch-icon.png` (iOS Safari "Añadir a pantalla de inicio")
  - `src/app/icon.png` y `src/app/apple-icon.png` (App Router discovery)
  - `public/brand/app-icon-cropped.png` (máster de alta nitidez para componentes)

---

### 3. Migración Cromática de Morado a Dorado Metálico / Ámbar Cálido
Se sustituyeron todos los acentos morados/violetas (`#8B5CF6`, `#7C3AED`, `violet-*`) por tokens de la marca oficial, optimizando el contraste:
* **Modo Día (Light Mode):** Botones y acciones principales en ámbar cálido (`bg-amber-600 hover:bg-amber-700 text-white`) y badges en `text-amber-700`, superando el ratio de contraste **WCAG AA (> 5.5:1)** sobre fondos claros.
* **Modo Noche (Dark Mode):** Botones en dorado metálico (`bg-[#D4AF37] hover:bg-[#C5A059] text-slate-950 font-bold`) y acentos `#D4AF37` sobre fondos azul marino profundo (`#0B0F19` / `#131B2E`).
* **Invarianza Contable:** Se preservaron estrictamente los colores semánticos financieros: **Verde esmeralda (`#10B981`)** para ingresos y **Rojo carmesí (`#F43F5E`)** para gastos/deudas.
* **Vistas Actualizadas:** Transacciones, Cuentas, Tarjetas de Crédito, Categorías, Dashboard (Welcome Hub, gráficos y proyecciones de cuotas), Campana de Notificaciones y Toggle de Tema.

---

### 4. Estabilidad y Funcionalidades Clave de la Versión
* **Hotfix Safari iOS (`v1.5.1`):** Aislamiento de llamadas `revalidatePath` en bloques `try...catch` independientes y validación defensiva del objeto de retorno de Server Actions (`if (!result || typeof result !== "object" || !("success" in result) || !result.success)`), eliminando el fallo `undefined is not an object (evaluating 's.success')`.
* **Parser de SMS y Notificaciones Bancarias:** Extracción automática y robusta de montos, fechas, cuentas y tipos para Bancolombia, Nequi y Nu, con aritmética exacta `Decimal.js` y zona horaria `America/Bogota`. Asistente en 2 pasos con inclusión opcional de notas.
* **Campo Dinámico de Partículas (Antigravity):** Micro-trazos fluidos en canvas interactivo de fondo, con repulsión al cursor, deriva táctil en móviles, desvanecimiento central y adaptación automática al tema día/noche.

---

### 5. Certificación QA y Validación Técnica

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | **0 errores** (TypeScript `strict: true`) |
| `npm run lint` | **0 errores / 0 advertencias** (ESLint) |
| `npm run test:run` | **20 suites / 284 tests PASSED** (100% éxito) |
| `npm run build` | **Build Exitoso** (14 rutas Next.js 14 + Middleware) |
