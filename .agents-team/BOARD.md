
# MULTI-AGENT HANDOFF BOARD

Project: Personal Finance System
Version: 1.0
Coordinator: Main Agent / Human Owner
Final Authority: QA Agent

---

# 1. GLOBAL STATUS

Current phase: NOT STARTED

| Agent | Role | Status | Depends on |
|---|---|---|---|
| DB | Database and Supabase | PENDING | None |
| BACKEND | Server Actions and Finance | COMPLETED | DB |
| FRONTEND | UI and PWA | IN_PROGRESS | DB + BACKEND |
| QA | Testing and verification | BLOCKED | DB + BACKEND + FRONTEND |

Allowed statuses:

- PENDING
- IN_PROGRESS
- BLOCKED
- REVIEW_REQUIRED
- COMPLETED
- FAILED

---

# 2. SHARED RULES

1. Read CONTEXT.md before working.
2. Read this BOARD.md before working.
3. Never assume another agent has completed a task.
4. Never modify another agent's files without coordination.
5. Record all public interfaces and contracts.
6. Do not mark a task COMPLETED without verification.
7. Update this board before handing off work.
8. If blocked, describe the exact dependency.
9. If a contract changes, notify every dependent agent.
10. QA must verify the final repository state, not only the agent's own changes.

---

# 3. DATABASE AGENT

Status: PENDING

Responsibilities:

- Create Supabase migration.
- Implement tables.
- Implement constraints and indexes.
- Implement triggers.
- Implement RLS policies.
- Verify user isolation.
- Generate database.types.ts.
- Document Supabase setup.

Expected deliverables:

- database/migrations/*.sql
- src/types/database.types.ts
- Documentation of schema.
- RLS verification report.

Handoff:

Files created:
[To be completed]

Public contracts:
[To be completed]

Commands executed:
[To be completed]

Errors:
[None / Details]

Next agent:
BACKEND

---

# 4. BACKEND AGENT

Status: IN_PROGRESS

Responsibilities:

- [x] Implement Supabase server client (src/lib/supabase/server.ts, client.ts).
- [x] Implement Zod schemas (src/lib/validations/finance.ts).
- [x] Implement Server Actions for Accounts & Transactions (account-actions.ts, transaction-actions.ts).
- [x] Implement CRUD operations with user isolation.
- [x] Implement financial calculations (money.ts).
- [x] Implement credit card schedules and calendar rules (calendar.ts).
- [ ] Implement credit-card.ts, installments.ts and projections.ts.
- [x] Add Vitest tests for financial logic, validations and server actions.

Expected deliverables:

- src/lib/supabase/
- src/lib/validations/
- src/lib/finance/
- src/features/*/actions/
- tests/unit/

Handoff:

Files created:
- src/types/actions.ts
- src/lib/supabase/server.ts
- src/lib/supabase/client.ts
- src/lib/finance/money.ts
- src/lib/finance/calendar.ts
- src/lib/validations/finance.ts
- src/features/accounts/actions/account-actions.ts
- src/features/transactions/actions/transaction-actions.ts
- tests/unit/finance.test.ts
- tests/unit/validations.test.ts
- tests/unit/actions.test.ts

Public contracts:
- `actions.ts`:
  - `ActionResult<T> = { success: true, data: T } | { success: false, error: string, validationErrors?: Record<string, string[]> }`
- `validations/finance.ts`:
  - `CreateAccountSchema`, `StandardAccountSchema`, `CreditCardAccountSchema`
  - `CreateTransactionSchema`, `CreateInstallmentPurchaseSchema`
  - `CivilDateSchema`, `PositiveMoneySchema`, `NonNegativeMoneySchema`
- `account-actions.ts`:
  - `listAccounts(): Promise<ActionResult<AccountRow[]>>`
  - `getAccountById(accountId: string): Promise<ActionResult<AccountRow>>`
  - `createAccount(rawInput: unknown): Promise<ActionResult<AccountRow>>`
- `transaction-actions.ts`:
  - `listTransactions(filters?: ListTransactionsFilter): Promise<ActionResult<TransactionRow[]>>`
  - `createTransaction(rawInput: unknown): Promise<ActionResult<TransactionRow>>`
  - `createInstallmentPurchase(rawInput: unknown): Promise<ActionResult<{ transaction: TransactionRow, installments: string[] }>>`
- `money.ts`:
  - `roundMoney(amount: string | number | Decimal): string`
  - `splitInstallments(amount: string, installmentCount: number): string[]` (invariante sum(installments) === total garantizado)
  - `addMoney(...amounts: string[]): string`
  - `subtractMoney(minuend: string, subtrahend: string): string`
  - `multiplyMoney(amount: string, factor: string | number): string`
  - `compareMoney(a: string, b: string): number`
  - `isPositiveMoney(amount: string): boolean`
  - `formatMoneyCOP(amount: string | number | Decimal, options?): string`
