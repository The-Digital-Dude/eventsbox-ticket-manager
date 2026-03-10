# Phase 10 Plan — Pre-Launch Bug Fixes

**Status:** IN PROGRESS
**Depends on:** Phase 9 complete ✅
**Goal:** Fix confirmed bugs in promo codes, null safety, and seat cleanup before soft launch.

No schema migrations required.

---

## Current State (verified against source code 2026-03-10)

| Bug | File | Status |
|-----|------|--------|
| BUG-01 — Ticket inventory race | `app/api/checkout/route.ts` | ✅ ALREADY FIXED — inventory re-validated inside `$transaction` |
| BUG-02 — Promo code burned on PENDING | `app/api/checkout/route.ts` line 194 | ✅ FIXED — promo use now increments only after payment success |
| BUG-03 — Promo code concurrent race | `app/api/webhooks/stripe/route.ts` | ✅ FIXED — webhook now uses atomic conditional SQL increment |
| BUG-04 — Null crash on QR endpoint | `app/api/account/tickets/[ticketId]/qr/route.ts` line 47 | ✅ FIXED — null guard returns 404 for missing order relation |
| BUG-05 — Silent attendee unlinking | `app/api/checkout/route.ts` line 240 | ✅ ALREADY FIXED — warning log present |
| BUG-06 — Stale seat reservations (passive) | `app/api/checkout/route.ts` line 110 | ✅ PARTIALLY FIXED — expired seats deleted at start of each new checkout |

**Remaining work:** Phase 10 acceptance follow-up only. Route-level fixes and targeted tests are complete.

---

## Task 1 — BUG-04: Null Guard on QR Endpoint (1-line fix)

**File:** `app/api/account/tickets/[ticketId]/qr/route.ts`

**Problem:**
Line 47 reads:
```ts
if (!ticket || ticket.order.status !== "PAID") {
```
If `ticket` is non-null but `ticket.order` is somehow null (orphaned record, edge-case deletion),
this throws a `TypeError: Cannot read properties of null (reading 'status')` — a 500 crash
instead of a clean 404.

**Fix — exact change:**

Old:
```ts
if (!ticket || ticket.order.status !== "PAID") {
  return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
}
```

New:
```ts
if (!ticket || !ticket.order || ticket.order.status !== "PAID") {
  return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
}
```

That is the entire change for this task. One condition added: `!ticket.order`.

**Files to change:**
- `app/api/account/tickets/[ticketId]/qr/route.ts` — line 47

**Test coverage:**
Extend `src/tests/integration/ticket-wallet.test.ts`:
- Add test case: create a `QRTicket` with no associated `Order` (raw prisma insert to simulate orphan), call GET `/api/account/tickets/[ticketId]/qr`, expect 404 not 500.

---

## Task 2 — BUG-02 + BUG-03: Promo Code Fixes (do both together — same area)

### BUG-02: Promo Code Incremented on PENDING Order

**Problem:**
In `app/api/checkout/route.ts` inside the `$transaction` at lines 194–199:
```ts
if (promoCodeRecordId) {
  await tx.promoCode.update({
    where: { id: promoCodeRecordId },
    data: { usedCount: { increment: 1 } },
  });
}
```
This runs when the PENDING order is created — before payment. If the user abandons the Stripe
checkout, the promo code's `usedCount` is permanently incremented. A `maxUses: 1` code becomes
permanently burned after any abandoned checkout.

### BUG-03: Promo Code Concurrent Race

**Problem:**
Even after moving the increment to the webhook, two concurrent Stripe `payment_intent.succeeded`
webhooks for different orders using the same promo code could both read `usedCount < maxUses`
before either increments — ending at `usedCount: 2` for a code that allows only 1 use.

---

### Fix — Step 1: Remove increment from checkout

**File:** `app/api/checkout/route.ts`

Remove the entire promo code increment block from inside the `$transaction`. The promo code
record is already stored on the order via `promoCodeId: promoCodeRecordId` — that is sufficient
to track which code was used.

Delete these lines (currently ~194–199):
```ts
if (promoCodeRecordId) {
  await tx.promoCode.update({
    where: { id: promoCodeRecordId },
    data: { usedCount: { increment: 1 } },
  });
}
```

### Fix — Step 2: Add atomic increment to webhook on payment success

**File:** `app/api/webhooks/stripe/route.ts`

Inside `handlePaymentSucceeded`, the function already does `prisma.order.findFirst` with
`include: { items: { include: { ticketType: true } } }` but does NOT include `promoCodeId`.

