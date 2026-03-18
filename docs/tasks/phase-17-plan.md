# Phase 17 Plan — Event Add-ons / Extra Services

**Status:** READY
**Depends on:** Phase 16 complete
**Goal:** Organizers define optional extras per event (parking, meal, t-shirt, etc.). Attendees select add-ons at checkout. Add-ons appear in order confirmations, PDF tickets, and organizer order views.

---

## Schema Changes

### New model: `EventAddOn`
```prisma
model EventAddOn {
  id          String       @id @default(cuid())
  eventId     String
  name        String
  description String?
  price       Decimal      @db.Decimal(10, 2)
  maxPerOrder Int          @default(10)
  totalStock  Int?
  isActive    Boolean      @default(true)
  sortOrder   Int          @default(0)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  event       Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  orderAddOns OrderAddOn[]
}
```

### New model: `OrderAddOn`
```prisma
model OrderAddOn {
  id         String     @id @default(cuid())
  orderId    String
  addOnId    String
  name       String
  quantity   Int
  unitPrice  Decimal    @db.Decimal(10, 2)
  subtotal   Decimal    @db.Decimal(10, 2)
  createdAt  DateTime   @default(now())
  order      Order      @relation(fields: [orderId], references: [id], onDelete: Cascade)
  addOn      EventAddOn @relation(fields: [addOnId], references: [id])
}
```

### Extend `Event`:
```prisma
addOns  EventAddOn[]
```

### Extend `Order`:
```prisma
orderAddOns  OrderAddOn[]
```

**Migration name:** `add-event-addons`

---

## Task 1 — Organizer Add-on Management API

### `app/api/organizer/events/[id]/addons/route.ts` (new)
- **GET** — returns all add-ons for the event; requires organizer ownership check
- **POST** — body: `{ name, description?, price, maxPerOrder?, totalStock?, isActive?, sortOrder? }`; Zod validate; create add-on; return `ok(addOn)`

### `app/api/organizer/events/[id]/addons/[addOnId]/route.ts` (new)
- **PATCH** — update any field; ownership check via event → organizerProfileId
- **DELETE** — hard delete only if no orders reference it; otherwise set `isActive = false`

---

## Task 2 — Public Event Route

### `app/api/public/events/[slug]/route.ts` (modify)
- Include active add-ons in the event response:
  ```ts
  addOns: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id, name, description, price, maxPerOrder, totalStock }
  }
  ```
- Compute `remainingStock` per add-on: `totalStock - count(OrderAddOn where addOnId)`

---

## Task 3 — Checkout Integration

### `app/api/checkout/route.ts` (modify)
- Accept `addOns?: { addOnId: string; quantity: number }[]` in request body Zod schema
- For each add-on entry:
  1. Fetch `EventAddOn` — verify it belongs to the same event, is active, and quantity ≤ `maxPerOrder`
  2. Check stock if `totalStock` is set: `totalStock - existing OrderAddOn count >= quantity`
  3. Add price * quantity to the order total
- Create `OrderAddOn` records inside the same DB transaction as the order
- Snapshot `name` and `unitPrice` from the add-on at time of purchase (denormalized, same pattern as `OrderItem`)

### `app/api/orders/[id]/route.ts` (modify)
- Include `orderAddOns` in the order detail response

---

## Task 4 — Checkout UI

### `app/checkout/[orderId]/page.tsx` (modify)
- After ticket type selection, show an "Extras" section if the event has active add-ons
- Each add-on shows: name, description, price, quantity stepper (0 to maxPerOrder)
- Add-on totals are reflected in the order summary before Stripe redirect
- Pass selected add-ons in the POST body to `/api/checkout`

---

## Task 5 — Order Confirmation & PDF

### `src/lib/services/notifications.ts` (modify)
- In `sendOrderConfirmationEmail`, include add-ons in the email body if `order.orderAddOns` has items:
  ```
  Extras:
  - Parking Pass x1 — $15.00
  - Meal Package x2 — $40.00
  ```

### `app/api/account/tickets/[ticketId]/pdf/route.ts` (modify)
- Fetch `orderAddOns` via the ticket's order; list them in the PDF below the ticket details

---

## Task 6 — Organizer Event Edit UI

### `app/organizer/events/[id]/edit/page.tsx` (modify)
- Add "Add-ons" section below ticket types
- Table of existing add-ons with edit/delete inline
- "Add Extra" form: name, description, price, max per order, stock (optional)
- CRUD calls to `/api/organizer/events/[id]/addons`

---

## Task 7 — Integration Tests

### `src/tests/integration/event-addons.test.ts`
- POST `/api/organizer/events/[id]/addons` → created, returned in public event route
- POST `/api/checkout` with valid add-ons → `OrderAddOn` rows created, total includes add-on price
- POST `/api/checkout` with quantity exceeding `maxPerOrder` → 400 error
- POST `/api/checkout` with out-of-stock add-on → 400 error
- DELETE add-on that has orders → sets `isActive = false`, does not hard delete

---

## Execution Order
```
Schema migration
Task 1 (organizer add-on API)
Task 2 (public event route)
Task 3 (checkout API)
Task 4 (checkout UI)
Task 5 (order confirmation + PDF)
Task 6 (organizer edit UI)
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
| Schema | TODO |
| Add-on API | TODO |
| Public event route | TODO |
| Checkout API | TODO |
| Checkout UI | TODO |
| Order confirmation + PDF | TODO |
| Organizer edit UI | TODO |
| Tests | TODO |
