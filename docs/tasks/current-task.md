# Current Task

## Active Task
**Phase I — Final Product Polish & Hardening**

**Status:** DONE — one-time event venues and saved-venue seating snapshots are implemented

**Latest Handoff (2026-05-07):**
- Added event-only venues for the event creation wizard. Physical events now default to one-time venue details with text inputs for state/city, creating hidden approved `Venue` rows linked to the event and excluded from organizer/admin/public venue lists.
- Saved venue selection remains available for physical events. For reserved-seating events, the selected venue's seating template is copied into event-owned seating sections/rows/seats or table zones during event creation, so later venue edits do not mutate the event.
- Added migration `prisma/migrations/20260506120000_add_event_only_venues/migration.sql` for `Venue.isEventOnly` plus a reusable `copyVenueSeatingToEvent()` helper.
- Added focused coverage in `src/tests/integration/event-one-time-venue.test.ts` and `src/tests/unit/venue-seating-copy.test.ts`.
- Validation on this handoff: `npx prisma generate`, `npx prisma db push`, `npx vitest run src/tests/integration/event-one-time-venue.test.ts src/tests/unit/venue-seating-copy.test.ts`, `npm run lint`, and `npm run typecheck` passed.
- Known risks/TBDs: local Postgres was not reachable from Vitest for live DB integration coverage, so the new event creation route coverage uses mocked Prisma transaction assertions.

**Previous Handoff (2026-05-05):**
- I1 Ticket Drag-Reorder UI is complete. Organizer event detail now has up/down controls for ticket types, backed by `POST /api/organizer/events/[id]/tickets/reorder`, and public/organizer/admin ticket reads continue to order by `TicketType.sortOrder`.
- I2 Admin Request Changes is complete. Admin event governance now has a distinct Request Changes action that stores the requested change note on `Event.adminNote`, moves the event back to `DRAFT` for organizer edits/resubmission, clears rejection reason, emails the organizer, and surfaces the note on organizer/admin event status/detail pages.
- I3 Resend Confirmation Email is complete. Added `POST /api/account/orders/[orderId]/resend-confirmation`, requiring ATTENDEE ownership of a PAID order and reusing `sendOrderConfirmationEmail`; attendee Orders and Tickets surfaces now expose resend buttons with toast feedback.
- I4 Discovery Polish is complete. Public discovery now supports availability filtering in the UI and API, preserves price range filtering, computes sold-out/available states from ticket and reserved-seat inventory, and `/events/[slug]` emits Event JSON-LD structured data.
- I5 Reservation Cleanup Hardening is complete. Added reusable `cleanupExpiredSeatReservations()` for expired `SeatInventory RESERVED` holds and legacy `EventSeatBooking RESERVED` rows, reused by public seat reads, public reserve, and checkout validation.
- Added targeted coverage for request-changes decisions and expired seat cleanup behavior.
- Validation on this handoff: `npx vitest run src/tests/integration/public-seat-reservations.test.ts src/tests/integration/admin-event-decision-notify.test.ts` passed; `npm run lint && npm run typecheck` passed.
- Known risks/TBDs: availability filtering is computed after the primary event query so it remains correct across simple and reserved seating inventory, but it is not yet optimized for very large public event catalogs.

---

## Previous Task
**Phase H — Reporting and Ledger**

**Status:** DONE — reporting, payout ledger, event-day stats, and PDF report export are implemented

**Latest Handoff (2026-05-05):**
- H1 Attendance Report View is complete. `/organizer/analytics` now includes an Attendance tab with event selection, per-event issued/checked-in/no-show/check-in-rate totals, and scan history with ticket number, attendee name/email, checked-in time, and device.
- Added `GET /api/organizer/analytics/attendance?eventId=...`, scoped to the authenticated organizer and returning `{ totalIssued, checkedIn, noShows, checkInRate, scanHistory }`.
- H2 Unified Transaction Ledger is complete. `/organizer/payout` now shows a Transaction Ledger section with Sale, Refund, Platform Fee, and Payout rows plus gross sales, total fees, total refunds, and net available totals.
- Added `GET /api/organizer/payout/ledger`, returning paginated ledger entries derived from PAID/REFUNDED orders and PAID payout requests.
- H3 Event-Day Real-Time Dashboard is complete. `/organizer/scanner` now has an event-day stats panel for the selected event with Total Tickets, Checked In, Remaining, and Invalid Scans Today, polling every 30 seconds.
- Added `GET /api/organizer/events/[id]/checkin-stats`. Invalid scanner not-found outcomes are recorded in `AuditLog` going forward via existing scanner check-in endpoints, then counted for the selected event for the current day.
- H4 PDF Report Export is complete using the existing `@react-pdf/renderer` dependency from Phase G. `/organizer/analytics` now exposes an Export PDF Report button for the selected attendance event.
- Added `GET /api/organizer/export/report-pdf?eventId=...`, returning a PDF with event summary, revenue metrics, ticket type breakdown, and attendance stats.
- Validation on this handoff: `npm run lint && npm run typecheck` passed.
- Known risks/TBDs: `invalidScansToday` is durable from this release forward; historical invalid scan attempts were not persisted before Phase H because no scan-attempt table existed.

