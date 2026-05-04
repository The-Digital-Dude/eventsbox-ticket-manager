# Current Task

## Active Task
**Phase C — Reserved Seating Map Builder**

**Status:** DONE — organizer reserved seating builder is implemented for reserved seating events

**Latest Handoff (2026-05-04):**
- Added `/organizer/events/[id]/seating` as a two-panel reserved seating builder for `RESERVED_SEATING` events only.
- The visual canvas renders seating sections, rows, seat inventory, and table zones, with seat colors mapped to `AVAILABLE`, `RESERVED`, `SOLD`, and `BLOCKED`.
- Organizers can create sections, rows, table zones, bulk-generate row/seat inventory, select map items, edit section/row/table/seat fields, and delete seating records.
- Added organizer-owned seating APIs:
  - `GET/POST /api/organizer/events/[id]/seating`
  - `PATCH/DELETE /api/organizer/events/[id]/seating/[zoneId]`
- All seating API routes require `ORGANIZER`, verify event ownership, and reject non-`RESERVED_SEATING` events.
- Added a conditional `Seating` button on `/organizer/events/[id]` only when `event.mode === RESERVED_SEATING`.
- Extended `src/lib/validators/event.ts` with Zod schemas for seating create/update/delete payloads.
- Validation on this handoff: `npm run lint` and `npm run typecheck` passed.
- Known risks/TBDs: Section-level pricing and table-zone sort order are not present in the current Prisma schema, so Phase C only edits fields that exist in Phase A models. Public seat picking, ticket sync, and generated ticket pricing remain deferred to later phases.

---

## Previous Task
**Phase B — Multi-Step Event Creation Wizard**

**Status:** DONE — organizer event creation now uses the Phase B wizard flow

**Latest Handoff (2026-05-04):**
- Replaced `/organizer/events/new` with a five-step creation wizard: mode selection, event details, location/date with live preview, media, and review/create.
- Wizard now captures and submits `mode`, `tagline`, `eventType`, `visibility`, and `onlineAccessLink` alongside existing event fields.
- Organizer event creation API now accepts the Phase A event fields and saves online access links only for online events.
- `eventCreateSchema` now validates the new event mode/type/visibility/tagline/online fields.
- Validation on this handoff: `npm run lint` and `npm run typecheck` passed.

---

## Previous Task
**Phase A — Schema Additions**

**Status:** DONE — foundation schema for event creation modes and reserved seating is in place

**Latest Handoff (2026-05-04):**
- Event records now support `tagline`, `eventType`, `onlineAccessLink`, `visibility`, `mode`, and `adminNote`.
- Added safe defaults for existing events: `eventType = PHYSICAL`, `visibility = PUBLIC`, and `mode = SIMPLE`.
- Added reserved seating foundation models: `SeatingSection`, `SeatingRow`, `SeatInventory`, and `TableZone`.
- Added `SeatInventoryStatus` with `AVAILABLE`, `RESERVED`, `SOLD`, and `BLOCKED`.
- Checked-in migrations cover both the Event field additions and reserved seating model additions.
- No UI files were changed for Phase A.

---

## Previous Task
**Phase 26 — Attendee Experience Polish**

**Status:** DONE — attendee discovery and notification UX received a focused polish pass on top of phases 22–25

**Latest Handoff (2026-03-19):**
- Notifications now mark themselves read when opened from both the bell dropdown and `/account/notifications`, so unread counts stay aligned with actual attendee behavior instead of requiring a second manual click.
- The attendee dashboard now surfaces unread notification count directly in the welcome summary and includes a dedicated Notifications quick-action card.
- `/events` now includes a browser-powered nearby-events module with an explicit "Use my location" CTA, reusing `GET /api/public/events/nearby` without auto-prompting for location access on page load.
- Nearby public event responses now include `distanceKm`, allowing the UI to show how far each nearby recommendation is from the attendee.
- Updated `src/tests/integration/public-discovery.test.ts` to cover `distanceKm` in nearby-event responses.
- Validation on this handoff: `npm run typecheck`, targeted integration tests for `public-discovery` and `attendee-notifications`, `npm run lint`, and `npm run build`.
- `npm run lint` still reports the same pre-existing warnings only in `app/organizer/onboarding/page.tsx`, `app/organizer/venues/page.tsx`, and `app/organizers/[id]/page.tsx`.
- `npm run build` may still log the known transient Neon connectivity noise during homepage prerender fallback, but the build remains expected to complete successfully.

---

## Previous Task
**Phases 22–25 — Public Discovery, Attendee Notifications, Organizer Self-Service, Financial Operations**

