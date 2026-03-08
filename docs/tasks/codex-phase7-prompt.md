# Codex Prompt — Phase 7: Promo Codes & Attendee Self-Service

You are working on the EventsBox Ticket Manager — a Next.js 16 App Router fullstack app with Prisma + PostgreSQL, Stripe, Resend, and Cloudinary. The stack uses: `ok()`/`fail()` from `@/src/lib/http/response`, `requireRole()` from `@/src/lib/auth/server-auth`, `requireAttendee()` from `@/src/lib/auth/require-attendee`, Zod validators, `rateLimitRedis()` from `@/src/lib/http/rate-limit-redis`, Tailwind CSS v4.

Read `docs/tasks/phase-7-plan.md` for the full spec. Execute tasks **in order, one at a time**. After each task run `npm run lint && npm run typecheck` and fix all errors before moving on. Commit after each task.

---

## Task 1 — Prisma Schema Migration

Modify `prisma/schema.prisma`:

1. Add two new enums after `OrderStatus`:
```prisma
enum DiscountType {
  PERCENTAGE
  FIXED
}

enum CancellationRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

2. Add `PromoCode` model after `TicketType`:
```prisma
model PromoCode {
  id                 String           @id @default(cuid())
  organizerProfileId String
  eventId            String?
  code               String           @unique
  discountType       DiscountType
  discountValue      Decimal          @db.Decimal(10, 2)
  maxUses            Int?
  usedCount          Int              @default(0)
  expiresAt          DateTime?
  isActive           Boolean          @default(true)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  organizerProfile   OrganizerProfile @relation(fields: [organizerProfileId], references: [id], onDelete: Cascade)
  event              Event?           @relation(fields: [eventId], references: [id], onDelete: SetNull)
  orders             Order[]

  @@index([organizerProfileId])
  @@index([code])
}
```

3. Add `CancellationRequest` model after the `Order` model:
```prisma
model CancellationRequest {
  id              String                    @id @default(cuid())
  orderId         String                    @unique
  attendeeUserId  String
  reason          String?
  status          CancellationRequestStatus @default(PENDING)
  adminNote       String?
  resolvedAt      DateTime?
  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt
  order           Order                     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  attendeeProfile AttendeeProfile           @relation(fields: [attendeeUserId], references: [id], onDelete: Cascade)
}
```

4. Add to `OrganizerProfile`: `promoCodes PromoCode[]`
5. Add to `Event`: `promoCodes PromoCode[]`
6. Add to `Order`:
```prisma
promoCodeId         String?
discountAmount      Decimal    @default(0) @db.Decimal(10, 2)
promoCode           PromoCode? @relation(fields: [promoCodeId], references: [id])
cancellationRequest CancellationRequest?
```
Add `@@index([promoCodeId])` to Order.
7. Add to `AttendeeProfile`: `cancellationRequests CancellationRequest[]`

Run: `npx prisma migrate dev --name add-promo-codes-and-cancellation`
Run: `npx prisma generate`
Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: schema — promo codes and cancellation requests`

---

## Task 2 — Organizer Promo Code API

Create `app/api/organizer/promo-codes/route.ts`:

**GET**: `requireRole("ORGANIZER")`. Find organizer profile for the session user. Return all promo codes where `organizerProfileId = profile.id`. Include event title if eventId set.

**POST**: `requireRole("ORGANIZER")`. Validate body with Zod:
```ts
z.object({
  code: z.string().min(4).max(20).regex(/^[A-Z0-9]+$/, "Uppercase alphanumeric only"),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  eventId: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
})
```
Check `code` not already taken (`prisma.promoCode.findUnique({ where: { code } })`). If `eventId` provided, verify event belongs to this organizer. Create and return the promo code.

Create `app/api/organizer/promo-codes/[id]/route.ts`:

**PATCH**: Validate body `{ isActive?: boolean, maxUses?: number, expiresAt?: string }`. Verify promo code belongs to organizer's profile before updating.

**DELETE**: Set `isActive = false`. Do not hard delete. Verify ownership first.

