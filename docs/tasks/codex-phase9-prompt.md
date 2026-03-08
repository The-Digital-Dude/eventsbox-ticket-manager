# Codex Prompt — Phase 9: Complimentary Tickets, Event Series & Ticket Transfer

You are working on the EventsBox Ticket Manager. Next.js 16 App Router, Prisma + PostgreSQL, Stripe, Resend, Cloudinary. Use `ok()`/`fail()` from `@/src/lib/http/response`, `requireRole()` from `@/src/lib/auth/server-auth`, `requireAttendee()` from `@/src/lib/auth/require-attendee`, `rateLimitRedis()` from `@/src/lib/http/rate-limit-redis`, Zod, Tailwind CSS v4.

Read `docs/tasks/phase-9-plan.md` for full spec. Execute tasks **in order, one at a time**. After each task run `npm run lint && npm run typecheck && npm run build` and fix ALL errors before moving on. Commit after each task.

---

## Task 1 — Prisma Schema Migration

Modify `prisma/schema.prisma`:

1. Add `TicketTransferStatus` enum after `CancellationRequestStatus`:
```prisma
enum TicketTransferStatus {
  PENDING
  ACCEPTED
  CANCELLED
  EXPIRED
}
```

2. Add to `TicketType` model:
```prisma
reservedQty  Int @default(0)
compIssued   Int @default(0)
```

3. Add to `QRTicket` model:
```prisma
isComplimentary Boolean @default(false)
```

4. Add `CompTicketIssuance` model after `QRTicket`:
```prisma
model CompTicketIssuance {
  id             String     @id @default(cuid())
  ticketTypeId   String
  issuedByUserId String
  recipientName  String
  recipientEmail String
  note           String?
  qrTicketId     String     @unique
  createdAt      DateTime   @default(now())
  ticketType     TicketType @relation(fields: [ticketTypeId], references: [id], onDelete: Cascade)
  issuedBy       User       @relation(fields: [issuedByUserId], references: [id])
  qrTicket       QRTicket   @relation(fields: [qrTicketId], references: [id])

  @@index([ticketTypeId])
  @@index([issuedByUserId])
}
```

5. Add `EventSeries` model after `Event`:
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

6. Add `TicketTransfer` model after `CompTicketIssuance`:
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

7. Add relations to existing models:
- `TicketType`: add `compIssuances CompTicketIssuance[]`
- `QRTicket`: add `compIssuance CompTicketIssuance?` and `transfers TicketTransfer[]`
- `User`: add `compIssuances CompTicketIssuance[]`
- `OrganizerProfile`: add `eventSeries EventSeries[]`
- `Event`: add `seriesId String?`, `series EventSeries? @relation(fields: [seriesId], references: [id])`, and `@@index([seriesId])`

Run: `npx prisma migrate dev --name add-comp-tickets-series-transfer`
Run: `npx prisma generate`
Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: schema — comp tickets, event series, ticket transfer`

---

## Task 2 — Reserved Qty on Ticket Type + Checkout Guard

Modify `app/api/organizer/events/[id]/tickets/[ticketId]/route.ts`:
- Add `reservedQty: z.number().int().min(0).optional()` to the PATCH Zod schema
- Before updating: if `reservedQty` provided, validate `reservedQty <= ticketType.quantity - ticketType.sold` — if not: `fail(400, { code: "INVALID_RESERVED_QTY", message: "Reserved qty cannot exceed available unsold tickets" })`
- Include `reservedQty` in the update data

Modify `app/api/checkout/route.ts`:
- Change inventory check from `const available = tt.quantity - tt.sold` to `const available = tt.quantity - tt.sold - tt.reservedQty`
- Everything else stays the same

Modify `app/organizer/events/[id]/edit/page.tsx`:
- On each ticket type form/row, add a "Reserved for Comp" number input (min 0)
- Show helper text: "Available to public: [quantity - sold - reservedQty]"
- Save via existing PATCH ticket endpoint

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: comp ticket reserved quantity on ticket types`

---

## Task 3 — Complimentary Ticket Issuance API

Create `app/api/organizer/events/[id]/comp-tickets/route.ts`:

**GET**: `requireRole("ORGANIZER")`. Verify event belongs to organizer.
- Fetch all `CompTicketIssuance` where ticketType.eventId = id
- Include: recipientName, recipientEmail, note, createdAt, ticketType name, qrTicket ticketNumber and token
- Return `ok({ issuances })`