**Status:** DONE

**Latest Handoff (2026-03-19):**
- Phase 22 is implemented: public event cards and homepage featured cards now show aggregate ratings, the homepage adds a browse-by-category section, and `GET /api/public/events/nearby` returns upcoming nearby published events by venue coordinates.
- Added `src/tests/integration/public-discovery.test.ts` for keyword/category discovery and nearby endpoint coverage.
- Phase 23 is implemented: `Notification` records now support attendee in-app notifications, `/api/account/notifications*` routes are live, the attendee nav includes a bell dropdown plus `/account/notifications`, Stripe payment success creates `ORDER_CONFIRMED` notifications, waitlist openings create `WAITLIST_OPEN` notifications for linked attendees, and the reminder cron now creates `EVENT_REMINDER` notifications.
- Waitlist entries now optionally store `attendeeProfileId` so logged-in attendees can receive in-app availability notifications in addition to email.
- Added `src/tests/integration/attendee-notifications.test.ts` for notification APIs and the payment webhook side effect.
- Phase 24 is implemented: events support `customConfirmationMessage`, organizers can toggle previously approved events offline/online via `/api/organizer/events/[id]/publish`, onboarding/profile now store `twitterUrl` and `instagramUrl`, organizer public pages expose the new social links, the dashboard includes pending cancellations/unread reviews/revenue-this-month cards, and `/api/organizer/export/orders` streams paid-order CSV across all events.
- Added `src/tests/integration/organizer-self-service.test.ts` for publish toggles, custom confirmation message persistence, and organizer order export.
- Phase 25 is implemented: payout requests now store `stripeTransferId` and `failureReason`, admins can settle approved payouts through `/api/admin/payouts/[id]/settle`, weekly `/api/cron/auto-payouts` is scheduled in `vercel.json`, tax and refund CSV report endpoints are live under `/api/admin/reports/*`, admin analytics exposes report download forms, and organizer payout history now shows transfer references.
- Stripe-connected organizer payout onboarding now uses `AUTO` payout mode while existing `STRIPE_CONNECT` records remain supported in checkout and UI branches.
- Added `src/tests/integration/financial-operations.test.ts` for payout settlement, tax/refund reports, and auto-payout cron behavior.
- Validation on this handoff: `npx prisma db push` passed, `npx prisma generate` passed, `npm run typecheck` passed, targeted integration tests for phases 22–25 passed (`public-discovery`, `attendee-notifications`, `organizer-self-service`, `financial-operations`), `npm run build` passed, and `npm run lint` completed with pre-existing warnings only (`app/organizer/onboarding/page.tsx`, `app/organizer/venues/page.tsx`, `app/organizers/[id]/page.tsx`).
- `npm run build` still logs transient Neon connectivity errors while statically rendering homepage fallbacks, but the build completes successfully because `/` already degrades gracefully when Prisma cannot reach the database.

---

## Previous Task
**Phase 14 — Event Richness + Hardening**

**Status:** DONE

**Latest Handoff (2026-03-11):**
- Events now support an ordered multi-image gallery through the new `Event.images` field, organizer gallery management in `/organizer/events/[id]/edit`, and a public horizontal gallery/lightbox on `/events/[slug]`.
- Marketing unsubscribe is now complete with `User.marketingOptOut`, `User.unsubscribeToken`, a public `/unsubscribe` flow, waitlist-email opt-out enforcement, and an attendee email-preferences toggle on `/account/profile`.
- Added Phase 14 integration coverage in `src/tests/integration/unsubscribe.test.ts` and `src/tests/integration/gallery.test.ts`.
- Validation passed with `npm run lint`, `npm run typecheck`, `npm run test:integration`, and `npm run build` (28 integration files, 88 tests).
- `npx prisma migrate dev --name add-event-gallery-and-unsubscribe` was blocked by pre-existing migration drift in the shared development database, so Phase 14 ships with a checked-in SQL migration at `prisma/migrations/20260311024757_add_event_gallery_and_unsubscribe/migration.sql`, applied manually via `prisma db execute`, plus a regenerated Prisma client.

**Hotfix Note (2026-03-14):**
- Homepage stats in `app/page.tsx` now degrade gracefully when Prisma cannot reach the database, so `/` still renders with zeroed stats instead of crashing during transient Neon connectivity issues.
- Added `src/tests/integration/home-page.test.ts` to cover the homepage fallback behavior.
- Local `.env` was corrected so `DATABASE_URL` stays on the Neon pooled host while `DIRECT_DATABASE_URL` uses the verified non-pooler direct host.

---

