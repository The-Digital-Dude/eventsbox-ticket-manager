# Phase 20 Plan — Advanced Analytics & Financial Reporting

**Status:** READY
**Depends on:** Phase 19 complete
**Goal:** Give organizers rich breakdowns of revenue (by ticket type, by promo code, over time). Give admins a platform-wide financial dashboard. Add a monthly revenue summary email that admins can trigger per organizer.

---

## Schema Changes

### None required.
All data exists in: `Order`, `OrderItem`, `TicketType`, `PromoCode`, `AffiliateLink`, `OrderAddOn`, `EventReview`, `Event`, `OrganizerProfile`.

---

## Task 1 — Extended Organizer Analytics API

### `app/api/organizer/analytics/route.ts` (modify)

Add these breakdowns to the existing response (keep existing fields, add new ones):

```ts
{
  // existing fields ...

  // NEW
  revenueByTicketType: { ticketTypeName: string; revenue: number; sold: number }[]
  revenueByPromoCode:  { code: string; discount: number; orders: number }[]
  revenueByAddOn:      { addOnName: string; revenue: number; quantity: number }[]
  revenueByDay:        { date: string; revenue: number; orders: number }[]  // last 90 days
  affiliateStats:      { code: string; label: string; orders: number; revenue: number }[]
  reviewSummary:       { averageRating: number; totalReviews: number }
}
```

All queries scoped to `organizerProfileId` and optional `eventId` filter (existing pattern).

Implementation:
- `revenueByTicketType`: group `OrderItem` by `ticketType.name` where `order.status = PAID`
- `revenueByPromoCode`: group `Order` by `promoCodeId`, sum `order.total`, count
- `revenueByAddOn`: group `OrderAddOn` by `addOn.name`, sum `subtotal`, sum `quantity`
- `revenueByDay`: raw Prisma query — group PAID orders by `DATE(createdAt)` for last 90 days
- `affiliateStats`: group PAID orders by `affiliateLinkId`
- `reviewSummary`: avg and count of visible `EventReview` for organizer's events

---

## Task 2 — Extended Organizer Analytics UI

### `app/organizer/analytics/page.tsx` (modify)

Add tabbed sections below the existing summary cards:

**Revenue by Ticket Type** — sortable table: Ticket Type, Units Sold, Revenue
**Revenue by Promo Code** — table: Code, Orders, Total Discount Applied
**Revenue by Add-on** — table: Add-on Name, Qty Sold, Revenue
**Revenue Over Time** — simple HTML table of last 30 days (date, orders, revenue) — no chart library required; use a CSS bar via inline `style="width: Xpx"` for visual
**Affiliate Stats** — table: Code, Label, Orders, Revenue
**Review Summary** — average star rating + total count

---

## Task 3 — Extended Export

### `app/api/organizer/analytics/export/route.ts` (modify)

Current export returns order-level CSV. Extend to accept `?type=` query param:
- `?type=orders` (default, existing)
- `?type=ticket-types` — CSV: Ticket Type, Units Sold, Revenue
- `?type=addons` — CSV: Add-on Name, Qty Sold, Revenue
- `?type=promo-codes` — CSV: Code, Orders, Discount Total

---

## Task 4 — Admin Platform Analytics API

### `app/api/admin/analytics/route.ts` (modify)

Add to the existing response:

```ts
{
  // existing fields ...

  // NEW
  platformRevenue:       number     // sum of all PAID order totals
  platformCommission:    number     // sum of (order.total * event.commissionPct / 100)
  revenueByCategory:     { categoryName: string; revenue: number; orders: number }[]
  topOrganizers:         { brandName: string; revenue: number; events: number }[]   // top 10
  topEvents:             { title: string; revenue: number; ticketsSold: number }[]  // top 10
  newOrganizersThisMonth: number
  newAttendeesThisMonth:  number
  reviewStats:           { totalReviews: number; averageRating: number }
}
```

---

## Task 5 — Admin Analytics UI

### `app/admin/analytics/page.tsx` (modify)

Add sections:
- **Platform Revenue** summary card (total revenue, commission earned)
- **Top Organizers** table (brand name, revenue, event count)
- **Top Events** table (title, tickets sold, revenue)
- **Revenue by Category** table
- **New Users This Month** (organizers + attendees)
- **Review Stats** (platform average rating, total reviews)

---

## Task 6 — Monthly Revenue Report Email (Admin Triggered)

### `src/lib/services/notifications.ts` (modify)

Add `sendMonthlyRevenueReport(input: { organizerEmail, brandName, month, totalRevenue, totalOrders, topEvent })`:
- Simple plain-text + HTML email with the organizer's monthly summary
- Subject: "Your [Month] revenue summary — EventsBox"

### `app/api/admin/reports/send-monthly/route.ts` (new)

- **POST** — body: `{ organizerProfileId: string; month: string }` (e.g. `"2026-03"`)
- Requires SUPER_ADMIN
- Queries orders for that organizer in that month
- Calls `sendMonthlyRevenueReport`
- Returns `ok({ sent: true, email: organizer.email })`

### `app/admin/analytics/page.tsx` (modify)

Add a "Send Monthly Report" button at the bottom:
- Select organizer (dropdown) + month (month input)
- POST to the new endpoint
- Show success toast

---

## Task 7 — Integration Tests

### `src/tests/integration/organizer-analytics-extended.test.ts`
- GET `/api/organizer/analytics` returns `revenueByTicketType`, `revenueByPromoCode`, `revenueByAddOn`, `revenueByDay` arrays
- `revenueByTicketType` sums correctly for 2 ticket types

### `src/tests/integration/admin-analytics-extended.test.ts`
- GET `/api/admin/analytics` returns `platformRevenue`, `topOrganizers`, `revenueByCategory`
- `platformRevenue` matches sum of all PAID orders in test DB

### `src/tests/integration/monthly-report.test.ts`
- POST `/api/admin/reports/send-monthly` → calls `sendEmail` with correct subject (mock sendEmail)
- Non-admin → 403

---

## Execution Order
```
Task 1 (organizer analytics API)
Task 2 (organizer analytics UI)
Task 3 (extended CSV export)
Task 4 (admin analytics API)
Task 5 (admin analytics UI)
Task 6 (monthly report email + admin trigger)
Task 7 (tests)
```

## Acceptance Gate
- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing
- `npm run build` — clean

## Status
| Task | Status |
|------|--------|
| Organizer analytics API | TODO |
| Organizer analytics UI | TODO |
| Extended CSV export | TODO |
| Admin analytics API | TODO |
| Admin analytics UI | TODO |
| Monthly report email | TODO |
| Tests | TODO |
