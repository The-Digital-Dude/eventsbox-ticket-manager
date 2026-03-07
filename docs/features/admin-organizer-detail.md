# Feature Plan: Admin Organizer Detail + Edit

## Feature Name
Admin organizer detail page: full profile view and editable fields

## Objective
When an admin clicks an organizer row in the governance list, they land on a rich detail page showing every profile field, account status, payout info, linked venues, and a timeline. Admin can also edit key fields directly.

## Scope
- In scope:
  - New page: `/admin/organizers/[id]`
  - Add "View" button/link on each row in `app/admin/organizers/page.tsx`
  - Add `PATCH /api/admin/organizers/[id]` to update editable fields
  - Read-only sections for sensitive/computed data
  - Editable sections for profile fields
  - Approve / reject / suspend actions available from the detail page too
- Out of scope:
  - Changing user email or role
  - Viewing event/ticket data (Phase 2)
  - Audit log trail (future)

## Affected Files
- `app/admin/organizers/[id]/page.tsx` — new detail page
- `app/api/admin/organizers/[id]/route.ts` — add PATCH method (GET already exists)
- `app/admin/organizers/page.tsx` — add "View" link on each row

## Page Layout (`/admin/organizers/[id]`)

### Header
- Back link: `← Organizers`
- Large heading: `{companyName ?? brandName ?? user.email}`
- Status badge (coloured by status: amber=PENDING_APPROVAL, green=APPROVED, red=REJECTED/SUSPENDED, grey=DRAFT)
- Action buttons top-right: Approve / Reject / Suspend (same `decide()` pattern as list page, reloads after action)

### Section 1 — Account
Read-only. Fields:
- Email (`user.email`)
- Email verified (`user.emailVerified` → Yes/No badge)
- Account active (`user.isActive` → Yes/No badge)
- Organizer profile ID

### Section 2 — Company Profile (editable)
Fields shown and editable:
- Company Name (`companyName`)
- Brand Name (`brandName`)
- Website (`website`)
- Tax ID (`taxId`)

### Section 3 — Contact (editable)
Fields shown and editable:
- Contact Name (`contactName`)
- Phone (`phone`)
- Alternate Phone (`alternatePhone`)
- Support Email (`supportEmail`)

### Section 4 — Address (editable)
Fields shown and editable:
- Address Line 1 (`addressLine1`)
- Address Line 2 (`addressLine2`)
- State (read-only display — resolved from `stateId` via relation)
- City (read-only display — resolved from `cityId` via relation)

### Section 5 — Social (editable)
- Facebook Page (`facebookPage`)
- Social Media Link (`socialMediaLink`)

### Section 6 — Payout
Read-only. Fields:
- Payout mode (`payoutSettings.payoutMode` or `"Not configured"`)
- Stripe account ID (`payoutSettings.stripeAccountId` or `"None"`)
- Stripe onboarding status (badge: NOT_STARTED / PENDING / COMPLETED)
- Manual payout note (`payoutSettings.manualPayoutNote`)

### Section 7 — Venues
Read-only list. For each venue:
- Venue name, address line, status badge
- Total seats / tables
- Link: "View Venue" → `/admin/venues` (for now)

### Section 8 — Timeline
Read-only. Display these timestamps if present:
- Created at
- Submitted at
- Onboarding done at
- Approved at
- Rejection reason (if status is REJECTED, show reason in amber alert box)

## Edit Behaviour
- Sections 2–5 render in read mode by default with an "Edit" button per section
- Clicking "Edit" turns the section into a form (inline edit, not a separate page)
- "Save" calls `PATCH /api/admin/organizers/[id]` with only the fields in that section
- "Cancel" reverts to read mode without saving
- Toast success/error consistent with existing patterns

## Backend Changes

### `PATCH /api/admin/organizers/[id]`
- Auth: `requireRole(req, Role.SUPER_ADMIN)`
- Body: partial update — accept any subset of: `companyName`, `brandName`, `website`, `taxId`, `contactName`, `phone`, `alternatePhone`, `supportEmail`, `addressLine1`, `addressLine2`, `facebookPage`, `socialMediaLink`
- Validate with Zod: all fields optional strings, max 500 chars each, no nulls accepted (use `undefined` to skip)
- Run `prisma.organizerProfile.update({ where: { id }, data: parsed })`
- Return `ok(updatedRow)` with full profile + user included
- Do NOT allow updating `approvalStatus`, `userId`, `stateId`, `cityId` via this endpoint

## Design Spec
- Use `rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm` for each section card
- Section heading: `text-lg font-semibold text-neutral-900 mb-4`
- Field label: `text-sm text-neutral-500`
- Field value: `text-sm font-medium text-neutral-900`
- Fields in a `grid gap-4 md:grid-cols-2` layout
- Edit button: `variant="outline" size="sm"` aligned top-right of section card
- Status badge colours:
  - APPROVED: `bg-emerald-100 text-emerald-700`
  - PENDING_APPROVAL: `bg-amber-100 text-amber-700`
  - REJECTED: `bg-red-100 text-red-700`
  - SUSPENDED: `bg-orange-100 text-orange-700`
  - DRAFT: `bg-neutral-100 text-neutral-600`
- Rejection reason: amber alert box `bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800`
- Loading state: show skeleton placeholder cards (use `animate-pulse bg-neutral-100 rounded-xl h-4`)
- Empty/error: if organizer not found, show `EmptyState` component with "Organizer not found" message and back link

## Acceptance Criteria
1. Clicking "View" on any organizer row in the list navigates to `/admin/organizers/[id]`
2. All profile fields are displayed in organised sections
3. Editable sections can be updated and saved independently
4. PATCH endpoint validates input and rejects unknown/forbidden fields
5. Approve / reject / suspend actions work from the detail page
6. Timeline shows all available timestamps
7. Lint, typecheck, tests pass

## TBD
- Whether to add `stateId`/`cityId` as dropdowns in address edit (requires fetching locations) — default: show state/city as read-only resolved names, mark as TBD if not resolvable from existing public API
- Whether rejection reason should be editable by admin post-rejection — default: read-only for now
