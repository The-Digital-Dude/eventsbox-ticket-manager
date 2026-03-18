# Gemini Prompt — Phases 16–20 (Sequential)

Paste everything below this line into Gemini CLI:

---

You are implementing Phases 16 through 20 of the EventsBox Ticket Manager — a Next.js 16 + Prisma + PostgreSQL + Tailwind CSS v4 monorepo. All code lives under the repo root.

## Before you start

Read these files in order:
1. `docs/architecture/overview.md`
2. `docs/architecture/decisions.md`
3. `docs/tasks/phase-16-plan.md`
4. `docs/tasks/phase-17-plan.md`
5. `docs/tasks/phase-18-plan.md`
6. `docs/tasks/phase-19-plan.md`
7. `docs/tasks/phase-20-plan.md`

Also read these files to understand existing patterns before writing any code:
- `src/lib/http/response.ts` — all API responses use `ok()` / `fail()`
- `src/lib/auth/guards.ts` — auth guard patterns
- `src/lib/auth/require-attendee.ts` — attendee guard
- `app/api/organizer/promo-codes/route.ts` — organizer CRUD pattern
- `app/api/checkout/route.ts` — checkout flow
- `app/api/webhooks/stripe/route.ts` — order + QRTicket creation
- `src/lib/services/notifications.ts` — email patterns
- `src/tests/integration/checkout.test.ts` — integration test patterns

## Ground rules

- All API responses use `ok(data)` / `fail(status, { code, message })` from `src/lib/http/response.ts`
- All request bodies and route params must be Zod-validated
- All routes that modify data require a role guard (`requireRole` or `requireAttendee`)
- Never add new npm packages unless the plan explicitly calls for one
- Match existing code style — look at adjacent files before writing
- Each schema change: run `npx prisma db push && npx prisma generate` (do NOT use `prisma migrate dev` — it is blocked by Neon drift)
- After every phase: run `npm run lint && npm run typecheck && npm run test:integration && npm run build` and fix all errors before moving to the next phase

---

## PHASE 16 — Affiliate Tickets & Referral Codes

Read `docs/tasks/phase-16-plan.md` in full. Then implement exactly:

### Schema (do first)
Add `AffiliateLink` model and `affiliateLinkId` on `Order` exactly as specified in the plan.
Run: `npx prisma db push && npx prisma generate`

### API — Organizer Affiliate Management
Create `app/api/organizer/affiliate/route.ts`:
- GET: `requireRole(ORGANIZER)` → fetch all `AffiliateLink` where `organizerProfileId = profile.id`, include `_count: { orders: true }`, `event: { select: { title: true, slug: true } }`
- POST: body `{ label?, eventId?, commissionPct?, code? }`; Zod: `label: z.string().optional()`, `eventId: z.string().optional()`, `commissionPct: z.number().min(0).max(100).default(10)`, `code: z.string().toUpperCase().optional()`; if code not provided generate with `nanoid(8).toUpperCase()`; check code uniqueness before insert; return `ok(link)`

Create `app/api/organizer/affiliate/[id]/route.ts`:
- PATCH: update `label`, `commissionPct`, `isActive`; verify link belongs to organizer
- DELETE: set `isActive = false` (never hard delete — orders reference it)

### API — Public Click Tracking
Create `app/api/public/affiliate/[code]/route.ts`:
- GET: `prisma.affiliateLink.update({ where: { code, isActive: true }, data: { clickCount: { increment: 1 } } })`; return `ok({ eventId, eventSlug: link.event?.slug ?? null })`
- If code not found: `fail(404, { code: 'NOT_FOUND' })`

### Checkout Integration
Modify `app/api/checkout/route.ts`:
- Add `affiliateCode: z.string().optional()` to the request body Zod schema
- After validating the body, if `affiliateCode` is present: `prisma.affiliateLink.findUnique({ where: { code: affiliateCode, isActive: true } })`
- Attach `affiliateLinkId` to the order create call if found; silently ignore if not found

### Organizer UI
Create `app/organizer/affiliate/page.tsx`:
- Client component, same structure as `app/organizer/promo-codes/page.tsx`
- Table columns: Code (monospace badge), Label, Event, Commission %, Clicks, Orders, Active
- "New Link" inline form: label, event (dropdown from `/api/organizer/events`), commission %
- "Copy URL" button per row: copies `window.location.origin + '/events/' + (event.slug ?? '') + '?ref=' + code` to clipboard using `navigator.clipboard.writeText`
- Deactivate button calls DELETE

Add `{ href: "/organizer/affiliate", label: "Affiliate Links" }` to organizer sidebar nav in `src/components/shared/sidebar-layout.tsx` or wherever organizer nav items are defined.

