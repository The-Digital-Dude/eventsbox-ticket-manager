# Phase 11 Plan — Security & Business Correctness

**Status:** DONE
**Depends on:** Phase 10 complete ✅
**Goal:** Wire Stripe Connect payouts into real checkout, fix admin refund restriction, and patch the one missing rate limit.

No schema migrations required.

---

## Audit Results (verified against source 2026-03-10)

| Item | File | Status |
|------|------|--------|
| SEC-02 — Stripe Connect payout in real checkout | `app/api/checkout/route.ts` | ✅ FIXED — Connect routing is now attached for completed onboarded organizers |
| SEC-03 — Admin refund blocked unless event CANCELLED | `app/api/admin/events/[id]/orders/[orderId]/refund/route.ts` | ✅ FIXED — admin/organizer routes now allow refunding any PAID order |
| SEC-04 — Rate limit on verify-email | `app/api/auth/verify-email/route.ts` | ✅ FIXED — verify-email now enforces IP-based Redis throttling |
| SEC-04 — Rate limit on login | `app/api/auth/login/route.ts` | ✅ DONE |
| SEC-04 — Rate limit on register | `app/api/auth/register/route.ts` | ✅ DONE |
| SEC-04 — Rate limit on reset-password | `app/api/auth/reset-password/route.ts` | ✅ DONE |
| SEC-04 — Rate limit on resend OTP | `app/api/auth/verify-email/resend/route.ts` | ✅ DONE |

**Remaining work:** None for Phase 11 scope.

---

## Task 1 — SEC-04: Rate Limit on Verify-Email (smallest, do first)

**File:** `app/api/auth/verify-email/route.ts`

**Problem:**
The OTP is 6 digits = 1,000,000 combinations. Without rate limiting, an attacker can
brute-force any account's OTP in minutes. All other auth endpoints have Redis rate limits
but this one does not.

**Fix — add these 4 lines at the top of the POST handler, same pattern as login:**

```ts
import { rateLimitRedis } from "@/src/lib/http/rate-limit-redis";

export async function POST(req: NextRequest) {
  try {
    // ADD THIS BLOCK:
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await rateLimitRedis(`verify-email:${ip}`, 10, 60_000);
    if (rl.limited) {
      return fail(429, { code: "RATE_LIMITED", message: "Too many attempts" });
    }
    // END ADD

    const parsed = verifyOtpSchema.safeParse(await req.json());
    ...
```

10 attempts per IP per 60 seconds is sufficient. This matches the resend OTP limit.

**Files to change:**
- `app/api/auth/verify-email/route.ts`

---

## Task 2 — SEC-03: Admin Refund Should Work on Any PAID Order (1-line fix)

**File:** `app/api/admin/events/[id]/orders/[orderId]/refund/route.ts`

**Problem:**
The `refundPaidOrder` service in `src/lib/services/order-refund.ts` has a guard:
```ts
if (!options?.allowAnyEventStatus && order.event.status !== "CANCELLED") {
  return { success: false, error: { code: "EVENT_NOT_CANCELLED", ... } };
}
```
The admin refund route calls `refundPaidOrder(orderId)` WITHOUT passing
`{ allowAnyEventStatus: true }`. This means admins cannot refund a single attendee's
order unless the entire event is cancelled — which blocks legitimate customer service
scenarios (e.g. duplicate purchase, medical emergency).

The organizer refund route has the same problem.

**Fix — pass the flag in both admin and organizer refund routes:**

In `app/api/admin/events/[id]/orders/[orderId]/refund/route.ts` line 22:
```ts
// OLD:
const refunded = await refundPaidOrder(orderId);

// NEW:
const refunded = await refundPaidOrder(orderId, { allowAnyEventStatus: true });
```

In `app/api/organizer/events/[id]/orders/[orderId]/refund/route.ts` line 41:
```ts
// OLD:
const refunded = await refundPaidOrder(orderId);

// NEW:
const refunded = await refundPaidOrder(orderId, { allowAnyEventStatus: true });
```

**Files to change:**
- `app/api/admin/events/[id]/orders/[orderId]/refund/route.ts`
- `app/api/organizer/events/[id]/orders/[orderId]/refund/route.ts`

---

## Task 3 — SEC-02: Wire Stripe Connect into Real Checkout

**File:** `app/api/checkout/route.ts`

**Problem:**
The test-payment route (`/api/organizer/payout/test-payment`) correctly creates Stripe
Checkout Sessions with `transfer_data.destination` and `application_fee_amount`, routing
money to the organizer's Stripe Connect account.

