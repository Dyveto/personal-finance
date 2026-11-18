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