**POST**: `requireRole("ORGANIZER")`. Validate body:
```ts
z.object({
  ticketTypeId: z.string(),
  recipientName: z.string().min(1),
  recipientEmail: z.string().email(),
  note: z.string().max(300).optional(),
})
```
- Verify ticketType belongs to this event and event belongs to organizer
- Check `ticketType.compIssued < ticketType.reservedQty` — else `fail(400, { code: "NO_COMP_SLOTS" })`
- Use `prisma.$transaction`:
  1. Create `Order`: status PAID, buyerName, buyerEmail, total 0, subtotal 0, platformFee 0, gst 0, discountAmount = ticketType.price, eventId, paidAt = now()
  2. Create `OrderItem`: orderId, ticketTypeId, quantity 1, unitPrice = ticketType.price, subtotal 0
  3. Create `QRTicket`: orderId, orderItemId, ticketNumber = `COMP-${nanoid(8).toUpperCase()}`, isComplimentary = true
  4. Create `CompTicketIssuance`: ticketTypeId, issuedByUserId = session.user.id, recipientName, recipientEmail, note, qrTicketId
  5. `prisma.ticketType.update({ data: { compIssued: { increment: 1 }, sold: { increment: 1 } } })`
- Fire-and-forget email to recipientEmail: "You've received a complimentary ticket for [Event Title]. Ticket number: [ticketNumber]"
- Return `ok({ issuance })`

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: comp ticket issuance API`

---

## Task 4 — Comp Ticket Organizer UI

Create `app/organizer/events/[id]/comp-tickets/page.tsx` ("use client"):
- On mount: fetch `GET /api/organizer/events/[id]/comp-tickets` and event details
- Per ticket type that has `reservedQty > 0`: show stat row "Reserved: X | Issued: Y | Remaining: Z"
- Issue form per ticket type: Recipient Name, Recipient Email, Note (optional), Submit
- On submit: `POST /api/organizer/events/[id]/comp-tickets`
- On success: toast "Comp ticket sent to [email]", refresh list
- Issued tickets table: Recipient Name, Email, Ticket Type, Ticket Number, Issued At
- If no ticket type has `reservedQty > 0`: show info box "No comp ticket slots reserved. Edit the event's ticket types to reserve comp slots first." with link to edit page

Modify `app/organizer/events/[id]/page.tsx`:
- Add "Comp Tickets" button in event header action group → `/organizer/events/${id}/comp-tickets`

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: organizer comp ticket management UI`

---

## Task 5 — Event Series API

Create `app/api/organizer/series/route.ts`:

**GET**: `requireRole("ORGANIZER")`. Find organizer profile. Return all `EventSeries` where `organizerProfileId = profile.id`. Include `_count { select: { events: true } }`.

**POST**: body `{ title: z.string().min(1).max(100), description: z.string().optional() }`. `requireRole("ORGANIZER")`. Create series. Return `ok(series, 201)`.

Create `app/api/organizer/series/[id]/route.ts`:

**PATCH**: body `{ title?, description? }`. Verify series belongs to organizer. Update and return.

**DELETE**: Verify ownership. `prisma.event.updateMany({ where: { seriesId: id }, data: { seriesId: null } })` then delete series. Return `ok({ deleted: true })`.

Modify `app/api/organizer/events/[id]/route.ts` PATCH handler:
- Accept optional `seriesId: z.string().nullable().optional()` in body
- If provided: verify series belongs to organizer or is null (to unlink)
- Include in update data

Create `app/api/public/series/[id]/route.ts`:

**GET**: public, no auth. Find `EventSeries` by id. Include `events` where `status = PUBLISHED`, ordered by `startAt asc`. Include event category, state, city. Return `ok({ series, events })`.

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: event series API`

---

## Task 6 — Event Series Organizer UI + Public Page

Create `app/organizer/series/page.tsx` ("use client"):
- On mount: fetch `GET /api/organizer/series`
- List of series cards: title, description, event count
- Create form at top: Title (required), Description (optional), Create button
- Each card: Edit button (toggles inline edit for title/description), Delete button (confirm first)
- Empty state: "No series yet. Create one to group related events."

Modify `app/organizer/events/[id]/edit/page.tsx`:
- Fetch organizer's series from `GET /api/organizer/series`
- Add "Event Series" select field: options = organizer's series + "None"
- On change: include `seriesId` (or `null`) in PATCH body
- Show current series assignment

Create `app/events/series/[id]/page.tsx` (SSR public):
- Fetch `GET /api/public/series/[id]`
- If not found: `notFound()`
- Show series title, description
- Grid of event cards (same card component as `/events` page)
- "Browse all events" link at bottom

Modify `app/events/[slug]/page.tsx`:
- If `event.seriesId`: show "Part of series: [series.title]" badge linking to `/events/series/${event.seriesId}`

Add `{ href: "/organizer/series", label: "Series" }` to nav array in ALL organizer page files.

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: event series organizer UI and public page`

---

## Task 7 — Ticket Transfer API

Create `app/api/account/orders/[orderId]/tickets/[ticketId]/transfer/route.ts`:

