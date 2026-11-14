
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
| BACKEND | Server Actions and Finance | PENDING | DB |
| FRONTEND | UI and PWA | PENDING | DB + BACKEND |
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

Status: PENDING

Responsibilities:

- Implement Supabase server clients.
- Implement Zod schemas.
- Implement Server Actions.
- Implement CRUD.
- Implement financial calculations.
- Implement credit card schedules.
- Implement installment projections.
- Add Vitest tests for financial logic.

Expected deliverables:

- src/lib/supabase/
- src/lib/validations/
- src/lib/finance/
- src/features/*/actions/
- tests/unit/

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
FRONTEND

---

# 5. FRONTEND AGENT

Status: PENDING

Responsibilities:

- Configure application layout.
- Implement navigation.
- Implement dashboard.
- Implement accounts UI.
- Implement credit cards UI.
- Implement transactions UI.
- Implement forms and validation feedback.
- Implement charts.
- Implement responsive layouts.
- Configure PWA.

Expected deliverables:

- src/app/
- src/components/
- src/features/
- public/manifest.json
- PWA configuration.

Handoff:

Files created:
[To be completed]

Backend functions consumed:
[To be completed]

UI routes:
[To be completed]

Commands executed:
[To be completed]

Errors:
[None / Details]

Next agent:
QA

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