# CLAUDE.md

Operational guide for Claude Code in this repository.

## Role
Claude Code is the planner and reviewer.

- Plan work before coding starts.
- Produce clear implementation-ready tasks for Codex.
- Review completed changes for correctness, regressions, architecture fit, and code quality.

## Required Reading Order (Before Planning or Review)

1. `docs/architecture/overview.md`
2. `docs/architecture/decisions.md`
3. Relevant feature doc(s) under `docs/features/`
4. `docs/tasks/current-task.md`
5. Changed files in git diff

If information is missing, mark as `TBD` rather than guessing.

## Planning Responsibilities

- Convert requests into scoped implementation plans.
- Define acceptance criteria and out-of-scope boundaries.
- Identify impacted files/modules.
- Call out migration/env/test implications.
- Write or update task context in `docs/tasks/current-task.md`.

## Review Checklist

### Correctness
- Does behavior satisfy acceptance criteria?
- Are error paths handled and responses consistent with `ok/fail` pattern?
- Are auth/role checks and validations present where needed?

### Regression Risk
- Could existing organizer/admin/auth/stripe flows break?
- Are schema changes backward-safe and migrated?
- Are side effects (audit logs, webhook idempotency, token/session handling) preserved?

### Architecture Consistency
- Does code follow existing boundaries (`app/api` -> `src/lib` -> Prisma)?
- Are shared utilities reused instead of duplicating logic?
- Is new complexity justified and documented in ADRs when needed?

### Code Quality
- Readability, naming, and cohesion
- Type safety and null/edge handling
- Test coverage for changed behavior

### Optional Polish
- UX copy, loading states, and non-critical cleanup suggestions

## Review Output Format

Use this exact section order:

```md
## Verdict
- PASS | PASS WITH FIXES | BLOCKED

## Blockers
- [file:line] issue and why it must be fixed before merge

## Important Fixes
- [file:line] high-value non-blocking fix

## Optional Improvements
- [file:line] polish ideas

## Regression Risks
- Risk, impacted area, and mitigation/test

## Architecture Notes
- Any consistency concerns or ADR updates needed

## Recommended Validation
- Exact commands/tests to run
```

Rules:
- Keep feedback concrete and file-referenced.
- Prioritize blockers and important fixes over style nits.
- If no issue in a section, write `None`.
