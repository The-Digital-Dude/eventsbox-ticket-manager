# Phase 18 Plan — Scanner / Door Sales Role

**Status:** READY
**Depends on:** Phase 17 complete
**Goal:** Organizers create scanner accounts for their events. A scanner can (a) check in attendees by QR scan and (b) sell walk-in tickets at the door with a simple UI. No payment processing for walk-ins — recorded as CASH/DOOR payment type.

---

## Schema Changes

### Extend `Role` enum:
```prisma
enum Role {
  SUPER_ADMIN
  ORGANIZER
  ATTENDEE
  SCANNER        // new
}
```

### Extend `User`:
```prisma
scannerOrganizerProfileId  String?
scannerOrganizerProfile    OrganizerProfile? @relation("ScannerAccounts", fields: [scannerOrganizerProfileId], references: [id])
```

### Extend `OrganizerProfile`:
```prisma
scannerAccounts  User[] @relation("ScannerAccounts")
```

### Extend `Order` — add door-sale payment type:
```prisma
paymentType  PaymentType  @default(STRIPE)

enum PaymentType {
  STRIPE
  DOOR_CASH
  COMPLIMENTARY
}
```

Note: existing comp tickets use `Order` with `status = PAID` and `total = 0`. Add `paymentType` with default `STRIPE` — backward-safe.

**Migration name:** `add-scanner-role-and-door-sales`

---

## Task 1 — Auth Guard Update

### `src/lib/auth/guards.ts` (modify)
- `requireRole(req, Role.SCANNER)` must work
- Add a new helper: `requireScannerOrOrganizer(req)` — accepts either SCANNER or ORGANIZER roles; returns session payload

### `middleware.ts` / `proxy.ts` (modify)
- `/scanner/*` routes require SCANNER or ORGANIZER role
- SCANNER role must NOT be able to access `/organizer/*`, `/account/*`, `/admin/*`

---

## Task 2 — Organizer Scanner Account Management API

### `app/api/organizer/scanners/route.ts` (new)
- **GET** — list scanner accounts linked to this organizer (`User` where `role = SCANNER` and `scannerOrganizerProfileId = organizerProfile.id`)
- **POST** — body: `{ email, password, name? }`; Zod validate; create `User` with `role = SCANNER`, `scannerOrganizerProfileId`, hashed password; return `ok({ id, email })`
  - Email must be unique across all users
  - Do NOT send welcome email for scanner accounts

### `app/api/organizer/scanners/[id]/route.ts` (new)
- **DELETE** — deactivate: set `isActive = false`; ownership check (scanner must belong to this organizer)
- **PATCH** — update `isActive` (reactivate/deactivate)

---

## Task 3 — Organizer Scanner Management UI

### `app/organizer/scanners/page.tsx` (new)
- Table: Email, Created At, Active status, Deactivate/Activate toggle
- "Add Scanner Account" form: email, password, confirm password
- Add "Scanners" to organizer sidebar nav

---

## Task 4 — Scanner Check-in API

### `app/api/scanner/checkin/route.ts` (new)
- **POST** — body: `{ ticketId }` (QR value)
- Requires SCANNER or ORGANIZER role
- SCANNER: can only check in tickets for events belonging to their `scannerOrganizerProfileId`
- ORGANIZER: can only check in tickets for their own events
- Reuses same logic as existing `/api/organizer/checkin/route.ts` — extract shared helper

### Refactor `app/api/organizer/checkin/route.ts`
- Extract core check-in logic to `src/lib/services/checkin.ts`
- Both the organizer and scanner routes call the shared service

---

## Task 5 — Walk-in Door Sale API

### `app/api/scanner/walk-in/route.ts` (new)
- **POST** — body: `{ eventId, items: { ticketTypeId: string; quantity: number }[], buyerName: string, buyerEmail?: string }`
- Requires SCANNER or ORGANIZER role; ownership check
- Validates ticket availability (same as checkout: decrement `TicketType.quantity`)
- Creates `Order` with `status = PAID`, `paymentType = DOOR_CASH`, `total = sum of ticket prices`
- Creates `OrderItem` rows
- Creates `QRTicket` per item (same as Stripe webhook handler)
- Does NOT create Stripe payment intent
- If `buyerEmail` provided: send order confirmation email
- Returns `ok({ orderId, tickets: [{ id, ticketNumber }] })`

---

## Task 6 — Scanner Dashboard UI

### `app/scanner/page.tsx` (new)
- Client component, requires SCANNER or ORGANIZER session
- Two tabs: **Check In** | **Walk-in Sale**

**Check In tab:**
- Text input or camera QR scan input for ticket ID
- On submit: POST to `/api/scanner/checkin`
- Show result: green "✓ Checked In — [Name] — [Ticket Type]" or red "✗ Already checked in / Invalid"

**Walk-in Sale tab:**
- Event selector (fetches events for this organizer from `/api/organizer/events`)
- After event selected: show ticket types with quantity steppers
- Buyer name (required) and email (optional) fields
- "Record Sale" button → POST to `/api/scanner/walk-in`
- On success: show order summary and "Print / Download QR" link

### `app/scanner/layout.tsx` (new)
- Minimal layout — no organizer sidebar, just a top bar with "Scanner" label and logout button

---

## Task 7 — Auth Flow for Scanner Role

### `app/auth/login/page.tsx` (modify)
- After successful login, if role is `SCANNER`, redirect to `/scanner`

### `proxy.ts` / `middleware.ts` (modify)
- Add `/scanner` path to allowed routes for SCANNER role
- Block SCANNER from all other authenticated paths

---

## Task 8 — Integration Tests

### `src/tests/integration/scanner-role.test.ts`
- POST `/api/organizer/scanners` → creates scanner user with SCANNER role
- POST `/api/scanner/checkin` with valid ticketId → marks checked in; SCANNER from different org → 403
- POST `/api/scanner/walk-in` → creates PAID order with `paymentType = DOOR_CASH`, QRTickets created
- POST `/api/scanner/walk-in` with over-capacity tickets → 400

---

## Execution Order
```
Schema migration
Task 1 (auth guard update)
Task 2 (scanner account API)
Task 3 (walk-in API)
Task 4 (check-in API + refactor)
Task 5 (organizer scanner UI)
Task 6 (scanner dashboard UI)
Task 7 (auth login redirect)
Task 8 (tests)
```

## Acceptance Gate
- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing
- `npm run build` — clean

## Status
| Task | Status |
|------|--------|
| Schema | TODO |
| Auth guards | TODO |
| Scanner account API | TODO |
| Walk-in API | TODO |
| Check-in API refactor | TODO |
| Organizer scanner UI | TODO |
| Scanner dashboard UI | TODO |
| Auth redirect | TODO |
| Tests | TODO |
