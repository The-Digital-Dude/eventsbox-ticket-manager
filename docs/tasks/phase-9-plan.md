# Phase 9 Plan — Complimentary Tickets, Event Series & Ticket Transfer

**Status:** TODO
**Depends on:** Phase 8 complete ✅
**Goal:** Add complimentary (held) ticket system for organizers, event series for recurring events, and attendee ticket transfer.

---

## Task Order (Sequential — do not reorder)

---

### Task 1 — Prisma Schema Migration

**File to modify:** `prisma/schema.prisma`

**1. Add `TicketTransferStatus` enum** (after `CancellationRequestStatus`):
```prisma
enum TicketTransferStatus {
  PENDING
  ACCEPTED
  CANCELLED
  EXPIRED
}
```

**2. Add `reservedQty` and `compIssued` to `TicketType`:**
```prisma
reservedQty  Int @default(0)
compIssued   Int @default(0)
```

**3. Add `isComplimentary` to `QRTicket`:**
```prisma
isComplimentary Boolean @default(false)
```

**4. Add `CompTicketIssuance` model** (after `QRTicket`):
```prisma
model CompTicketIssuance {
  id              String    @id @default(cuid())
  ticketTypeId    String
  issuedByUserId  String
  recipientName   String
  recipientEmail  String
  note            String?
  qrTicketId      String    @unique
  createdAt       DateTime  @default(now())
  ticketType      TicketType @relation(fields: [ticketTypeId], references: [id], onDelete: Cascade)
  issuedBy        User       @relation(fields: [issuedByUserId], references: [id])
  qrTicket        QRTicket   @relation(fields: [qrTicketId], references: [id])

  @@index([ticketTypeId])
  @@index([issuedByUserId])
}
```

**5. Add `EventSeries` model** (after `Event`):
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

**6. Add `TicketTransfer` model** (after `CompTicketIssuance`):
```prisma
model TicketTransfer {
  id          String              @id @default(cuid())
  qrTicketId  String
  fromEmail   String
  toEmail     String
  toName      String
  token       String              @unique @default(cuid())
  status      TicketTransferStatus @default(PENDING)
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime            @default(now())
  qrTicket    QRTicket            @relation(fields: [qrTicketId], references: [id], onDelete: Cascade)

  @@index([qrTicketId])
  @@index([token])
}
```

**7. Add relations to existing models:**
- `TicketType`: add `compIssuances CompTicketIssuance[]`
- `QRTicket`: add `compIssuance CompTicketIssuance?` and `transfers TicketTransfer[]`
- `User`: add `compIssuances CompTicketIssuance[]`
- `OrganizerProfile`: add `eventSeries EventSeries[]`
- `Event`: add `seriesId String?` and `series EventSeries? @relation(fields: [seriesId], references: [id])` and index `@@index([seriesId])`

