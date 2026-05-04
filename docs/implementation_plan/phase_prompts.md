# Phase Prompts — EventsBox Implementation

> Copy each prompt into a **new chat**. Each phase is a self-contained unit of work.
> Always run `npm run lint && npm run typecheck` at the end of each phase before starting the next.

---

## Phase A — Schema Additions

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[docs/tasks/current-task.md]

Read the gap analysis plan carefully. Implement Phase A: Schema Additions.

Add the following to prisma/schema.prisma:

1. New enums:
   - EventMode { SIMPLE, RESERVED_SEATING }
   - EventType { PHYSICAL, ONLINE }
   - EventVisibility { PUBLIC, PRIVATE, UNLISTED }

2. New fields on the Event model:
   - mode         EventMode      @default(SIMPLE)
   - eventType    EventType      @default(PHYSICAL)
   - visibility   EventVisibility @default(PUBLIC)
   - tagline      String?
   - onlineAccessLink String?
   - adminNote    String?

3. New models for reserved seating:
   - SeatingSection (id, eventId, name, color, sortOrder, createdAt, updatedAt)
   - SeatingRow (id, sectionId, label, sortOrder, createdAt, updatedAt)
   - SeatInventory (id, eventId, sectionId, rowId, seatLabel, status enum {AVAILABLE, RESERVED, SOLD, BLOCKED}, orderId?, expiresAt?, createdAt, updatedAt)
   - TableZone (id, eventId, name, seatsPerTable, totalTables, price Decimal, color?, createdAt, updatedAt)

All new enum fields on Event must have safe @default values so existing events are not broken.

After editing schema.prisma:
1. Run: npm run db:generate
2. Create migration: npx prisma migrate dev --name phase-a-seating-and-event-fields
3. Run: npm run typecheck
4. Update docs/tasks/current-task.md with Phase A completion status.

Do not touch any UI files. Schema only.
```

---

## Phase B — Event Creation Wizard

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[app/organizer/events/new/page.tsx]
@[app/api/organizer/events/route.ts]

Read the gap analysis plan. Implement Phase B: Multi-Step Event Creation Wizard.

Replace app/organizer/events/new/page.tsx with a proper multi-step wizard. The steps are:

Step 1 — Mode Selection
  - Two large cards: "Simple Event" (GA/online/no seating) and "Reserved Seating Event" (rows/tables/seat-based)
  - User must pick one before proceeding

Step 2 — Event Details
  - title (required)
  - tagline (new field, optional)
  - description
  - eventType: PHYSICAL or ONLINE toggle (new field)
  - category select
  - tags input
  - visibility: PUBLIC / PRIVATE / UNLISTED (new field)

Step 3 — Location & Date
  - If PHYSICAL: venue select, PlacesAutocomplete, country/state/city, lat/lng
  - If ONLINE: onlineAccessLink input (new field)
  - startAt, endAt, timezone
  - Live preview card on the right side showing: cover image, title, date, venue/online badge, draft status badge

Step 4 — Media
  - heroImage upload
  - gallery images upload (multiple)
  - videoUrl

Step 5 — Review & Create
  - Summary of all entered data
  - "Create Event" button → POST to /api/organizer/events with all fields including mode, tagline, eventType, visibility, onlineAccessLink
  - On success: redirect to /organizer/events/[id] for ticket setup (if SIMPLE) or /organizer/events/[id]/seating (if RESERVED_SEATING)

Rules:
- Use a step indicator at the top (Step 1 of 5)
- Preserve existing API route shape, just extend it with new fields
- Validate new fields in src/lib/validators/ using Zod
- Keep existing UI style (Tailwind, existing component library)
- Run npm run lint && npm run typecheck when done
- Update docs/tasks/current-task.md
```

---

## Phase C — Reserved Seating Map Builder

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[app/organizer/events/[id]/page.tsx]

Read the gap analysis plan. Implement Phase C: Reserved Seating Map Builder.

This is only for events where mode = RESERVED_SEATING.

Create app/organizer/events/[id]/seating/page.tsx — the seating builder page.

The page has two panels:

