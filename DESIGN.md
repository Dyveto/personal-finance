# Design System & UI/UX Architecture (DESIGN.md)

Este documento define la guía visual, tipográfica y de interacción aprobada para el sistema de finanzas personales. Su cumplimiento es obligatorio para el **Frontend Agent**.

## 1. Tipografía (Jerarquía y Pesos)
*Se prohíben estrictamente tipografías genéricas (Inter, Roboto, Arial, System Default).*
- **Tipografía Principal (Display & Títulos):** `Plus Jakarta Sans` o `Cabinet Grotesk` (Estimación basada en estilos modernos de alta gama).
- **Tipografía Secundaria (Cuerpo y Datos):** `Outfit` o `Space Grotesk`.
- **Jerarquía:**
  - **H1 (Título de Página / Balance Principal):** `font-size: 2.5rem;` (40px), `font-weight: 700;` (Bold), `line-height: 1.1;`
  - **H2 (Secciones / Tarjetas):** `font-size: 1.5rem;` (24px), `font-weight: 600;` (SemiBold).
  - **Body (Textos descriptivos):** `font-size: 0.9375rem;` (15px), `font-weight: 400;` (Regular).
  - **Caption / Etiquetas Financieras:** `font-size: 0.8125rem;` (13px), `font-weight: 500;` (Medium), `letter-spacing: 0.05em;`

## 2. Paleta de Colores (HEX Codes)
*Prohibido usar degradados morados sobre fondo blanco.* Se prioriza una atmósfera oscura, profunda y sofisticada mediante contrastes marcados.
- **Fondo General (Atmósfera y Profundidad):** `#0B0F19` (Azul medianoche profundo con superposiciones de iluminación CSS radiales).
- **Superficies / Tarjetas (Cards sin sombras genéricas):** `#131B2E` con borde sutil de separación (`1px solid rgba(255, 255, 255, 0.08)`).
- **Acento Primario (Vibrante / Acciones Clave):** `#8B5CF6` (Violeta eléctrico puro para elementos interactivos destacados).
- **Color de Éxito / Ingresos:** `#10B981` (Esmeralda profundo).
- **Color de Alerta / Gastos / Deuda:** `#F43F5E` (Rosa coral / carmesí).
- **Texto Principal:** `#F8FAFC` (Blanco pizarra).
- **Texto Secundario / Inactivo:** `#94A3B8` (Gris pizarra medio).

## 3. Espaciado y Radios de Borde (Border-Radius)
- **Sistema de Espaciado (Grid / Padding / Gap):** Basado en escala de 4px (`p-2 = 8px`, `p-4 = 16px`, `p-6 = 24px`, `p-8 = 32px`).
- **Radios de Borde (Estructuras modulares):**
  - **Tarjetas Principales y Contenedores (Cards):** `border-radius: 1rem;` (16px).
  - **Botones e Inputs:** `border-radius: 0.75rem;` (12px).
  - **Badges y Etiquetas Pequeñas:** `border-radius: 9999px;` (Píldora completa).

## 4. Animaciones y Micro-interacciones
- **Revelados Escalonados:** Uso obligatorio de retardos en cascada (`animation-delay: 100ms`, `200ms`, `300ms`) para tarjetas y gráficos en la carga inicial del Dashboard.
- **Transiciones:** `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);` para efectos hover fluidos sin saltos bruscos.
- **Widgets Editables (Drag & Drop):** Soporte estructurado para reorganizar paneles del dashboard de acuerdo con las prioridades del usuario y el tamaño del viewport.