All handlers: structured `catch (error) { console.error(...); return fail(500, ...) }`.

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer promo code CRUD API`

---

## Task 3 — Organizer Promo Code Management Page

Create `app/organizer/promo-codes/page.tsx` as a `"use client"` component:

- On mount: fetch `GET /api/organizer/promo-codes`
- Show table with columns: Code, Type, Value, Uses (usedCount/maxUses or "Unlimited"), Expires, Active toggle, Deactivate button
- Active toggle: `PATCH /api/organizer/promo-codes/[id]` with `{ isActive: !current }`
- Deactivate: `DELETE /api/organizer/promo-codes/[id]`, remove from list
- "New Promo Code" section above table with form fields: Code (input, auto-uppercase on change), Type (select PERCENTAGE/FIXED), Value (number), Max Uses (number, optional), Expires At (`<input type="datetime-local">`, optional), Event (select from fetched events, optional — fetch `GET /api/organizer/events` for the list)
- Submit calls `POST /api/organizer/promo-codes`, adds to table on success
- Use `Input`, `Label`, `Button`, `Badge` from `@/src/components/ui/*`
- Nav: add `{ href: "/organizer/promo-codes", label: "Promo Codes" }` to the `nav` array in **every** organizer page file (`dashboard`, `events`, `analytics`, `payout`, `venues`, `scanner`, `status`, `onboarding`, `promo-codes`)

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer promo code management page`

---

## Task 4 — Apply Promo Code at Checkout

Create `app/api/checkout/validate-promo/route.ts`:

**POST**: body `{ code: string, eventId: string }`. Find promo code where:
- `code` matches (store as uppercase, compare uppercase)
- `isActive = true`
- `expiresAt IS NULL OR expiresAt > now()`
- `eventId IS NULL OR eventId = given eventId`
- `maxUses IS NULL OR usedCount < maxUses`

If found: return `ok({ valid: true, discountType, discountValue, promoCodeId })`.
If not found or fails any check: return `ok({ valid: false, message: "..." })`.

Modify `app/api/checkout/route.ts`:
- Add `promoCodeId: z.string().optional()` to `checkoutIntentSchema` (or create inline Zod extension)
- If `promoCodeId` provided: re-validate server-side (same checks as above — never trust client)
- Calculate `discountAmount`: PERCENTAGE → `subtotal * (discountValue / 100)`, FIXED → `Math.min(discountValue, subtotal)`. Round to 2dp.
- New `discountedSubtotal = subtotal - discountAmount`
- Recalculate: `platformFee` and `gst` based on `discountedSubtotal`
- `total = discountedSubtotal + platformFee + gst`
- Store on order: `promoCodeId`, `discountAmount`
- After order created: `prisma.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } })`
- Return `discountAmount` in summary response

Modify `app/events/[slug]/page.tsx`:
- Add promo code input and "Apply" button above the checkout section
- "Apply" calls `POST /api/checkout/validate-promo` with `{ code, eventId }`
- On success with `valid: true`: show discount in green text, store `promoCodeId` in state, include in checkout POST body
- On `valid: false`: show error message inline in red
- Store `promoCodeId` in component state; pass it as part of the checkout payload

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: promo code validation and checkout discount`

---

## Task 5 — Attendee Order Cancellation Request

Create `app/api/account/orders/[orderId]/cancel/route.ts`:

**POST**: `requireAttendee()`. Body: `{ reason?: string }`.
- Find `AttendeeProfile` for session user
- Find order by `orderId` where `attendeeUserId = profile.id` and `status = "PAID"`
- If not found: `fail(404, { code: "NOT_FOUND" })`
- Check `prisma.cancellationRequest.findUnique({ where: { orderId } })` — if exists: `fail(409, { code: "ALREADY_REQUESTED" })`
- Create `CancellationRequest`
- Fire-and-forget: send email to event organizer's support email (from `event.contactEmail` or organizer's `supportEmail`) notifying of the request
- Return `ok({ requestId: request.id, status: "PENDING" })`

Modify `app/account/orders/page.tsx`:
- For PAID orders, add a "Request Cancellation" button
- On click: show inline form with optional textarea for reason
- Submit: `POST /api/account/orders/[orderId]/cancel`
- On success: replace button with `<Badge>Cancellation Requested</Badge>`
- On `ALREADY_REQUESTED` error: show same badge without re-submitting

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: attendee order cancellation request`

---

## Task 6 — Organizer Cancellation Request Management

Create `app/api/organizer/cancellation-requests/route.ts`:

**GET**: `requireRole("ORGANIZER")`. Find organizer profile. Return all `CancellationRequest` records for orders belonging to the organizer's events. Include: order id, buyerEmail, event title, reason, status, createdAt. Filter by `?status=` query param.

Create `app/api/organizer/cancellation-requests/[id]/route.ts`:

**PATCH**: body `{ action: "APPROVE" | "REJECT", adminNote?: string }`.
- Find `CancellationRequest` by id, include order + event, verify event belongs to organizer
- If `APPROVE`:
  - Trigger Stripe refund: `stripe.refunds.create({ payment_intent: order.stripePaymentIntentId })`
  - Update order: `status = "REFUNDED"`
  - Update request: `status = "APPROVED"`, `resolvedAt = now()`, `adminNote`
  - Send refund confirmation email to buyer (use existing `sendRefundConfirmationEmail` or equivalent from notifications service)
  - Write audit log entry
- If `REJECT`:
  - Update request: `status = "REJECTED"`, `resolvedAt = now()`, `adminNote`
  - Send rejection email to buyer with `adminNote`
- Return `ok({ status })`

Create `app/organizer/cancellation-requests/page.tsx` (SSR):
- Auth guard
- Fetch via `GET /api/organizer/cancellation-requests?status=PENDING`
- Table: Buyer Email, Event, Reason, Requested At, Actions
- Approve button: calls PATCH with `{ action: "APPROVE" }` — confirm dialog first
- Reject button: opens inline input for `adminNote`, then calls PATCH with `{ action: "REJECT", adminNote }`
- Filter tabs: Pending / Approved / Rejected
- Add `{ href: "/organizer/cancellation-requests", label: "Cancellations" }` to nav in all organizer pages

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer cancellation request management`

---

## Task 7 — Organizer Attendee Export CSV

Create `app/api/organizer/events/[id]/attendees/export/route.ts`:

**GET**: `requireRole("ORGANIZER")`. Verify event belongs to organizer's profile.
- Fetch all PAID orders with items and QRTickets: `prisma.order.findMany({ where: { eventId, status: "PAID" }, include: { items: { include: { ticketType: true, tickets: true } } } })`
- Build CSV rows — one row per QRTicket:
  - Columns: `Ticket Number, Buyer Name, Buyer Email, Ticket Type, Checked In, Check-in Time, Order ID, Paid At`
- Set response headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename=attendees.csv`
- Return CSV string as response body

Modify `app/organizer/events/[id]/page.tsx`:
- Add "Export Attendees" button in the event header action group
- Button: `<a href="/api/organizer/events/${id}/attendees/export" download>Export Attendees</a>` — use anchor tag, not `window.location`

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer attendee list CSV export`

---

## Task 8 — Admin Attendee Management

Create `app/api/admin/attendees/route.ts`:

**GET**: `requireRole("SUPER_ADMIN")`. Query params: `?page=` (default 1, size 20), `?q=` (email search), `?status=active|suspended`.
- Find users where `role = "ATTENDEE"` with optional `email: { contains: q }` and `isActive` filter
- Include: `attendeeProfile { displayName, _count { select: { orders: true } } }`
- Return `ok({ attendees, total, pages })`

Create `app/api/admin/attendees/[id]/route.ts`:

**PATCH**: body `{ isActive: boolean }`. Find user, verify role is ATTENDEE, update `isActive`. Write audit log: action `ATTENDEE_SUSPENDED` or `ATTENDEE_UNSUSPENDED`. Return `ok({ isActive })`.

Create `app/admin/attendees/page.tsx` (SSR):
- Auth guard
- Fetch `GET /api/admin/attendees?page=X&q=Y`
- Table: Email, Display Name, Orders, Joined, Verified badge, Status badge, Suspend/Unsuspend button
- `?q=` search input (form GET)
- Pagination
- Suspend/Unsuspend: client-side `fetch` to PATCH, reload page on success
- Add `{ href: "/admin/attendees", label: "Attendees" }` to nav in all admin pages (after "Orders")

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: admin attendee management page`

---

## Task 9 — Integration Tests

Create `src/tests/integration/promo-codes.test.ts`:
- Organizer creates promo code → 201
- Validate promo: valid code → `{ valid: true }`
- Validate promo: expired → `{ valid: false }`
- Validate promo: maxUses exceeded → `{ valid: false }`
- Checkout with valid promo → order has `discountAmount > 0`, `promoCode.usedCount` incremented

Create `src/tests/integration/cancellation-requests.test.ts`:
- Attendee requests cancellation on PAID order → 200, request created
- Duplicate request → 409
- Organizer approves → order status REFUNDED, request status APPROVED
- Organizer rejects with note → request status REJECTED

Follow existing test patterns from `src/tests/integration/auth-flow.test.ts`.

Run: `npm run test:integration`. All tests must pass. Fix any failures.
Commit: `test: promo codes and cancellation request integration tests`

---

## Task 10 — Release Notes

Create `docs/releases/phase-7-release-notes.md` with: date, status Complete, summary of all features, migration name `add-promo-codes-and-cancellation`, new API routes list, validation evidence.

Update `docs/tasks/phase-7-plan.md` — set all tasks to DONE.

Commit: `docs: phase 7 release notes and plan completion`

---

## Final Validation

Run: `npm run lint && npm run typecheck && npm run test:integration`
All must pass with zero errors. Push to `main` when complete.
