# Personal Finance System 💳📊

Sistema Web de Finanzas Personales, Contabilidad y Control de Tarjetas de Crédito construido con **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Shadcn/UI**, **Supabase** y **Vitest**.

---

## 🚀 Tecnologías Principales

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript (`strict: true`)
- **Estilos**: Tailwind CSS & Shadcn/UI
- **Base de Datos & Auth**: Supabase PostgreSQL & Supabase Auth
- **Validación**: Zod
- **Precisión Financiera**: decimal.js (Cálculos monetarios de alta precisión en COP)
- **Visualización**: Recharts & Lucide Icons
- **Testing**: Vitest & React Testing Library
- **Calidad de Código**: ESLint & TypeScript ESLint

---

## 📁 Estructura del Proyecto

```text
├── .agents/             # Reglas arquitectónicas y habilidades de los agentes
│   ├── rules/
│   └── skills/
├── .agent/workflows/    # Flujos de trabajo paso a paso por agente
├── .agents-team/        # Coordinación del equipo (CONTEXT, BOARD, DECISIONS)
├── database/migrations/ # Migraciones SQL de Supabase
├── src/
│   ├── app/             # Rutas, layouts y páginas (Next.js App Router)
│   ├── components/      # Componentes UI (incluye Shadcn UI)
│   ├── features/        # Módulos organizados por dominio funcional
│   ├── hooks/           # Custom hooks de React
│   ├── lib/             # Clientes Supabase, utilidades y lógica financiera
│   └── types/           # Definiciones globales de TypeScript y tipos de DB
├── tests/unit/          # Pruebas unitarias con Vitest
└── public/              # Assets estáticos y manifiesto PWA
```

---

## 🤖 Arquitectura Multi-Agente

El proyecto está diseñado para ser desarrollado y auditado por un equipo de agentes especializados:

1. **`01-db-agent`**: Modelado relacional, esquemas SQL, RLS y migraciones en Supabase.
2. **`02-backend-agent`**: Server Actions, validaciones Zod, lógica financiera y cálculo de cuotas.
3. **`03-frontend-agent`**: Interfaces accesibles y responsivas en Shadcn/UI, dashboards y gráficos.
4. **`04-qa-verifier-agent`**: Auditoría de compilación, linters, pruebas unitarias y consistencia de negocio.

La coordinación y el estado del equipo se registran en:
- `.agents-team/CONTEXT.md`
- `.agents-team/BOARD.md`
- `.agents-team/DECISIONS.md`

---

## 🛠️ Instalación y Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/Dyveto/personal-finance.git
   cd personal-finance
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Variables de entorno**:
   Copia el archivo de plantilla y configura tus credenciales de Supabase:
   ```bash
   cp .env.example .env.local
   ```

4. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

---

## 🧪 Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo en `http://localhost:3000`.
- `npm run build`: Compila la aplicación para producción.
- `npm run start`: Inicia el servidor en producción.
- `npm run lint`: Ejecuta el análisis estático con ESLint.
- `npm run test`: Ejecuta Vitest en modo interactivo (watch).
- `npm run test:run`: Ejecuta la suite de pruebas unitarias una sola vez (modo CI/QA).
