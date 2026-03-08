# Codex Prompt — Phase 8: Waitlist, Discovery & Advanced Organizer Tools

You are working on the EventsBox Ticket Manager — a Next.js 16 App Router fullstack app with Prisma + PostgreSQL, Stripe, Resend, and Cloudinary. Stack uses: `ok()`/`fail()` from `@/src/lib/http/response`, `requireRole()` from `@/src/lib/auth/server-auth`, `requireAttendee()` from `@/src/lib/auth/require-attendee`, `rateLimitRedis()` from `@/src/lib/http/rate-limit-redis`, Tailwind CSS v4.

Read `docs/tasks/phase-8-plan.md` for the full spec. Execute tasks **in order, one at a time**. After each task run `npm run lint && npm run typecheck` and fix all errors before moving on. Commit after each task.

---

## Task 1 — Prisma Schema Migration

Modify `prisma/schema.prisma`:

1. Add `Waitlist` model after `QRTicket`:
```prisma
model Waitlist {
  id           String     @id @default(cuid())
  eventId      String
  ticketTypeId String
  email        String
  name         String?
  notifiedAt   DateTime?
  createdAt    DateTime   @default(now())
  event        Event      @relation(fields: [eventId], references: [id], onDelete: Cascade)
  ticketType   TicketType @relation(fields: [ticketTypeId], references: [id], onDelete: Cascade)

  @@unique([ticketTypeId, email])
  @@index([eventId])
  @@index([ticketTypeId])
}
```

2. Add to `Event` model: `isFeatured Boolean @default(false)` and `waitlist Waitlist[]`
3. Add to `TicketType` model: `waitlist Waitlist[]`

Run: `npx prisma migrate dev --name add-waitlist-and-featured`
Run: `npx prisma generate`
Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: schema — waitlist and featured events`

---

## Task 2 — Public Waitlist Join API + Event Page UI

Create `app/api/events/[slug]/waitlist/route.ts`:

**POST**: body `{ email: string, name?: string, ticketTypeId: string }`. Validate with Zod.
- Rate limit: `await rateLimitRedis(\`waitlist:${ip}\`, 5, 60_000)`
- Find event by slug (must be PUBLISHED)
- Find ticket type — must belong to this event
- Check ticket type is sold out: `ticketType.sold >= ticketType.quantity`. If not: `fail(400, { code: "TICKETS_AVAILABLE", message: "Tickets are still available — go purchase one!" })`
- Check for existing waitlist entry: `prisma.waitlist.findUnique({ where: { ticketTypeId_email: { ticketTypeId, email } } })`. If exists: return `ok({ alreadyJoined: true })`
- Create waitlist entry
- Fire-and-forget email to attendee: subject "You're on the waitlist!", body "We'll notify you when a [Ticket Name] ticket becomes available for [Event Title]."
- Return `ok({ joined: true })`

Modify `app/events/[slug]/page.tsx`:
- For each ticket type where `sold >= quantity` (sold out), replace the quantity selector and "Add to cart" section with:
  - "Sold Out" badge
  - "Join Waitlist" button
  - Clicking shows an inline form: Email input (required), Name input (optional), Submit button
  - On submit: `POST /api/events/[slug]/waitlist` with `{ email, name, ticketTypeId }`
  - On `joined: true`: show "You're on the waitlist! We'll email you if a spot opens."
  - On `alreadyJoined: true`: show "You're already on the waitlist."
  - On error: show error message

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: public waitlist join for sold-out tickets`

---

## Task 3 — Waitlist Auto-Notify on Ticket Availability

Create `src/lib/services/waitlist.ts`:

Export async function `notifyWaitlist(ticketTypeId: string, slotsFreed: number): Promise<void>`:
- Find the ticketType to get its name and eventId
- Find the event to get its title and slug
- Find oldest un-notified waitlist entries: `prisma.waitlist.findMany({ where: { ticketTypeId, notifiedAt: null }, orderBy: { createdAt: "asc" }, take: slotsFreed })`
- For each entry: send email "A ticket is now available! Purchase [Ticket Name] for [Event Title] here: [APP_URL]/events/[slug]" (fire-and-forget)
- Batch update: `prisma.waitlist.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: new Date() } })`

Modify `app/api/webhooks/stripe/route.ts`:
- After setting order to PAID and decrementing `ticketType.sold` (find where sold counts are updated in the refund/cancellation flow) — actually, the webhook handles PAID orders, not refunds. Find the refund handling in the webhook if it exists, or skip.
- In the `payment_intent.succeeded` / `charge.refunded` handler (whichever handles status → REFUNDED): after decrementing `ticketType.sold`, calculate `slotsFreed = item.quantity`, call `void notifyWaitlist(ticketTypeId, slotsFreed).catch(console.error)`

Modify `app/api/organizer/events/[id]/orders/[orderId]/refund/route.ts`:
- After refund completes and order status set to REFUNDED: for each order item, call `void notifyWaitlist(item.ticketTypeId, item.quantity).catch(console.error)`

Modify `app/api/admin/events/[id]/orders/[orderId]/refund/route.ts`:
- Same as organizer refund route above

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: waitlist auto-notify on ticket availability`

