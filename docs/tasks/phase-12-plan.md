# Phase 12 Plan — Attendee & Transaction Completions

**Status:** DONE
**Depends on:** Phase 11 complete ✅
**Goal:** Add complimentary tickets, ticket transfer, and event series. Password reset and waitlist are already fully implemented.

---

## Audit Results (verified against source 2026-03-10)

| Item | Status |
|------|--------|
| ATT-04 — Waitlist / notify-me | ✅ ALREADY DONE — full API + UI + email notification |
| ATT-05 — Password reset flow | ✅ ALREADY DONE — full API + UI at /auth/forgot-password and /auth/reset-password |
| ATT-01 — Complimentary ticket issuance | ✅ DONE — organizer API/UI, checkout inventory protection, comp email flow |
| ATT-02 — Ticket transfer | ✅ DONE — attendee initiation, public accept flow, orders UI updates, email notifications |
| ATT-03 — Event series | ✅ DONE — organizer API/UI, event assignment, public series pages |

**Remaining work: 0**

---

## Task 1 — Prisma Schema Migration

**File:** `prisma/schema.prisma`

Run this FIRST before any code. All 3 features share one migration.

### 1a. Add `TicketTransferStatus` enum (after existing enums)
```prisma
enum TicketTransferStatus {
  PENDING
  ACCEPTED
  CANCELLED
  EXPIRED
}
```

### 1b. Add fields to `TicketType`
```prisma
reservedQty  Int @default(0)   // seats reserved for comp tickets
compIssued   Int @default(0)   // how many comp tickets issued so far
```

### 1c. Add `isComplimentary` to `QRTicket`
```prisma
isComplimentary Boolean @default(false)
```

### 1d. Add `CompTicketIssuance` model (after QRTicket)
```prisma
model CompTicketIssuance {
  id              String     @id @default(cuid())
  ticketTypeId    String
  issuedByUserId  String
  recipientName   String
  recipientEmail  String
  note            String?
  qrTicketId      String     @unique
  createdAt       DateTime   @default(now())
  ticketType      TicketType @relation(fields: [ticketTypeId], references: [id], onDelete: Cascade)
  issuedBy        User       @relation(fields: [issuedByUserId], references: [id])
  qrTicket        QRTicket   @relation(fields: [qrTicketId], references: [id])

  @@index([ticketTypeId])
  @@index([issuedByUserId])
}
```

### 1e. Add `EventSeries` model (after Event)
```prisma
model EventSeries {
  id                 String           @id @default(cuid())
  organizerProfileId String
  title              String
  description        String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  organizerProfile   OrganizerProfile @relation(fields: [organizerProfileId], references: [id], onDelete: Cascade)
  events             Event[]

  @@index([organizerProfileId])
}
```

### 1f. Add `TicketTransfer` model (after CompTicketIssuance)
```prisma
model TicketTransfer {
  id         String               @id @default(cuid())
  qrTicketId String
  fromEmail  String
  toEmail    String
  toName     String
  token      String               @unique @default(cuid())
  status     TicketTransferStatus @default(PENDING)
  expiresAt  DateTime
  acceptedAt DateTime?
  createdAt  DateTime             @default(now())
  qrTicket   QRTicket             @relation(fields: [qrTicketId], references: [id], onDelete: Cascade)

  @@index([qrTicketId])
  @@index([token])
}
```

### 1g. Add relations to existing models
- `TicketType`: add `compIssuances CompTicketIssuance[]`
- `QRTicket`: add `compIssuance CompTicketIssuance?` and `transfers TicketTransfer[]`
- `User`: add `compIssuances CompTicketIssuance[]`
- `OrganizerProfile`: add `eventSeries EventSeries[]`
- `Event`: add `seriesId String?` and `series EventSeries? @relation(fields: [seriesId], references: [id])` and `@@index([seriesId])`

### Run after schema changes:
```bash
npx prisma migrate dev --name add-comp-tickets-series-transfer
npx prisma generate
npm run lint && npm run typecheck
```

**Commit:** `feat: schema — comp tickets, event series, ticket transfer`

---

## Task 2 — ATT-03: Event Series API + UI

### 2a. File to create: `app/api/organizer/series/route.ts`

**GET** — `requireRole("ORGANIZER")`. Return all series for the organizer profile with event count.

**POST** — body: `{ title: string, description?: string }`.
- Validate: title required, max 100 chars
- Find organizer profile by `auth.sub`
- Create `EventSeries` with `organizerProfileId`
- Return `ok(series, 201)`

