# Phase 7 Plan — Promo Codes & Attendee Self-Service

**Status:** TODO
**Depends on:** Phase 6 complete ✅
**Goal:** Give organizers promo/discount code tools, give attendees the ability to cancel orders, give admins attendee oversight, and give organizers exportable attendee lists.

---

## Task Order (Sequential — do not reorder)

---

### Task 1 — Prisma Schema: PromoCode + CancellationRequest

**File to modify:** `prisma/schema.prisma`

**Add two new enums:**
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

**Add `PromoCode` model** (place after `TicketType`):
```prisma
model PromoCode {
  id                 String            @id @default(cuid())
  organizerProfileId String
  eventId            String?
  code               String            @unique
  discountType       DiscountType
  discountValue      Decimal           @db.Decimal(10, 2)
  maxUses            Int?
  usedCount          Int               @default(0)
  expiresAt          DateTime?
  isActive           Boolean           @default(true)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  organizerProfile   OrganizerProfile  @relation(fields: [organizerProfileId], references: [id], onDelete: Cascade)
  event              Event?            @relation(fields: [eventId], references: [id], onDelete: SetNull)
  orders             Order[]

  @@index([organizerProfileId])
  @@index([code])
}
```

**Add `CancellationRequest` model** (place after `Order`):
```prisma
model CancellationRequest {
  id             String                    @id @default(cuid())
  orderId        String                    @unique
  attendeeUserId String
  reason         String?
  status         CancellationRequestStatus @default(PENDING)
  adminNote      String?
  resolvedAt     DateTime?
  createdAt      DateTime                  @default(now())
  updatedAt      DateTime                  @updatedAt
  order          Order                     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  attendeeProfile AttendeeProfile          @relation(fields: [attendeeUserId], references: [id], onDelete: Cascade)
}
```

**Add to `OrganizerProfile`:** `promoCodes PromoCode[]`
**Add to `Event`:** `promoCodes PromoCode[]`
**Add to `Order`:**
```prisma
promoCodeId        String?
discountAmount     Decimal   @default(0) @db.Decimal(10, 2)
promoCode          PromoCode? @relation(fields: [promoCodeId], references: [id])
cancellationRequest CancellationRequest?
```
Add `@@index([promoCodeId])` to Order.

**Add to `AttendeeProfile`:** `cancellationRequests CancellationRequest[]`

Run: `npx prisma migrate dev --name add-promo-codes-and-cancellation`
Run: `npx prisma generate`
Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: schema — promo codes and cancellation requests`

---

### Task 2 — Organizer Promo Code API

**File to create:** `app/api/organizer/promo-codes/route.ts`

**GET** — list all promo codes for the organizer's profile. Return: id, code, discountType, discountValue, maxUses, usedCount, expiresAt, isActive, eventId.

**POST** — create promo code. Body: `{ code, discountType, discountValue, eventId?, maxUses?, expiresAt?, isActive }`. Validate with Zod. Code must be uppercase alphanumeric 4–20 chars. Check code not already taken. Return created promo code.

**File to create:** `app/api/organizer/promo-codes/[id]/route.ts`

**PATCH** — update `isActive`, `maxUses`, `expiresAt` only. Cannot change code or discountValue after creation.

**DELETE** — soft delete: set `isActive = false`. Do not hard delete (orders may reference it).

All handlers: `requireRole("ORGANIZER")`, verify promo code belongs to organizer's profile before mutating.

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer promo code CRUD API`

---

### Task 3 — Organizer Promo Code Management Page

**File to create:** `app/organizer/promo-codes/page.tsx`

