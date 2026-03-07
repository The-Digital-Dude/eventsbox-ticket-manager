# Feature Plan: Admin Payout Panel

## Feature Name
Admin payout request queue: review, approve, reject, and mark as paid

## Objective
Give admins a dedicated payout panel to see all organizer payout requests, review request details, and action them with approve / reject / mark as paid decisions. Includes a stat summary at the top and full request history.

## Prerequisite
`manual-payout-flow.md` must be implemented first — this feature depends on the `PayoutRequest` model existing in the schema.

## Scope
- In scope:
  - New page: `/admin/payouts`
  - Add "Payouts" link to admin nav
  - New API: `GET /api/admin/payouts` and `POST /api/admin/payouts/[id]/decision`
  - Filter by request status
  - Admin note on each decision
  - Summary stats (pending count, total pending amount)
- Out of scope:
  - Actual bank transfer initiation
  - Email notification to organizer on decision (future)
  - Stripe Connect payout management (handled by Stripe dashboard)
  - Pagination

## Affected Files
- `app/admin/payouts/page.tsx` — new page
- `app/api/admin/payouts/route.ts` — new: GET all requests
- `app/api/admin/payouts/[id]/decision/route.ts` — new: POST decision
- `app/admin/organizers/page.tsx` — add "Payouts" to nav array (all admin pages share the same nav)
- All other admin pages that define the `nav` array — update to include Payouts link

## Backend Changes

### `GET /api/admin/payouts`
- Auth: `requireRole(req, Role.SUPER_ADMIN)`
- Optional `status` query param — filter by `PayoutRequestStatus`; validate against enum, return `fail(400)` on invalid
- Include: `organizerProfile { user { email }, companyName, brandName }`
- Order by: `requestedAt desc`
- Return `ok(requests)`

### `POST /api/admin/payouts/[id]/decision`
- Auth: `requireRole(req, Role.SUPER_ADMIN)`
- Body schema: `{ action: "APPROVED" | "PAID" | "REJECTED", adminNote?: string }`
- Validate `action` — fail 400 on invalid
- Find `PayoutRequest` by id — fail 404 if not found
- Logic:
  - `APPROVED`: set `status = APPROVED`, set `resolvedAt = now()`
  - `PAID`: set `status = PAID`, set `resolvedAt = now()` (only valid if current status is APPROVED or PENDING)
  - `REJECTED`: set `status = REJECTED`, set `resolvedAt = now()`
- Always set `adminNote` if provided
- Return `ok(updatedRequest)`

## Page Layout (`/admin/payouts`)

### Summary bar (top of page)
Three stat cards side by side:
- **Pending Requests** — count of PENDING requests
- **Total Pending Amount** — sum of `amount` for PENDING requests (show `$0.00` if all amounts are null)
- **All Time Paid** — count of PAID requests

### Filter bar
- `<select>` for status: All / PENDING / APPROVED / PAID / REJECTED
- State: `status` (default `""`)
- `useEffect` depends on `[status]`, refetches on change

### Request cards (one per request)
Each card shows:
- **Header row**: organizer email + company name | requested date | status badge
- **Amount**: `$${amount.toFixed(2)}` or `"Amount not specified"` if null
- **Organizer note**: shown if present, else hidden
- **Admin note**: shown if present in amber/blue box depending on status
- **Action buttons** (conditional on status):
  - If PENDING: "Approve" (primary) + "Reject" (outline destructive)
  - If APPROVED: "Mark as Paid" (primary) + "Reject" (outline destructive)
  - If PAID or REJECTED: no action buttons, show resolved date
- **Admin note input**: shown inline when an action button is clicked — text input for optional note before confirming
  - "Confirm" button submits the decision
  - "Cancel" collapses the input

### Empty state
- When `rows.length === 0`: `EmptyState` component with "No payout requests match the current filter."

## Design Spec
- Page uses `SidebarLayout role="admin"` with updated nav including "Payouts"
- `PageHeader title="Payout Requests" subtitle="Review and action organizer manual payout requests."`
- Summary bar: `grid gap-4 lg:grid-cols-3` with stat cards matching organizer dashboard style
  - Card: `rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm`
  - Stat number: `text-4xl font-semibold tracking-tight text-neutral-900`
- Request card: `rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm`
- Status badge colours:
  - PENDING: `bg-amber-100 text-amber-700`
  - APPROVED: `bg-blue-100 text-blue-700`
  - PAID: `bg-emerald-100 text-emerald-700`
  - REJECTED: `bg-red-100 text-red-700`
- Admin note box (after decision): `bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800`
- Inline action confirm area: `bg-neutral-50 border border-[var(--border)] rounded-xl p-4 mt-3`
- "Approve" button: `variant="default"`
- "Reject" button: `variant="outline"` with red text
- "Mark as Paid" button: `variant="default"` with emerald styling

## Nav Update
Add `{ href: "/admin/payouts", label: "Payouts" }` to the nav array in ALL admin pages:
- `app/admin/organizers/page.tsx`
- `app/admin/venues/page.tsx`
- `app/admin/categories/page.tsx`
- `app/admin/locations/page.tsx`
- `app/admin/config/page.tsx`
- `app/admin/payouts/page.tsx` (new)

## Acceptance Criteria
1. Admin nav includes "Payouts" link visible from all admin pages
2. Summary bar shows live pending count and total pending amount
3. Admin can filter requests by status
4. Admin can approve, reject, or mark as paid with an optional note
5. Status transitions are enforced (cannot mark as paid if already rejected)
6. Resolved date is shown on completed requests
7. Organizer's request history reflects the updated status (relies on organizer payout requests API)
8. Lint, typecheck pass

## TBD
- Whether to add a "total paid to date" per organizer view — defer to Phase 3 analytics
- Whether rejected requests can be re-opened — default: no, create a new request
