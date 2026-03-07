# Feature Plan: Manual Payout Flow

## Feature Name
Organizer manual payout request + admin approval cycle

## Objective
Organizers on manual payout mode can formally request a payout. Admins review the request, add a note, and mark it as approved or paid. Both sides see a full status history.

## Scope
- In scope:
  - New `PayoutRequest` Prisma model + migration
  - Organizer: request payout form + request history on payout page
  - API: create request, list own requests
  - Admin payout panel covered in `admin-payout-panel.md`
- Out of scope:
  - Stripe Connect payouts (already handled by Stripe automatically)
  - Actual bank transfer — admin marks as paid manually
  - Email notifications on status change (future)

## Affected Files
- `prisma/schema.prisma` — add `PayoutRequest` model and `PayoutRequestStatus` enum
- `prisma/migrations/` — new migration
- `app/api/organizer/payout/requests/route.ts` — new: GET + POST
- `app/organizer/payout/page.tsx` — add request section + history table
- `src/lib/validators/organizer.ts` — add `payoutRequestSchema`

## Schema Changes

### Add to `prisma/schema.prisma`

```prisma
enum PayoutRequestStatus {
  PENDING
  APPROVED
  PAID
  REJECTED
}

model PayoutRequest {
  id                 String              @id @default(cuid())
  organizerProfileId String
  amount             Decimal?
  note               String?
  status             PayoutRequestStatus @default(PENDING)
  adminNote          String?
  requestedAt        DateTime            @default(now())
  resolvedAt         DateTime?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  organizerProfile   OrganizerProfile    @relation(fields: [organizerProfileId], references: [id], onDelete: Cascade)
}
```

### Add to `OrganizerProfile` model
```prisma
payoutRequests PayoutRequest[]
```

### Migration
```sh
npx prisma migrate dev --name add_payout_request
```

## Backend Changes

### `POST /api/organizer/payout/requests`
- Auth: `requireRole(req, Role.ORGANIZER)`
- Validate with `payoutRequestSchema`: `{ amount: z.number().positive().optional(), note: z.string().max(500).optional() }`
- Fetch organizer profile, check `payoutSettings.payoutMode === "MANUAL"` — if not manual, return `fail(400, { code: "NOT_MANUAL_MODE", message: "Payout requests are only available for manual payout mode" })`
- Check no existing `PENDING` request exists for this organizer — if one exists return `fail(409, { code: "PENDING_REQUEST_EXISTS", message: "You already have a pending payout request" })`
- Create `PayoutRequest` record
- Return `ok(newRequest)`

### `GET /api/organizer/payout/requests`
- Auth: `requireRole(req, Role.ORGANIZER)`
- Fetch all `PayoutRequest` records for organizer, ordered by `requestedAt desc`
- Return `ok(requests)`

## Frontend Changes — `app/organizer/payout/page.tsx`

### Add to Manual tab only (when `payoutMode === "MANUAL"`)

**Request Payout section** (shown above manual note):
- Heading: "Request a Payout"
- Optional amount input: `type="number" placeholder="Amount (optional)"`
- Optional note textarea: `placeholder="Add a note for the admin (optional)"` max 500 chars
- Submit button: "Request Payout" — disabled while loading or if pending request already exists
- If a PENDING request exists: show info box "You have a pending payout request. Wait for admin review before submitting another."

**Request History section** (below the form):
- Heading: "Payout Request History"
- Table columns: Date | Amount | Note | Status | Admin Note
- Status badge colours:
  - PENDING: `bg-amber-100 text-amber-700`
  - APPROVED: `bg-blue-100 text-blue-700`
  - PAID: `bg-emerald-100 text-emerald-700`
  - REJECTED: `bg-red-100 text-red-700`
- Amount: show `$${amount.toFixed(2)}` or `"—"` if null
- Admin note: show if present, else `"—"`
- Empty state: "No payout requests yet."

### State additions
- `requests: PayoutRequest[]` — loaded on mount alongside settings
- `requestAmount: string` — controlled input
- `requestNote: string` — controlled input
- `isSubmittingRequest: boolean`

### Load function
- Update existing `loadSettings()` to also fetch `/api/organizer/payout/requests` in parallel
- Set both `settings` and `requests` state

## Design Spec
- Request form card: `rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white p-6 shadow-sm`
- History table: same table component pattern as organizer list
- Pending info box: `bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800`
- Amount input: `Input` component, `type="number"`, `min="0"`, `step="0.01"`
- Note textarea: `Textarea` component (if it exists) or `<textarea className="app-input h-24 resize-none">`
- Section heading: `text-lg font-semibold text-neutral-900 mb-4`

## Acceptance Criteria
1. Schema migration runs cleanly
2. Organizer on MANUAL mode can submit a payout request with optional amount and note
3. Organizer cannot submit a second request while one is PENDING
4. Organizer sees full request history with status badges
5. Organizer on STRIPE_CONNECT mode does not see the request form
6. API validates input and returns appropriate errors
7. Lint, typecheck pass

## TBD
- Whether to show the request form when organizer's Stripe Connect is COMPLETED but mode is set to MANUAL (edge case) — default: show form if `payoutMode === "MANUAL"` regardless of Stripe status
- Whether amount is required or truly optional — default: optional, admin can confirm actual amount when approving
