# AGENTS.md

Operational guide for Codex in this repository.

## Role
Codex is the implementation and execution agent.

- Build features based on `docs/tasks/current-task.md` and relevant feature docs.
- Keep changes scoped to the active task.
- Do not rely on chat history as system memory; update repo docs as you work.

## Stack Summary

- Framework: Next.js App Router (`app/`) on Next `16.1.6`
- Language: TypeScript (strict), React `19`, Node runtime
- Styling/UI: Tailwind CSS v4 + custom CSS variables, Radix UI primitives, `class-variance-authority`
- Data: Prisma ORM + PostgreSQL (`prisma/schema.prisma`)
- Auth: JWT access/refresh tokens in HTTP-only cookies + refresh token persistence
- Validation: Zod schemas in `src/lib/validators`
- Payments: Stripe + Stripe Connect + webhook idempotency table
- Testing: Vitest (unit/integration), Playwright (e2e smoke)
- Linting/Type checks: ESLint 9 + `eslint-config-next`, `tsc --noEmit`

## Repository Shape

- `app/`: UI pages and API route handlers (`app/api/**/route.ts`)
- `src/lib/`: server/business logic helpers (db, auth, validators, http helpers, services)
- `src/components/`: shared and UI components
- `prisma/`: schema, migrations, seed
- `src/tests/`: unit, integration, e2e tests
- `docs/`: planning, architecture, reviews, tasks, AI workflow docs

## Coding Conventions (Inferred)

- Keep TypeScript strict; avoid `any` unless unavoidable.
- Use `@/` imports (example: `@/src/lib/db`).
- Route handlers typically:
  1. `try/catch`
  2. auth/role checks via `requireRole`/guards
  3. `zod.safeParse` for request validation
  4. standardized API shape via `ok(...)` / `fail(...)`
- Prefer shared helpers over duplicate logic (auth/session/response/validators).
- Preserve existing naming style:
  - kebab-case files in `src/lib`
  - `route.ts` for API endpoints
  - React components in PascalCase
- Preserve existing UI style and tokens in `app/globals.css`.

## Commands

Install:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build/start:

```bash
npm run build
npm run start
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
```

Targeted tests:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run smoke
```

Database:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Execution Rules

- Do not rewrite unrelated files.
- Keep scope tight to the active task and acceptance criteria.
- Preserve existing architectural patterns and style.
- Prefer minimal, reviewable diffs.
- Update docs when behavior/architecture changes:
  - `docs/architecture/overview.md` for structural changes
  - `docs/architecture/decisions.md` for new decisions
  - `docs/tasks/current-task.md` status/checklist updates
- Run relevant checks after changes (at minimum `lint` + `typecheck`, plus affected tests).
- If an assumption is required and cannot be verified, mark it as `TBD` in docs.

## Definition of Done

A task is done when all are true:

1. Implementation matches `docs/tasks/current-task.md` scope.
2. No unrelated files were modified.
3. Lint and typecheck pass.
4. Relevant tests pass (unit/integration/e2e as applicable).
5. Docs/task status are updated for handoff.
6. Review-ready summary includes changed files, validation run, and known risks/TBDs.
