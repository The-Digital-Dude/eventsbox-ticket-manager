# EventsBox — Full Gap Analysis & Implementation Plan

> **Source of truth:** `docs/architecture/structure_to_follow.md` (client-defined product spec)
> **Created:** 2026-05-04
> **Status:** READY FOR REVIEW

This document maps every section of the client's 18-section feature structure against what is currently implemented,
identifies gaps, and proposes a phased implementation roadmap.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| 🟡 | Partially implemented (some features missing) |
| ❌ | Not implemented |

---

## Section-by-Section Gap Analysis

---

### Section 1 — Organizer Dashboard

**Route:** `app/organizer/dashboard/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Event status cards (Draft / Pending / Published / Rejected) | ✅ | Dashboard shows event counts by status |
| Quick actions — Create new event | ✅ | Link to `/organizer/events/new` |
| Quick actions — Resume draft | 🟡 | Events list shows drafts but no explicit "Resume Draft" card with last-saved step |
| Quick actions — Duplicate event | ❌ | No duplicate event action exists anywhere |
| Event list (name, date, status, sales, actions) | ✅ | `app/organizer/events/page.tsx` has this |
| Draft recovery (last saved time, current step, continue button) | ❌ | No draft recovery widget on dashboard; multi-step wizard doesn't persist step state |

**Gap Summary:** Missing duplicate event action and draft recovery widget.

---

### Section 2 — Create Event · Mode Selection

**Route:** `app/organizer/events/new/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Choose event setup type (Simple vs Reserved Seating) | ❌ | Create event page is a single flat form — no mode selection step |
| Simple Event definition (online/GA/no seating map) | ❌ | No concept of event "mode" in schema or UI |
| Reserved Seating Event definition (row/column/tables/seat-based pricing) | ❌ | Schema has `Venue.seatingConfig` JSON but no reserved-seating creation wizard |

**Gap Summary:** The entire mode-selection step is missing. Currently all events are treated as simple/GA events.

---

### Section 3 — Event Details Section