Run: `npx prisma migrate dev --name add-comp-tickets-series-transfer`
Run: `npx prisma generate`
Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: schema — comp tickets, event series, ticket transfer`

---

### Task 2 — Complimentary Ticket: Reserve Qty on Ticket Type

**File to modify:** `app/api/organizer/events/[id]/tickets/[ticketId]/route.ts`

**PATCH changes:**
- Accept `reservedQty` in the update body (add to Zod schema)
- Validate: `reservedQty` must be >= 0 and <= `quantity - sold`
- Update `reservedQty` on the ticket type
- Public available quantity must always be computed as `quantity - sold - reservedQty` — this affects the checkout inventory check

**File to modify:** `app/api/checkout/route.ts`
- Change available inventory check from `tt.quantity - tt.sold` to `tt.quantity - tt.sold - tt.reservedQty`
- If `item.quantity > available`: return `fail(400, { code: "INSUFFICIENT_INVENTORY" })` as before

**File to modify:** `app/organizer/events/[id]/edit/page.tsx`
- Add "Reserved (Comp) Qty" number input on each ticket type row
- Show below quantity field: "X of Y reserved for complimentary tickets"
- Public available = quantity - sold - reservedQty shown as helper text

**Acceptance criteria:**
- Setting `reservedQty = 10` on a 100-ticket type means only 90 are purchasable
- `lint` and `typecheck` pass
Commit: `feat: comp ticket reserved quantity on ticket types`

---

### Task 3 — Complimentary Ticket: Issue API

**File to create:** `app/api/organizer/events/[id]/comp-tickets/route.ts`

**GET** — `requireRole("ORGANIZER")`. Verify event belongs to organizer.
- Return all `CompTicketIssuance` records for all ticket types of this event
- Include: recipientName, recipientEmail, note, createdAt, ticketType name, qrTicket token and ticketNumber
- Return `ok({ issuances })`

**POST** — `requireRole("ORGANIZER")`. Body: `{ ticketTypeId, recipientName, recipientEmail, note? }`.
- Verify ticketType belongs to this event and event belongs to organizer
- Check `compIssued < reservedQty` — if not: `fail(400, { code: "NO_COMP_SLOTS", message: "No complimentary slots remaining. Increase reserved quantity first." })`
- In a transaction:
  1. Create a placeholder `Order` with status `PAID`, total `0`, platformFee `0`, gst `0`, buyerName = recipientName, buyerEmail = recipientEmail, `discountAmount = ticketType.price` (full discount)
  2. Create `OrderItem` for qty 1, unitPrice = ticketType.price, subtotal = 0
  3. Create `QRTicket` with `isComplimentary = true`
  4. Create `CompTicketIssuance` linking ticketType, issuedByUserId = session.user.id, qrTicketId
  5. Increment `ticketType.compIssued += 1` and `ticketType.sold += 1`
- Send ticket email to recipient (fire-and-forget): "You've received a complimentary ticket for [Event Title]! Your ticket: [QR code or link]"
- Return `ok({ issuance })`

**Acceptance criteria:**
- Issuing a comp ticket creates a real QRTicket scannable at the door
- Issuing beyond `reservedQty` fails with clear error
- `lint` and `typecheck` pass
Commit: `feat: comp ticket issuance API`

---

### Task 4 — Complimentary Ticket: Organizer UI

**File to create:** `app/organizer/events/[id]/comp-tickets/page.tsx`

**Behavior (SSR + client actions):**
- Auth guard, verify organizer owns event
- Fetch `GET /api/organizer/events/[id]/comp-tickets`
- Per ticket type: show "X of Y reserved — Z issued — W remaining" stats
- "Issue Comp Ticket" form per ticket type:
  - Recipient Name (required)
  - Recipient Email (required)
  - Note (optional)
  - Submit → `POST /api/organizer/events/[id]/comp-tickets`
- Table of all issued comp tickets: Recipient, Email, Ticket Type, Issued At, Ticket Number
- Toast on success: "Complimentary ticket sent to [email]"
- Empty state if no reservedQty set on any ticket type: show prompt "Go to Edit Event to reserve comp ticket slots first"

**File to modify:** `app/organizer/events/[id]/page.tsx`
- Add "Comp Tickets" button/link in event header actions → `/organizer/events/${id}/comp-tickets`
- Show total comp slots and issued count in the event stats section

**Acceptance criteria:**
- Organizer can issue comp tickets from the UI
- Issued tickets appear in the table
- `lint` and `typecheck` pass
Commit: `feat: organizer comp ticket management UI`

---

### Task 5 — Event Series: API

**File to create:** `app/api/organizer/series/route.ts`

**GET** — `requireRole("ORGANIZER")`. Return all series for organizer profile. Include event count per series.

**POST** — body: `{ title, description? }`. Validate: title required, max 100 chars. Create `EventSeries`. Return `ok(series, 201)`.

**File to create:** `app/api/organizer/series/[id]/route.ts`

**PATCH** — update title/description. Verify ownership.

**DELETE** — delete series. Events with this seriesId get `seriesId = null` (set null, not cascade delete). Verify ownership.

**File to modify:** `app/api/organizer/events/[id]/route.ts`
- Accept optional `seriesId` in PATCH body
- Validate seriesId belongs to this organizer's profile if provided
- Update `event.seriesId`

**File to create:** `app/api/public/series/[id]/route.ts`

**GET** — public endpoint. Return series details + all PUBLISHED events in the series ordered by startAt.

**Acceptance criteria:**
- Organizer can create, update, delete series
- Events can be linked to a series
- Public can fetch series with its events
- `lint` and `typecheck` pass
Commit: `feat: event series API`

---

### Task 6 — Event Series: Organizer UI + Public Page

**File to create:** `app/organizer/series/page.tsx` ("use client")
- List all series with event count
- Create new series form: Title, Description
- Each series row: title, event count, Edit button (inline), Delete button, "View Events" link
- Edit inline: update title/description via PATCH

**File to modify:** `app/organizer/events/[id]/edit/page.tsx`
- Add "Series" select dropdown: fetch organizer's series, allow assigning event to a series or removing it
- Show current series assignment

**File to create:** `app/events/series/[id]/page.tsx` (SSR public page)
- Fetch from `GET /api/public/series/[id]`
- Show series title, description
- Grid of event cards (same card style as `/events` listing)
- "Back to all events" link

**File to modify:** `app/events/[slug]/page.tsx`
- If event has a series: show "Part of [Series Title]" badge/link below event title → `/events/series/[seriesId]`

**Nav:** Add `{ href: "/organizer/series", label: "Series" }` to all organizer page nav arrays.

**Acceptance criteria:**
- Organizer can manage series from nav
- Events can be linked to series via edit page
- Public series page shows all events in the series
- `lint` and `typecheck` pass
Commit: `feat: event series organizer UI and public page`

---

### Task 7 — Ticket Transfer: API

**File to create:** `app/api/account/orders/[orderId]/tickets/[ticketId]/transfer/route.ts`

**POST** — `requireAttendee()`. Body: `{ toEmail, toName }`.
- Verify QRTicket belongs to an order owned by this attendee
- Check ticket not already checked in (`checkedInAt` must be null)
- Check no existing PENDING transfer for this ticket
- Create `TicketTransfer` with `expiresAt = now() + 48 hours`, status PENDING
- Send email to `toEmail`: "You've been offered a ticket for [Event Title]. Accept here: [APP_URL]/transfer/accept?token=[token]" (fire-and-forget)
- Send confirmation email to sender: "Transfer request sent to [toEmail]" (fire-and-forget)
- Return `ok({ transferId, expiresAt })`

**DELETE** — `requireAttendee()`. Cancel a PENDING transfer. Set status to CANCELLED.

**File to create:** `app/api/transfer/accept/route.ts` (public — no auth required)

**POST** — body: `{ token }`.
- Find `TicketTransfer` by token, status must be PENDING, not expired
- In a transaction:
  1. Update `QRTicket`: set `order.buyerEmail = toEmail`, `order.buyerName = toName` — actually update the Order's buyer fields OR create a note on the QRTicket
  2. Set transfer status to ACCEPTED, acceptedAt = now()
- Send confirmation emails to both parties
- Return `ok({ eventTitle, ticketNumber })`

**Acceptance criteria:**
- Attendee can initiate a transfer from their orders page
- Recipient gets an email with accept link
- On accept, ticket is reassigned
- Checked-in tickets cannot be transferred
- `lint` and `typecheck` pass
Commit: `feat: ticket transfer API`

---

### Task 8 — Ticket Transfer: UI

**File to modify:** `app/account/orders/page.tsx`
- For each PAID order ticket, add "Transfer" button (if event hasn't started yet and ticket not checked in)
- On click: show inline form — Recipient Name, Recipient Email, Submit
- Calls `POST /api/account/orders/[orderId]/tickets/[ticketId]/transfer`
- On success: show "Transfer request sent to [email]. They have 48 hours to accept."
- Show "Cancel Transfer" button if transfer is PENDING
- If transfer ACCEPTED: show "Transferred to [name]" badge

**File to create:** `app/transfer/accept/page.tsx` (public, no auth)
- Reads `?token=` from URL
- On load: calls `POST /api/transfer/accept` with the token
- On success: show "Ticket accepted! Check your email for your ticket."
- On failure/expired: show "This transfer link has expired or is no longer valid."

**Acceptance criteria:**
- Transfer flow works end to end
- Expired links show clear error
- `lint` and `typecheck` pass
Commit: `feat: ticket transfer UI`

---

### Task 9 — Integration Tests

**File to create:** `src/tests/integration/comp-tickets.test.ts`
- Set `reservedQty = 5` on ticket type
- Issue comp ticket → QRTicket created with `isComplimentary = true`
- Issue 6th comp ticket → 400 `NO_COMP_SLOTS`
- Reserved tickets reduce public available inventory at checkout

**File to create:** `src/tests/integration/event-series.test.ts`
- Create series via organizer API
- Link event to series via PATCH
- Public series endpoint returns event

**File to create:** `src/tests/integration/ticket-transfer.test.ts`
- Attendee initiates transfer → PENDING
- Accept transfer via token → ACCEPTED, ticket reassigned
- Duplicate accept → error
- Expired token → error

Run: `npm run test:integration`. All (old + new) must pass.
Commit: `test: phase 9 integration tests`

---

### Task 10 — Release Notes

**File to create:** `docs/releases/phase-9-release-notes.md`
- Date, status Complete, feature summary, migration name, validation evidence

**File to update:** `docs/tasks/phase-9-plan.md` — mark all tasks DONE.

Commit: `docs: phase 9 release notes and plan completion`

---

## Status Table

| Task | Description | Status |
|------|-------------|--------|
| 1 | Schema migration | TODO |
| 2 | Reserved qty on ticket type + checkout guard | TODO |
| 3 | Comp ticket issuance API | TODO |
| 4 | Comp ticket organizer UI | TODO |
| 5 | Event series API | TODO |
| 6 | Event series organizer UI + public page | TODO |
| 7 | Ticket transfer API | TODO |
| 8 | Ticket transfer UI | TODO |
| 9 | Integration tests | TODO |
| 10 | Release notes | TODO |

---

## Out of Scope
- Comp ticket email template customisation
- Bulk comp ticket issuance (CSV upload of recipients)
- Series with a shared cover image/banner
- Transfer to a logged-in attendee only (for now any email)
- Partial ticket transfer (transferring 1 of 3 tickets in an order)