LEFT PANEL — Visual Canvas (SVG-based, no external canvas library needed):
  - Renders all SeatingSection and SeatingRow records as a grid
  - Each seat in a row is a small colored square
  - Color indicates zone/section (use SeatingSection.color)
  - Clicking a seat or zone selects it and populates the right panel
  - "Add Section" button → creates a new SeatingSection
  - "Add Row" button (inside a section) → creates a new SeatingRow
  - "Add Table Zone" button → creates a new TableZone

RIGHT PANEL — Config Panel:
  - Shown when a section/row/zone is selected
  - Fields: name, type (SECTION/TABLE/GA), capacity, price (Decimal), color picker, notes
  - "Save Zone" button → PATCH /api/organizer/events/[id]/seating/[zoneId]
  - "Delete Zone" button → DELETE /api/organizer/events/[id]/seating/[zoneId]
  - "Auto-generate seats" button → given rows × columns, bulk-insert SeatInventory records

API routes to create:
  - GET  /api/organizer/events/[id]/seating/route.ts — load all sections, rows, seats, table zones
  - POST /api/organizer/events/[id]/seating/route.ts — create section or table zone
  - PATCH/DELETE /api/organizer/events/[id]/seating/[zoneId]/route.ts — update/delete zone

All routes require ORGANIZER role and ownership check.

Add a "Seating" tab/link on the event detail page (app/organizer/events/[id]/page.tsx) that only shows when event.mode === RESERVED_SEATING.

Run npm run lint && npm run typecheck when done.
Update docs/tasks/current-task.md.
```

---

## Phase D — Auto Ticket Generation Preview

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[app/organizer/events/[id]/page.tsx]
@[app/api/organizer/events/[id]/seating/route.ts]

Read the gap analysis plan. Implement Phase D: Auto Ticket Generation Preview.

After the seating map is built (Phase C), each priced zone should automatically generate a TicketType.

Create a "Sync Tickets" flow on app/organizer/events/[id]/page.tsx (or a new tab):

1. Add a "Ticket Preview" section that appears when event.mode === RESERVED_SEATING
2. Show a card for each SeatingSection and TableZone that has a price set
3. Each card shows: zone name, source type (Section/Table/GA), price, capacity, current sync status
4. Sync status badge: "Synced" (green) if a TicketType already exists linked to this zone, "Not synced" (yellow) if price is set but no TicketType exists yet
5. "Sync All" button → POST /api/organizer/events/[id]/tickets/sync

Create POST /api/organizer/events/[id]/tickets/sync/route.ts:
  - For each priced SeatingSection: upsert a TicketType with name = section name, price = section price, quantity = total seats in section
  - For each priced TableZone: upsert a TicketType with name = zone name, price = zone price, quantity = totalTables
  - Return list of created/updated ticket types
  - Requires ORGANIZER role + ownership

Allow renaming and price adjustment on the generated ticket cards (inline edit → PATCH /api/organizer/events/[id]/ticket-types/[id]).

Run npm run lint && npm run typecheck when done.
Update docs/tasks/current-task.md.
```

---

## Phase E — Public Seat Picker + Reservation Timer

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[app/events/[slug]/EventDetailClient.tsx]
@[app/api/checkout/route.ts]

Read the gap analysis plan. Implement Phase E: Public Seat Picker and Reservation Flow.

This adds reserved seating selection to the public event page for events where mode = RESERVED_SEATING.

1. In app/events/[slug]/EventDetailClient.tsx:
   - If event.mode === SIMPLE: keep existing GA quantity selector (no change)
   - If event.mode === RESERVED_SEATING: show a seat map viewer instead

2. Create src/components/shared/public-seat-map.tsx:
   - Read-only SVG seat map (same visual layout as the builder in Phase C)
   - Seat colors: green = available, yellow = reserved (held by someone), red = sold, gray = blocked
   - Clicking an available seat selects it (highlight in blue)
   - Multiple seat selection supported
   - Shows selected seat labels and total price below the map

3. Create GET /api/events/[slug]/seats/route.ts:
   - Public route (no auth)
   - Returns all SeatInventory records for the event with their current status
   - Excludes RESERVED seats where expiresAt has passed (treat as AVAILABLE)

4. Create POST /api/events/[slug]/reserve/route.ts:
   - Accepts { seatIds: string[] }
   - Checks each seat is still AVAILABLE
   - Sets status = RESERVED, expiresAt = now + 10 minutes, orderId = pending
   - Returns reservation token + expiry time