### 2b. File to create: `app/api/organizer/series/[id]/route.ts`

**PATCH** — Update title/description. Verify series belongs to organizer before updating.

**DELETE** — Delete series. Events with this `seriesId` get `seriesId = null` (not cascade delete). Verify ownership before deleting.

### 2c. File to modify: `app/api/organizer/events/[id]/route.ts`

In the PATCH handler, accept optional `seriesId` in the body:
- If `seriesId` is provided, verify it belongs to this organizer's profile
- Update `event.seriesId`

### 2d. File to create: `app/api/public/series/[id]/route.ts`

**GET** — public, no auth. Return series details + all PUBLISHED events ordered by `startAt`.

### 2e. File to create: `app/organizer/series/page.tsx` ("use client")

- List all organizer's series with event count
- Create series form: Title, Description
- Each row: title, event count, Edit (inline), Delete, "View Events" link → `/events/series/[id]`
- Add "Series" to the organizer nav array (same nav used in all organizer pages)

### 2f. File to modify: `app/organizer/events/[id]/edit/page.tsx`

- Add "Series" select dropdown: fetch organizer's series from `/api/organizer/series`
- Allow assigning event to a series or clearing it (send `seriesId: null`)
- Show current series assignment

### 2g. File to create: `app/events/series/[id]/page.tsx` (SSR public page)

- Fetch from `GET /api/public/series/[id]`
- Show series title, description
- Grid of event cards (same card style as /events listing)
- "Back to all events" link

### 2h. File to modify: `app/events/[slug]/EventDetailClient.tsx`

- If event has a `series` object: show "Part of [Series Title]" badge/link below event title
- Link: `/events/series/[seriesId]`

**Commit:** `feat: event series API and UI`

---

## Task 3 — ATT-01: Complimentary Ticket API + UI

### 3a. File to modify: `app/api/organizer/events/[id]/tickets/[ticketId]/route.ts`

In the PATCH handler:
- Accept `reservedQty` in the Zod schema (number, min 0)
- Validate: `reservedQty <= quantity - sold` (cannot reserve more than available)
- Update `reservedQty` on the ticket type

### 3b. File to modify: `app/api/checkout/route.ts`

Change the available inventory check (inside transaction) from:
```ts
const available = ticketType.quantity - ticketType.sold;
```
To:
```ts
const available = ticketType.quantity - ticketType.sold - ticketType.reservedQty;
```

### 3c. File to create: `app/api/organizer/events/[id]/comp-tickets/route.ts`

**GET** — `requireRole("ORGANIZER")`. Verify event belongs to organizer.
- Return all `CompTicketIssuance` records for all ticket types of this event
- Include: recipientName, recipientEmail, note, createdAt, ticketType name, qrTicket ticketNumber

**POST** — body: `{ ticketTypeId, recipientName, recipientEmail, note? }`
- Verify ticketType belongs to this event and event belongs to organizer
- Check `compIssued < reservedQty` — if not: `fail(400, { code: "NO_COMP_SLOTS" })`
- In a `$transaction`:
  1. Create `Order` with status `PAID`, total `0`, platformFee `0`, gst `0`
  2. Create `OrderItem` for qty 1, unitPrice = ticketType.price, subtotal = 0
  3. Create `QRTicket` with `isComplimentary = true`
  4. Create `CompTicketIssuance`
  5. Increment `ticketType.compIssued += 1` and `ticketType.sold += 1`
- Fire-and-forget: send email to recipient ("You've received a complimentary ticket")
- Return `ok({ issuance })`

### 3d. File to create: `app/organizer/events/[id]/comp-tickets/page.tsx` ("use client")

- Auth guard, verify organizer owns event
- Per ticket type show: "X of Y reserved — Z issued — W remaining" stats
- "Issue Comp Ticket" form: Recipient Name, Recipient Email, Note (optional), Submit
- Table of issued comp tickets: Recipient, Email, Ticket Type, Issued At, Ticket Number
- Empty state if no `reservedQty` set: "Go to Edit Event to reserve comp ticket slots first"

### 3e. File to modify: `app/organizer/events/[id]/edit/page.tsx`

- Add "Reserved (Comp) Qty" number input on each ticket type row
- Show helper text: "X of Y reserved for complimentary tickets. Public available: Z"

### 3f. File to modify: `app/organizer/events/[id]/page.tsx`