But the real checkout (`/api/checkout`) creates a plain PaymentIntent with no routing:
```ts
const intent = await stripe.paymentIntents.create({
  amount: Math.round(Number(order.total) * 100),
  currency: "nzd",
  metadata: { orderId: order.id, eventId, buyerEmail },
  receipt_email: buyerEmail,
});
```
This means 100% of ticket revenue goes to the platform Stripe account. Organizers
never receive their share automatically.

**Fix — fetch organizer's Stripe Connect account and attach to PaymentIntent:**

### Step 1: After event is fetched, also load organizer's payout settings

Add this query after the `event` fetch (after the `if (!event)` check, before promo code logic):

```ts
// Load organizer's Stripe Connect account if available
const organizerPayoutSettings = await prisma.organizerPayoutSettings.findUnique({
  where: { organizerProfileId: event.organizerProfileId },
  select: {
    stripeAccountId: true,
    stripeOnboardingStatus: true,
    payoutMode: true,
  },
});

const connectedAccountId =
  organizerPayoutSettings?.payoutMode === "STRIPE_CONNECT" &&
  organizerPayoutSettings?.stripeOnboardingStatus === "COMPLETED" &&
  organizerPayoutSettings?.stripeAccountId
    ? organizerPayoutSettings.stripeAccountId
    : null;
```

### Step 2: Include Connect routing in PaymentIntent creation

Replace the existing `stripe.paymentIntents.create` call with:

```ts
const platformFeeAmount = Math.round(Number(order.platformFee) * 100);
const totalAmountCents = Math.round(Number(order.total) * 100);

const intent = await stripe.paymentIntents.create({
  amount: totalAmountCents,
  currency: "nzd",
  metadata: { orderId: order.id, eventId, buyerEmail },
  receipt_email: buyerEmail,
  ...(connectedAccountId && platformFeeAmount > 0
    ? {
        application_fee_amount: platformFeeAmount,
        transfer_data: { destination: connectedAccountId },
      }
    : {}),
});
```

**How this works:**
- If the organizer has completed Stripe Connect onboarding: Stripe automatically splits
  the payment — `platformFee` amount goes to the platform, the rest goes to the organizer
- If the organizer is on manual payout mode or hasn't connected Stripe: payment goes to
  platform account as before (no change in behaviour)
- `application_fee_amount` = `order.platformFee` (already calculated correctly in checkout)

**Note on schema:** `event.organizerProfileId` must be available. Verify the event include
already selects this field — if not, add it to the `prisma.event.findFirst` select.

**Files to change:**
- `app/api/checkout/route.ts`

---

## Task 4 — Integration Tests

### File: `src/tests/integration/checkout.test.ts` (extend)

**Test A — verify-email rate limit blocks after 10 attempts**
In `src/tests/integration/` create or extend an auth test:
1. POST `/api/auth/verify-email` 11 times with wrong OTP for same IP
2. The 11th attempt should return 429 `RATE_LIMITED`
- Note: rate limit tests are hard to run reliably in integration (Redis state). Skip this
  test if Redis is not available in the test env. Add a comment explaining why.

**Test B — admin can refund a PAID order on a non-cancelled event**
1. Seed: organizer, event (status PUBLISHED), attendee, PAID order
2. POST `/api/admin/events/[id]/orders/[orderId]/refund` as SUPER_ADMIN
3. Expect 200 — not 400 `EVENT_NOT_CANCELLED`
4. Cleanup

**Test C — organizer can refund a PAID order on a non-cancelled event**
1. Seed same as above
2. POST `/api/organizer/events/[id]/orders/[orderId]/refund` as ORGANIZER
3. Expect 200
4. Cleanup

---

## Acceptance Gate

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all 67+ tests passing
- Manual smoke: refund a PAID order from admin panel on a live event

---

## Execution Order

```
Task 1 (SEC-04 — 4 lines)       → smallest, do first
Task 2 (SEC-03 — 2 lines)       → tiny, do second
Task 3 (SEC-02 — Connect payout) → most logic, do third
Task 4 (tests)                   → last
```

---

## Status Tracking

| Task | Status |
|------|--------|
| SEC-04 — Rate limit on verify-email | DONE |
| SEC-03 — Admin/organizer refund on any PAID order | DONE |
| SEC-02 — Stripe Connect routing in real checkout | DONE |
| Tests | DONE |

**Validation note (2026-03-10):**
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:integration` ✅ (68 tests passing)
