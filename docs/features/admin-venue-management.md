# Feature Plan: Admin Venue Management Improvements

## Feature Name
Admin venue list: filter, search, richer cards, and approval notes

## Objective
Give admins a fast way to find and action venue requests with proper filter/search, richer data on each card, and the ability to add a note when rejecting.

## Scope
- In scope:
  - Add `status` filter and `q` text search to `GET /api/admin/venues`
  - Add filter bar UI to `app/admin/venues/page.tsx`
  - Richer venue cards (address, category, organizer email, state/city, submitted date)
  - Rejection note stored and displayed
  - Empty state when no venues match
- Out of scope:
  - Venue edit by admin (organizer owns venue data)
  - Seat map editing from admin side
  - Pagination redesign

## Affected Files
- `app/api/admin/venues/route.ts` — add `q` param support
- `app/api/admin/venues/[id]/decision/route.ts` — store rejection reason on venue record
- `app/admin/venues/page.tsx` — filter bar, richer cards, empty state

## Backend Changes

### `GET /api/admin/venues` — add `q` param
- Parse `q` from query params, trim, treat blank as absent
- Existing `status` param already works — keep it
- Add OR search when `q` present across: `venue.name`, `organizerProfile.user.email`
- Use `mode: "insensitive"`
- Validate `status` against `VenueStatus` enum values; return `fail(400, ...)` on invalid value
- Do NOT change auth or response envelope

```ts
// Where clause shape
{
  ...(status ? { status: status as VenueStatus } : {}),
  ...(q ? {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { organizerProfile: { user: { email: { contains: q, mode: "insensitive" } } } },
    ]
  } : {}),
}
```

### `POST /api/admin/venues/[id]/decision` — store rejection reason
- Already accepts `reason` in body
- Confirm that `rejectionReason` is stored on the `Venue` model — check schema
- If `Venue` model does not have `rejectionReason` field: add it as `String?` with a migration
- Return full venue row after update

## Frontend Changes

### Filter bar (above venue cards)
- `<select>` for status: All / PENDING_APPROVAL / APPROVED / REJECTED
- `<input>` for search: `placeholder="Search venue or organizer email..."`
- Same layout pattern as organizer list: `grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]`
- State: `status` (default `""`) and `q` (default `""`)
- `useEffect` depends on `[status, q]`, uses active cancellation guard

### Richer venue cards
Each card shows:
- Venue name (large, `text-xl font-semibold`)
- Status badge (coloured: amber=PENDING_APPROVAL, green=APPROVED, red=REJECTED)
- Organizer email (`text-sm text-neutral-500`)
- Address line 1 + State + City (one line, with MapPin icon)
- Category name (if present, small badge)
- Total seats / Total tables (two small stat boxes)
- Seating layout: "Configured" or "Not configured" badge
- Submitted date (`updatedAt` formatted as `DD MMM YYYY`)
- If status is REJECTED and `rejectionReason` is present: show amber alert box with reason

### Actions
- Approve button (existing)
- Reject button — open a small inline reason input before confirming (replace the `prompt()` call with a controlled input in the card)
- View Layout button (existing modal — keep as-is)

### Empty state
- When `rows.length === 0` after filter/search: show `EmptyState` component with message "No venues match the current filter."

## Design Spec
- Venue card: `rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm`
- Stat boxes: `rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-white/85 px-3 py-2`
- Rejection reason box: `bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mt-3`
- Status badge colours:
  - APPROVED: `bg-emerald-100 text-emerald-700`
  - PENDING_APPROVAL: `bg-amber-100 text-amber-700`
  - REJECTED: `bg-red-100 text-red-700`
- Inline rejection input: `Input` component + "Confirm Reject" button rendered in the card when reject is clicked, hidden otherwise

## Schema Check Required
- Check if `Venue` model has `rejectionReason String?` — if not, add it
- If migration needed: `npx prisma migrate dev --name add_venue_rejection_reason`

## Acceptance Criteria
1. Admin can filter venues by status and search by name or organizer email
2. Venue cards show full address, category, organizer email, seat counts, and submission date
3. Rejection reason is captured via inline input (not browser prompt) and stored
4. Rejected venues display the rejection reason on the card
5. Empty state shown when no results match
6. Lint, typecheck, tests pass

## TBD
- Whether to replace `prompt()` for rejection reason on the organizer list page as well — recommend yes, but scope to this task only for now
- Pagination if venue count grows — not in scope here
