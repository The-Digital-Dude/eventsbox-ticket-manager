# Phase 10 Plan — Pre-Launch Bug Fixes

**Status:** TODO
**Depends on:** Phase 9 complete ✅
**Goal:** Fix confirmed race conditions, null-safety gaps, and data integrity bugs before soft launch.

No schema migrations required.

---

## Confirmed Bugs (verified against source)

### BUG-01 — CRITICAL: Ticket Inventory Race Condition (Overselling)

**File:** `app/api/checkout/route.ts` lines 33–49

**Problem:**
Ticket availability is checked BEFORE the Prisma transaction:
```ts
// line 37 — outside transaction, not atomic
const available = tt.quantity - tt.sold;
if (item.quantity > available) { ... }
```
The transaction that creates the order starts at line 85. Two concurrent requests
can both pass the availability check and both create orders, causing `sold` to
exceed `quantity` (overselling).

**Fix:**
Move the availability check INSIDE the transaction. Re-fetch ticket types with
`select: { quantity, sold }` at the start of the transaction and re-validate
before creating the order. If any item is over-limit, throw an error to abort the
transaction.

**Files to change:**
- `app/api/checkout/route.ts`

---

### BUG-02 — HIGH: Promo Code Usage Incremented on PENDING Orders (Never Expires)

**File:** `app/api/checkout/route.ts` lines 110–115

**Problem:**
`promoCode.usedCount` is incremented when the PENDING order is created, not when
payment actually succeeds:
```ts
// inside transaction — runs at checkout intent creation time
if (promoCodeRecordId) {
  await tx.promoCode.update({
    where: { id: promoCodeRecordId },
    data: { usedCount: { increment: 1 } },
  });
}
```
If the user abandons payment (never completes Stripe checkout), the promo usage
count is permanently consumed. A single-use code (`maxUses: 1`) becomes
permanently burned after any failed/abandoned checkout.

**Fix:**
Remove the `usedCount` increment from the checkout transaction. Move it to the
`handlePaymentSucceeded` function in `app/api/webhooks/stripe/route.ts`, inside
the existing `$transaction` that marks the order as PAID. The promo code is
accessible via `order.promoCodeId`.

**Files to change:**
- `app/api/checkout/route.ts` — remove increment from transaction
- `app/api/webhooks/stripe/route.ts` — add increment inside `handlePaymentSucceeded` transaction

---

### BUG-03 — HIGH: Promo Code Concurrent Usage Race Condition

**File:** `src/lib/services/promo-code.ts` line 61, `app/api/checkout/route.ts` line 59

**Problem:**
The `usedCount >= maxUses` check (line 61 of promo-code.ts) and the increment
(line 113 of checkout/route.ts) are non-atomic. Two concurrent requests with the
same `maxUses: 1` promo code will both pass the check and both increment — ending
up at `usedCount: 2` for a code that should allow only 1 use.

**Fix:**
After moving the increment to the webhook (BUG-02 fix), use an atomic conditional
update in the webhook handler instead of a plain `increment`:
```ts
const updated = await tx.promoCode.updateMany({
  where: {
    id: order.promoCodeId,
    OR: [
      { maxUses: null },
      { usedCount: { lt: prisma.promoCode.fields.maxUses } }, // use raw where
    ],
  },
  data: { usedCount: { increment: 1 } },
});
// if updated.count === 0, the code was already exhausted — log a warning
```
Since Stripe webhooks are already idempotency-protected, this is sufficient for
production traffic levels. For higher throughput, a DB-level unique constraint on
`(promoCodeId, orderId)` could be added later.

**Files to change:**
- `app/api/webhooks/stripe/route.ts` — use conditional `updateMany` for increment

---

### BUG-04 — MEDIUM: Null Crash on QR Endpoint When `ticket.order` Is Null

**File:** `app/api/account/tickets/[ticketId]/qr/route.ts` line 47

**Problem:**
```ts
if (!ticket || ticket.order.status !== "PAID") {
```
If `ticket` is non-null but `ticket.order` is `null` (e.g. orphaned QR ticket
record after an edge-case deletion), this line throws a TypeError at runtime,
returning a 500 instead of a clean 404.

**Fix:**
```ts
if (!ticket || !ticket.order || ticket.order.status !== "PAID") {
  return fail(404, { code: "NOT_FOUND", message: "Ticket not found" });
}
```

**Files to change:**
- `app/api/account/tickets/[ticketId]/qr/route.ts`

---

### BUG-05 — MEDIUM: Silent Attendee Profile Unlinking on Checkout

**File:** `app/api/checkout/route.ts` lines 121–132

**Problem:**
If an authenticated ATTENDEE has no `attendeeProfile` row (e.g. profile deleted
after registration, or created via a path that skipped profile creation), the
order is silently created without `attendeeUserId`. The attendee's `/account/tickets`
wallet will never show the order, and there is no error or warning.

**Fix:**
Add a warning log when a valid ATTENDEE session exists but no profile is found:
```ts
if (session && session.user.role === "ATTENDEE") {
  const attendeeProfile = await prisma.attendeeProfile.findUnique({ ... });
  if (attendeeProfile) {
    await prisma.order.update({ ... });
  } else {
    console.warn(`[checkout] ATTENDEE session ${session.user.id} has no attendeeProfile — order ${order.id} not linked`);
  }
}
```
Do not fail the checkout — a guest checkout is still valid. This makes the gap
observable in logs without breaking the flow.

**Files to change:**
- `app/api/checkout/route.ts`

---

## Task Order

```
BUG-04 (1 line null guard)          → smallest, zero risk, do first
BUG-05 (add warning log)            → small, zero risk
BUG-02 + BUG-03 (promo code fixes)  → do together (same area)
BUG-01 (inventory race fix)         → highest risk, do last after others pass tests
```

---

## New Tests Required

Each fix must be covered:

| Test File | Covers |
|-----------|--------|
| `src/tests/integration/checkout.test.ts` (new or extend) | BUG-01: concurrent checkout doesn't oversell |
| `src/tests/integration/checkout.test.ts` | BUG-02: abandoned checkout doesn't consume promo code |
| `src/tests/integration/checkout.test.ts` | BUG-03: concurrent promo use doesn't exceed maxUses |
| `src/tests/integration/ticket-wallet.test.ts` (extend) | BUG-04: null order returns 404, not 500 |

---

## Acceptance Gate

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing (including new cases)
- Manual smoke test: buy a ticket end-to-end in dev/staging, confirm wallet shows QR

---

## Status Tracking

| Bug | Status |
|-----|--------|
| BUG-01 — Ticket inventory race condition | TODO |
| BUG-02 — Promo code incremented on PENDING | TODO |
| BUG-03 — Promo code concurrent race | TODO |
| BUG-04 — Null crash on QR endpoint | TODO |
| BUG-05 — Silent attendee unlinking | TODO |