---

## Previous Task
**Phase G — PDF Tickets + Organizer POS**

**Status:** DONE — attendee PDF ticket downloads and organizer POS ticket issuance are implemented

**Latest Handoff (2026-05-05):**
- G1 PDF Ticket Generation is complete. Added `@react-pdf/renderer`, created `src/lib/pdf/ticket-pdf.tsx`, and replaced `GET /api/account/tickets/[ticketId]/pdf` with a React PDF renderer using `renderToBuffer`.
- The PDF route requires an ATTENDEE session, verifies the ticket belongs to the attendee's paid order, loads the existing attendee QR image endpoint with the current cookie, and returns `application/pdf` with `Content-Disposition: attachment; filename="ticket-[ticketNumber].pdf"`.
- The attendee ticket wallet already had the per-ticket "Download PDF" action wired to `/api/account/tickets/[ticketId]/pdf`; that route is now backed by the requested React PDF implementation.
- G2 POS System is complete. Added `/organizer/pos` as an ORGANIZER-only, approved-organizer page showing the organizer's published events, simple ticket selection with quantity, reserved seating seat selection, buyer info, payment method, and immediate issued QR display.
- Added `POST /api/organizer/pos/issue`, requiring ORGANIZER access and ownership of a published event. It creates a PAID order without Stripe payment intent, creates the order item and QR ticket(s), increments sold inventory, marks reserved seats `SOLD`, sends the existing order confirmation email, and returns QR data URLs for the terminal.
- POS payment method and optional note are now persisted on `Order.paymentMethod` and `Order.posNote`; migration `prisma/migrations/20260504145745_phase_g_pos_fields/migration.sql` adds both nullable columns.
- Organizer sidebar navigation now includes a POS link.
- Validation on this handoff: `npm run lint` and `npm run typecheck` passed.
- Known risks/TBDs: None for Phase G.

---

## Previous Task
**Phase F — Quick Wins**

**Status:** DONE — duplicate/resume/ticket availability quick wins are implemented and prior TBDs are closed

**Latest Handoff (2026-05-04):**
- F1 Duplicate Event is complete. `POST /api/organizer/events/[id]/duplicate` now creates a `DRAFT` event titled `Copy of ...`, copies event fields only, and intentionally does not copy ticket types, orders, or other transactional records. `/organizer/events/[id]` has the Duplicate button wired to the endpoint.
- F2 Draft Recovery Widget is complete. `/organizer/dashboard` now surfaces the organizer's most recently updated `DRAFT` event with title, saved draft step, last saved time, and a Continue Editing button. `Event.draftStep` persists the resume point, and the edit page restores it from the dashboard link.
- F3 Duplicate Ticket Type is complete. Ticket rows on `/organizer/events/[id]` now include Duplicate, backed by `POST /api/organizer/events/[id]/ticket-types/[ticketTypeId]/duplicate`, which creates a copy named `... (Copy)` with clean sales/comp counters.
- F4 Manual Sold-Out Toggle is complete. Ticket rows now show a Sold Out badge plus Mark Sold Out / Mark Available actions. `PATCH /api/organizer/events/[id]/ticket-types/[id]` accepts `soldOut`; marking sold out sets `TicketType.quantity = TicketType.sold` and stores the previous capacity in `TicketType.manualSoldOutPreviousQuantity` so Mark Available restores the exact prior quantity.
- Added migration `prisma/migrations/20260504165000_add_phase_f_recovery_state/migration.sql` for `Event.draftStep`, `TicketType.manuallySoldOut`, and `TicketType.manualSoldOutPreviousQuantity`.
- Added focused integration coverage in `src/tests/integration/organizer-phase-f-quick-wins.test.ts`.
- Validation on this handoff: `npm run db:generate`, `npx vitest run src/tests/integration/organizer-phase-f-quick-wins.test.ts`, `npm run lint`, and `npm run typecheck` passed.
- Known risks/TBDs: None for the prior Phase F handoff items.

