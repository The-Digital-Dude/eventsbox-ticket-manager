# Current Task

## Active Task
**Phase 4 complete — implemented, validated, and pushed**

---

## Phase 4 Scope

Phase 4 closes the remaining product gaps identified after Phase 3 closeout. It is split into three tracks:

- **Track A: Missing Features** — functionality that is planned but not yet implemented
- **Track B: UX & Polish** — improvements to existing pages that affect usability
- **Track C: Production Hardening** — infra-level quality and reliability work

All tasks must pass `npm run lint`, `npm run typecheck`, and `npm run test:integration` before commit.

---

## Track A — Missing Features

### A1: Admin Orders Page
**Priority:** High
**Why:** Admins currently have no way to view or search across all platform orders. This is a basic governance need.

**Acceptance Criteria:**
- `GET /api/admin/orders` returns paginated orders with `?page=`, `?status=`, `?q=` (buyer email search)
- `app/admin/orders/page.tsx` (SSR) shows table: Order ID, Buyer Email, Event Title, Amount, Status, Date
- Status badge colors match existing pattern (PAID=green, PENDING=amber, REFUNDED=orange)
- Pagination via `?page=` query param (page size: 20)
- Add `{ href: "/admin/orders", label: "Orders" }` to all admin `nav` arrays (all 12 admin pages)

**Files:**
- `app/api/admin/orders/route.ts` — new GET handler, `requireRole(SUPER_ADMIN)`
- `app/admin/orders/page.tsx` — new SSR page
- All files under `app/admin/**/page.tsx` — add Orders to nav (12 files)

**Out of scope:** Order detail drilldown page, manual order creation.

---

### A2: Organizer Analytics CSV Export
**Priority:** Medium
**Why:** Organizers need to export data for accountants and reporting.

**Acceptance Criteria:**
- `GET /api/organizer/analytics/export` returns a CSV file with headers:
  `Event Title, Status, Start Date, Tickets Sold, Revenue (AUD), Platform Fee, Check-in Rate`
- Response has `Content-Type: text/csv` and `Content-Disposition: attachment; filename=analytics.csv`
- Existing `?months=` param respected (defaults to 12)
- "Export CSV" button added to `app/organizer/analytics/page.tsx` — triggers a `window.location.href` download

**Files:**
- `app/api/organizer/analytics/export/route.ts` — new GET handler
- `app/organizer/analytics/page.tsx` — add Export CSV button (client component wrapper needed)

**Out of scope:** Admin analytics CSV, scheduled email reports.

---

### A3: Organizer Dashboard Notification Banners
**Priority:** Medium
**Why:** Organizers don't know when events are rejected or stuck in approval without navigating to each event.

**Acceptance Criteria:**
- At top of `app/organizer/dashboard/page.tsx`, query events by organizer with `status: REJECTED` or `status: PENDING_APPROVAL`
- If any REJECTED events: show red banner "X event(s) were rejected by admin. Review and resubmit."
- If any PENDING_APPROVAL events: show amber banner "X event(s) are pending admin approval."
- Banners link to `/organizer/events` for full list
- No new API route needed — query runs server-side in the existing page component

**Files:**
- `app/organizer/dashboard/page.tsx` — add Prisma queries + banner JSX

**Out of scope:** Per-event notification inbox, push notifications.

---

### A4: Login Rate Limit by Email
**Priority:** Medium
**Why:** Current IP-only rate limit can be bypassed from different IPs; email-keyed limit prevents credential stuffing on a specific account.

**Acceptance Criteria:**
- In `app/api/auth/login/route.ts`, after IP rate limit check, add a second check:
  `rateLimit(\`login:email:${parsed.data.email}\`, 10, 300_000)` (10 attempts / 5 min per email)
- Returns same `429 RATE_LIMITED` response if exceeded
- Email rate limit checked only after schema validation passes (email is known)

**Files:**
- `app/api/auth/login/route.ts` — add second rateLimit call

**Out of scope:** Lockout notifications, account unlock UI.

---

### A5: Public Event Share Button
**Priority:** Low
**Why:** Attendees want to share events via mobile share sheet or clipboard.

**Acceptance Criteria:**
- In `app/events/[slug]/page.tsx`, add a Share button near event title
- On click: call `navigator.share({ title, url })` if supported; otherwise copy `window.location.href` to clipboard
- Show a brief "Link copied!" toast on clipboard fallback (use existing `sonner` toast)
- Button uses existing `Button` component variant `outline`

**Files:**
- `app/events/[slug]/page.tsx` — add ShareButton client component inline

**Out of scope:** Social share links (Twitter/Facebook), QR code share modal.

---

## Track B — UX & Polish

### B1: Dark Mode Sidebar Fix
**Priority:** Medium
**Why:** Sidebar background is hardcoded `bg-white` — dark mode toggle doesn't affect it, breaking visual consistency.

**Acceptance Criteria:**
- Replace `bg-white` with `bg-[var(--sidebar-bg)]` in `src/components/shared/sidebar-layout.tsx`
- Add `--sidebar-bg` token to `:root` (white) and `.theme-dark` (dark neutral) in `app/globals.css`
- Nav link text colors adjusted to use neutral tokens that respond to dark mode
- Mobile nav bar also updated