5. Frontend reservation timer:
   - After reserving, show a countdown timer (MM:SS) in the purchase panel
   - If timer hits 0: show "Your seats have been released" and reset selection
   - Cancel reservation on timer expiry: PATCH seat status back to AVAILABLE

6. Extend checkout flow (app/api/checkout/route.ts):
   - Accept seatIds in the checkout body
   - On checkout init: verify seats are still RESERVED and belong to the session
   - On payment success webhook: mark seats as SOLD, link orderId

Run npm run lint && npm run typecheck when done.
Update docs/tasks/current-task.md.
```

---

## Phase F — Quick Wins

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[docs/tasks/current-task.md]

Read the gap analysis plan. Implement Phase F: Quick Wins, one item at a time. 
Confirm completion of each item before moving to the next.

Items in order:

F1 — Duplicate Event
  - POST /api/organizer/events/[id]/duplicate/route.ts
  - Copies event fields (not tickets, not orders) with title prefix "Copy of ..."
  - Status resets to DRAFT
  - Add "Duplicate" button on app/organizer/events/[id]/page.tsx

F2 — Draft Recovery Widget on Dashboard
  - On app/organizer/dashboard/page.tsx, add a "Resume Draft" card
  - Fetches the most recent DRAFT event for the organizer
  - Shows: event title, last updated time, "Continue Editing" button

F3 — Duplicate Ticket Type
  - Add "Duplicate" button on each ticket type row in app/organizer/events/[id]/page.tsx
  - POST /api/organizer/events/[id]/ticket-types/[ticketTypeId]/duplicate/route.ts
  - Copies all fields, appends " (Copy)" to name

F4 — Manual Sold-Out Toggle
  - Add "Mark Sold Out" / "Mark Available" toggle on ticket type row
  - When marked sold out: set TicketType.quantity = TicketType.sold (no more available)
  - PATCH /api/organizer/events/[id]/ticket-types/[id] with soldOut: true flag

F5 — Admin "Request Changes" Action
  - On app/admin/events/[id]/page.tsx, add a third action button: "Request Changes"
  - Different from Reject: sets status back to DRAFT (not REJECTED), with a note
  - POST /api/admin/events/[id]/request-changes/route.ts
  - Accepts { note: string }, sets event.status = DRAFT, event.adminNote = note
  - Organizer can see the note on their event detail page

F6 — Admin Internal Note
  - Show Event.adminNote on app/organizer/events/[id]/page.tsx (read-only, styled as info callout)
  - Show + edit adminNote on app/admin/events/[id]/page.tsx

F7 — Resend Confirmation Email
  - Add "Resend Email" button on each ticket in app/account/tickets/page.tsx
  - POST /api/account/tickets/[ticketId]/resend-email/route.ts
  - Re-sends the order confirmation email for that ticket's order
  - Requires ATTENDEE session + ownership check

F8 — JSON-LD Structured Data on Event Pages
  - In app/events/[slug]/page.tsx, add a <script type="application/ld+json"> tag
  - Schema: Event type from schema.org with name, startDate, endDate, location, image, offers
  - Use generateMetadata pattern already in place

F9 — Price Range + Availability Filters on /events
  - Add "Min Price" and "Max Price" inputs to the filter panel on app/events/page.tsx
  - Add "Available Only" checkbox filter
  - Pass as query params to /api/events/filters or the existing events fetch
  - Filter in the API: exclude events where all ticket types are sold out (if availability filter on)

Run npm run lint && npm run typecheck after ALL items are done.
Update docs/tasks/current-task.md with Phase F completion.
```

---

## Phase G — PDF Tickets + POS System

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[app/account/tickets/page.tsx]
@[docs/tasks/current-task.md]

Read the gap analysis plan. Implement Phase G in two parts:

--- PART G1: PDF Ticket Generation ---

Install: npm install @react-pdf/renderer

Create src/lib/pdf/ticket-pdf.tsx:
  - React PDF component that renders a single QRTicket as a PDF page
  - Shows: event title, date, venue, ticket type, seat/table label, QR code image, ticket number
  - Use QR image from existing /api/account/tickets/[ticketId]/qr endpoint