---

## Previous Task
**Phase E — Public Seat Picker + Reservation Timer**

**Status:** DONE — public reserved seating selection and 10-minute reservation holds are implemented

**Latest Handoff (2026-05-04):**
- Added a reserved-seating branch to `/events/[slug]` while preserving the existing simple-event ticket quantity selector.
- Created `src/components/shared/public-seat-map.tsx` for the public seat picker. It renders Phase C `SeatInventory` grouped by section/row, supports multi-seat selection, shows `AVAILABLE`, `RESERVED`, `SOLD`, and `BLOCKED` states, and displays selected seat labels plus seat total.
- Reworked `GET /api/public/events/[slug]/seats` to serve public `SeatInventory` data for `RESERVED_SEATING` events, including section/row labels, ticket price metadata, and expired `RESERVED` seats as `AVAILABLE` in the response.
- Added `POST /api/public/events/[slug]/reserve`, which accepts `{ seatIds: string[] }`, verifies a published reserved-seating event, confirms all seats belong to the event and are currently available, reserves them for 10 minutes, and returns a signed reservation token plus expiry.
- The public event page now shows a `MM:SS` reservation countdown after reservation. When it expires, the UI clears selected seats and shows a released/expired state. No cron or background release job was added.
- Extended checkout to accept `reservationToken` plus selected reserved seat IDs, verify the hold is still valid and unexpired, link reserved `SeatInventory` rows to the pending order, and preserve the existing simple/legacy seating checkout path.
- Extended payment seat handling so successful Stripe payment marks linked `SeatInventory` seats as `SOLD` and creates QR tickets with seat labels; failed/refunded orders release linked `SeatInventory` rows back to `AVAILABLE`.
- Added targeted integration coverage in `src/tests/integration/public-seat-reservations.test.ts`.
- Validation on this handoff: `npm run lint`, `npm run typecheck`, and `npx vitest run src/tests/integration/public-seat-reservations.test.ts` passed.
- Known risks/TBDs: No cron/background release was added, as requested for Phase E. Expired public `SeatInventory` holds are now released when the public seats API is read or when a new reservation is attempted. `SeatingSection` still has no price field in the current schema, so public seat prices come only from active `TicketType.sectionId` links; seats without a section-linked active ticket type are shown as unavailable instead of using a fallback price.

---

## Previous Task
**Phase D — Auto Ticket Generation Preview**

**Status:** DONE — reserved seating table zones can preview and sync generated ticket types

**Latest Handoff (2026-05-04):**
- Added a reserved-seating-only `Ticket Preview / Sync Tickets` section on `/organizer/events/[id]`.
- The preview shows one generated-ticket card per syncable priced `TableZone`, including zone name, source type, price, capacity, and `Synced` / `Not synced` status.
- Added `Sync All`, which calls `POST /api/organizer/events/[id]/tickets/sync`.
- Added the organizer-owned sync API. It requires `ORGANIZER`, verifies event ownership, rejects non-`RESERVED_SEATING` events, and creates or updates `TicketType` records for table zones using `name = zone.name`, `price = zone.price`, and `quantity = zone.totalTables`.
- Generated table tickets are linked using the existing nullable `TicketType.sectionId` field with the `TableZone.id`; no schema migration was added in Phase D.
- Added a compatibility PATCH alias at `/api/organizer/events/[id]/ticket-types/[ticketTypeId]` and wired generated ticket cards to inline-edit generated ticket name and price through that route.
- Added targeted integration coverage in `src/tests/integration/organizer-ticket-sync.test.ts`.
- Validation on this handoff: `npm run lint`, `npm run typecheck`, and `npx vitest run src/tests/integration/organizer-ticket-sync.test.ts` passed.
- Note: an accidental broad `npm run test:integration -- src/tests/integration/organizer-ticket-sync.test.ts` invocation expanded to the full integration suite and failed in pre-existing environment-dependent tests because local Postgres/Upstash were unavailable; the targeted new ticket-sync test passed when run directly.
- Known risks/TBDs: `SeatingSection` still has no price field in the current Prisma schema, so section-level generated ticket sync is intentionally not implemented in Phase D. GA seating zones are also not represented by the current Phase A/C schema.

---

## Previous Task
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