## Previous Task
**Phase 13 — Admin Governance + Scanner Operations**

**Status:** Completed on 2026-03-11

---

## Phase 9 Overview

**Theme:** Complete the attendee-facing purchase loop and prepare the platform for public soft launch.

Phases 1–8 built the full organizer and admin surface. Phase 9 closes the gap on the attendee side:
post-purchase confirmation, a ticket wallet, social/SEO discoverability, and an organizer public profile.
No schema migrations are required.

---

## Task List

### P9-A1: Order Confirmation Email
**Priority:** High
**Why:** After checkout, attendees receive no email. This is a critical trust gap for a ticketing platform.

**Acceptance Criteria:**
- After a successful Stripe payment (in `app/webhooks/stripe/route.ts`, `payment_intent.succeeded` handler), send a confirmation email to the buyer
- Email contains: event title, date, venue name, order ID, and one QR code image per ticket (inline base64 or URL)
- QR code encodes the ticket's unique `id` (same value the scanner reads)
- Email is sent via existing `sendEmail()` helper in `src/lib/services/notifications.ts`
- New function `sendOrderConfirmationEmail(input)` added to `notifications.ts`
- If email send fails, log the error but do not fail the webhook response

**Schema:** No changes needed. Use existing `Order → OrderItem → TicketType → Event` relations.

**Files:**
- `src/lib/services/notifications.ts` — add `sendOrderConfirmationEmail()`
- `app/api/webhooks/stripe/route.ts` — call it after order is marked PAID
- `src/lib/qr.ts` — new helper: `generateQrDataUrl(ticketId: string): Promise<string>` using `qrcode` npm package

**QR package:** `qrcode` (already used by scanner). If not installed: `npm install qrcode @types/qrcode`.

**Out of scope:** PDF attachment, resend order email button.

---

### P9-A2: Attendee Ticket Wallet
**Priority:** High
**Why:** Attendees have no single place to see their tickets and QR codes. `/account/orders` shows order history but not QR codes.

**Acceptance Criteria:**
- New page `app/account/tickets/page.tsx` — SSR, requires ATTENDEE session
- Lists all PAID orders for the logged-in attendee, grouped by upcoming vs past events
- Each ticket shows: event title, date, venue, ticket type name, and the QR code image
- QR code rendered client-side using `qrcode` or as a static `<img>` from a `/api/account/tickets/[ticketId]/qr` route
- "Download" button per ticket that triggers a browser image download of the QR
- Add "Tickets" nav link to attendee account sidebar/nav (alongside Dashboard, Orders, Profile)

**Files:**
- `app/account/tickets/page.tsx` — new SSR page
- `app/api/account/tickets/[ticketId]/qr/route.ts` — new GET, returns PNG QR image, requires ATTENDEE session + ownership check
- Update attendee nav links in `src/components/shared/public-nav.tsx` or wherever account nav lives

**Out of scope:** PDF ticket generation, Apple/Google Wallet pass, bulk download.

---

### P9-A3: OG Meta Tags Per Event Page
**Priority:** High
**Why:** When an organizer shares an event link on WhatsApp, Twitter, or Facebook, it shows no preview. This kills organic sharing.

**Acceptance Criteria:**
- `app/events/[slug]/page.tsx` exports a `generateMetadata()` function
- Metadata includes: `title`, `description`, `openGraph.title`, `openGraph.description`, `openGraph.images` (event hero image or fallback), `openGraph.type: "website"`, `twitter.card: "summary_large_image"`
- Fallback image used if event has no hero image
- Description truncated to 160 chars

**Files:**
- `app/events/[slug]/page.tsx` — add `generateMetadata()` export

**Out of scope:** Dynamic OG image generation (Vercel OG), per-organizer OG.

---

### P9-A4: Sitemap + robots.txt
**Priority:** Medium
**Why:** Without a sitemap, search engines can't discover public event pages. robots.txt prevents indexing of admin/organizer routes.

**Acceptance Criteria:**
- `app/sitemap.ts` — Next.js App Router sitemap generator. Returns static routes (`/`, `/events`, `/auth/login`, `/auth/register`) plus all `PUBLISHED` events as `/events/[slug]`
- `app/robots.ts` — Next.js robots generator. Disallows `/admin/*`, `/organizer/*`, `/account/*`, `/api/*`. Allows everything else.
- Both work with `next build` (static generation)

**Files:**
- `app/sitemap.ts` — new
- `app/robots.ts` — new

**Out of scope:** Per-organizer profile sitemap, news sitemap.

---

### P9-A5: Organizer Public Profile Page
**Priority:** Medium
**Why:** Attendees have no way to discover other events by the same organizer. This increases repeat attendance.

