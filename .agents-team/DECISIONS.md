
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

## CHANGE LOG

New architectural decisions must include:
- ID.
- Date.
- Problem.
- Decision.
- Consequences.
- Affected agents.