### Tests
Create `src/tests/integration/affiliate.test.ts` covering all cases in the plan.

### Validation gate
```bash
npm run lint && npm run typecheck && npm run test:integration && npm run build
```
Fix all errors. Do not proceed to Phase 17 until this passes.

---

## PHASE 17 — Event Add-ons / Extra Services

Read `docs/tasks/phase-17-plan.md` in full. Then implement exactly:

### Schema
Add `EventAddOn` and `OrderAddOn` models exactly as specified.
Run: `npx prisma db push && npx prisma generate`

### Organizer Add-on API
Create `app/api/organizer/events/[id]/addons/route.ts`:
- GET: verify organizer owns event; return `prisma.eventAddOn.findMany({ where: { eventId: id }, orderBy: { sortOrder: 'asc' } })`
- POST: Zod validate `{ name, description?, price, maxPerOrder?, totalStock?, isActive?, sortOrder? }`; verify organizer owns event; create add-on

Create `app/api/organizer/events/[id]/addons/[addOnId]/route.ts`:
- PATCH: update fields; ownership check via `event.organizerProfileId`
- DELETE: check `prisma.orderAddOn.count({ where: { addOnId } })`; if > 0 set `isActive = false`; else hard delete

### Public Event Route
Modify `app/api/public/events/[slug]/route.ts` to include:
```ts
addOns: {
  where: { isActive: true },
  orderBy: { sortOrder: 'asc' },
  select: { id: true, name: true, description: true, price: true, maxPerOrder: true, totalStock: true }
}
```
For each add-on, compute `remainingStock = totalStock == null ? null : totalStock - existingCount` (query `orderAddOn.count` per add-on where order.status = PAID).

### Checkout API
Modify `app/api/checkout/route.ts`:
- Add `addOns: z.array(z.object({ addOnId: z.string(), quantity: z.number().int().min(1) })).optional().default([])`
- For each add-on entry: fetch `EventAddOn`, verify belongs to same event, check `quantity <= maxPerOrder`, check stock if `totalStock` set
- Add add-on totals to `order.total`
- Create `OrderAddOn` records inside the same transaction as the order (snapshot `name` and current `price` as `unitPrice`)

### Order Detail
Modify `app/api/orders/[id]/route.ts` to include `orderAddOns: { include: { addOn: { select: { name: true } } } }` in the Prisma query.

### Checkout UI
Modify `app/checkout/[orderId]/page.tsx` to show an "Extras" section after ticket selection if the event has add-ons. Each add-on: name, description, price, quantity stepper. Include selected add-ons in the POST body.

### Notifications
Modify `src/lib/services/notifications.ts` `sendOrderConfirmationEmail`: if `order.orderAddOns` is provided and non-empty, append an "Extras" section to the email body.

### Organizer Edit UI
Modify `app/organizer/events/[id]/edit/page.tsx` to include an "Add-ons" section after the ticket types section. CRUD calls to the new add-on endpoints. Same inline form pattern as ticket types.

### Tests
Create `src/tests/integration/event-addons.test.ts` covering all cases in the plan.

### Validation gate
```bash
npm run lint && npm run typecheck && npm run test:integration && npm run build
```
Fix all errors. Do not proceed to Phase 18 until this passes.

---

## PHASE 18 — Scanner / Door Sales Role

Read `docs/tasks/phase-18-plan.md` in full. Then implement exactly:

### Schema
1. Add `SCANNER` to the `Role` enum
2. Add `PaymentType` enum (`STRIPE`, `DOOR_CASH`, `COMPLIMENTARY`) and `paymentType PaymentType @default(STRIPE)` to `Order`
3. Add `scannerOrganizerProfileId String?` to `User`; add relation `scannerOrganizerProfile OrganizerProfile?` on `User` and `scannerAccounts User[]` on `OrganizerProfile`
Run: `npx prisma db push && npx prisma generate`

### Auth Guard
Modify `src/lib/auth/guards.ts`:
- Add helper `requireScannerOrOrganizer(req: NextRequest)` — calls `requireRole` and accepts SCANNER or ORGANIZER; throws FORBIDDEN if neither

Modify `middleware.ts` (or `proxy.ts`):
- Allow `/scanner` path for SCANNER and ORGANIZER roles
- SCANNER role must be blocked from `/organizer/*`, `/admin/*`, `/account/*`

### Scanner Account API
Create `app/api/organizer/scanners/route.ts`:
- GET: list users where `role = SCANNER AND scannerOrganizerProfileId = profile.id`
- POST: `{ email, password }` → hash password with bcrypt, create User with `role = SCANNER`, `scannerOrganizerProfileId = profile.id`, `emailVerified = true`; check email uniqueness

