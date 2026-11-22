# Historial de Versiones (Changelog)

Todas las modificaciones notables de este sistema de finanzas personales son registradas en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), y este proyecto adhiere estrictamente a [Semantic Versioning (SemVer)](https://semver.org/spec/v2.0.0.html).

---

## Protocolo Obligatorio de Versionado y Release (develop -> main)

Antes de fusionar o promover cualquier cambio desde la rama `develop` a `main`, el equipo y los agentes deben cumplir de forma obligatoria con el siguiente flujo:

1. **Determinación del Tipo de Incremento SemVer**:
   - **PATCH (`v1.4.X`)**: Corrección de bugs, parches visuales o hotfixes que no modifican APIs ni contratos.
   - **MINOR (`v1.X.0`)**: Nuevas funcionalidades o mejoras compatibles hacia atrás (ej. nuevos filtros, componentes o módulos).
   - **MAJOR (`vX.0.0`)**: Modificaciones disruptivas, rediseños globales o rupturas de esquemas en base de datos.
2. **Sincronización de Versión en Código**:
   - Actualizar `"version": "X.Y.Z"` en `package.json`.
   - Actualizar `APP_VERSION = "X.Y.Z"` en `src/config/version.ts` (reflejado visualmente en el badge del Sidebar).
3. **Registro en Changelog**:
   - Documentar las secciones `### Añadido`, `### Mejoras`, `### Correcciones` en `CHANGELOG.md` bajo la nueva versión y fecha ISO.
4. **Validación Estricta de Calidad (Quality Gate QA)**:
   - Ejecutar la secuencia obligatoria completa con código de salida 0:
     ```bash
     rm -rf .next
     npx tsc --noEmit
     npm run lint
     npx vitest run
     npm run build
     ```
   - Si `npm run build` falla o genera advertencias críticas sobre chunks o recursos estáticos, el PR NO se aprueba ni se fusiona.

---

## [v1.5.3] - 2026-11-21
### Añadido y Mejorado
- **Gravamen a los Movimientos Financieros (4x1000 - GMF) por Cuenta**:
  - Configuración explícita `has_four_per_thousand` (booleano con valor predeterminado `false`) en cuentas bancarias y billeteras, permitiendo distinguir cuentas gravadas (ej. cuenta de ahorros Nu) de cuentas exentas (ej. Bancolombia o Nequi).
  - Persistencia de campos decimales de alta precisión (`four_per_thousand_amount NUMERIC(12,2)` y `base_amount NUMERIC(12,2)`) en transacciones, garantizando compatibilidad retrospectiva con movimientos históricos.
  - Motor financiero puro `src/lib/finance/four-per-thousand.ts` (`calculateFourPerThousand`, `calculateExpenseWithFourPerThousand`, `breakdownFourPerThousand`) basado en `Decimal.js` con redondeo estándar en pesos colombianos (`ROUND_HALF_UP` en COP).
  - Suma automática del impuesto al gasto/transferencia saliente al operar desde cuentas gravadas, debitando `monto base + 4x1000` del saldo contable.
  - Interfaz de usuario reactiva en `TransactionForm` con vista previa dinámica en tiempo real del desglose monetario (`Valor base`, `4x1000 (0.4%)` y `Total a debitar`).
  - Badge visual compacto `4X1000` con tooltip informativo en listados de transacciones y en el widget de movimientos recientes del Dashboard.
- **4x1000 en Pagos de Extractos y Abonos a Tarjetas de Crédito**:
  - Evaluación dinámica de la cuenta origen en `PayStatementDialog`: al elegir una cuenta gravada, calcula en tiempo real el 4x1000 del abono (pago total, mínimo o personalizado).
  - Tarjeta de desglose interactivo y alerta preventiva de saldo insuficiente calculando el débito total (`abono + 4x1000`).
  - Backend atómico en `markExtractAsPaid`: debita `abono + 4x1000` de la cuenta bancaria origen, amortiza estrictamente el `abono base` al saldo adeudado de la tarjeta de crédito y vincula la transacción contable mediante `payment_transaction_id`.
  - Reversión atómica de pago (`revertStatementPayment`): reemborsa el total debitado íntegro (incluyendo el 4x1000) a la cuenta bancaria origen y restablece la deuda base a la tarjeta de crédito.
- **Formalización del 5.º Agente Especializado: Security Agent (`05-security-agent`)**:
  - Incorporación del manual de habilidades `.agents/skills/05-security-agent/SKILL.md` dedicado a AppSec, OWASP Top 10, auditoría de RLS en Supabase, políticas de contraseñas, auditoría de dependencias (`npm audit`) y prevención de inyección en SMS/prompts.
  - Actualización de `.agents/rules/global-architecture.md` incorporando al equipo de 5 agentes y estableciendo el gate de aprobación conjunto de QA y Seguridad.
  - Publicación del **ADR-011** en `.agents-team/DECISIONS.md`.
  - Registro de hallazgos de seguridad `SEC-001` a `SEC-005` y estado de trazabilidad en `.agents-team/BOARD.md`.

---

## [v1.5.2] - 2026-11-21
### Añadido y Mejorado
- **Navegación Temporal con Flechas en Gráficos del Dashboard (`FinancialCharts`)**:
  - Controles de desplazamiento temporal (`←` y `→`) para mover la ventana hacia el pasado o hacia el presente paso a paso.
  - Indicador dinámico de rango de fechas civiles en español con badge de `Histórico` cuando la vista está en el pasado.
  - Botón de acceso rápido `Ir a Actual` para regresar con un solo toque al período presente cuando `offset > 0`.
- **Cantidad de Ventana Configurable**:
  - Valores predeterminados actualizados: `Semanas = 4` (reducido de 8), `Meses = 6` (configurable de `1` a `24`).
  - Capacidad de aislar `1 mes` histórico para analizar cualquier mes individual (ej. Mayo 2026) tanto en barras como en la dona de categorías.
  - Presets rápidos y stepper `[-] [cantidad] [+]` con validación de límites.
- **Cuota de Manejo y Modalidades de Cobro en Tarjetas de Crédito**:
  - Configuración decimal en COP (`management_fee NUMERIC(12,2)`) y modalidades (`fixed_monthly` e.g. Nu $12,000 COP, `only_on_use`, `exempt_if_used`, `exempt`).
  - Motor puro de evaluación `evaluateManagementFee()` y campos descriptivos en `AccountForm`, `CreditCardsClientView` y `AccountsClientView`.
- **Pulido de Ergonomía Móvil y UX Táctil**:
  - Viewport estable con `initialScale: 1`, `maximumScale: 1`, `userScalable: false`, `viewportFit: "cover"`.
  - Bloqueo de auto-zoom agresivo de iOS Safari mediante tamaño de fuente mínimo de 16px en inputs móviles.
  - Eliminación de desplazamiento lateral indeseado (`overflow-x: hidden; overscroll-behavior-x: none`).
  - Restricción de selección de texto en la interfaz visual (`user-select: none`) permitiendo copiar, pegar y editar libremente en `input`, `textarea` y elementos editables.

---

## [v1.5.1] - 2026-11-21
### Correcciones (Hotfix de Estabilidad en Safari / iOS)
- **Blindaje Defensivo contra `undefined is not an object (evaluating 's.success')`**:
  - Corrección de validación en `TransactionForm` y modales del flujo SMS (`Paso 2 de 2`), verificando defensivamente `if (!result || typeof result !== "object" || !result.success)` antes de acceder a propiedades de respuesta.
  - Aislamiento de llamadas de revalidación (`revalidatePath`) en `transaction-actions.ts` dentro de bloques `try...catch` independientes, garantizando que un fallo o advertencia de caché en Server Components nunca aborte el retorno de `{ success: true, data: ... }` al cliente.
  - Sanitización de mensajes de error de tiempo de ejecución para evitar que TypeErrors crípticos de WebKit/Safari se muestren al usuario en banners de error.
  - Preservación total e intacta de los datos ya parseados del SMS (`monto`, `fecha`, `cuenta`, `tipo`, `categoría`, `descripción` y `notas`) en caso de errores de red o sesión, permitiendo reintentar la confirmación sin pérdida de información.
  - Aplicación extensiva de comprobaciones defensivas en formularios y vistas de clientes (`AccountForm`, `PayStatementDialog`, `CategoriesClientView`, `CreditCardsClientView`, `AccountsClientView`, `TransactionsClientView`, `NotificationBell`, `WelcomeHubDashboard`).

---

## [v1.5.0] - 2026-11-20
### Añadido
- **Campo de Micro-trazos Dinámico estilo Antigravity (`InteractiveDotField`)**:
  - Reemplazo de círculos estáticos por micro-trazos/cápsulas dinámicas con orientación fluida y longitud adaptable (`6-12px`).
  - Modulación cromática contextual (`calculateChromaticColor`) con gradientes espaciales entre tonos fríos (índigo/violeta/celeste) y cálidos (ámbar/dorado/coral) calibrados para Modo Claro y Modo Oscuro.
  - Atenuación y despeje en la zona central (`calculateCenterAttenuation`) para garantizar legibilidad óptima sobre cifras y tarjetas financieras en COP sin ruido visual.
  - Flujo ambiental continuo con ondas senoidales multicapa que nunca se congela al estar inactivo el cursor.
  - Aura de interacción elástica de 240px con caída cúbica suave y alineación tangencial al movimiento.
  - Soporte táctil optimizado para móviles con menor densidad de trazos, `max-devicePixelRatio: 2`, interacción activa solo al tocar y retorno gradual a la deriva ambiental.
  - Accesibilidad estricta con `prefers-reduced-motion: reduce` y pausa del ciclo `requestAnimationFrame` cuando la pestaña está oculta (`document.hidden`).
- **Asistente SMS de Nueva Transacción en 2 Pasos (`SmsTransactionWizard`)**:
  - Paso 1: Checkbox accesible para decidir opcionalmente si se incluye el texto original completo del SMS en el campo de Notas u Observaciones del Paso 2.
  - Paso 2: Limpieza de valores automáticos en Descripción y Categoría (`""`) para que el usuario escriba su propio concepto sin tener que borrar texto precargado.
  - Foco inteligente automático en Cuenta si no se detectó correspondencia, o en Descripción si la cuenta fue identificada exitosamente.
- **Normalización Bancaria Robusta en el Parser de SMS (`sms-transaction-parser`)**:
  - Soporte de pagos recibidos / abonos a cuentas de ahorros (`income`) con formatos invertidos de fecha y hora (`el 10:17 a las 19/11/2026`).
  - Soporte para formatos europeos/mixtos con puntos de miles y comas decimales (ej. `$164.000,00`).
  - Filtro y sanitización estricta de líneas de soporte telefónico bancario (`604...`, `018000...`) previniendo falsos positivos en números de cuenta.
  - Retorno garantizado de `suggestedDescription: ""`.

---

## [v1.4.0] - 2026-11-18
### Añadido
- Visualización elegante y sutil de la versión actual (`v1.4.0`) en la tarjeta inferior de seguridad del Sidebar.
- Filtros avanzados de búsqueda multi-palabra con etiquetas interactivas (*tags*) en Transacciones.
- Selección múltiple mediante casillas (*checkboxes*) tanto en cuentas como en categorías.
- Persistencia del estado colapsable en la sección de "Totales por Categoría" mediante `localStorage`.
- Filtrado reactivo independiente por tipo (Gastos / Ingresos / Ambos) en el desglose de categorías.

### Mejoras
- Corrección integral de contrastes en el **Modo Día (Tema Claro)** para botones "Limpiar filtros", variantes `outline` y `secondary`, y textos descriptivos.
- Unificación de categorías base en los filtros de transacciones por nombre sin distinción de tipo.
- Iconos de transacciones de gasto estilizados en color rojo atmosférico (`#F43F5E`) de manera consistente con los montos.
- Establecimiento y formalización del Protocolo Obligatorio Anti-Corrupción de Chunks en el pipeline de QA.

### Correcciones
- Corrección de visibilidad en botones secundarios de modales y estados vacíos en tema claro.
- Solución definitiva al scroll vertical excesivo en la vista de transacciones.
- Corrección de capas de apilamiento (*z-index*) y parpadeos en los menús desplegables flotantes.
