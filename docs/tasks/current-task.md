# Current Task

## Active Task
**Phase 12 — Attendee & Transaction Completions**

**Status:** DONE

**Latest Handoff (2026-03-10):**
- Added the shared Phase 12 schema for event series, complimentary tickets, and ticket transfer, plus a single migration SQL file at `prisma/migrations/20260310120000_add_comp_tickets_series_transfer/migration.sql`.
- Organizers can now create public event series, assign events to them, and attendees can browse `/events/series/[id]` pages or jump from an event detail page via the new series badge.
- Organizers can reserve complimentary inventory, issue comp tickets that create real PAID orders plus scannable QR tickets, and manage comp issuance from `/organizer/events/[id]/comp-tickets`.
- Attendees can initiate ticket transfers from `/account/orders`, recipients can accept via `/transfer/accept?token=...`, and accepted transfers update buyer ownership details.
- `npm run lint`, `npm run typecheck`, and `npm run test:integration` all pass (24 files, 78 tests).

---

## Previous Task
**Phase 11 — Security & Business Correctness**

**Status:** Completed on 2026-03-10

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
