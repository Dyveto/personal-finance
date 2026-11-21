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
