# Personal Finance System 💳📊

Sistema Web de Finanzas Personales, Contabilidad y Control de Tarjetas de Crédito de alta precisión, construido con **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Shadcn/UI**, **Supabase** y **Vitest**.

El sistema está diseñado específicamente bajo las reglas fiscales y financieras de Colombia (**Moneda COP** y zona horaria **`America/Bogota`**), garantizando exactitud matemática en compras diferidas a cuotas, manejo de fechas de corte/pago y aislamiento estricto de datos por usuario mediante **Row Level Security (RLS)**.

---

## 🚀 Características Principales

- **Gestión Integral de Cuentas**:
  - Billeteras de efectivo (`cash`), cuentas de ahorro/corriente (`bank`) y tarjetas de crédito (`credit_card`).
  - Monitoreo en tiempo real de saldo disponible vs. deuda acumulada.
- **Control de Tarjetas de Crédito**:
  - Configuración de cupo total aprobado, día de corte y día límite de pago.
  - Proyección de cuotas futuras agrupadas por mes de corte (`YYYY-MM`) y fecha límite de pago.
  - **Invariante de Base de Datos**: Las compras diferidas se almacenan como una única transacción y se proyectan dinámicamente sin duplicar registros ficticios.
- **Motor Financiero y Precisión Decimal**:
  - Cálculos con `decimal.js` (28 dígitos de precisión y redondeo `ROUND_HALF_UP`).
  - Distribución exacta de centavos residuales a la primera cuota: $\sum(\text{cuotas}) \equiv \text{monto total}$.
  - Manejo de fechas civiles sin desfases por conversiones UTC.
- **Visualización y Reportes**:
  - Gráficos interactivos con **Recharts** (Flujo mensual de ingresos vs. gastos y distribución porcentual por categorías).
  - Formateo estándar en Pesos Colombianos (`$ 1.250.000,00 COP`).
- **Seguridad y Autenticación**:
  - Middleware de protección de rutas en el Edge con `@supabase/ssr`.
  - Autenticación segura mediante correo/contraseña con Supabase Auth.
  - Políticas RLS estrictas en PostgreSQL (`user_id = auth.uid()`).
- **Progressive Web App (PWA)**:
  - Manifiesto nativo Web App (`src/app/manifest.ts`) preparado para instalación en dispositivos móviles y de escritorio.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Propósito |
| :--- | :--- | :--- |
| **Framework** | Next.js 14+ (App Router) | Server Components, Server Actions y Edge Middleware |
| **Lenguaje** | TypeScript (`strict: true`) | Tipado estricto sin `any` ni `@ts-ignore` |
| **Estilos & UI** | Tailwind CSS + Shadcn/UI | Interfaz moderna, accesible y soporte de tema oscuro |
| **Base de Datos** | Supabase PostgreSQL | Base de datos relacional con RLS, triggers e índices |
| **Autenticación** | Supabase Auth + `@supabase/ssr` | Manejo de sesiones y tokens seguros en cookies httpOnly |
| **Validación** | Zod | Esquemas estrictos de validación en cliente y servidor |
| **Matemática Financiera** | Decimal.js | Operaciones monetarias sin errores de punto flotante |
| **Gráficos** | Recharts & Lucide React | Visualización de datos interactiva y responsive |
| **Testing** | Vitest | Pruebas unitarias de lógica financiera, validaciones y acciones |
| **PWA** | Web App Manifest | Experiencia instalable en navegadores y móviles |

---

## 📁 Estructura del Proyecto

```text
├── .agents/                 # Reglas de arquitectura y manuales de habilidades
│   ├── rules/               # global-architecture.md (reglas inmutables del proyecto)
│   └── skills/              # Roles de agentes especializados (DB, Backend, Frontend, QA)
├── .agents-team/            # Coordinación multi-agente
│   ├── CONTEXT.md           # Contexto global y objetivos
│   ├── BOARD.md             # Tablero de tareas, entregables y registro de auditorías
│   └── DECISIONS.md         # Registro de decisiones arquitectónicas (ADRs)
├── database/
│   └── migrations/          # Migraciones SQL reproducibles para Supabase
├── public/                  # Assets estáticos y recursos PWA
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Rutas públicas de autenticación (/login, /signup)
│   │   ├── (dashboard)/     # Rutas protegidas (/, /accounts, /credit-cards, /transactions)
│   │   ├── layout.tsx       # Root layout con proveedores y fuentes
│   │   ├── manifest.ts      # Generador del Web App Manifest PWA
│   │   └── globals.css      # Tokens de diseño y variables CSS
│   ├── components/
│   │   ├── layout/          # Sidebar, Header y navegación responsive
│   │   └── ui/              # Componentes base Shadcn/UI (Button, Card, Dialog, Input, etc.)
│   ├── features/            # Módulos organizados por dominio de negocio
│   │   ├── accounts/        # Acciones, componentes y vistas de cuentas
│   │   ├── auth/            # Server actions de signIn, signUp, signOut
│   │   ├── categories/      # Acciones de categorías de ingresos/gastos
│   │   ├── dashboard/       # Gráficos Recharts y tarjetas de proyecciones
│   │   └── transactions/    # Formularios y vistas de movimientos y compras diferidas
│   ├── lib/
│   │   ├── finance/         # Motor financiero puro (money.ts, calendar.ts, projections.ts)
│   │   ├── supabase/        # Clientes Supabase para Server Actions, Client y Edge
│   │   ├── validations/     # Esquemas Zod para finanzas y autenticación
│   │   └── utils/           # Utilidades de Tailwind y clases condicionales
│   ├── types/               # Tipos generados de Supabase y contratos de Server Actions
│   └── middleware.ts        # Middleware de protección de rutas y actualización de sesión
└── tests/
    └── unit/                # Pruebas unitarias (smoke, finance, validations, actions, auth)
```

