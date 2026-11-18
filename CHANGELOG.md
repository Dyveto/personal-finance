# Historial de Versiones (Changelog)

Todas las modificaciones notables de este sistema de finanzas personales serán registradas en este archivo. El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.0.html).

## [v1.4.0] - 2026-06-07
### Añadido
- Filtros avanzados de búsqueda multi-palabra con etiquetas interactivas (*tags*).
- Selección múltiple mediante casillas (*checkboxes*) tanto en cuentas como en categorías.
- Persistencia del estado colapsable en la sección de "Totales por Categoría" mediante `localStorage`.
- Filtrado reactivo independiente por tipo (Gastos / Ingresos / Ambos) en el desglose de categorías.

### Mejoras
- Corrección profunda de contrastes en el **Modo Día (Tema Claro)** para garantizar legibilidad total.
- Unificación de categorías base en los filtros de transacciones.
- Iconos de transacciones de gasto estilizados en rojo de manera consistente.
- Limpieza de caché automática y blindaje de compilación estricta en el pipeline de QA.

### Correcciones
- Solución definitiva al scroll vertical excesivo en la vista de transacciones.
- Corrección de capas (*z-index*) y parpadeos en los menús desplegables flotantes.