- `calendar.ts`:
  - `isLeapYear(year: number): boolean`
  - `getDaysInMonth(year: number, month: number): number`
  - `parseCivilDate(dateStr: string): CivilDate`
  - `formatCivilDate(year: number, month: number, day: number): string`
  - `clampDayToMonth(year: number, month: number, targetDay: number): number`
  - `addMonths(year: number, month: number, monthsToAdd: number): { year: number; month: number }`
  - `calculateStatementClosingDate(purchaseDate: string, closingDay: number): string`
  - `calculatePaymentDueDate(closingDate: string, closingDay: number, paymentDueDay: number): string`

Commands executed:
- `npm run test:run` -> PASS (47 unit tests passing)
- `npx tsc --noEmit` -> PASS (0 type errors, strict: true)
- `npm run lint` -> PASS (0 lint warnings/errors)

Errors:
None.

Next agent:
BACKEND (projections.ts & installment schedules) -> FRONTEND.

---

# 5. FRONTEND AGENT

Status: IN_PROGRESS

Responsibilities:

- [x] Configure application root layout and responsive dashboard shell.
- [x] Implement navigation (Sidebar & Header, mobile drawer, PWA-ready).
- [x] Implement initial dashboard base page consuming Server Actions.
- [ ] Implement accounts UI.
- [ ] Implement credit cards UI.
- [ ] Implement transactions UI.
- [ ] Implement forms and validation feedback.
- [ ] Implement charts.
- [x] Implement responsive layouts.
- [ ] Configure PWA manifest and service worker.

Expected deliverables:

- src/app/
- src/components/
- src/features/
- public/manifest.json
- PWA configuration.

Handoff:

Files created:
- src/app/layout.tsx
- src/app/(dashboard)/layout.tsx
- src/app/(dashboard)/page.tsx
- src/components/layout/Sidebar.tsx
- src/components/layout/Header.tsx
- tailwind.config.ts (actualizado con tokens completos de Shadcn/Tailwind)

Backend functions consumed:
- `listAccounts()` de `@/features/accounts/actions/account-actions`
- `listTransactions()` de `@/features/transactions/actions/transaction-actions`
- `formatMoneyCOP()`, `addMoney()`, `roundMoney()` de `@/lib/finance/money`

UI routes:
- `/` (Dashboard view con métricas de disponible vs deuda, cuentas activas y transacciones recientes)

Commands executed:
- `npm run build` -> PASS (Optimized production build)
- `npm run test:run` -> PASS (47 unit tests passing)
- `npx tsc --noEmit` -> PASS (0 type errors, strict: true)
- `npm run lint` -> PASS (0 lint warnings/errors)

Errors:
None.

Next agent:
FRONTEND (continuing with Accounts, Cards and Transactions UI views) -> QA.

---

# 6. QA AGENT

Status: BLOCKED

Responsibilities:

- Inspect all agent deliverables.
- Check integration contracts.
- Execute TypeScript verification.
- Execute lint.
- Execute production build.
- Execute Vitest.
- Check RLS assumptions.
- Verify financial calculations.
- Identify regressions.
- Correct defects when safe.
- Re-run every relevant verification after changes.

Verification checklist:

[ ] DB migration reviewed.
[ ] RLS policies reviewed.
[ ] TypeScript passes.
[ ] ESLint passes.
[ ] Production build passes.
[ ] Vitest passes.
[ ] Installment rounding verified.
[ ] Closing date tests pass.
[ ] Payment date tests pass.
[ ] Monthly projections pass.
[ ] No duplicate installments.
[ ] No unauthorized user data access.

QA REPORT:

Date:
Agent:

TypeScript:
Status / Output:

Lint:
Status / Output:

Build:
Status / Output:

Vitest:
Status / Output:

Security review:
Status / Findings:

Bugs found:
[Details]

Files modified:
[Details]

Final verdict:
PENDING / APPROVED / REJECTED

---

# 7. BUG TRACKER

| ID | Severity | File | Description | Assigned to | Status |
|---|---|---|---|---|---|
| BUG-001 | - | - | No bugs registered | - | - |

Severity:

- CRITICAL
- HIGH
- MEDIUM
- LOW

A bug is resolved only after the responsible agent records the correction and QA verifies it.

---

# 8. HANDOFF LOG

## Initial state

No agents have started.

Each agent must append:

### [DATE] - [AGENT]

Task:
Files modified:
Contracts delivered:
Tests executed:
Known issues:
Next agent:
Handoff status:

---

# 9. FINAL RELEASE GATE

Release is BLOCKED until:

- All implementation agents are COMPLETED.
- All critical bugs are resolved.
- QA verification checklist is complete.
- All required commands return exit code 0.
- Final QA verdict is APPROVED.

Only the QA agent may change the final verdict to APPROVED.

The human project owner retains final release authority.