---

## 🤖 Arquitectura Multi-Agente

El desarrollo y mantenimiento del proyecto sigue un flujo estructurado de roles especializados:

1. **`01-db-agent` (Database Engineer)**:
   - Diseña esquemas SQL relacionales, claves foráneas, restricciones de montos positivos y políticas RLS.
   - Mantiene los tipos de TypeScript sincronizados desde Supabase (`src/types/database.types.ts`).
2. **`02-backend-agent` (Backend Engineer)**:
   - Implementa Server Actions tipadas (`ActionResult<T>`) y validaciones Zod estrictas.
   - Extrae el usuario autenticado desde el servidor (`supabase.auth.getUser()`), rechazando `user_id` enviado desde el cliente.
   - Desarrolla la lógica financiera pura en `src/lib/finance/`.
3. **`03-frontend-agent` (Frontend Engineer)**:
   - Construye componentes responsivos y accesibles con React Server Components y Client Components optimizados.
   - Diseña dashboards interactivos con Recharts y formularios reactivos con React Hook Form.
4. **`04-qa-verifier-agent` (QA & Release Gate Authority)**:
   - Audita de manera independiente que cada entrega compile con código de salida `0`.
   - Verifica que las pruebas unitarias pasen al 100% y que las políticas de seguridad RLS se cumplan.

La trazabilidad completa de handoffs y acuerdos se documenta en [.agents-team/BOARD.md](.agents-team/BOARD.md).

---

## ⚙️ Configuración y Puesta en Marcha

### 1. Requisitos Previos

- **Node.js**: Versión `20.x` o superior.
- **NPM**: Versión `10.x` o superior.
- **Supabase CLI** (opcional, para migraciones locales o remotas):
  ```bash
  npm install -g supabase
  ```

### 2. Instalación de Dependencias

```bash
git clone https://github.com/Dyveto/personal-finance.git
cd personal-finance
npm install
```

### 3. Configuración de Variables de Entorno

Copia el archivo de ejemplo a `.env.local`:

```bash
cp .env.example .env.local
```

Configura las variables correspondientes a tu proyecto de Supabase:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-privada

# URL de conexión a PostgreSQL (opcional para migraciones CLI)
DATABASE_URL="postgresql://postgres:[TU-PASSWORD]@db.tu-proyecto.supabase.co:5432/postgres"

# Configuración del servidor
PORT=3000
NODE_ENV=development
```

> [!IMPORTANT]
> `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse en el cliente ni compartirse en repositorios públicos.

### 4. Aplicar Migraciones a Supabase

Para sincronizar las tablas y políticas RLS en Supabase:

```bash
npx supabase link --project-ref <TU_PROJECT_REF>
npx supabase db push
```

---

## 🌐 Despliegue en Netlify

El proyecto está preconfigurado para un despliegue continuo y sin fricción en **Netlify** mediante el archivo `netlify.toml`.

### Pasos Rápidos de Despliegue:

1. **Importar Proyecto**:
   - Conecta tu repositorio de GitHub (`personal-finance`) en el panel de Netlify.
2. **Detección Automática**:
   - Netlify leerá la configuración de `netlify.toml` automáticamente:
     - **Build command**: `npm run build`
     - **Publish directory**: `.next`
     - **Node version**: `20`
3. **Vincular Variables de Entorno de Supabase**:
   - Ve a **Site configuration** > **Environment variables** y añade las siguientes claves:
     - `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto de Supabase (ej. `https://<tu-id>.supabase.co`).
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Llave pública anónima (`anon` / `public`).
     - `SUPABASE_SERVICE_ROLE_KEY`: Llave de servicio privada (solo en contexto de servidor/funciones para Server Actions protegidas).
4. **Desplegar**:
   - Haz clic en **Deploy site**. Cada push a la rama principal o `develop` generará un despliegue optimizado con soporte completo para Server Components, Server Actions y middleware de autenticación.

---

## 🧪 Comandos y Scripts Disponibles

El proyecto cuenta con un conjunto de comandos estrictos de calidad integrados:

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo en `http://localhost:3000` con hot-reloading |
| `npm run build` | Genera la compilación optimizada para producción |
| `npm run start` | Inicia el servidor optimizado de producción |
| `npm run test:run` | Ejecuta la suite completa de 57 pruebas unitarias con Vitest (modo CI) |
| `npm run test` | Ejecuta Vitest en modo interactivo con recarga en caliente |
| `npm run lint` | Ejecuta el análisis estático de código con ESLint |
| `npx tsc --noEmit` | Verifica la integridad de tipos en TypeScript (`strict: true`) |

---

## 🔒 Reglas de Seguridad y Buenas Prácticas

1. **Aislamiento Total por RLS**: Ninguna consulta puede acceder a datos ajenos; PostgreSQL descarta cualquier acceso donde `user_id != auth.uid()`.
2. **Cero Confianza en el Cliente**: El `user_id` nunca se recibe ni se acepta en las mutaciones de Server Actions. Se deriva directamente de la sesión criptográfica del token de Supabase.
3. **Manejo de Moneda Positiva**: Todos los montos se almacenan estrictamente como valores positivos (`NUMERIC(12,2)`); el campo `transaction_type` (`income` o `expense`) define su naturaleza contable.
4. **Fechas Civiles**: Las operaciones de corte y pago se procesan con formato civil estándar `YYYY-MM-DD`, evitando que los husos horarios modifiquen el día de la transacción.

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT.