**Route:** `app/organizer/events/new/page.tsx` + `app/organizer/events/[id]/edit/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Event basics (title, description, category, tags) | ✅ | All present |
| Tagline | ❌ | Schema has no `tagline` field on `Event` |
| Event type (physical / online) | ❌ | No `eventType` field; schema only has location fields optionally |
| Location (venue name, address, city, country, map link) | ✅ | Via venue or direct lat/lng + address fields |
| Online access link | ❌ | No `onlineAccessLink` or equivalent field in schema |
| Date and time (start, end, timezone) | ✅ | |
| Organizer contact (name, email, phone) | 🟡 | Email + phone exist; contact name not a distinct field (organizer profile name used) |
| Media (cover image, gallery, video link) | ✅ | `heroImage`, `images[]`, `videoUrl` all present |
| Visibility (public / private / unlisted) | ❌ | `EventStatus` enum has DRAFT/PENDING/PUBLISHED/REJECTED/CANCELLED — no visibility concept separate from status |
| Live preview card | ❌ | No real-time preview card in create/edit UI |

**Gap Summary:** Missing `tagline`, `eventType` (physical/online), `onlineAccessLink`, visibility levels (public/private/unlisted), and a live preview card.

---

### Section 4 — Simple Event Ticket Section

**Route:** `app/organizer/events/[id]/page.tsx` (event detail page with inline ticket management)

| Feature | Status | Notes |
|---------|--------|-------|
| Ticket creation (name, price, quantity, sale start/end) | ✅ | Full CRUD via inline form |
| Duplicate ticket | ❌ | No duplicate action on ticket type |
| Reorder tickets | 🟡 | `TicketType.sortOrder` field exists in schema; no drag-reorder UI |
| Hide ticket | 🟡 | `TicketType.isActive` exists; UI toggles it but labeled differently |
| Mark sold out manually | ❌ | No "mark sold out" action; only automatic via quantity depletion |
| Price validation | ✅ | |
| Quantity validation | ✅ | |
| Sale date validation | ✅ | |
| Auto inventory from quantity | ✅ | `quantity` field creates available inventory |

**Gap Summary:** Missing ticket duplicate, drag reorder UI, and manual sold-out marking.

---

### Section 5 — Reserved Seating Map + Pricing Section

**Route:** Does not exist

| Feature | Status | Notes |
|---------|--------|-------|
| Seating map builder (sections, rows, columns, auto-generate seats) | ❌ | `Venue.seatingConfig` JSON exists but no builder UI |
| Table builder (table zones, seats per table, number of tables) | ❌ | |
| General zone builder (standing/GA area with capacity) | ❌ | |
| Section/row/seat pricing inside map | ❌ | |
| Visual canvas (show sections, rows, tables, selected area) | ❌ | |
| Right-side config panel (zone name, type, capacity, price, color, notes) | ❌ | |
| Auto ticket generation from priced zones | ❌ | |
| Manual customization (rename tickets, adjust pricing, block/reserve seats) | ❌ | |

**Gap Summary:** The entire seating map builder is absent. This is the most complex missing feature.

---

### Section 6 — Auto Ticket Generation Preview

**Route:** Does not exist

| Feature | Status | Notes |
|---------|--------|-------|
| Generated ticket cards (name, source zone, price, capacity, type) | ❌ | No auto-generation preview |
| Sync status (synced with seating map, outdated warning) | ❌ | |
| Edit options (edit zone price, rename label, advanced settings) | ❌ | |
| Validation (every sellable zone generates a ticket, every ticket links to inventory) | ❌ | |

**Gap Summary:** Entire section missing — depends on Section 5 being built first.

---

### Section 7 — Inventory System

| Feature | Status | Notes |
|---------|--------|-------|
| Seat inventory (available, reserved, sold, blocked) | 🟡 | `EventSeatBooking` tracks RESERVED/BOOKED. No "blocked" state per seat |
| Table inventory | ❌ | No dedicated table inventory model; table is a conceptual overlay on seating |
| General inventory (total/available/reserved/sold counts) | ✅ | Via `TicketType` quantity/sold/reservedQty fields |
| Reservation timeout (hold seats, release after timeout) | 🟡 | `EventSeatBooking.expiresAt` exists; cron for release not confirmed active |
| Capacity rules (physical/sellable/blocked/reserved capacity) | 🟡 | Only `TicketType.quantity` as sellable capacity; no distinct physical/blocked capacity |

**Gap Summary:** Blocked seat state, table inventory model, and capacity rules layers are missing.

---

### Section 8 — Review & Submit Section

**Route:** `app/organizer/events/[id]/page.tsx` (partial — submit button exists on event detail page)

| Feature | Status | Notes |
|---------|--------|-------|
| Event summary (title, date, location, description) | 🟡 | Event detail page shows all info but no dedicated review step |
| Seating summary (sections, rows, seats, tables, GA zones) | ❌ | Not applicable until seating map is built |
| Ticket summary (generated tickets, prices, capacities) | 🟡 | Tickets listed on event page but not as a pre-submit review |
| Validation checklist (event details, pricing, inventory, visibility) | ❌ | No pre-submit checklist |
| Submit for approval (save draft → run validation → submit → status becomes pending) | ✅ | Submit button exists and sets status to PENDING_APPROVAL |

**Gap Summary:** No dedicated multi-step review wizard with validation checklist; seating summary not applicable yet.

---

### Section 9 — Admin Approval Section

**Route:** `app/admin/events/page.tsx` + `app/admin/events/[id]/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Pending event list (organizer, event name, date, submitted time) | ✅ | |
| Event review (details, media, seating map, pricing, tickets) | 🟡 | Details/media/tickets reviewable; seating map not applicable yet |
| Admin actions (approve, reject, request changes) | 🟡 | Approve + reject exist; "request changes" (separate from reject) missing |
| Notes (rejection reason, internal admin note) | 🟡 | `Event.rejectionReason` exists; no separate internal admin note field |

**Gap Summary:** Missing "request changes" action and internal admin note field.

---

### Section 10 — Public Event Page

