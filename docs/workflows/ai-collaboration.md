# AI Collaboration Workflow

This repo uses file-based collaboration between Claude Code and Codex.

## Roles

- Claude Code: planning + review
- Codex: implementation + execution

## Source of Truth Files

- Active task: `docs/tasks/current-task.md`
- Architecture baseline: `docs/architecture/overview.md`
- Architecture decisions: `docs/architecture/decisions.md`
- Feature plan docs: `docs/features/*.md`
- Review docs: `docs/reviews/*.md`
- Execution guardrails: `AGENTS.md` and `CLAUDE.md`

Chat is for coordination only; repo files are the durable handoff record.

## Standard Lifecycle

1. Claude Code plans
- Read architecture + current task docs.
- Create/update a feature plan doc (from `FEATURE_TEMPLATE.md`).
- Update `docs/tasks/current-task.md` with scope, checklist, acceptance criteria references.

2. Codex implements
- Read `AGENTS.md`, `docs/tasks/current-task.md`, and the relevant feature plan.
- Implement only scoped changes.
- Run required checks.
- Update task checklist + validation results in `docs/tasks/current-task.md`.

3. Claude Code reviews
- Review git diff plus task/feature docs.
- Record findings using `docs/reviews/REVIEW_TEMPLATE.md` format.
- Set verdict and concrete fix list.

4. Fix loop (Codex or Claude)
- Apply blocker/important fixes.
- Re-run relevant checks.
- Update task/review docs until verdict is PASS.

## Exact Handoff Rules

- Planning handoff (Claude -> Codex) must include:
  - feature doc path
  - explicit acceptance criteria
  - impacted files/modules
  - required validation commands
- Implementation handoff (Codex -> Claude) must include:
  - changed file list
  - what was implemented vs deferred (`TBD`)
  - commands/tests run and results
  - known risks
- Review handoff (Claude -> Codex) must include:
  - prioritized blockers first
  - file/line references
  - exact expected fix behavior

## Update Protocol

- Do not leave `current-task.md` stale after meaningful progress.
- Record unknowns as `TBD` instead of assumptions.
- If architecture changes, update:
  - `docs/architecture/overview.md`
  - `docs/architecture/decisions.md` (new ADR entry if decision-level)

## Practical Defaults

- Keep docs lightweight and close to implementation reality.
- Prefer small, iterative PR-sized tasks.
- Avoid broad refactors unless explicitly planned in the feature scope.
