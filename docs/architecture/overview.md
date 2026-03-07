# Architecture Overview

## Purpose
EventsBox Ticket Manager is a Next.js full-stack app for organizer onboarding, admin governance, venue management, and payout setup (including Stripe Connect onboarding/webhooks).

## Main Folders

- `app/`
  - App Router pages (`/auth`, `/organizer`, `/admin`)
  - API endpoints in `app/api/**/route.ts`
  - global shell/styles (`app/layout.tsx`, `app/globals.css`)
- `src/lib/`
  - Core server logic and helpers:
    - `db.ts` Prisma client singleton
    - `auth/*` JWT/session/guards/password
    - `validators/*` Zod request and domain validation
    - `http/*` API response + in-memory rate limiter
    - `services/audit.ts` audit write helper
    - `stripe/client.ts` Stripe client wrapper
- `src/components/`
  - `ui/*` reusable controls
  - `shared/*` layout/page-level shared building blocks
- `prisma/`
  - data schema, SQL migrations, seed script
- `src/tests/`
  - unit, integration (route-level), e2e (Playwright)

## Data Flow

1. Client pages in `app/**/page.tsx` fetch internal API routes.
2. Route handlers perform auth/role checks (`requireRole` or related guards).
3. Request payloads are validated with Zod schemas.
4. Handlers call Prisma directly (or thin helper services) for persistence.
5. API returns standardized envelope via `ok(...)` / `fail(...)`.

## Frontend / Backend Boundary

- Frontend: React client pages/components under `app/` and `src/components`.
- Backend: Next route handlers in `app/api` plus server libraries in `src/lib`.
- Boundary is logical, not repository-separated (single deployable Next app).

## Key Dependencies

- Next.js 16 + React 19
- Prisma + PostgreSQL
- Zod
- jsonwebtoken + bcryptjs
- Stripe SDK
- Tailwind CSS v4 + Radix UI + CVA
- Vitest + Playwright

## Current Technical Debt / Weak Spots (Visible)

- Rate limiting uses in-memory `Map` (`src/lib/http/rate-limit.ts`), so limits reset on restart and are not shared across instances.
- Many API `catch` blocks return generic 500/401/403 and swallow error detail, which can reduce observability.
- `proxy.ts` decodes JWT payload for route gating without full signature verification (API routes still enforce auth server-side).
- Organizer onboarding currently persists many optional blanks as sentinel string `"N/A"`, adding cleanup/normalization overhead.
- No dedicated service layer for all domains yet; some route handlers contain significant business logic.

If additional constraints exist (hosting topology, background workers, external queues), status is `TBD`.