**Route:** `app/events/[slug]/EventDetailClient.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Event header (cover image, title, date, venue) | ✅ | |
| Event information (description, organizer, policies, location map) | ✅ | |
| Ticket purchase panel — GA quantity selector | ✅ | |
| Ticket purchase panel — section selector | ❌ | No section-based ticket selection |
| Ticket purchase panel — seat map picker | ❌ | No interactive seat map on public page |
| Ticket purchase panel — table picker | ❌ | No table selection |
| Price summary (subtotal, fees, total) | ✅ | |
| CTA (buy ticket, reserve selected seats) | 🟡 | "Buy ticket" exists; "reserve selected seats" CTA for reserved seating missing |

**Gap Summary:** Reserved seating selection UI missing on public event page.

---

### Section 11 — Seat / Table Selection Checkout

**Route:** Does not exist as a separate flow

| Feature | Status | Notes |
|---------|--------|-------|
| Interactive seat map (available/reserved/sold/blocked states) | ❌ | No public-facing seat map viewer |
| Seat selection (single or multiple, show price) | ❌ | |
| Table selection (full table or individual seats) | ❌ | |
| Reservation timer (hold 10 minutes, release on timeout) | ❌ | Backend `expiresAt` exists but no frontend timer UI |
| Cart summary (selected seats, price, fees, total) | ❌ | |

**Gap Summary:** Entire section missing — depends on seating map builder (Section 5).

---

### Section 12 — Payment & Ticket Issuing

**Route:** `app/checkout/[orderId]/page.tsx` + `app/api/checkout/route.ts` + `app/api/webhooks/stripe/`

| Feature | Status | Notes |
|---------|--------|-------|
| Stripe checkout (payment success/failure/webhook) | ✅ | Full Stripe integration with idempotency |
| Ticket issuing (create QRTicket, link to seat/table, generate QR) | ✅ | `QRTicket` created on payment; QR generated |
| Link ticket to seat | 🟡 | `QRTicket.seatId` + `QRTicket.seatLabel` exist; populated for seat bookings |
| Confirmation (success page, email ticket, PDF ticket) | 🟡 | Success page + email exist; no PDF ticket |
| Order lifecycle (pending/paid/failed/refunded/cancelled) | ✅ | Full `OrderStatus` enum implemented |

**Gap Summary:** No PDF ticket generation.

---

### Section 13 — Attendee Account

**Route:** `app/account/tickets/page.tsx`, `app/account/orders/`, `app/account/profile/`

| Feature | Status | Notes |
|---------|--------|-------|
| My tickets (upcoming / past) | ✅ | Ticket wallet page groups by upcoming/past |
| Ticket details (QR code, seat/table info, event info) | ✅ | QR shown; seat label displayed when present |
| Download PDF | ❌ | No PDF download per ticket |
| Resend email | ❌ | No "resend confirmation email" action |
| Transfer ticket | ✅ | `app/transfer/` flow + `TicketTransfer` model |
| Refund request | ✅ | Cancellation request flow exists |

**Gap Summary:** Missing PDF download and resend email.

---

### Section 14 — Scanner / Check-in

**Route:** `app/organizer/scanner/page.tsx` + `app/api/scanner/`

| Feature | Status | Notes |
|---------|--------|-------|
| QR scanner (camera scan) | ✅ | Camera-based QR scan |
| Manual code input | ✅ | Manual entry fallback |
| Validation states (valid / already used / invalid / refunded / cancelled) | ✅ | All states handled |
| Check-in action (mark as used, record timestamp, record staff) | ✅ | `QRTicket.isCheckedIn`, `checkedInAt`, `checkedInDevice` |
| Event-day dashboard (total checked in, remaining, invalid scans) | 🟡 | Basic stats on scanner page; no dedicated event-day dashboard |

**Gap Summary:** No dedicated event-day real-time dashboard with live stats.

---

### Section 15 — POS System

**Route:** Does not exist

| Feature | Status | Notes |
|---------|--------|-------|
| Sell ticket onsite (select event, ticket/seat/table, payment) | ❌ | No POS system |
| Issue ticket instantly (QR, receipt, email/SMS) | ❌ | Comp tickets exist but not a full POS flow |
| Sync inventory (seat/table sold, dashboard updates) | ❌ | |

**Gap Summary:** Entire POS section missing. Partially addressable via comp ticket issuance but not the same.

---

### Section 16 — Organizer Reporting

**Route:** `app/organizer/analytics/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Sales dashboard (total revenue, tickets sold, remaining inventory) | ✅ | Analytics page has revenue + ticket counts |
| Ticket performance (by section, by price tier, by ticket type) | 🟡 | By ticket type exists; by section/price tier missing (requires seating) |
| Attendance report (checked in, no-show, scan history) | 🟡 | Check-in data available but no dedicated attendance report view |
| Exports (CSV) | ✅ | CSV order export via `/api/organizer/export/orders` |
| Exports (PDF report) | ❌ | No PDF report generation |

