
# ARCHITECTURE DECISION RECORDS

## ADR-001: Monetary precision

Decision: Store monetary values as NUMERIC(12,2).
Application calculations use decimal arithmetic.

## ADR-002: Installment storage

Decision: Store each installment purchase as one transaction.
Generate installment schedules dynamically.

## ADR-003: Calendar timezone

Decision: America/Bogota.
Civil dates use YYYY-MM-DD.

## ADR-004: Credit card accounting

Decision: Card purchases increase outstanding debt.
Card payments are transfers, not income.

Status: Transfer functionality is pending implementation.

## ADR-005: Security

Decision: Supabase RLS is mandatory.
All user-owned records must be isolated.

## ADR-006: Initial scope

Decision: First release includes:
- Authentication.
- Accounts.
- Categories.
- Transactions.
- Credit cards.
- Installments.
- Monthly projections.
- Dashboard.

Future features must not be introduced without approval.

## ADR-007: SMS & Push Notification Parser for Pre-filling Transactions

Date: 2026-11-20
Status: ACCEPTED

Problem: Users need a quick, safe method to record transactions from bank SMS or push notifications without paying for bank aggregation APIs, exposing banking credentials, or losing monetary precision.

Decision: Implement a pure, deterministic TypeScript module (`src/lib/sms-transaction-parser.ts`) validated with Zod (`SmsParseResultSchema`).
- Amount is normalized to two decimal places matching PostgreSQL `NUMERIC(12,2)` using Decimal.js with standard `ROUND_HALF_UP` banking rounding.
- Civil dates are normalized to `YYYY-MM-DD` in `America/Bogota`.
- Phone numbers (such as `018000...` and Colombian mobile lines) are sanitized to prevent false matches.
- Direction (`expense` vs `income`) is inferred from Colombian banking semantics (Bancolombia, Nequi, BBVA, Nu, Davivienda, etc.).
- Safe fallback with `confidence: 'high' | 'partial' | 'none'` and descriptive warnings. Zero unhandled exceptions.

Consequences:
- Zero external subscription/API fees.
- Completely offline and secure; no bank credentials handled.
- Serves as the domain engine for the upcoming frontend SMS paste interface.

Affected agents: BACKEND, FRONTEND, QA.

## ADR-008: Credit Card Management Fee Modalities and Precision

Date: 2026-11-21
Status: ACCEPTED

Problem: Users in Colombia manage various credit cards with differing management fee rules: fixed monthly charges (Nu, Bancolombia, etc. regardless of usage), conditional charges (only if the card was used or carries a balance), or exemption rules (exempt if used, or fully exempt / no fee). The system needed to capture exact decimal fee amounts and enforce billing rules without floating-point errors or security regressions.

Decision:
1. Extend `public.accounts` with:
   - `management_fee NUMERIC(12,2)`: Non-negative monetary amount in COP, defaulting to 0.00 for credit cards, strictly NULL for bank/cash accounts.
   - `management_fee_type TEXT`: Constrained via CHECK constraint `accounts_management_fee_rules` to:
     - `fixed_monthly`: Cobro mensual fijo (se cobra todos los meses, se use o no la tarjeta; ej. Nu $12.000 COP).
     - `only_on_use`: Cobro condicionado a uso (solo si se registra compras o saldo adeudado en el ciclo).
     - `exempt_if_used`: Exenta si se usa (sin cobro si se registra consumo en el mes).
     - `exempt`: Exenta permanente / Sin cuota de manejo ($0.00).
2. Domain Logic:
   - Encapsulated in `src/lib/finance/management-fee.ts` via `evaluateManagementFee()` using pure decimal arithmetic and zero React/Next.js dependencies.
3. RLS and Security:
   - RLS remains active and isolated by `user_id = (SELECT auth.uid())`.
   - Recreated `public.credit_card_balance_summary` view with `WITH (security_invoker = true)` including fee fields.

Consequences:
- Supports realistic Colombian banking scenarios.
- Zero floating-point rounding issues.
- Full backwards compatibility with existing cards (defaulting to 0 and exempt).

Affected agents: DB, BACKEND, FRONTEND, QA.

## ADR-009: Flexible Credit Card Statement Payments and Payment Reversal

Date: 2026-11-21
Status: ACCEPTED

Problem: Credit card statements could previously only be marked as paid in full or overwrite `total_amount`. Users need to execute flexible payments (minimum payment including management fee, full balance, or custom partial amount capped at card debt), select an origin savings/checking/cash account with sufficient balance, and securely revert accidental payments restoring debts and account balances.

Decision:
1. Database Schema (`public.credit_card_statements`):
   - Added `paid_amount NUMERIC(12,2)` (actual amount paid in COP).
   - Added `payment_type TEXT` with CHECK constraint `payment_type IN ('minimum', 'full', 'custom')`.
   - Added `minimum_payment NUMERIC(12,2)` (suggested minimum payment for audit).
   - Added `payment_account_id UUID REFERENCES public.accounts(user_id, id) ON DELETE SET NULL`.
   - Added `payment_transaction_id UUID REFERENCES public.transactions(user_id, id) ON DELETE SET NULL`.
   - CHECK constraint `statements_payment_rules`: enforces valid payment details when `is_paid = true` and cleans them when `is_paid = false`.
2. Balance Recalculation & Views:
   - Updated `public.recalculate_account_balance(UUID)` and `public.credit_card_balance_summary` to deduct `COALESCE(paid_amount, total_amount)`.
   - Updated trigger `trg_sync_account_balance_on_statement` to track `paid_amount`.