**Files:**
- `src/components/shared/sidebar-layout.tsx`
- `app/globals.css`

---

### B2: Event Search & Filter on Public Listing
**Priority:** Medium
**Why:** `/events` page has no filtering — as events grow, discoverability breaks.

**Acceptance Criteria:**
- Add `?q=`, `?category=`, `?state=` query params to `app/events/page.tsx`
- Filter UI: text search input + category dropdown + state dropdown (all SSR-driven, no client JS needed)
- Prisma query uses `where: { title: { contains: q }, categoryId, stateId }`
- Existing pagination works correctly with active filters (page resets to 1 on filter change)

**Files:**
- `app/events/page.tsx` — add filter UI + extend Prisma query
- `app/api/public/events/route.ts` — add `q`, `category`, `state` query params

---

### B3: Organizer Event Status Timeline
**Priority:** Low
**Why:** Organizers can't see a history of state transitions (submitted → rejected → resubmitted). This helps with support.

**Acceptance Criteria:**
- In `app/organizer/events/[id]/page.tsx`, show a simple vertical timeline of AuditLog entries for the event
- Entries show: action label, actor role, timestamp
- Uses existing `prisma.auditLog.findMany({ where: { entityType: "Event", entityId: id } })`
- Server-side, no new API needed

**Files:**
- `app/organizer/events/[id]/page.tsx`

---

## Track C — Production Hardening

### C1: E2E Test Coverage (Playwright)
**Priority:** High
**Why:** Integration tests cover API routes but no browser-level user journey is tested.

**Acceptance Criteria:**
- `src/tests/e2e/checkout-flow.spec.ts` — attendee browses event, selects ticket, completes checkout (mocked Stripe), lands on order confirmation
- `src/tests/e2e/auth-flow.spec.ts` — register, verify email link, login, logout
- `src/tests/e2e/organizer-event.spec.ts` — organizer creates event, adds ticket type, submits for approval
- All tests pass with `npm run test:e2e`
- Playwright config already exists — extend it

**Files:**
- `src/tests/e2e/*.spec.ts` — new test files

---

### C2: Improved API Error Observability
**Priority:** Medium
**Why:** `catch {}` blocks swallow errors entirely. Production debugging requires structured logging.

**Acceptance Criteria:**
- Replace bare `catch {}` with `catch (error) { console.error("[route-name]", error); }` in all route handlers
- No behavior change — still returns `fail(500, ...)` to clients
- Affects all `app/api/**/route.ts` files with bare catch blocks

**Files:**
- All route handlers with bare `catch {}` — grep for `} catch {` pattern

---

### C3: Update Docs
**Priority:** Low (but required before phase closeout)

**Acceptance Criteria:**
- `docs/tasks/current-task.md` updated with completion status as tasks land
- `docs/releases/phase-4-release-notes.md` created at phase closeout
- `docs/architecture/overview.md` updated with any new technical debt introduced

---

## Execution Order

```
A4 (login rate limit)      → small, do first, no deps
A3 (dashboard banners)     → small, no deps
A5 (share button)          → small, no deps
A1 (admin orders page)     → medium, needs nav updates across 12 files
A2 (analytics CSV export)  → medium, depends on analytics API shape
B1 (dark mode sidebar)     → CSS-only, safe
B2 (event search/filter)   → medium, touches public listing
B3 (event status timeline) → small, reads existing audit log
C1 (E2E tests)             → after features land
C2 (error observability)   → grep + replace pass, low risk
C3 (docs)                  → last
```

---

## Acceptance Gate (per task)

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — 32/32 passing (or more if new tests added)
- Behavior matches acceptance criteria above

### Validation Snapshot

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:integration` ✅ (32/32)
- `npm run test:e2e` ✅ (4/4)

---

## Out of Scope for Phase 4

- Attendee self-registration (separate account type, requires schema migration)
- Redis-backed rate limiting (requires infrastructure provisioning)
- Background job queue (requires worker setup)
- Staging/production deployment (tracked separately in deployment checklist)
- Admin user ban/suspend flow
- Social login (Google/GitHub)

---

## Status Tracking

| Task | Status |
|------|--------|
| A1 — Admin Orders Page | DONE |
| A2 — Analytics CSV Export | DONE |
| A3 — Dashboard Banners | DONE |
| A4 — Login Rate Limit by Email | DONE |
| A5 — Share Button | DONE |
| B1 — Dark Mode Sidebar | DONE |
| B2 — Event Search & Filter | DONE |
| B3 — Event Status Timeline | DONE |
| C1 — E2E Tests | DONE |
| C2 — Error Observability | DONE |
| C3 — Docs Update | DONE |

---

## Phase 3 Completion Summary

See:

- `docs/releases/phase-3-release-notes.md`
- `docs/releases/phase-3-deployment-checklist.md`
- `docs/releases/phase-4-release-notes.md`

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:integration` ✅ (32/32)
- `npm run test:e2e` ✅ (4/4)
- Pushed to `origin/main` and `origin/sleep-mode` ✅
