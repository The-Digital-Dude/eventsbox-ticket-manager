# Architecture Decisions

Lightweight ADR log for current repository decisions.

## ADR-001: Next.js Monolith for UI + API
- Status: Accepted
- Context: Product surfaces are tightly coupled (auth, organizer/admin panels, internal APIs).
- Decision: Keep frontend pages and backend APIs in one Next.js App Router codebase.
- Consequences:
  - Faster iteration with shared types/helpers.
  - Simpler deployment surface.
  - Requires discipline in module boundaries to avoid route handler bloat.

## ADR-002: Prisma + PostgreSQL as Primary Persistence
- Status: Accepted
- Context: App has relational entities (users, organizer profiles, venues, locations, audit logs, webhook events).
- Decision: Use Prisma models/migrations against PostgreSQL.
- Consequences:
  - Strong schema evolution and typed DB access.
  - Migration quality directly impacts release safety.

## ADR-003: Cookie-Based JWT Session with Refresh Token Store
- Status: Accepted
- Context: Need role-based authenticated dashboard access with session rotation.
- Decision: Use short-lived access JWT + refresh JWT in HTTP-only cookies; persist hashed refresh tokens in DB.
- Consequences:
  - Supports rotation/revocation patterns.
  - Requires secure secret/env management and careful token invalidation.

## ADR-004: Standard API Envelope + Zod Validation
- Status: Accepted
- Context: Many internal API endpoints require predictable response handling.
- Decision: Route handlers return `{ success, data }` or `{ success, error }` via shared helpers and validate inputs with Zod.
- Consequences:
  - Consistent client handling and easier review.
  - Validation schemas become critical contract artifacts.

## ADR-005: Role Enforcement at Both Proxy and Route Layers
- Status: Accepted
- Context: UI route access and API authorization both matter.
- Decision: Use `proxy.ts` for navigation gating and server route guards (`requireRole`) for authoritative checks.
- Consequences:
  - Better UX via early redirects.
  - Security still depends on route-level checks, not proxy alone.

## ADR-006: Stripe Webhook Idempotency Persistence
- Status: Accepted
- Context: Stripe webhooks retry and may duplicate events.
- Decision: Persist webhook event IDs in `StripeWebhookEvent` and short-circuit already-processed events.
- Consequences:
  - Safer retry behavior.
  - Requires periodic operational visibility/cleanup strategy (`TBD`).
