# Phase 13 Plan — Admin Governance + Scanner Operations

**Status:** DONE
**Depends on:** Phase 12 complete ✅
**Goal:** Admin financial dashboard, organizer decision emails, and scanner bulk check-in list.

No schema migrations required.

---

## Audit Results (verified against source 2026-03-11)

| Item | Status |
|------|--------|
| ADM-04 — Event cancellation by organizer | ✅ ALREADY DONE — route exists, notifies attendees, handles paid orders |
| ADM-01 — Admin financial dashboard | ✅ DONE — `/api/admin/analytics` and `/admin/analytics` now expose platform financial reporting |
| ADM-02 — Organizer approval/rejection emails | ✅ DONE — decision route now sends approval/rejection notifications |
| ADM-03 — Scanner bulk check-in list | ✅ DONE — scanner includes attendee list, search, filters, and manual check-in |

**Remaining work: 0 tasks.**

---

## Task 1 — ADM-02: Organizer Decision Emails (smallest, do first)

**File:** `app/api/admin/organizers/[id]/decision/route.ts`

**Problem:**
When admin approves or rejects an organizer, the organizer receives no notification.
The route updates `approvalStatus` and writes an audit log but sends no email.

**Fix — Step 1:** Add two email functions to `src/lib/services/notifications.ts`:

```ts
// Send when organizer application is APPROVED
export async function sendOrganizerApprovedEmail(params: {
  to: string;
  organizerName: string;
}): Promise<EmailResult>

// Send when organizer application is REJECTED
export async function sendOrganizerRejectedEmail(params: {
  to: string;
  organizerName: string;
  reason: string;
}): Promise<EmailResult>
```

Email copy:
- **Approved:** "Your organizer application has been approved! You can now create and publish events on EventsBox. Log in to get started."
- **Rejected:** "Your organizer application was not approved at this time. Reason: [reason]. If you have questions, please contact support."

**Fix — Step 2:** In `app/api/admin/organizers/[id]/decision/route.ts`, after the `prisma.organizerProfile.update` call, fetch the organizer's user email and fire the appropriate email:

```ts
const organizerUser = await prisma.user.findUnique({
  where: { id: updated.userId },
  select: { email: true, displayName: true },
});

if (organizerUser) {
  const name = organizerUser.displayName ?? organizerUser.email;
  if (parsed.data.action === "APPROVED") {
    void sendOrganizerApprovedEmail({ to: organizerUser.email, organizerName: name }).catch(console.error);
  } else if (parsed.data.action === "REJECTED") {
    void sendOrganizerRejectedEmail({
      to: organizerUser.email,
      organizerName: name,
      reason: parsed.data.reason ?? "No reason provided",
    }).catch(console.error);
  }
}
```

**Files to change:**
- `src/lib/services/notifications.ts` — add two new email functions
- `app/api/admin/organizers/[id]/decision/route.ts` — fire email after decision

**Commit:** `feat: email organizer on approval or rejection`

---

## Task 2 — ADM-03: Scanner Bulk Attendee List + Manual Check-In

**Context:**
The scanner page at `/organizer/scanner` currently only allows QR code scanning.
Organizers need to also see a full attendee list for an event and manually check in
attendees by name (useful when QR code is damaged or phone is dead).

### 2a. New API endpoint: `app/api/organizer/events/[id]/checkin-list/route.ts`

**GET** — `requireRole("ORGANIZER")`. Verify event belongs to organizer profile.

Query params:
- `search` — optional string, filters by `buyerName` or `buyerEmail` (case-insensitive)
- `checkedIn` — optional `"true"` | `"false"` filter

Response: array of tickets for the event:
```ts
{
  tickets: Array<{
    ticketId: string
    ticketNumber: string
    ticketTypeName: string
    buyerName: string
    buyerEmail: string
    seatLabel: string | null
    checkedInAt: string | null  // ISO string or null
    isComplimentary: boolean
  }>
  summary: {
    total: number
    checkedIn: number
    remaining: number
  }
}
```

Build this by querying `QRTicket` joined with `OrderItem → TicketType` and `Order`,
filtered by `order.eventId = id` and `order.status = "PAID"`.

**POST** — Manual check-in by ticketId. Body: `{ ticketId: string }`
- Verify ticket belongs to an event owned by this organizer
- If already checked in: return `{ alreadyCheckedIn: true, checkedInAt }`
- If not: set `checkedInAt = new Date()`, return `{ alreadyCheckedIn: false, checkedInAt }`

This reuses the same logic as the existing `/api/organizer/checkin` QR scan endpoint
but accepts a ticketId directly instead of a QR token.

### 2b. Update scanner UI: `app/organizer/scanner/page.tsx`