**Acceptance Criteria:**
- New page `app/organizers/[id]/page.tsx` — SSR, public (no auth required)
- Shows: organizer brand name, company name, website link, and a grid of their PUBLISHED upcoming events
- If organizer not found or not APPROVED: return 404 via `notFound()`
- Link from event detail page: "More events by [brand name]" → `/organizers/[organizerId]`
- No new API route needed — direct Prisma query in the page component

**Files:**
- `app/organizers/[id]/page.tsx` — new public SSR page
- `app/events/[slug]/page.tsx` — add "More events by organizer" link

**Out of scope:** Organizer follow/subscribe, social links, ratings.

---

### P9-A6: Admin Bulk Event Actions
**Priority:** Medium
**Why:** Admins currently approve/reject events one by one. During launch, dozens of events may need bulk processing.

**Acceptance Criteria:**
- `app/admin/events/page.tsx` — add row checkboxes and a bulk action toolbar (visible when ≥1 row selected)
- Bulk actions: Approve, Reject, Feature, Unfeature
- New API: `POST /api/admin/events/bulk` — body `{ ids: string[], action: "APPROVE" | "REJECT" | "FEATURE" | "UNFEATURE" }`
- Requires `SUPER_ADMIN` role
- Each action runs a Prisma `updateMany` with `where: { id: { in: ids } }`
- Audit log entries written for each affected event
- Returns `{ updated: number }`

**Files:**
- `app/api/admin/events/bulk/route.ts` — new POST handler
- `app/admin/events/page.tsx` — add checkbox UI + bulk toolbar (convert to client component or add client island)

**Out of scope:** Bulk delete, bulk cancel, bulk email to organizers.

---

### P9-A7: Integration Tests for Phase 9
**Priority:** High (required before phase closeout)

**Acceptance Criteria:**
- `src/tests/integration/order-confirmation-email.test.ts` — verify webhook triggers email send (mock `sendEmail`)
- `src/tests/integration/ticket-wallet.test.ts` — GET `/api/account/tickets/[ticketId]/qr` returns 200 PNG for owner, 403 for non-owner
- `src/tests/integration/admin-bulk-events.test.ts` — bulk approve/reject updates status and writes audit logs

**Files:**
- `src/tests/integration/order-confirmation-email.test.ts`
- `src/tests/integration/ticket-wallet.test.ts`
- `src/tests/integration/admin-bulk-events.test.ts`

---

### P9-A8: Docs Update
**Priority:** Low (required at closeout)

**Acceptance Criteria:**
- `docs/tasks/current-task.md` — updated with completion status
- `docs/releases/phase-9-release-notes.md` — created at closeout

---

## Execution Order

```
P9-A4 (sitemap + robots)       → zero deps, do first
P9-A3 (OG meta tags)           → zero deps, small
P9-A5 (organizer profile page) → zero deps, no schema
P9-A1 (order confirm email)    → needs qrcode lib install
P9-A2 (ticket wallet)          → depends on qr helper from A1
P9-A6 (admin bulk actions)     → independent, medium
P9-A7 (integration tests)      → after features land
P9-A8 (docs)                   → last
```

---

## Schema Changes
**None.** Phase 9 uses existing models only:
- `Order → OrderItem → TicketType → Event → Venue`
- `OrganizerProfile → User`
- `AuditLog`

---

## New Dependencies
- `qrcode` + `@types/qrcode` — QR code generation (PNG buffer + data URL)

---

## Acceptance Gate (per task)

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing

---

## Status Tracking

| Task | Status |
|------|--------|
| P9-A1 — Order Confirmation Email | DONE |
| P9-A2 — Attendee Ticket Wallet | DONE |
| P9-A3 — OG Meta Tags Per Event | DONE |
| P9-A4 — Sitemap + robots.txt | DONE |
| P9-A5 — Organizer Public Profile | DONE |
| P9-A6 — Admin Bulk Event Actions | DONE |
| P9-A7 — Integration Tests | DONE |
| P9-A8 — Docs Update | DONE |

## Completion Notes

- Buyer confirmations now include ticket QR codes generated from `QRTicket.id`, and the organizer scanner accepts both legacy token values and the new ticket-ID QR payloads.
- Attendees now have a dedicated `/account/tickets` wallet with downloadable QR images and protected QR PNG delivery.
- Public discovery is improved through sitemap/robots coverage, event OG metadata, and organizer profile pages.
- Admin launch readiness is improved through bulk event moderation and dedicated integration coverage for the new attendee and admin flows.
