# Phase 8 Plan — Waitlist, Discovery & Advanced Organizer Tools

**Status:** TODO
**Depends on:** Phase 7 complete ✅
**Goal:** Add sold-out waitlist with auto-notify, improve public event discovery, give organizers an attendee roster view, and let admins feature-highlight events on the landing page.

---

## Task Order (Sequential — do not reorder)

---

### Task 1 — Prisma Schema: Waitlist + Featured Events

**File to modify:** `prisma/schema.prisma`

**Add `Waitlist` model** (place after `QRTicket`):
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

**Add to `Event` model:**
```prisma
isFeatured  Boolean   @default(false)
waitlist    Waitlist[]
```

**Add to `TicketType` model:** `waitlist Waitlist[]`

Run: `npx prisma migrate dev --name add-waitlist-and-featured`
Run: `npx prisma generate`
Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: schema — waitlist and featured events`

---

### Task 2 — Public Waitlist API

**File to create:** `app/api/events/[slug]/waitlist/route.ts`

**POST** — body: `{ email, name?, ticketTypeId }`.
- Validate: email valid, ticketTypeId exists and belongs to this event
- Check ticket type is actually sold out (`sold >= quantity`) — if not, return error "Tickets still available"
- Check not already on waitlist for this ticketTypeId+email — if duplicate, return `ok({ alreadyJoined: true })`
- Create `Waitlist` record
- Send confirmation email to attendee: "You're on the waitlist for [Ticket Name] at [Event Title]. We'll notify you if tickets become available." (fire-and-forget, graceful if no Resend key)
- Return `ok({ joined: true })`

Rate limit: `await rateLimitRedis(\`waitlist:${ip}\`, 5, 60_000)`

**File to modify:** `app/events/[slug]/page.tsx`
- For each sold-out ticket type (sold >= quantity): replace the "Add to cart" button with a "Join Waitlist" button
- Clicking opens an inline form: Email, Name (optional)
- Calls `POST /api/events/[slug]/waitlist`
- On success: show "You're on the waitlist!" confirmation in place of the form

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: public waitlist join for sold-out tickets`

---

### Task 3 — Waitlist Auto-Notify on Ticket Availability

**File to modify:** `app/api/webhooks/stripe/route.ts`

After a refund is processed and `order.status` is set to REFUNDED:
- For each refunded `OrderItem`, decrement `ticketType.sold` by `item.quantity`
- After decrement, check if `ticketType.sold < ticketType.quantity` (tickets now available)
- If yes: find up to `quantity - sold` oldest un-notified waitlist entries for that `ticketTypeId` where `notifiedAt IS NULL`
- For each: send email "Good news! A ticket for [Ticket Name] at [Event Title] is now available. Purchase here: [event URL]" (fire-and-forget)
- Update `notifiedAt = now()` on those waitlist entries

**File to modify:** `app/api/organizer/events/[id]/orders/[orderId]/refund/route.ts`
- After refund completes, apply the same waitlist-notify logic as above (same helper function)

**File to create:** `src/lib/services/waitlist.ts`
- Export `notifyWaitlist(ticketTypeId: string, slotsAvailable: number): Promise<void>`
- Encapsulates the query + email + update logic so both refund paths reuse it

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: waitlist auto-notify on ticket availability`

---

### Task 4 — Event Discovery: Date Range Filter

**File to modify:** `app/events/page.tsx`
- Add date filter UI: "From" and "To" date inputs (`<input type="date">`)
- These are SSR query params: `?from=YYYY-MM-DD` and `?to=YYYY-MM-DD`
- Prisma query: add `startAt: { gte: fromDate, lte: toDate }` when provided
- Existing `?q=`, `?category=`, `?state=` filters continue to work alongside date filters
- Filter form uses `<form method="GET">` (no JS required — pure SSR)
- Active filters shown as dismissable chips (link that removes that param)

**File to modify:** `app/api/public/events/route.ts`
- Add `from` and `to` query params, parse as ISO date strings
- Apply to Prisma `where` clause alongside existing filters

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: event discovery date range filter`

---

### Task 5 — Admin: Feature Events on Landing Page

**File to create:** `app/api/admin/events/[id]/feature/route.ts`

**POST** — `requireRole("SUPER_ADMIN")`. Body: `{ isFeatured: boolean }`.
- Update `event.isFeatured`
- Write audit log: action `EVENT_FEATURED` or `EVENT_UNFEATURED`
- Return `ok({ isFeatured })`

**File to modify:** `app/admin/events/[id]/page.tsx`
- Add "Feature on Homepage" / "Unfeature" toggle button in the event header
- Calls `POST /api/admin/events/[id]/feature`
- Shows current featured state as a badge

**File to modify:** `app/page.tsx` (landing page)
- Change featured events query from `take: 3, orderBy: { startAt: "asc" }` to:
  `where: { isFeatured: true, status: "PUBLISHED", startAt: { gte: new Date() } }, take: 6, orderBy: { startAt: "asc" }`
- Fallback: if fewer than 3 featured events, fill remaining slots with upcoming published events

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: admin can feature events on landing page`

---

### Task 6 — Organizer Attendee Roster Page

**File to create:** `app/api/organizer/events/[id]/attendees/route.ts`

**GET** — `requireRole("ORGANIZER")`. Verify event belongs to organizer.
- Return paginated list of PAID order attendees for this event
- Per row: buyerName, buyerEmail, tickets (name + qty), total, paidAt, check-in status (% of tickets scanned)
- Query params: `?page=`, `?q=` (email search)
- Return `ok({ attendees, total, pages })`

**File to create:** `app/organizer/events/[id]/attendees/page.tsx`

**Behavior (SSR):**
- Auth guard: organizer only, event must belong to them
- Show event title + start date in header
- Table: Name, Email, Tickets, Total, Paid At, Check-in %
- `?q=` search input
- Pagination
- "Export CSV" button → `GET /api/organizer/events/[id]/attendees/export` (already built in Phase 7 Task 7)

**File to modify:** `app/organizer/events/[id]/page.tsx`
- Add "View Attendees" button linking to `/organizer/events/[id]/attendees`

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer attendee roster page`

---

### Task 7 — Organizer Waitlist View

**File to create:** `app/api/organizer/events/[id]/waitlist/route.ts`

**GET** — `requireRole("ORGANIZER")`. Verify event belongs to organizer.
- Return all waitlist entries for the event grouped by ticket type
- Per entry: email, name, joinedAt, notifiedAt
- Return `ok({ byTicketType: [ { ticketTypeName, entries: [...] } ] })`

**File to create:** `app/organizer/events/[id]/waitlist/page.tsx`

**Behavior (SSR):**
- Show waitlist grouped by ticket type
- Each group shows: ticket name, total waiting, notified count
- Table of entries: Email, Name, Joined, Notified (checkmark or —)
- "Notify All" button per group: calls `POST /api/organizer/events/[id]/waitlist/notify` to manually trigger notification emails for un-notified entries (optional manual nudge)

**File to modify:** `app/organizer/events/[id]/page.tsx`
- Add "Waitlist" button/section if any ticket type has waitlist entries

Run: `npm run lint && npm run typecheck`. Fix errors.
Commit: `feat: organizer waitlist view and manual notify`

---

### Task 8 — Integration Tests

**File to create:** `src/tests/integration/waitlist.test.ts`
- Join waitlist for sold-out ticket → success
- Duplicate join → `alreadyJoined: true`
- Join when tickets still available → error
- Refund triggers waitlist notify (mock email, check `notifiedAt` set)

**File to create:** `src/tests/integration/featured-events.test.ts`
- Admin sets `isFeatured = true` → event appears in featured query
- Admin sets `isFeatured = false` → event removed from featured query

Run: `npm run test:integration`. All (old + new) must pass. Fix any failures.
Commit: `test: waitlist and featured events integration tests`

---

### Task 9 — Release Notes

**File to create:** `docs/releases/phase-8-release-notes.md`
- Date, status Complete, feature summary, migration name `add-waitlist-and-featured`, validation evidence

**File to update:** `docs/tasks/phase-8-plan.md` — mark all tasks DONE.

Commit: `docs: phase 8 release notes and plan completion`

---

## Status Table

| Task | Description | Status |
|------|-------------|--------|
| 1 | Schema migration (Waitlist + isFeatured) | TODO |
| 2 | Public waitlist join API + event page UI | TODO |
| 3 | Waitlist auto-notify on ticket availability | TODO |
| 4 | Event discovery date range filter | TODO |
| 5 | Admin feature events on landing page | TODO |
| 6 | Organizer attendee roster page | TODO |
| 7 | Organizer waitlist view | TODO |
| 8 | Integration tests | TODO |
| 9 | Release notes | TODO |

---

## Out of Scope
- Waitlist priority queue (first-come-first-served is enough for now)
- Paid waitlist reservation (hold payment until ticket confirmed)
- Recurring / series events
- Embeddable ticket widget
- Mobile app API