**POST**: `requireAttendee()`. Body: `{ toEmail: z.string().email(), toName: z.string().min(1) }`.
- Find attendee profile for session user
- Find order: `orderId` must belong to attendee, status PAID
- Find QRTicket: `ticketId` must belong to this order
- Check `qrTicket.checkedInAt === null` — else `fail(400, { code: "ALREADY_CHECKED_IN" })`
- Check no existing PENDING transfer for this ticket: `prisma.ticketTransfer.findFirst({ where: { qrTicketId: ticketId, status: "PENDING" } })` — else `fail(409, { code: "TRANSFER_PENDING" })`
- Create `TicketTransfer`: fromEmail = order.buyerEmail, toEmail, toName, expiresAt = now() + 48h, status PENDING
- Fire-and-forget email to toEmail: "You've been offered a ticket for [Event Title]. Accept here: [APP_URL]/transfer/accept?token=[token]. Offer expires in 48 hours."
- Fire-and-forget email to fromEmail: "Your transfer request to [toEmail] has been sent."
- Return `ok({ transferId: transfer.id, expiresAt: transfer.expiresAt })`

**DELETE**: `requireAttendee()`. Find transfer by query param `?transferId=`. Verify qrTicket belongs to attendee's order. Update status to CANCELLED. Return `ok({ cancelled: true })`.

Create `app/api/transfer/accept/route.ts` (public — no auth):

**POST**: body `{ token: string }`.
- Find `TicketTransfer` by token — if not found: `fail(404, { code: "NOT_FOUND" })`
- If status !== PENDING: `fail(400, { code: "ALREADY_USED" })`
- If `expiresAt < now()`: update status to EXPIRED, `fail(400, { code: "EXPIRED" })`
- In transaction:
  1. Update `Order`: `buyerEmail = transfer.toEmail`, `buyerName = transfer.toName`
  2. Update `TicketTransfer`: status ACCEPTED, acceptedAt = now()
- Fire-and-forget emails to both parties confirming the transfer
- Return `ok({ eventTitle, ticketNumber })`

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: ticket transfer API`

---

## Task 8 — Ticket Transfer UI

Modify `app/account/orders/page.tsx`:
- For each QRTicket in a PAID order (where event startAt > now and checkedInAt is null):
  - Add "Transfer" button
  - On click: show inline form — Recipient Name, Recipient Email, Submit
  - POST to `/api/account/orders/${orderId}/tickets/${ticketId}/transfer`
  - On success: replace form with "Transfer pending — awaiting [toEmail]. Offer expires in 48h." + "Cancel" button
  - Cancel: DELETE to same route with `?transferId=`, resets UI on success
  - If transfer.status is ACCEPTED: show "Transferred to [toName]" badge (grey out ticket row)

Create `app/transfer/accept/page.tsx` (public, no auth, "use client"):
- Read `?token=` from URL using `useSearchParams`
- On mount: POST to `/api/transfer/accept` with `{ token }`
- Show loading spinner while processing
- On success: show "✅ Ticket accepted! Event: [eventTitle], Ticket: [ticketNumber]. Check your email for your ticket details."
- On EXPIRED: show "❌ This transfer offer has expired."
- On ALREADY_USED: show "ℹ️ This transfer has already been accepted."
- On NOT_FOUND: show "❌ Invalid transfer link."
- "Browse events" link at bottom

Run: `npm run lint && npm run typecheck && npm run build`. Fix errors.
Commit: `feat: ticket transfer UI`

---

## Task 9 — Integration Tests

Create `src/tests/integration/comp-tickets.test.ts`:
- Set `reservedQty = 5` on ticket type → 200
- Issue comp ticket → 201, QRTicket has `isComplimentary = true`
- Issue 6th comp ticket → 400 `NO_COMP_SLOTS`
- Checkout: reserved tickets reduce public available (reserved 5 of 10, only 5 purchasable)

Create `src/tests/integration/event-series.test.ts`:
- Organizer creates series → 201
- Links event to series via PATCH → event.seriesId set
- Public `GET /api/public/series/[id]` returns series + events
- Delete series → events get seriesId = null

Create `src/tests/integration/ticket-transfer.test.ts`:
- Attendee initiates transfer → 200, PENDING transfer created
- Duplicate transfer request → 409
- Accept transfer via token → 200, order buyer updated, status ACCEPTED
- Accept already-accepted token → 400 ALREADY_USED
- Expired token (manually set expiresAt in past) → 400 EXPIRED

Run: `npm run test:integration`. All old + new tests must pass. Fix any failures.
Commit: `test: phase 9 integration tests`

---

## Task 10 — Release Notes

Create `docs/releases/phase-9-release-notes.md`:
- Date (today), status Complete
- Summary: Complimentary Tickets, Event Series, Ticket Transfer
- Migration name: `add-comp-tickets-series-transfer`
- New routes listed
- Validation: lint ✅, typecheck ✅, build ✅, test:integration ✅

Update `docs/tasks/phase-9-plan.md` — set all tasks to DONE.

Commit: `docs: phase 9 release notes and plan completion`

---

## Final Validation

Run: `npm run lint && npm run typecheck && npm run build && npm run test:integration`
All must pass with zero errors. Push to `main` when complete.