Add a second tab to the scanner page: **"Attendee List"** alongside the existing **"QR Scanner"** tab.

**Attendee List tab:**
- Event selector dropdown (fetch organizer's events, filter to PUBLISHED only)
- Once event selected:
  - Show summary bar: "X / Y checked in"
  - Search input: filter by name or email (debounced, client-side filter on loaded list)
  - Toggle buttons: "All" | "Checked In" | "Not Yet"
  - Table columns: Ticket #, Name, Email, Type, Seat, Status (badge: "Checked In [time]" or "—")
  - Each unchecked row: "Check In" button → POST to checkin-list endpoint → updates row in place
  - Each checked row: show timestamp, no button

**Files to create/modify:**
- `app/api/organizer/events/[id]/checkin-list/route.ts` — new
- `app/organizer/scanner/page.tsx` — add Attendee List tab

**Commit:** `feat: scanner bulk attendee list and manual check-in`

---

## Task 3 — ADM-01: Admin Financial Dashboard

### 3a. New API endpoint: `app/api/admin/analytics/route.ts`

**GET** — `requireRole("SUPER_ADMIN")`.

Query params:
- `from` — ISO date string, default: 30 days ago
- `to` — ISO date string, default: now

Response:
```ts
{
  summary: {
    grossRevenue: number       // sum of order.total for PAID orders in range
    platformFees: number       // sum of order.platformFee for PAID orders
    refunded: number           // sum of order.total for REFUNDED orders
    netRevenue: number         // grossRevenue - refunded
    ticketsSold: number        // sum of orderItem.quantity for PAID orders
    ordersCount: number        // count of PAID orders
    refundsCount: number       // count of REFUNDED orders
  }
  topEvents: Array<{
    eventId: string
    title: string
    revenue: number
    ticketsSold: number
  }>                           // top 5 by revenue in range
  revenueByDay: Array<{
    date: string               // YYYY-MM-DD
    revenue: number
  }>                           // daily revenue for the range (for chart)
}
```

### 3b. Update admin analytics UI: `app/admin/analytics/page.tsx`

Currently the page exists but likely shows only organizer-level data.
Replace or extend it with:

- Date range picker (from/to, defaults to last 30 days)
- 4 stat cards: Gross Revenue, Platform Fees, Net Revenue (after refunds), Tickets Sold
- 2 smaller cards: Orders Count, Refunds Count
- Top 5 Events table: Event name, Revenue, Tickets Sold
- Revenue by Day bar chart (use a simple HTML/CSS bar chart or recharts if already in deps — check package.json first)

**Files to create/modify:**
- `app/api/admin/analytics/route.ts` — new
- `app/admin/analytics/page.tsx` — extend with financial summary

**Commit:** `feat: admin financial dashboard`

---

## Task 4 — Integration Tests

**File:** `src/tests/integration/admin-analytics.test.ts`
- Seed 3 PAID orders + 1 REFUNDED order
- GET `/api/admin/analytics` as SUPER_ADMIN
- Assert `summary.grossRevenue`, `summary.platformFees`, `summary.refunded` match seeded data
- Assert `topEvents` contains the seeded event
- Assert 401 for unauthenticated request

**File:** `src/tests/integration/organizer-decision-notify.test.ts` (extend existing if it exists)
- Approve an organizer → verify email function was called (mock notifications or check DB state)
- Reject an organizer with reason → verify rejection email called

**Commit:** `test: phase 13 integration tests`

---

## Execution Order

```
Task 1 (ADM-02 — 2 email functions + 8 lines)  → smallest, do first
Task 2 (ADM-03 — scanner list)                 → medium
Task 3 (ADM-01 — financial dashboard)          → most complex, do last
Task 4 (tests)                                 → after all features
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
| ADM-04 — Event cancellation by organizer | ✅ ALREADY DONE |
| ADM-02 — Organizer decision emails | DONE |
| ADM-03 — Scanner bulk check-in list | DONE |
| ADM-01 — Admin financial dashboard | DONE |
| Tests | DONE |

## Completion Notes

- Organizer approval decisions now send fire-and-forget emails from the admin decision route using the existing notification service. Because the current `User` model does not expose `displayName`, organizer email is used as the name fallback in this phase.
- The organizer scanner page now supports both QR scanning and a bulk attendee-list workflow with event filtering, live search, checked-in summaries, and manual per-ticket check-in.
- Admin financial reporting now includes gross revenue, platform fees, refunded totals, net revenue, orders/refunds counts, top events, and a daily revenue chart over a selected date range.
- Phase 13 integration coverage now includes dedicated tests for admin analytics and organizer approval/rejection notifications.
- Validation passed with `npm run lint`, `npm run typecheck`, and `npm run test:integration` (26 files, 82 tests).