3. Financial Engine & Server Actions:
   - Pure engine in `src/lib/finance/statement-payments.ts` calculating minimum (period total + management fee if applicable), full (card debt), and custom (capped at total card debt).
   - Server Action `markExtractAsPaid` validates sufficient balance on the origin account, records payment, and links the debit transaction.
   - Server Action `revertStatementPayment` safely reimburses the origin account, restores card debt, unmarks statement transactions, and marks statement as unpaid.

Consequences:
- Exact decimal precision in COP.
- Safe payment reversal with zero orphaned transactions or balance corruption.
- Complete audit trail of payment origin and modalities.

Affected agents: DB, BACKEND, FRONTEND, QA.

## ADR-010: 4x1000 (GMF) Tax Support by Account and Transaction Traceability

Date: 2026-11-21
Status: ACCEPTED

Problem: In Colombia, certain bank savings accounts (e.g. Nu savings accounts) are subject to the 4x1000 (GMF - Gravamen a los Movimientos Financieros) tax of 0.4% on debits/expenses, while other accounts (like a designated exempt account in Bancolombia, Nequi up to legal monthly limits, or credit cards) are exempt. Users need to configure this per bank account and have debits and outgoing transfers automatically calculate and account for the 4x1000 tax without losing cents, while recording a clear visual and financial audit breakdown.

Decision:
1. Database Schema (`public.accounts` & `public.transactions`):
   - Added `has_four_per_thousand BOOLEAN NOT NULL DEFAULT FALSE` to `public.accounts` with CHECK constraint `accounts_four_per_thousand_rules` (strictly restricted to `account_type = 'bank'`).
   - Added `four_per_thousand_amount NUMERIC(12,2)` and `is_four_per_thousand_applied BOOLEAN NOT NULL DEFAULT FALSE` to `public.transactions` with CHECK constraint `transactions_four_per_thousand_rules`.
   - Partial composite indexes for fast audit and aggregation.
2. Domain Logic & Financial Calculations:
   - Pure decimal module `src/lib/finance/four-per-thousand.ts` using Decimal.js with standard `ROUND_HALF_UP` rounding.
   - `FOUR_PER_THOUSAND_RATE = 0.004` (0.4% or 4 per 1,000 COP).
   - Invariant: `transactions.amount = baseAmount + fourPerThousandAmount` so that the account balance and database balance recalculation function `recalculate_account_balance(UUID)` seamlessly reflect the real debited bank balance down to the exact cent.
3. User Interface:
   - Checkbox toggle in `AccountForm.tsx` for bank accounts to mark as taxed or exempt.
   - Live breakdown preview card in `TransactionForm.tsx` displaying Base, 4x1000 and Total debited.
   - Distinctive `4X1000` badge beside transaction titles in `TransactionsClientView.tsx` with secondary breakdown `Base: $X · 4x1000: $Y`.
   - Subtle ` · 4x1000` tag in `DashboardRecentTransactions.tsx`.

Consequences:
- 100% exact reconciliation between bank statements and registered movements in COP.
- Zero floating-point drift or cent distortion.
- Fully backward-compatible: all existing accounts default to `has_four_per_thousand = false`.

Affected agents: DB, BACKEND, FRONTEND, QA.

## ADR-011: Incorporación del Security Agent (05-security-agent) para Auditoría Continua y AppSec Financiera

Date: 2026-11-21
Status: ACCEPTED

Problem: Como sistema de gestión financiera personal que administra balances bancarios reales, tarjetas de crédito, deudas, transacciones y credenciales de usuario, el proyecto requiere una auditoría técnica especializada e independiente de los agentes de implementación (DB, Backend, Frontend) y complementaria al QA Verifier. Se requiere vigilar continuamente el cumplimiento de OWASP Top 10, políticas de contraseñas, RLS en Supabase, cabeceras de seguridad HTTP, cadena de suministro (`npm audit`) y resiliencia ante manipulación de datos o prompt injection.

Decision:
1. Crear formalmente el agente `05-security-agent` con su especificación en `.agents/skills/05-security-agent/SKILL.md`.
2. Actualizar las reglas de arquitectura global (`.agents/rules/global-architecture.md`) y el tablero de coordinación (`.agents-team/BOARD.md`) integrando el rol `SECURITY`.
3. Establecer los 5 dominios obligatorios de auditoría:
   - Dominio 1: OWASP Top 10, Aislamiento RLS e IDOR/BOLA.
   - Dominio 2: Autenticación, Fuerza Bruta y Políticas de Contraseñas (OWASP ASVS).
   - Dominio 3: Dependencias y Cadena de Suministro (`npm audit`).
   - Dominio 4: Cabeceras de Seguridad HTTP (CSP, HSTS, X-Frame-Options, etc.) y Superficie de Red.
   - Dominio 5: Resiliencia ante Inyección de Entradas Externas (SMS bancarios).
4. Establecer una matriz de severidad estandarizada (Crítico, Alto, Medio, Bajo) con reporte estructurado y remediación concreta.

Consequences:
- Auditoría continua de seguridad antes de cada entrega o promoción a producción.
- Protección reforzada de la privacidad y los activos financieros de los usuarios.
- Identificación proactiva de vectores de ataque como Open Redirects, escalamiento de privilegios o cabeceras faltantes.

Affected agents: DB, BACKEND, FRONTEND, QA, SECURITY.

## CHANGE LOG

New architectural decisions must include:
- ID.
- Date.
- Problem.
- Decision.
- Consequences.
- Affected agents.