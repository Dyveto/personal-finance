
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

## CHANGE LOG

New architectural decisions must include:
- ID.
- Date.
- Problem.
- Decision.
- Consequences.
- Affected agents.