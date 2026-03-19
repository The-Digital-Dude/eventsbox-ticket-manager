# Phase 21 Plan — Production Hardening

**Status:** IMPLEMENTED
**Depends on:** Phase 20 complete
**Goal:** Tighten authentication behavior for suspended users, add production cron maintenance, enable reminder delivery, and document the required ops setup for launch.

---

## Task 1 — Enforce `isActive` on authenticated requests

**Status:** DONE

- `requireAuth()` now re-checks `User.isActive` after JWT verification.
- Suspended users now fail with `ACCOUNT_SUSPENDED`.
- Refresh rotation and server-side session readers also ignore inactive users.

## Task 2 — Nightly token cleanup cron

**Status:** DONE

- Added `GET /api/cron/cleanup-tokens`
- Protected by `Authorization: Bearer ${CRON_SECRET}`
- Deletes expired or revoked refresh tokens plus expired verification/reset tokens

## Task 3 — Daily event reminder cron

**Status:** DONE

- Added `Order.reminderSentAt`
- Added `GET /api/cron/event-reminders`
- Sends reminder emails for paid orders whose events start in the next 24–48 hours
- Marks orders after a successful send so the cron remains idempotent

## Task 4 — Sentry wiring

**Status:** DONE

- Added `SENTRY_DSN` to env validation
- Existing Sentry config remained compatible and already used `process.env.SENTRY_DSN`

## Task 5 — Ops setup guide

**Status:** DONE

- Added [production-setup.md](/Users/juhan/Developer/TDD/EventsBox/EventsBox_Ticket_Manager/docs/ops/production-setup.md)

## Validation

- `npx prisma db push` — PASS
- `npx prisma generate` — PASS
- `npm run typecheck` — PASS
- `npx vitest run src/tests/integration/auth-hardening.test.ts src/tests/integration/cron-reminders.test.ts` — PASS
- `npm run lint` — pending final run
- `npm run build` — pending final run

## Notes

- Targeted Phase 21 behavior is validated locally.
- Repo-wide integration remains subject to intermittent shared Neon connectivity failures in older unrelated tests.
