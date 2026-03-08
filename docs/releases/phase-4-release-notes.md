# Phase 4 Release Notes

Date: 2026-03-08  
Status: Complete

## Summary

Phase 4 delivered the planned secondary features, UX polish, and production hardening items:
- Admin orders management surface
- Organizer analytics CSV export
- Organizer dashboard notification banners
- Login rate limit hardening by email
- Public event share action
- Sidebar dark-mode compatibility polish
- Public event listing filter query normalization
- Organizer event status timeline
- Expanded Playwright end-to-end coverage
- Structured error logging in API catch blocks

## Feature Delivery

### Track A — Missing Features

- A1 Admin Orders Page
  - Added `GET /api/admin/orders` with `page`, `status`, and `q` filters.
  - Added SSR page `/admin/orders` with order table and pagination.
  - Added `Orders` nav item across admin pages.
- A2 Organizer Analytics CSV Export
  - Added `GET /api/organizer/analytics/export` CSV download endpoint.
  - Added `Export CSV` action on organizer analytics page.
- A3 Organizer Dashboard Notification Banners
  - Added rejected/pending-approval event banners on organizer dashboard.
- A4 Login Rate Limit by Email
  - Added email-scoped rate limit check in login route after schema validation.
- A5 Public Event Share Button
  - Added share button with `navigator.share` and clipboard fallback + toast.

### Track B — UX & Polish

- B1 Dark Mode Sidebar Fix
  - Replaced hardcoded sidebar background with token-based styling.
  - Added sidebar color tokens for light/dark themes.
  - Updated mobile nav colors to respect theme tokens.
- B2 Event Search & Filter on Public Listing
  - Standardized query params to `q`, `category`, `state` (legacy params still accepted in API).
  - Public page pagination preserves active filters.
- B3 Organizer Event Status Timeline
  - Added event audit timeline section to organizer event detail page.
  - Event detail API now returns latest event-scoped audit logs.

### Track C — Production Hardening

- C1 E2E Test Coverage
  - Added:
    - `src/tests/e2e/checkout-flow.spec.ts`
    - `src/tests/e2e/auth-flow.spec.ts`
    - `src/tests/e2e/organizer-event.spec.ts`
  - Updated `src/tests/e2e/smoke.spec.ts` assertion text to current dashboard copy.
- C2 API Error Observability
  - Replaced bare `catch {}` with `catch (error)` + route-scoped `console.error(...)` across API route handlers.
- C3 Docs
  - Updated `docs/tasks/current-task.md` completion status.
  - Added this release note file.

## Validation

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test:integration` passed (`32/32`)
- `npm run test:e2e` passed (`4/4`)

## Notes

- Integration tests rely on external database connectivity; intermittent network issues may require re-run.