**First**, update the `findFirst` query to also select `promoCodeId`:
```ts
const order = await prisma.order.findFirst({
  where: { stripePaymentIntentId: intent.id, status: "PENDING" },
  include: {
    event: { select: { title: true, startAt: true, timezone: true, venue: { select: { name: true } } } },
    items: { include: { ticketType: true } },
  },
  // ADD THIS:
  // The order model has promoCodeId as a direct scalar field — add it to select
});
```

Actually the `include` already returns all scalar fields including `promoCodeId`. You do not need
to change the query. `order.promoCodeId` is available on the returned object.

**Then**, inside the existing `await prisma.$transaction(async (tx) => { ... })` block in
`handlePaymentSucceeded`, after the `tx.order.update` call, add the atomic promo increment:

```ts
// Inside the $transaction, after tx.order.update({ status: "PAID" })
if (order.promoCodeId) {
  const updated = await tx.promoCode.updateMany({
    where: {
      id: order.promoCodeId,
      OR: [
        { maxUses: null },
        { usedCount: { lt: tx.promoCode.fields.maxUses } }, // THIS SYNTAX IS WRONG — see below
      ],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (updated.count === 0) {
    console.warn(`[webhook] Promo code ${order.promoCodeId} maxUses already reached for order ${order.id}`);
  }
}
```

**Correct syntax for the atomic conditional updateMany** (Prisma does not support `lt: field`
cross-field comparisons directly). Use raw SQL instead:

```ts
if (order.promoCodeId) {
  await prisma.$executeRaw`
    UPDATE "PromoCode"
    SET "usedCount" = "usedCount" + 1
    WHERE id = ${order.promoCodeId}
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `;
}
```

Place this INSIDE the `prisma.$transaction` block, using the `tx` parameter:
```ts
if (order.promoCodeId) {
  await tx.$executeRaw`
    UPDATE "PromoCode"
    SET "usedCount" = "usedCount" + 1
    WHERE id = ${order.promoCodeId}
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `;
}
```

This is atomic at the DB level — concurrent webhooks cannot both increment past `maxUses`.

**Files to change:**
- `app/api/checkout/route.ts` — remove promo increment block (~lines 194–199)
- `app/api/webhooks/stripe/route.ts` — add `tx.$executeRaw` inside `handlePaymentSucceeded` `$transaction`

---

## Task 3 — New/Extended Integration Tests

### File: `src/tests/integration/checkout.test.ts` (create new or extend existing)

Add these test cases:

**Test A — BUG-02: Abandoned checkout does not burn promo code**
1. Create event + ticket type + promo code (`maxUses: 1`)
2. POST `/api/checkout` with the promo code → creates PENDING order, returns `clientSecret`
3. Do NOT simulate `payment_intent.succeeded` webhook
4. Fetch `promoCode` from DB → `usedCount` must still be `0`
5. Cleanup

**Test B — BUG-02: Successful payment increments promo code**
1. Create event + ticket type + promo code (`maxUses: 1`)
2. POST `/api/checkout` → PENDING order
3. Simulate `payment_intent.succeeded` webhook (POST `/api/webhooks/stripe` with mock body, or call the handler directly via import)
4. Fetch `promoCode` → `usedCount` must be `1`

**Test C — BUG-03: Two successful payments with same single-use code — only one succeeds increment**
1. Create promo code `maxUses: 1, usedCount: 0`
2. Create two PENDING orders both referencing this promo code
3. Fire two handlePaymentSucceeded calls (sequentially in test, since `fileParallelism: false`)
4. Fetch `promoCode` → `usedCount` must be `1`, not `2`

### File: `src/tests/integration/ticket-wallet.test.ts` (extend existing)

**Test D — BUG-04: Orphaned QRTicket returns 404 not 500**
- This test can be skipped if creating an orphaned QRTicket in test requires bypassing FK constraints (not easy). Instead, verify the existing NOT_FOUND path returns 404 by passing a nonexistent ticketId. The null guard change is a 1-line defensive fix — document it as such.

---

## Acceptance Gate

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing (including new test cases above)
- Manual check: create a promo code with `maxUses: 1`, start a checkout but do NOT pay → verify `usedCount` stays at 0 in DB

---

## Execution Order

```
Task 1 (BUG-04 — 1 line)     → do first, zero risk
Task 2 (BUG-02 + BUG-03)     → do second (remove from checkout, add to webhook)
Task 3 (tests)                → write tests covering BUG-02 + BUG-03
```

---