Create `app/api/organizer/scanners/[id]/route.ts`:
- PATCH: toggle `isActive`
- DELETE: set `isActive = false`; ownership check (`user.scannerOrganizerProfileId = profile.id`)

### Check-in Service Refactor
Extract shared logic from `app/api/organizer/checkin/route.ts` into `src/lib/services/checkin.ts`:
- `performCheckin(ticketId: string, organizerProfileId: string): Promise<CheckinResult>`
- The organizer route calls it with the organizer's profile ID
Create `app/api/scanner/checkin/route.ts`:
- POST: `requireScannerOrOrganizer(req)`; for SCANNER role, fetch `user.scannerOrganizerProfileId` to use as the scope; call `performCheckin`

### Walk-in Sale API
Create `app/api/scanner/walk-in/route.ts`:
- POST: `requireScannerOrOrganizer(req)`; body: `{ eventId, items: [{ ticketTypeId, quantity }], buyerName, buyerEmail? }`
- Verify event belongs to the organizer (or scanner's org)
- Validate ticket availability (decrement quantities)
- Create Order (`status = PAID`, `paymentType = DOOR_CASH`), OrderItems, QRTickets in a single transaction
- If `buyerEmail` provided, send order confirmation email
- Return `ok({ orderId, tickets })`

### Organizer Scanner Management UI
Create `app/organizer/scanners/page.tsx`:
- Table: Email, Created, Active status
- "Add Scanner" form: email + password
- Deactivate button
- Add `{ href: "/organizer/scanners", label: "Scanners" }` to organizer nav

### Scanner Dashboard UI
Create `app/scanner/layout.tsx`: minimal layout — logo/title + logout button, no sidebar
Create `app/scanner/page.tsx`:
- Client component, two tabs: Check In | Walk-in Sale
- Check In tab: text input for ticket ID, submit button, result display (success green / error red)
- Walk-in Sale tab: event selector (fetch from `/api/organizer/events` scoped by org), ticket type quantity steppers, buyer name + email fields, "Record Sale" button, success panel with ticket IDs

### Auth Login Redirect
Modify `app/auth/login/page.tsx`: after login, if `role === 'SCANNER'` redirect to `/scanner`

### Tests
Create `src/tests/integration/scanner-role.test.ts` covering all cases in the plan.

### Validation gate
```bash
npm run lint && npm run typecheck && npm run test:integration && npm run build
```
Fix all errors. Do not proceed to Phase 19 until this passes.

---

## PHASE 19 — Event Reviews & Ratings

Read `docs/tasks/phase-19-plan.md` in full. Then implement exactly:

### Schema
Add `EventReview` model exactly as specified.
Run: `npx prisma db push && npx prisma generate`

### Public Review API
Create `app/api/events/[slug]/reviews/route.ts`:
- GET (no auth): `prisma.eventReview.findMany({ where: { event: { slug }, isVisible: true }, include: { attendeeProfile: { select: { firstName, lastName } } }, orderBy: { createdAt: 'desc' } })`; compute `averageRating = sum(ratings) / count`; map `attendeeName` from profile fields or "Anonymous"
- POST (ATTENDEE required): Zod `{ rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() }`; verify attendee has PAID order for this event via `prisma.order.count({ where: { event: { slug }, attendeeUserId: attendeeProfile.id, status: 'PAID' } })`; create review; catch unique constraint violation → `fail(409, { code: 'ALREADY_REVIEWED' })`

Create `app/api/account/reviews/route.ts`:
- GET (ATTENDEE): return attendee's reviews with event details

Create `app/api/account/reviews/[reviewId]/route.ts`:
- DELETE (ATTENDEE): ownership check, hard delete

### Admin Moderation API
Create `app/api/admin/reviews/route.ts`:
- GET (SUPER_ADMIN): paginated list, filters `?eventId=&isVisible=&page=`

Create `app/api/admin/reviews/[id]/route.ts`:
- PATCH (SUPER_ADMIN): `{ isVisible: boolean }`; write audit log

### Public Event Page
Modify `app/events/[slug]/EventDetailClient.tsx`:
- Add Reviews section: average rating display + list of reviews (first 10, load more)
- If attendee is logged in, event has ended, they have a paid ticket, and no review exists: show inline review form (star rating selector + comment textarea + submit)
- Star rating selector: 5 clickable stars rendered as Unicode or SVG, track selected value in state
- After submit: refresh reviews list

### Organizer Event Dashboard
Modify `app/organizer/events/[id]/page.tsx`:
- Add "Reviews" tab, read-only table of reviews for this event

### Admin Reviews Page
Create `app/admin/reviews/page.tsx`:
- Table with filter, inline visibility toggle
- Add "Reviews" to admin sidebar nav

### Organizer Public Profile
Modify `app/organizers/[id]/page.tsx`:
- Query aggregate: `prisma.eventReview.aggregate({ where: { event: { organizerProfileId: id }, isVisible: true }, _avg: { rating: true }, _count: { id: true } })`
- Show "★ 4.3 average (94 reviews)" badge under the organizer name

### In-App Review Prompt
Modify `app/account/orders/page.tsx`:
- For each PAID order where `event.endAt < new Date()`: fetch whether a review exists for that event by this attendee; if not, show "Rate this event →" button linking to `/events/[slug]#reviews`

### Tests
Create `src/tests/integration/event-reviews.test.ts` covering all cases in the plan.

### Validation gate
```bash
npm run lint && npm run typecheck && npm run test:integration && npm run build
```
Fix all errors. Do not proceed to Phase 20 until this passes.

---

## PHASE 20 — Advanced Analytics & Financial Reporting

Read `docs/tasks/phase-20-plan.md` in full. Then implement exactly:

### No schema changes needed.

### Extended Organizer Analytics API
Modify `app/api/organizer/analytics/route.ts`:

Add these to the existing response (do NOT remove existing fields):

```ts
// revenueByTicketType
const byTicketType = await prisma.orderItem.groupBy({
  by: ['ticketTypeId'],
  where: { order: { organizerProfile: { userId: auth.sub }, status: 'PAID' } },
  _sum: { subtotal: true },
  _count: { id: true },
});
// join with ticketType names

// revenueByPromoCode
const byPromo = await prisma.order.groupBy({
  by: ['promoCodeId'],
  where: { organizerProfile: { userId: auth.sub }, status: 'PAID', promoCodeId: { not: null } },
  _count: { id: true },
  _sum: { total: true },
});

// revenueByDay — last 90 days
// Use prisma.$queryRaw for date grouping:
const byDay = await prisma.$queryRaw<{ date: string; revenue: number; orders: number }[]>`
  SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders
  FROM "Order"
  WHERE status = 'PAID'
    AND organizer_profile_id = ${profileId}
    AND created_at >= NOW() - INTERVAL '90 days'
  GROUP BY DATE(created_at)
  ORDER BY date ASC
`;

// affiliateStats — group PAID orders by affiliateLinkId
// revenueByAddOn — group OrderAddOn by addOn.name
// reviewSummary — avg and count
```

### Extended Organizer Analytics UI
Modify `app/organizer/analytics/page.tsx`:
- Add tabbed sections as specified in the plan
- Revenue Over Time: render a simple bar chart using CSS widths (no chart library): `<div style={{ width: \`${(day.revenue / maxRevenue) * 200}px\` }} className="h-4 bg-blue-500 rounded" />`

### Extended CSV Export
Modify `app/api/organizer/analytics/export/route.ts`:
- Add `?type=ticket-types`, `?type=addons`, `?type=promo-codes` as specified

### Admin Analytics API
Modify `app/api/admin/analytics/route.ts`:
- Add `platformRevenue`, `platformCommission`, `revenueByCategory`, `topOrganizers`, `topEvents`, `newOrganizersThisMonth`, `newAttendeesThisMonth`, `reviewStats` to the response

### Admin Analytics UI
Modify `app/admin/analytics/page.tsx`:
- Add the new stat cards and tables as specified

### Monthly Report Email
Add `sendMonthlyRevenueReport` to `src/lib/services/notifications.ts`
Create `app/api/admin/reports/send-monthly/route.ts` (SUPER_ADMIN, POST)
Add trigger UI to `app/admin/analytics/page.tsx`

### Tests
Create:
- `src/tests/integration/organizer-analytics-extended.test.ts`
- `src/tests/integration/admin-analytics-extended.test.ts`
- `src/tests/integration/monthly-report.test.ts`

### Final validation gate
```bash
npm run lint && npm run typecheck && npm run test:integration && npm run build
```
All must pass with zero errors.

---

## Completion

After all 5 phases pass their validation gates, output a summary in this format:

```
## Phase 16 — Affiliate Tickets
Files created: [list]
Files modified: [list]
Tests: [pass count]

## Phase 17 — Add-ons / Extra Services
...

## Phase 18 — Scanner / Door Sales
...

## Phase 19 — Reviews & Ratings
...

## Phase 20 — Advanced Analytics
...
```