Create GET /api/account/tickets/[ticketId]/pdf/route.ts:
  - Requires ATTENDEE session + ownership check
  - Renders the PDF using @react-pdf/renderer renderToBuffer
  - Returns response with Content-Type: application/pdf
  - Content-Disposition: attachment; filename="ticket-[ticketNumber].pdf"

Add "Download PDF" button on each ticket card in app/account/tickets/page.tsx:
  - Links to /api/account/tickets/[ticketId]/pdf

--- PART G2: POS System ---

Create app/organizer/pos/page.tsx — Point of Sale terminal page.
Requires ORGANIZER role.

Step 1 — Select Event:
  - Dropdown of the organizer's PUBLISHED events
  
Step 2 — Select Ticket / Seat:
  - For SIMPLE events: ticket type selector + quantity
  - For RESERVED events: mini seat map (read-only, pick available seat)

Step 3 — Buyer Info:
  - Name and email (required for issuing ticket)
  - Payment method: Cash / Card (external) / Complimentary
  - Optional: note

Step 4 — Issue Ticket:
  - POST /api/organizer/pos/issue/route.ts
  - Creates an Order (status = PAID, no stripePaymentIntentId)
  - Creates OrderItem + QRTicket records
  - Marks seat as SOLD if reserved seating
  - Sends confirmation email to buyer email
  - Returns QR code to display on screen immediately

Add "POS" link to organizer sidebar nav.

Run npm run lint && npm run typecheck when done.
Update docs/tasks/current-task.md.
```

---

## Phase H — Reporting & Ledger

```
@[docs/implementation_plan/gap_analysis_and_plan.md]
@[prisma/schema.prisma]
@[app/organizer/analytics/page.tsx]
@[app/organizer/payout/page.tsx]
@[docs/tasks/current-task.md]

Read the gap analysis plan. Implement Phase H: Reporting and Ledger.

--- H1: Attendance Report View ---

On app/organizer/analytics/page.tsx, add a new "Attendance" tab:
  - Per-event table showing: total tickets issued, checked in, no-shows (issued - checked in), check-in rate %
  - Scan history table: ticket number, attendee name/email, checked-in time, device
  - API: GET /api/organizer/analytics/attendance?eventId=xxx
    Returns: { totalIssued, checkedIn, noShows, scanHistory[] }

--- H2: Unified Transaction Ledger ---

On app/organizer/payout/page.tsx, add a "Transaction Ledger" section:
  - Table with columns: Date, Type (Sale / Refund / Platform Fee / Payout), Description, Amount, Net
  - Each paid Order = one Sale row (gross amount)
  - Each refunded Order = one Refund row (negative)
  - Each PayoutRequest (PAID) = one Payout row
  - Platform fees shown as deductions
  - Totals row at bottom: Gross Sales, Total Fees, Total Refunds, Net Available

API: GET /api/organizer/payout/ledger
  Returns paginated list of ledger entries derived from Orders + PayoutRequests

--- H3: Event-Day Real-Time Dashboard ---

Extend app/organizer/scanner/page.tsx with an event-day stats panel:
  - Shows for selected event: Total Tickets, Checked In, Remaining, Invalid Scans today
  - Auto-refreshes every 30 seconds (polling)
  - API: GET /api/organizer/events/[id]/checkin-stats
    Returns: { totalTickets, checkedIn, remaining, invalidScansToday }

--- H4: PDF Report Export ---

Install: npm install pdfkit (or reuse @react-pdf/renderer from Phase G)

Add "Export PDF Report" button on app/organizer/analytics/page.tsx:
  - GET /api/organizer/export/report-pdf?eventId=xxx
  - PDF contains: event summary, revenue table, ticket type breakdown, attendance stats
  - Returns PDF file download

Run npm run lint && npm run typecheck when done.
Update docs/tasks/current-task.md with Phase H completion and final handoff notes.
```

---

## Tips for Every Chat

1. **Always attach only the files referenced** in the prompt — don't add extras
2. **One phase per chat** — don't combine phases
3. **After each phase**, verify with:
   ```
   npm run lint
   npm run typecheck
   npm run test:integration (if tests exist for the area)
   ```
4. **Phase C (seating builder)** is the most complex — if it exceeds one chat, split into C1 (API + models) and C2 (UI canvas)
