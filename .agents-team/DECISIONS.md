
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

## CHANGE LOG

New architectural decisions must include:
- ID.
- Date.
- Problem.
- Decision.
- Consequences.
- Affected agents.