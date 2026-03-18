# Phase 16 Plan — Affiliate Tickets & Referral Codes

**Status:** READY
**Depends on:** Phase 15 complete ✅
**Goal:** Organizers generate affiliate/referral links with codes. Attendees use a code at checkout. Sales are tracked per affiliate link with click counts and order attribution.

---

## Schema Changes

### New model: `AffiliateLink`
```prisma
model AffiliateLink {
  id                 String           @id @default(cuid())
  organizerProfileId String
  eventId            String?
  code               String           @unique
  label              String?
  commissionPct      Decimal          @default(10) @db.Decimal(5, 2)
  isActive           Boolean          @default(true)
  clickCount         Int              @default(0)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
  organizerProfile   OrganizerProfile @relation(fields: [organizerProfileId], references: [id], onDelete: Cascade)
  event              Event?           @relation(fields: [eventId], references: [id], onDelete: SetNull)
  orders             Order[]
}
```

### Extend `Order`:
```prisma
affiliateLinkId  String?
affiliateLink    AffiliateLink? @relation(fields: [affiliateLinkId], references: [id])
```

### Extend `OrganizerProfile`:
```prisma
affiliateLinks  AffiliateLink[]
```

### Extend `Event`:
```prisma
affiliateLinks  AffiliateLink[]
```

**Migration name:** `add-affiliate-links`

---

## Task 1 — Affiliate Link API (Organizer)

### `app/api/organizer/affiliate/route.ts` (new)
- **GET** — returns all affiliate links for the current organizer (include `_count.orders`, `clickCount`, `event.title`)
- **POST** — body: `{ label?, eventId?, commissionPct?, code? }` (auto-generate code via `nanoid(8).toUpperCase()` if not provided); Zod validate; create `AffiliateLink`; return `ok(link)`

### `app/api/organizer/affiliate/[id]/route.ts` (new)
- **PATCH** — update `label`, `commissionPct`, `isActive`; organizer ownership check
- **DELETE** — soft-delete: set `isActive = false` (do not hard delete — orders reference it); ownership check

---

## Task 2 — Click Tracking (Public)

### `app/api/public/affiliate/[code]/route.ts` (new)
- **GET** — increment `AffiliateLink.clickCount` where `code = param` and `isActive = true`; return `ok({ eventId, eventSlug })` so client can redirect to the event page
- No auth required

---

## Task 3 — Checkout Integration

### `app/api/checkout/route.ts` (modify)
- Accept optional `affiliateCode?: string` in request body Zod schema
- If provided: look up `AffiliateLink` by `code` where `isActive = true`; attach `affiliateLinkId` to the created `Order`
- If code not found or inactive: proceed with checkout normally (do not fail the order)

### `app/api/public/events/[slug]/route.ts` (modify)
- No change needed — affiliate codes are applied at checkout

---

## Task 4 — Organizer Affiliate Management UI

### `app/organizer/affiliate/page.tsx` (new)
- SSR skeleton + client table (same pattern as promo-codes page)
- Table columns: Code, Label, Event (or "All events"), Commission %, Clicks, Orders, Active toggle
- "New Affiliate Link" button → inline form: Label, Event (dropdown of organizer's events or "All"), Commission %
- Copy-to-clipboard button per row that builds the public URL: `${APP_URL}/events/[slug]?ref=[code]` or `${APP_URL}?ref=[code]`
- Delete (deactivate) button per row
- Add "Affiliate Links" to organizer sidebar nav

### `app/organizer/[layout or nav]` (modify)
- Add nav item: `{ href: "/organizer/affiliate", label: "Affiliate Links" }`

---

## Task 5 — Admin Affiliate Oversight

### `app/api/admin/analytics/route.ts` (modify)
- Add `topAffiliates` to response: top 10 affiliate links by order count across the platform

---

## Task 6 — Integration Tests

### `src/tests/integration/affiliate.test.ts`
- POST `/api/organizer/affiliate` → creates link with auto-generated code
- GET `/api/public/affiliate/[code]` → increments clickCount
- POST `/api/checkout` with valid `affiliateCode` → order has `affiliateLinkId` set
- POST `/api/checkout` with invalid `affiliateCode` → order created successfully, `affiliateLinkId` is null
- DELETE `/api/organizer/affiliate/[id]` → sets `isActive = false`, does not delete

---

## Execution Order
```
Task 1 (schema)
Task 2 (affiliate API)
Task 3 (click tracking)
Task 4 (checkout integration)
Task 5 (organizer UI)
Task 6 (admin)
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
| Affiliate API | TODO |
| Click tracking | TODO |
| Checkout integration | TODO |
| Organizer UI | TODO |
| Admin | TODO |
| Tests | TODO |
