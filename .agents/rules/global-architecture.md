
---
trigger: always_on
description: "Arquitectura global, convenciones, seguridad y estándares técnicos del sistema de finanzas personales."
---

# GLOBAL ARCHITECTURE RULES

## 1. IDENTIDAD DEL PROYECTO

Sistema Web de Finanzas Personales y Control de Tarjetas de Crédito.

El objetivo es construir una aplicación segura para administrar:
- Cuentas bancarias y efectivo.
- Tarjetas de crédito.
- Ingresos y gastos.
- Categorías.
- Compras diferidas y cuotas.
- Fechas de corte y fechas límite de pago.
- Proyecciones financieras.
- Dashboard y reportes.

## 2. STACK OBLIGATORIO

- Next.js con App Router.
- React.
- TypeScript con strict: true.
- Tailwind CSS.
- Shadcn/UI.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Row Level Security (RLS).
- Zod para validaciones.
- Recharts para visualizaciones.
- Vitest para pruebas unitarias.
- PWA mediante Web App Manifest y Service Worker.

No introducir frameworks alternativos sin autorización.

## 3. TYPESCRIPT

- PROHIBIDO utilizar `any`.
- PROHIBIDO utilizar `@ts-ignore`.
- Evitar `@ts-expect-error`; si resulta imprescindible, justificarlo.
- Usar `unknown` cuando el tipo sea desconocido.
- Validar datos externos con Zod antes de utilizarlos.
- Definir tipos explícitos para parámetros y retornos.
- Preferir interfaces para contratos de objetos.
- Usar type para uniones y tipos derivados.
- No duplicar tipos que puedan generarse desde Supabase.

## 4. DINERO Y PRECISIÓN

- PostgreSQL: NUMERIC(12,2) para valores monetarios.
- Nunca utilizar FLOAT o REAL para almacenar dinero.
- En JavaScript no realizar cálculos monetarios críticos con operaciones directas de Number.
- Utilizar una librería decimal como decimal.js o dinero.js.
- Las operaciones de dinero deben redondearse a dos decimales según una política explícita.
- Las cuotas deben distribuir los centavos restantes sin perder ni crear dinero.
- Todos los importes se almacenan como valores positivos; el tipo de transacción determina su significado.
- La moneda inicial del proyecto es COP.

## 5. CONVENCIONES DE NOMBRES

Base de datos:
- snake_case.
- Tablas en plural.
- Columnas en snake_case.
- Primary keys: id.
- Foreign keys: entidad_id.

TypeScript:
- camelCase para variables y funciones.
- PascalCase para componentes, clases e interfaces.
- UPPER_SNAKE_CASE para constantes globales.
- Archivos de componentes en PascalCase.
- Hooks con prefijo use.

Funciones:
- Nombres descriptivos y orientados a acciones.
- No utilizar abreviaciones ambiguas.

## 6. ESTRUCTURA DE CARPETAS

src/
  app/
    (auth)/
    (dashboard)/
    api/
  components/
    ui/
    layout/
    shared/
  features/
    accounts/
    categories/
    transactions/
    credit-cards/
    dashboard/
  lib/
    supabase/
    validations/
    finance/
    utils/
  hooks/
  types/

database/
  migrations/

tests/
  unit/
  integration/

## 7. NEXT.JS Y BACKEND

- Utilizar Server Components por defecto.
- Utilizar Client Components solamente cuando sean necesarios.
- Las mutaciones deben ejecutarse en el servidor.
- Usar Server Actions para operaciones de formularios y CRUD.
- Validar todos los inputs en el servidor con Zod.
- Nunca confiar en user_id enviado desde el cliente.
- Obtener el usuario desde la sesión autenticada.
- Utilizar el cliente Supabase adecuado para cada contexto.
- Nunca exponer SUPABASE_SERVICE_ROLE_KEY al navegador.
- No acceder directamente a la base de datos desde componentes visuales.

## 8. SEGURIDAD

- Toda tabla con información privada debe tener RLS habilitado.
- Cada consulta debe respetar la identidad autenticada.
- Nunca utilizar políticas USING (true) para tablas privadas.
- Las operaciones INSERT deben validar WITH CHECK.
- Las operaciones UPDATE deben validar USING y WITH CHECK.
- Las relaciones deben comprobar pertenencia al mismo usuario.
- No confiar exclusivamente en validaciones frontend.
- No almacenar secretos en Git.
- No utilizar service_role en el cliente.

## 9. MANEJO DE ERRORES

- No silenciar excepciones.
- Evitar bloques catch vacíos.
- Utilizar respuestas estructuradas:
  { success: true, data: ... }
  { success: false, error: ... }
- Los errores esperados deben tener mensajes comprensibles.
- Los errores internos no deben revelar información sensible.
- Registrar errores de forma útil para depuración.
- No exponer SQL, tokens o secretos al usuario.

## 10. ARQUITECTURA FINANCIERA

- Separar cálculos financieros de componentes React.
- La lógica de tarjetas debe vivir en src/lib/finance/.
- Las fechas deben manejarse sin depender de UTC accidentalmente.
- La zona horaria de negocio será America/Bogota.
- Usar fechas ISO YYYY-MM-DD para fechas civiles.
- No calcular fechas de corte con aproximaciones de 30 días.
- Utilizar el calendario real de cada mes.
- Las cuotas deben conservar exactamente el valor total de la compra.
- Una compra diferida no debe contabilizarse como gasto completo y además sumar sus cuotas como gastos independientes.

## 11. COORDINACIÓN MULTIAGENTE

El equipo está compuesto por 5 agentes especializados:
1. `01-db-agent`: PostgreSQL, RLS, esquemas, tipos y migraciones.
2. `02-backend-agent`: Server Actions, lógica financiera, Zod y Supabase SSR.
3. `03-frontend-agent`: Interfaz de usuario, App Router, Shadcn/UI, Tailwind y PWA.
4. `04-qa-verifier-agent`: Compilación, pruebas unitarias Vitest, linter y gate final de aprobación.
5. `05-security-agent`: AppSec, OWASP Top 10, auditoría de RLS, autenticación, cabeceras y seguridad financiera.

Antes de modificar archivos:

1. Leer .agents-team/CONTEXT.md.
2. Leer .agents-team/BOARD.md.
3. Identificar el rol asignado.
4. Revisar los contratos de los agentes anteriores.
5. Evitar sobrescribir trabajo ajeno.

Después de modificar archivos:

1. Ejecutar las verificaciones correspondientes.
2. Actualizar BOARD.md.
3. Documentar archivos creados y modificados.
4. Documentar funciones y contratos públicos.
5. Registrar errores conocidos.
6. Indicar explícitamente si el siguiente agente puede comenzar.

## 12. REGLA DE CALIDAD

No declarar una tarea terminada únicamente porque el código fue escrito.

Una tarea se considera terminada cuando:
- Compila.
- Pasa las validaciones de tipos aplicables.
- Tiene pruebas cuando corresponde.
- Respeta los contratos.
- Respeta RLS y seguridad auditada.
- Está documentada en BOARD.md.

El agente QA y el Security Agent tienen la responsabilidad conjunta de auditar y verificar
el resultado completo antes de su liberación.