**Behavior (client component):**
- Load promo codes from `GET /api/organizer/promo-codes`
- Table: Code, Type, Value, Uses (used/max), Expires, Active toggle, Delete button
- "New Promo Code" form inline or modal: Code (auto-uppercase), Type (PERCENTAGE/FIXED select), Value, Max Uses (optional), Expires At (optional date picker using `<input type="datetime-local">`), Event (optional select from organizer's published events)
- Active toggle calls `PATCH /api/organizer/promo-codes/[id]`
- Delete calls `DELETE`, replaces row with "Deactivated"
- Use existing `Input`, `Label`, `Button`, `Badge` components
- Add `{ href: "/organizer/promo-codes", label: "Promo Codes" }` to nav in all organizer pages

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer promo code management page`

---

### Task 4 — Apply Promo Code at Checkout

**File to create:** `app/api/checkout/validate-promo/route.ts`

**POST** — body: `{ code, eventId }`. Find active promo code where: code matches (case-insensitive), isActive=true, not expired, (eventId matches OR eventId is null). If maxUses set, check usedCount < maxUses. Return: `{ valid: true, discountType, discountValue, promoCodeId }` or `{ valid: false, message }`.

**File to modify:** `app/api/checkout/route.ts`
- Accept optional `promoCodeId` in checkout body (add to `checkoutIntentSchema`)
- If provided: validate the promo code again server-side (same checks as above)
- Apply discount: PERCENTAGE → `subtotal * (discountValue/100)`, FIXED → min(discountValue, subtotal)
- Store `discountAmount` on order
- Recalculate: `platformFee` and `gst` computed on `subtotal - discountAmount`
- Store `promoCodeId` on order
- Increment `promoCode.usedCount` atomically: `prisma.promoCode.update({ data: { usedCount: { increment: 1 } } })`

**File to modify:** `app/events/[slug]/page.tsx`
- Add promo code input field above checkout button
- "Apply" button calls `POST /api/checkout/validate-promo`
- On success: show discount amount in green, store `promoCodeId` in state, pass to checkout payload
- On fail: show error message inline

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: promo code validation and checkout discount`

---

### Task 5 — Attendee Order Cancellation Request

**File to create:** `app/api/account/orders/[orderId]/cancel/route.ts`

**POST** — `requireAttendee()`. Body: `{ reason? }`.
- Find order by `orderId` — must belong to this attendee (`attendeeUserId = profile.id`) and status must be PAID
- Check no existing `CancellationRequest` for this order
- Create `CancellationRequest` with status PENDING
- Send email to organizer: "Attendee [email] has requested a cancellation for order [id] — event: [title]" (fire-and-forget)
- Return `ok({ requestId, status: "PENDING" })`

**File to modify:** `app/account/orders/page.tsx`
- Add "Request Cancellation" button next to PAID orders
- Opens inline form with optional reason textarea
- Calls `POST /api/account/orders/[orderId]/cancel`
- On success: replace button with "Cancellation Requested" badge

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: attendee order cancellation request`

---

### Task 6 — Organizer Cancellation Request Management

**File to create:** `app/api/organizer/cancellation-requests/route.ts`

**GET** — list all cancellation requests across organizer's events. Include: orderId, attendee email, event title, reason, status, createdAt. Filter by `?status=PENDING|APPROVED|REJECTED`.

**File to create:** `app/api/organizer/cancellation-requests/[id]/route.ts`

**PATCH** — body: `{ action: "APPROVE" | "REJECT", adminNote? }`.
- If APPROVE: update request status to APPROVED, trigger refund via Stripe (same logic as existing refund endpoint), update order status to REFUNDED, send refund confirmation email to attendee
- If REJECT: update status to REJECTED, send email to attendee with adminNote
- Write audit log entry

**File to create:** `app/organizer/cancellation-requests/page.tsx`
- SSR page listing all pending cancellation requests
- Table: Attendee Email, Event, Reason, Requested At, Action buttons (Approve / Reject with note)
- Add `{ href: "/organizer/cancellation-requests", label: "Cancellations" }` to all organizer nav arrays

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer cancellation request management`

---

### Task 7 — Organizer Attendee List Export

**File to create:** `app/api/organizer/events/[id]/attendees/export/route.ts`

**GET** — `requireRole("ORGANIZER")`. Returns CSV file.
- Find all PAID orders for the event belonging to this organizer
- Expand items to individual tickets (one row per QRTicket)
- CSV columns: `Ticket Number, Buyer Name, Buyer Email, Ticket Type, Quantity, Check-in Status, Check-in Time, Order ID, Paid At`
- Response: `Content-Type: text/csv`, `Content-Disposition: attachment; filename=attendees-[eventSlug].csv`

**File to modify:** `app/organizer/events/[id]/page.tsx`
- Add "Export Attendees CSV" button in the event header actions
- `window.location.href = /api/organizer/events/${id}/attendees/export`

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer attendee list CSV export`

---

### Task 8 — Admin Attendee Management

**File to create:** `app/api/admin/attendees/route.ts`

**GET** — `requireRole("SUPER_ADMIN")`. Paginated list of all ATTENDEE users. Query params: `?page=`, `?q=` (email search), `?status=active|suspended`. Return: id, email, displayName, createdAt, emailVerified, isActive, order count.

**File to create:** `app/api/admin/attendees/[id]/route.ts`

**PATCH** — toggle `isActive` (suspend/unsuspend). Body: `{ isActive: boolean }`. Write audit log.

**File to create:** `app/admin/attendees/page.tsx`
- SSR page, paginated table: Email, Display Name, Orders, Joined, Verified, Status, Suspend/Unsuspend button
- `?q=` search input
- Add `{ href: "/admin/attendees", label: "Attendees" }` to all admin nav arrays (after "Orders")

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: admin attendee management page`

---

### Task 9 — Integration Tests

**File to create:** `src/tests/integration/promo-codes.test.ts`
- Create promo code via organizer API
- Validate promo code at checkout (valid + expired + maxUses exceeded)
- Checkout with promo code — verify discountAmount stored on order
- Apply same promo code twice — verify usedCount increments

**File to create:** `src/tests/integration/cancellation-requests.test.ts`
- Attendee submits cancellation request for PAID order
- Duplicate request returns error
- Organizer approves → order status becomes REFUNDED
- Organizer rejects → request status becomes REJECTED

Run: `npm run test:integration`. All (old + new) must pass. Fix any failures.
Commit: `test: promo codes and cancellation request integration tests`

---

### Task 10 — Release Notes

**File to create:** `docs/releases/phase-7-release-notes.md`
- Date, status Complete, feature summary, migration name, validation evidence

**File to update:** `docs/tasks/phase-7-plan.md` — mark all tasks DONE.

Commit: `docs: phase 7 release notes and plan completion`

---

## Status Table

| Task | Description | Status |
|------|-------------|--------|
| 1 | Schema migration (PromoCode + CancellationRequest) | TODO |
| 2 | Organizer promo code API | TODO |
| 3 | Organizer promo code management page | TODO |
| 4 | Apply promo code at checkout | TODO |
| 5 | Attendee order cancellation request | TODO |
| 6 | Organizer cancellation request management | TODO |
| 7 | Organizer attendee list export | TODO |
| 8 | Admin attendee management | TODO |
| 9 | Integration tests | TODO |
| 10 | Release notes | TODO |

---

## Out of Scope
- Auto-refund on cancellation approval (approved requests trigger manual review by default — organizer must explicitly approve in Task 6)
- Bulk promo code generation
- Referral/affiliate codes
- Stripe coupon sync
