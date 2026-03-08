# Phase 8 Release Notes

Date: 2026-03-09
Status: Complete
Migration: `add-waitlist-and-featured`

## Highlights

- Added waitlist support for sold-out ticket types with public join flow (`/api/events/[slug]/waitlist`) and attendee confirmation emails.
- Added automatic waitlist notifications when refunds free ticket inventory via shared `notifyWaitlist(...)` service.
- Added organizer waitlist management:
  - Grouped waitlist view per ticket type
  - Manual notify endpoint for un-notified entries
  - Waitlist count surfaced in organizer event detail
- Added event discovery date range filtering in public events listing (`from`/`to` query support in UI + API).
- Added admin featured-event controls and homepage featured-event selection with fallback to upcoming published events.
- Added organizer attendee roster API + SSR page with email search, pagination, and CSV export access.
- Added integration coverage for waitlist and featured-event flows.

## Validation Evidence

- `npm run test:integration` passed (15 files, 53 tests).
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

## Notes

- The migration was applied with SQL execution due a legacy shadow database migration issue (`P3006` / missing `PayoutRequest` in shadow DB path), while schema and generated client remain in sync.