- Add "Comp Tickets" button → `/organizer/events/${id}/comp-tickets`

**Commit:** `feat: complimentary ticket issuance API and UI`

---

## Task 4 — ATT-02: Ticket Transfer API + UI

### 4a. File to create: `app/api/account/orders/[orderId]/tickets/[ticketId]/transfer/route.ts`

**POST** — `requireAttendee()`. Body: `{ toEmail, toName }`
- Verify QRTicket belongs to an order owned by this attendee
- Check ticket not already checked in (`checkedInAt` must be null)
- Check no existing PENDING transfer for this ticket
- Create `TicketTransfer` with `expiresAt = now() + 48 hours`, status `PENDING`
- Fire-and-forget: send email to `toEmail` with accept link: `[APP_URL]/transfer/accept?token=[token]`
- Fire-and-forget: send confirmation to sender
- Return `ok({ transferId, expiresAt })`

**DELETE** — `requireAttendee()`. Cancel a PENDING transfer → set status `CANCELLED`.

### 4b. File to create: `app/api/transfer/accept/route.ts` (public — no auth)

**POST** — body: `{ token }`
- Find `TicketTransfer` by token, status must be `PENDING`, not expired
- In a `$transaction`:
  1. Update `Order`: set `buyerEmail = toEmail`, `buyerName = toName`
  2. Set transfer status to `ACCEPTED`, `acceptedAt = now()`
- Fire-and-forget: send confirmation emails to both parties
- Return `ok({ eventTitle, ticketNumber })`

### 4c. File to modify: `app/account/orders/page.tsx`

For each PAID order ticket:
- Show "Transfer" button if event hasn't started and ticket not checked in and no pending transfer
- On click: show inline form — Recipient Name, Recipient Email, Submit
- On success: "Transfer request sent to [email]. They have 48 hours to accept."
- Show "Cancel Transfer" button if transfer is PENDING
- Show "Transferred to [name]" badge if transfer is ACCEPTED

### 4d. File to create: `app/transfer/accept/page.tsx` (public, no auth)

- Read `?token=` from URL
- On load: POST to `/api/transfer/accept` with the token
- On success: "Ticket accepted! Check your email for your ticket."
- On failure/expired: "This transfer link has expired or is no longer valid."

**Commit:** `feat: ticket transfer API and UI`

---

## Task 5 — Integration Tests

**File to create:** `src/tests/integration/comp-tickets.test.ts`
- Set `reservedQty = 5` on ticket type
- Issue comp ticket → QRTicket created with `isComplimentary = true`
- Issue 6th → `400 NO_COMP_SLOTS`
- Reserved qty reduces public available in checkout

**File to create:** `src/tests/integration/event-series.test.ts`
- Create series via organizer API
- Link event to series via PATCH
- Public series endpoint returns the event

**File to create:** `src/tests/integration/ticket-transfer.test.ts`
- Attendee initiates transfer → PENDING
- Accept via token → ACCEPTED, ticket reassigned
- Duplicate accept → error
- Expired token → error

**Commit:** `test: phase 12 integration tests`

---

## Execution Order

```
Task 1 (schema migration)     → MUST be first — all 3 features depend on it
Task 2 (event series)         → smallest feature, good warm-up after migration
Task 3 (comp tickets)         → medium complexity
Task 4 (ticket transfer)      → most complex, do last
Task 5 (tests)                → after all features land
```

---

## Acceptance Gate

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing

---

## Status Tracking

| Task | Status |
|------|--------|
| Task 1 — Schema migration | DONE |
| Task 2 — Event series API + UI | DONE |
| Task 3 — Comp ticket API + UI | DONE |
| Task 4 — Ticket transfer API + UI | DONE |
| Task 5 — Integration tests | DONE |

## Completion Notes

- Added the shared migration SQL in `prisma/migrations/20260310120000_add_comp_tickets_series_transfer/migration.sql` after `prisma migrate dev` remained flaky in Prisma's schema engine.
- Event series now cover organizer CRUD, assignment from the event edit flow, public event detail linking, and SSR series landing pages.
- Complimentary tickets now reserve inventory, block checkout from overselling reserved stock, create real `Order` / `OrderItem` / `QRTicket` rows, and email the recipient.
- Ticket transfer now covers attendee initiation, cancellation, public acceptance by token, orders-page status badges/actions, and transfer emails to both parties.
- Validation completed with `npm run lint`, `npm run typecheck`, and `npm run test:integration` passing.