## Status Tracking

| Task | Status |
|------|--------|
| BUG-01 — Ticket inventory race | ✅ DONE (already fixed in source) |
| BUG-02 — Promo code incremented on PENDING | DONE |
| BUG-03 — Promo code concurrent race | DONE |
| BUG-04 — Null crash on QR endpoint | DONE |
| BUG-05 — Silent attendee unlinking | ✅ DONE (already fixed in source) |
| BUG-06 — Stale seat reservations | ✅ DONE (passive cleanup on each checkout) |
| Tests — BUG-02/03 coverage | DONE |

**Validation note (2026-03-10):**
- `npm run lint` ✅
- `npm run typecheck` ✅
- Targeted Phase 10 integration tests ✅ (`checkout.test.ts`, `promo-codes.test.ts`, `ticket-wallet.test.ts`)
- `npm run test:integration` is still blocked by an unrelated live-DB failure in `src/tests/integration/attendee-account.test.ts`

---

## Codex Handover Prompt

```
You are implementing Phase 10 of the EventsBox Ticket Manager — Pre-Launch Bug Fixes.

Read these files before writing any code:
1. docs/tasks/phase-10-plan.md  ← full plan (this document)
2. app/api/checkout/route.ts
3. app/api/webhooks/stripe/route.ts
4. app/api/account/tickets/[ticketId]/qr/route.ts
5. src/tests/integration/ticket-wallet.test.ts (if it exists)

---

## What needs to be done (3 tasks):

### Task 1 — BUG-04: 1-line null guard (do first)
File: app/api/account/tickets/[ticketId]/qr/route.ts

Change line 47 from:
  if (!ticket || ticket.order.status !== "PAID") {
To:
  if (!ticket || !ticket.order || ticket.order.status !== "PAID") {

That is the entire change for Task 1.

---

### Task 2 — BUG-02 + BUG-03: Promo code fixes (do second)

Step A — Remove from checkout:
In app/api/checkout/route.ts, inside the $transaction, find and DELETE this block:
  if (promoCodeRecordId) {
    await tx.promoCode.update({
      where: { id: promoCodeRecordId },
      data: { usedCount: { increment: 1 } },
    });
  }

Step B — Add to webhook:
In app/api/webhooks/stripe/route.ts, inside handlePaymentSucceeded, inside the
existing prisma.$transaction(async (tx) => { ... }) block, after the tx.order.update call,
add this atomic increment:

  if (order.promoCodeId) {
    await tx.$executeRaw`
      UPDATE "PromoCode"
      SET "usedCount" = "usedCount" + 1
      WHERE id = ${order.promoCodeId}
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
    `;
  }

Note: order.promoCodeId is already available because the findFirst at the top of
handlePaymentSucceeded uses include which returns all scalar fields.

---

### Task 3 — Integration Tests

Create or extend src/tests/integration/checkout.test.ts with these test cases:

Test A — "promo code usedCount stays 0 after abandoned checkout":
1. Seed: create organizer, event, ticketType, attendeeUser, promoCode (maxUses: 1)
2. POST /api/checkout with promoCodeId — should succeed, order status = PENDING
3. Query DB: promoCode.usedCount must equal 0
4. Cleanup all seeded data

Test B — "promo code usedCount increments to 1 after payment_intent.succeeded":
1. Seed same as above
2. POST /api/checkout → get orderId
3. Create a mock Stripe PaymentIntent succeeded event and POST to /api/webhooks/stripe
   OR directly call handlePaymentSucceeded by importing and calling it with a mock intent
   (check how existing webhook tests in the test suite call it)
4. Query DB: promoCode.usedCount must equal 1
5. Cleanup

Test C — "single-use promo code: second payment does not increment past maxUses":
1. Seed: promoCode with maxUses = 1, usedCount = 0
2. Create two PENDING orders both with promoCodeId set
3. Call handlePaymentSucceeded for both orders (sequentially)
4. Query DB: promoCode.usedCount must equal 1, not 2
5. Cleanup

---

## Acceptance criteria:
- npm run lint → zero errors
- npm run typecheck → zero errors
- npm run test:integration → all tests pass including the new ones above

## Out of scope for Phase 10:
- Stripe Connect payouts to organizers (Phase 11)
- Refund flow wiring (Phase 11)
- Any UI changes
- Any schema changes

Commit messages:
- Task 1: fix: null guard on QR ticket endpoint
- Task 2: fix: move promo code increment to payment webhook
- Task 3: test: cover promo code lifecycle and QR null safety
```
