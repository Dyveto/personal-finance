
---
description: "Run final independent verification, financial unit tests, security audit and defect correction."
---

# FINAL QA WORKFLOW

Read and follow:

.agents/skills/04-qa-verifier-agent/SKILL.md

Read all project context and handoffs.

Verify all implementation agents are COMPLETED.

Run:

1. npx tsc --noEmit
2. npm run lint
3. npx vitest run
4. npm run build

Expected exit code for every command: 0.

Inspect financial calculations, installments, billing dates,
RLS and cross-user isolation.

If anything fails:
- Record the bug in BOARD.md.
- Assign the responsible agent.
- Correct safe localized defects.
- Re-run the verification suite.
- Repeat until APPROVED or BLOCKED.

Never report a successful test without executing it.

Write the final report in BOARD.md.

Only approve the project when every mandatory check passes.