**Gap Summary:** Missing section/tier breakdown (depends on seating), dedicated attendance report UI, and PDF reports.

---

### Section 17 — Payout & Wallet

**Route:** `app/organizer/payout/page.tsx` + `app/admin/payouts/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Organizer wallet (gross sales, fees, commission, net payout) | ✅ | Payout page shows financials |
| Payout status (pending / processing / paid) | ✅ | `PayoutRequestStatus` enum |
| Transaction ledger (orders, refunds, platform fees, payouts) | 🟡 | Order history available; no unified transaction ledger view |

**Gap Summary:** Missing unified transaction ledger with per-line breakdown of orders, refunds, fees, and payouts.

---

### Section 18 — Discovery / Marketplace

**Route:** `app/page.tsx` + `app/events/page.tsx`

| Feature | Status | Notes |
|---------|--------|-------|
| Homepage events (featured events, upcoming events, categories) | ✅ | Homepage has featured + upcoming + categories |
| Search (event name, city, category, date) | ✅ | `/events` filter page with keyword + filters |
| Filters (price, location, event type, availability) | 🟡 | Location/category filters exist; price range and availability filters missing |
| SEO (event slug, meta title, structured data) | 🟡 | Slug + meta title/OG exist; no JSON-LD structured data |

**Gap Summary:** Missing price range filter, availability filter, and JSON-LD structured data.

---

## Consolidated Gap List

### Schema Changes Required

| # | Change | Scope |
|---|--------|-------|
| S1 | Add `Event.tagline String?` | Section 3 |
| S2 | Add `Event.eventType Enum (PHYSICAL/ONLINE)` | Section 3 |
| S3 | Add `Event.onlineAccessLink String?` | Section 3 |
| S4 | Add `Event.visibility Enum (PUBLIC/PRIVATE/UNLISTED)` | Section 3 |
| S5 | Add `Event.mode Enum (SIMPLE/RESERVED_SEATING)` | Section 2 |
| S6 | Add `Event.adminNote String?` (internal admin note) | Section 9 |
| S7 | Add `SeatingSection`, `SeatingRow`, `SeatingZone` models for reserved seating | Section 5 |
| S8 | Add `SeatInventory` model with blocked/reserved/sold states | Section 7 |
| S9 | Add `TableZone` + `TableInventory` models | Section 5/7 |

### UI/Feature Gaps by Priority

#### Priority 1 — Critical Missing Core Flows

| ID | Feature | Section | Effort |
|----|---------|---------|--------|
| G1 | Event mode selection step (Simple vs Reserved) | §2 | Medium |
| G2 | Reserved seating map builder (canvas + config panel) | §5 | Very High |
| G3 | Auto ticket generation from seating zones | §6 | High |
| G4 | Public seat map picker on event page | §10/§11 | High |
| G5 | Seat/table reservation timer with frontend countdown | §11 | High |
| G6 | Seat/table checkout cart summary | §11 | Medium |

#### Priority 2 — Important Missing Features

| ID | Feature | Section | Effort |
|----|---------|---------|--------|
| G7 | `Event.tagline`, `eventType`, `onlineAccessLink`, `visibility` fields | §3 | Low |
| G8 | Live preview card in event create/edit | §3 | Medium |
| G9 | Duplicate event action | §1 | Low |
| G10 | Draft recovery widget on dashboard | §1 | Low |
| G11 | Duplicate ticket action | §4 | Low |
| G12 | Drag-reorder tickets UI | §4 | Low |
| G13 | Manual sold-out marking on ticket | §4 | Low |
| G14 | "Request changes" admin action (distinct from reject) | §9 | Low |
| G15 | Internal admin note field on event | §9 | Low |
| G16 | PDF ticket generation | §12/§13 | Medium |
| G17 | Resend confirmation email action | §13 | Low |

#### Priority 3 — Enhancements

| ID | Feature | Section | Effort |
|----|---------|---------|--------|
| G18 | POS system (onsite ticket sale) | §15 | Very High |
| G19 | Event-day real-time dashboard | §14 | Medium |
| G20 | Unified transaction ledger | §17 | Medium |
| G21 | Attendance report dedicated view | §16 | Low |
| G22 | PDF report exports | §16 | Medium |
| G23 | Price range + availability filters on discovery | §18 | Low |
| G24 | JSON-LD structured data on event pages | §18 | Low |
| G25 | Contact name as distinct event field | §3 | Low |

---

## Phased Roadmap

### Phase A — Schema Additions (Foundation)
**Scope:** Add all missing schema fields to `prisma/schema.prisma` and run migration.
- Add `Event.tagline`, `Event.eventType`, `Event.onlineAccessLink`, `Event.visibility`, `Event.mode`, `Event.adminNote`
- Add `SeatingSection`, `SeatingRow`, `SeatingZone`, `SeatInventory`, `TableZone`, `TableInventory` models
- Migration: `prisma migrate dev --name phase-a-seating-and-event-fields`

**Files:**
- `prisma/schema.prisma`

---

### Phase B — Simple Event Creation Wizard
**Scope:** Replace flat new-event form with a proper multi-step wizard that first asks Simple vs Reserved.
- Step 1: Mode selection (Simple / Reserved Seating)
- Step 2: Event details (title, tagline, description, type, category, tags, visibility)
- Step 3: Location & date (with live preview card)
- Step 4: Media (cover image, gallery, video)
- Step 5: For Simple → Ticket creation; For Reserved → redirect to seating builder

**Files:**
- `app/organizer/events/new/page.tsx` — refactor into multi-step wizard
- `app/organizer/events/new/steps/` — step components
- `src/lib/validators/event-create.ts` — per-step Zod schemas
- `app/api/organizer/events/route.ts` — support new fields

---

### Phase C — Reserved Seating Map Builder
**Scope:** Build the visual seating map builder for reserved-seating events.
- Canvas component (react-konva or SVG-based) for drawing sections/rows/tables
- Section/row/zone add actions
- Right-side config panel (zone name, type, capacity, price, color)
- Auto-generate seats from row × column inputs
- Seat state visualization (available/blocked/reserved)

**Files:**
- `app/organizer/events/[id]/seating/page.tsx` — new seating builder page
- `src/components/shared/seating-canvas.tsx` — canvas component
- `src/components/shared/seating-config-panel.tsx` — right panel
- `app/api/organizer/events/[id]/seating/route.ts` — save/load seating config
- New Prisma models: `SeatingSection`, `SeatingRow`, `SeatingZone`

---

### Phase D — Auto Ticket Generation Preview
**Scope:** After seating map is configured, show auto-generated ticket cards per zone with sync status.
- Parse seating config and generate ticket types per priced zone
- Show sync status badge (synced / outdated)
- Allow renaming and price adjustment before saving

**Files:**
- `app/organizer/events/[id]/tickets/page.tsx` — extend with auto-gen preview
- `app/api/organizer/events/[id]/tickets/sync/route.ts` — sync tickets to seating map

---

### Phase E — Reserved Seating Inventory + Public Seat Picker
**Scope:** Enable buyers to pick seats from an interactive map on the public event page.
- Public read-only seat map with available/reserved/sold/blocked states
- Seat selection → reservation hold (10-minute timer)
- Frontend countdown timer
- Cart summary with seat info + price breakdown

**Files:**
- `app/events/[slug]/EventDetailClient.tsx` — add seat map picker for reserved events
- `src/components/shared/public-seat-map.tsx` — read-only interactive seat map
- `app/api/events/[slug]/seats/route.ts` — GET seat availability
- `app/api/events/[slug]/reserve/route.ts` — POST seat reservation (10-min hold)
- Extend checkout flow to carry seat selection

---

### Phase F — Quick Wins (Tickets + Dashboard Polish)
**Scope:** Address all low-effort gaps.
- G9: Duplicate event action (POST `/api/organizer/events/[id]/duplicate`)
- G10: Draft recovery widget on dashboard
- G11: Duplicate ticket action
- G12: Drag-reorder tickets (react-dnd or dnd-kit)
- G13: Manual sold-out marking
- G14: "Request changes" admin action
- G15: Admin internal note field on event
- G17: Resend confirmation email button on attendee ticket wallet
- G21: Attendance report view (checked-in vs no-show)
- G23: Price range + availability filters on `/events`
- G24: JSON-LD structured data on `/events/[slug]`

---

### Phase G — PDF & POS
**Scope:** Add PDF ticket generation and a basic POS system.
- G16: PDF ticket per QRTicket (using `@react-pdf/renderer` or `pdfkit`)
- G18: POS system — select event → select ticket/seat → manual payment → issue ticket instantly

---

### Phase H — Reporting & Ledger
**Scope:** Complete organizer reporting and financial ledger.
- G19: Event-day real-time dashboard (scanner page extension)
- G20: Unified transaction ledger on payout page
- G22: PDF report exports for organizer

---

## Current State Summary Table

| Client Section | Implementation | Priority |
|---------------|---------------|----------|
| §1 Organizer Dashboard | 🟡 Partial | Phase F |
| §2 Mode Selection | ❌ Missing | Phase B |
| §3 Event Details | 🟡 Partial | Phase B + F |
| §4 Simple Tickets | 🟡 Partial | Phase F |
| §5 Reserved Seating Builder | ❌ Missing | Phase C |
| §6 Auto Ticket Generation | ❌ Missing | Phase D |
| §7 Inventory System | 🟡 Partial | Phase C + E |
| §8 Review & Submit | 🟡 Partial | Phase B |
| §9 Admin Approval | 🟡 Partial | Phase F |
| §10 Public Event Page | 🟡 Partial | Phase E |
| §11 Seat/Table Checkout | ❌ Missing | Phase E |
| §12 Payment & Ticketing | 🟡 Partial | Phase G |
| §13 Attendee Account | 🟡 Partial | Phase F + G |
| §14 Scanner / Check-in | 🟡 Partial | Phase H |
| §15 POS System | ❌ Missing | Phase G |
| §16 Organizer Reporting | 🟡 Partial | Phase H |
| §17 Payout & Wallet | 🟡 Partial | Phase H |
| §18 Discovery / Marketplace | 🟡 Partial | Phase F |

---

## Recommended Execution Order

```
Phase A  →  Schema additions (foundation for everything)
Phase B  →  Simple event creation wizard (unblocks organizer flow)
Phase F  →  Quick wins (immediate product quality improvement)
Phase C  →  Reserved seating map builder (largest engineering effort)
Phase D  →  Auto ticket generation (depends on C)
Phase E  →  Public seat picker + reservation timer (depends on C + D)
Phase G  →  PDF tickets + POS (independent but lower priority)
Phase H  →  Reporting + ledger (analytics layer on top of existing data)
```

---

## Notes & Risks

1. **Reserved seating is the largest missing piece.** Phases C–E together represent ~60% of the remaining product work. A canvas-based seating builder requires careful library selection (react-konva or fabricjs recommended).
2. **Schema migration risk.** Adding `Event.mode` and `Event.visibility` as required enums will need defaults set to avoid breaking existing events.
3. **Backward compatibility.** All existing simple/GA events should default to `mode = SIMPLE` and `visibility = PUBLIC`.
4. **Reservation timeout cron.** `EventSeatBooking.expiresAt` exists but a cleanup cron job needs to be verified/added.
5. **POS system (Phase G)** is a large independent feature that may warrant its own separate app or role-gated page.