---

## Task 4 — Event Discovery: Date Range Filter

Modify `app/events/page.tsx`:
- Read two new search params from `searchParams`: `from` (string, YYYY-MM-DD) and `to` (string, YYYY-MM-DD)
- Add date filter inputs to the filter form: `<input type="date" name="from" value={from ?? ""}>` and `<input type="date" name="to" value={to ?? ""}>`
- Form uses `method="GET"` (pure SSR, no client JS)
- Pass `from` and `to` to the data fetching function / API call
- Show active filters as dismissable links: if `from` is set, show chip "From: [date] ×" where × is a link that removes only the `from` param. Same for `to`.
- Pagination links must preserve `from`, `to`, `q`, `category`, `state` params

Modify the Prisma query in the events page (or in `app/api/public/events/route.ts` if that's where the query lives):
- Add to `where`:
  - If `from`: `startAt: { gte: new Date(from) }`
  - If `to`: `startAt: { lte: new Date(to + "T23:59:59Z") }`
  - Combine with existing `status: "PUBLISHED"`, `title: { contains: q }`, `categoryId`, `stateId` filters using `AND`

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: event discovery date range filter`

---

## Task 5 — Admin: Feature Events on Landing Page

Create `app/api/admin/events/[id]/feature/route.ts`:

**POST**: `requireRole("SUPER_ADMIN")`. Body: `{ isFeatured: boolean }`.
- Find event by id — if not found: `fail(404, ...)`
- Update: `prisma.event.update({ where: { id }, data: { isFeatured } })`
- Write audit log: action = `isFeatured ? "EVENT_FEATURED" : "EVENT_UNFEATURED"`, entityType "Event", entityId id
- Return `ok({ isFeatured })`

Modify `app/admin/events/[id]/page.tsx`:
- In the event header actions section, add a "Feature on Homepage" / "Unfeature" toggle button
- Button shows current state: if `event.isFeatured`, show "★ Featured" badge + "Unfeature" button; else show "Feature on Homepage" button
- On click: `fetch POST /api/admin/events/${id}/feature` with `{ isFeatured: !current }`, reload page on success

Modify `app/page.tsx` (landing page — SSR):
- Change the featured events query to:
```ts
const featuredEvents = await prisma.event.findMany({
  where: { isFeatured: true, status: "PUBLISHED", startAt: { gte: new Date() } },
  orderBy: { startAt: "asc" },
  take: 6,
  include: { category: true, state: true, city: true },
});
// Fallback: if fewer than 3, fill with upcoming events not already in the list
if (featuredEvents.length < 3) {
  const fallback = await prisma.event.findMany({
    where: { status: "PUBLISHED", startAt: { gte: new Date() }, id: { notIn: featuredEvents.map(e => e.id) } },
    orderBy: { startAt: "asc" },
    take: 3 - featuredEvents.length,
    include: { category: true, state: true, city: true },
  });
  featuredEvents.push(...fallback);
}
```

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: admin can feature events on landing page`

---

## Task 6 — Organizer Attendee Roster Page

Create `app/api/organizer/events/[id]/attendees/route.ts`:

**GET**: `requireRole("ORGANIZER")`.
- Find organizer profile for session user
- Verify event `id` belongs to organizer: `prisma.event.findFirst({ where: { id, organizerProfileId: profile.id } })`
- Parse `?page=` (default 1, size 20), `?q=` (buyerEmail search)
- `prisma.order.findMany` where `{ eventId: id, status: "PAID", buyerEmail: { contains: q } }`
- Include: `items { quantity, ticketType { name } }`, `tickets { checkedInAt }`
- Compute per order: total tickets, checked-in count
- Return `ok({ attendees, total, pages })`

Create `app/organizer/events/[id]/attendees/page.tsx` (SSR):
- Auth guard
- Fetch from API
- Page header: "[Event Title] — Attendees ([total])"
- Search input `?q=`
- Table: Name, Email, Tickets (count + type names), Total Paid, Check-in (X/Y)
- Pagination
- "Export CSV" button: `<a href="/api/organizer/events/${id}/attendees/export" download>Export CSV</a>`
- `export const revalidate = 0`

Modify `app/organizer/events/[id]/page.tsx`:
- Add "View Attendees" button in the header action group linking to `/organizer/events/${id}/attendees`

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer attendee roster page`

---

## Task 7 — Organizer Waitlist View

Create `app/api/organizer/events/[id]/waitlist/route.ts`:

**GET**: `requireRole("ORGANIZER")`. Verify event belongs to organizer.
- Fetch all waitlist entries for the event grouped by ticket type:
```ts
const entries = await prisma.waitlist.findMany({
  where: { eventId: id },
  include: { ticketType: { select: { name: true } } },
  orderBy: { createdAt: "asc" },
});
```
- Group by `ticketTypeId` in JS
- Return `ok({ groups: [ { ticketTypeId, ticketTypeName, total, notifiedCount, entries: [...] } ] })`

Create `app/api/organizer/events/[id]/waitlist/notify/route.ts`:

**POST**: body `{ ticketTypeId: string }`. Verify event belongs to organizer.
- Find un-notified entries for this ticketTypeId
- Find current available slots: `ticketType.quantity - ticketType.sold`
- Call `notifyWaitlist(ticketTypeId, Math.max(slotsAvailable, entries.length))` from `@/src/lib/services/waitlist`
- Return `ok({ notified: count })`

Create `app/organizer/events/[id]/waitlist/page.tsx` (SSR):
- Auth guard
- Fetch from `GET /api/organizer/events/[id]/waitlist`
- Show "No waitlist entries" empty state if no groups
- Per ticket type group: heading with ticket name + count, sub-stats "Notified: X / Total: Y"
- Table per group: Email, Name, Joined, Notified (✓ or —)
- "Notify Un-notified" button per group — calls `POST /api/organizer/events/[id]/waitlist/notify`, shows toast on success
- Link back to event detail

Modify `app/organizer/events/[id]/page.tsx`:
- After fetching event data, also fetch total waitlist count for this event
- If count > 0: show "Waitlist: [N] waiting" badge/button linking to `/organizer/events/${id}/waitlist`

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer waitlist view and manual notify`

---

## Task 8 — Integration Tests

Create `src/tests/integration/waitlist.test.ts`:
- `POST /api/events/[slug]/waitlist` on sold-out ticket → 200, `joined: true`
- Same email + ticketTypeId again → `alreadyJoined: true`
- On ticket that is NOT sold out → 400, `TICKETS_AVAILABLE`
- After refund, `notifyWaitlist` sets `notifiedAt` on waitlist entry (mock email service)

Create `src/tests/integration/featured-events.test.ts`:
- Admin calls `POST /api/admin/events/[id]/feature` with `{ isFeatured: true }` → `isFeatured` true on event
- Admin calls with `{ isFeatured: false }` → `isFeatured` false
- Non-admin gets 403

Follow existing test patterns from `src/tests/integration/auth-flow.test.ts`.

Run: `npm run test:integration`. All (old + new) must pass. Fix any failures.
Commit: `test: waitlist and featured events integration tests`

---

## Task 9 — Release Notes

Create `docs/releases/phase-8-release-notes.md` with: date (today), status Complete, summary of all features delivered, migration name `add-waitlist-and-featured`, new API routes, validation evidence (lint ✅, typecheck ✅, test:integration ✅).

Update `docs/tasks/phase-8-plan.md` — set all tasks to DONE.

Commit: `docs: phase 8 release notes and plan completion`

---

## Final Validation

Run: `npm run lint && npm run typecheck && npm run test:integration`
All must pass with zero errors. Push to `main` when complete.
