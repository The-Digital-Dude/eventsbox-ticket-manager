# Phase 6 Plan — Attendee Accounts

**Status:** COMPLETE
**Depends on:** Phase 5 complete ✅
**Goal:** Allow event attendees to create accounts, view order history, manage their profile, and cancel their own orders.

---

## Context

Currently the app has two roles: `ORGANIZER` and `SUPER_ADMIN`. Orders are guest-based — linked only by `buyerEmail`. Phase 6 introduces a third role `ATTENDEE` with a dedicated account portal.

**Schema impact summary:**
- Add `ATTENDEE` to `Role` enum
- Add `AttendeeProfile` model
- Add nullable `attendeeUserId` to `Order` (backward-safe — existing orders stay as guest)
- Add `stripeCustomerId` to `AttendeeProfile` for saved cards (future use)

---

## Task Order (Sequential — do not reorder)

---

### Task 1 — Prisma Schema Migration

**File to modify:** `prisma/schema.prisma`

**Changes:**

1. Add `ATTENDEE` to the `Role` enum:
```prisma
enum Role {
  SUPER_ADMIN
  ORGANIZER
  ATTENDEE
}
```

2. Add `AttendeeProfile` model after the `OrganizerProfile` model:
```prisma
model AttendeeProfile {
  id               String   @id @default(cuid())
  userId           String   @unique
  displayName      String?
  phone            String?
  stripeCustomerId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  orders           Order[]
}
```

3. Add `attendeeProfile` relation to `User` model:
```prisma
attendeeProfile  AttendeeProfile?
```

4. Add nullable `attendeeUserId` and relation to `Order` model:
```prisma
attendeeUserId   String?
attendeeProfile  AttendeeProfile? @relation(fields: [attendeeUserId], references: [id])
```
Also add index: `@@index([attendeeUserId])`

**After schema changes:** run `npx prisma migrate dev --name add-attendee-role`

**Acceptance criteria:**
- Migration runs without error
- `npx prisma generate` succeeds
- `typecheck` passes

---

### Task 2 — Attendee Register API

**File to create:** `app/api/auth/register/attendee/route.ts`

**Behavior:**
- POST `{ email, password, displayName? }`
- Validate with Zod: email valid, password min 8 chars
- Rate limit: 10/min by IP
- Check email not already taken
- Create `User` with `role: Role.ATTENDEE`
- Create `AttendeeProfile` with `displayName` if provided
- Create `EmailVerificationToken` (same flow as organizer)
- Send welcome email (fire-and-forget, same `sendWelcomeEmail`)
- Return `ok({ userId, email }, 201)`

**Do NOT modify** `app/api/auth/register/route.ts` — that remains organizer-only.

**Acceptance criteria:**
- `POST /api/auth/register/attendee` creates an ATTENDEE user
- `lint` and `typecheck` pass

---

### Task 3 — Attendee Auth Pages

**File to create:** `app/auth/register/attendee/page.tsx`

**Behavior:**
- "use client" page
- Fields: Email, Password, Display Name (optional)
- On submit: calls `POST /api/auth/register/attendee`
- On success: shows "Check your email to verify your account"
- Link to `/auth/login` for existing accounts
- Use existing `Input`, `Label`, `Button` components
- No sidebar — use `PublicNav`

**File to modify:** `app/auth/login/page.tsx`
- After the "Forgot password?" link, add: "Don't have an account? Register as Attendee" → `/auth/register/attendee`
- Also add: "Register as Organizer" → `/auth/register`

**Acceptance criteria:**
- Page renders at `/auth/register/attendee`
- `lint` and `typecheck` pass

---

### Task 4 — Attendee Session & Middleware Guard

**File to modify:** `app/api/auth/login/route.ts`
- After successful login, the existing `issueSession` handles all roles — no change needed
- ATTENDEE users can log in via the existing `/api/auth/login` endpoint

**File to create:** `src/lib/auth/require-attendee.ts`
- Export `requireAttendee(req)` guard — similar to `requireRole` but checks `role === "ATTENDEE"`
- Throws `"UNAUTHENTICATED"` if no session, `"FORBIDDEN"` if role is not ATTENDEE

**Acceptance criteria:**
- `requireAttendee` can be imported without errors
- `typecheck` passes

---

### Task 5 — Attendee Account Layout & Dashboard

**File to create:** `app/account/layout.tsx`
- Wraps account pages with `PublicNav` at top
- Simple centered container, no sidebar

**File to create:** `app/account/dashboard/page.tsx`

**Behavior (SSR):**
- Call `getServerSession()` — if no session or role !== ATTENDEE, redirect to `/auth/login`
- Fetch `AttendeeProfile` for user
- Show: welcome message with displayName/email, quick links to "My Orders" and "My Profile"
- Show count of total orders linked to their attendeeProfileId

**Acceptance criteria:**
- Page renders at `/account/dashboard`
- Redirects unauthenticated users to `/auth/login`
- `lint` and `typecheck` pass

---

### Task 6 — Attendee Orders Page

**File to create:** `app/api/account/orders/route.ts`

**Behavior:**
- GET — `requireAttendee(req)`
- Find `AttendeeProfile` for user
- Return orders where `attendeeUserId = profile.id`, status PAID or REFUNDED
- Include: event title, event startAt, items (ticket name, qty), total, status, paidAt
- Paginated: `?page=` (page size 10)
- Return `ok({ orders, total, pages })`

**File to create:** `app/account/orders/page.tsx`

**Behavior (SSR):**
- Auth guard: redirect if not ATTENDEE
- Fetch from `/api/account/orders`
- Table: Event, Date, Tickets, Total, Status, link to `/orders/[id]`
- Pagination
- Empty state: "No orders yet. Browse events →"

**Acceptance criteria:**
- `GET /api/account/orders` returns correct data
- Page renders at `/account/orders`
- `lint` and `typecheck` pass

---

### Task 7 — Attendee Profile Page

**File to create:** `app/api/account/profile/route.ts`

**Behavior:**
- GET — return `{ email, displayName, phone, createdAt }`
- PATCH `{ displayName?, phone? }` — update `AttendeeProfile`
- Both require `requireAttendee`

**File to create:** `app/account/profile/page.tsx`

**Behavior ("use client"):**
- Auth guard via API call on mount
- Load profile via GET `/api/account/profile`
- Editable form: Display Name, Phone
- Save via PATCH `/api/account/profile`
- Show toast on success/failure (use `sonner`)
- "Change password" link → `/auth/forgot-password`

**Acceptance criteria:**
- GET and PATCH work correctly
- Page renders at `/account/profile`
- `lint` and `typecheck` pass

---

### Task 8 — Link Orders to Attendee on Checkout

**File to modify:** `app/api/checkout/route.ts`

**Behavior change:**
- After creating the order, check if there is an active session with `role === "ATTENDEE"`
- If yes, find `AttendeeProfile` for that user, then update order: `{ attendeeUserId: profile.id }`
- If not logged in (guest checkout), leave `attendeeUserId` as null — backward-compatible
- Use `getServerSession()` from `@/src/lib/auth/server-auth`

**Acceptance criteria:**
- Guest checkout still works unchanged
- Logged-in attendee orders get `attendeeUserId` set
- `lint` and `typecheck` pass

---

### Task 9 — Public Nav Attendee Links

**File to modify:** `src/components/shared/public-nav.tsx`

**Changes:**
- Read session on client (use existing auth cookie pattern or API call)
- If user is ATTENDEE and logged in: show "My Account" → `/account/dashboard` and "Logout"
- If not logged in: show "Sign In" → `/auth/login` and "Register" → `/auth/register/attendee`

**Acceptance criteria:**
- Nav shows correct links per session state
- `lint` and `typecheck` pass

---

### Task 10 — Integration Tests

**File to create:** `src/tests/integration/attendee-account.test.ts`

**Tests to cover:**
1. `POST /api/auth/register/attendee` — creates ATTENDEE user and profile
2. `POST /api/auth/login` with attendee credentials — issues session
3. `GET /api/account/orders` — returns empty list for new attendee
4. `PATCH /api/account/profile` — updates displayName and phone
5. Checkout with attendee session — order has `attendeeUserId` set

**Acceptance criteria:**
- All new tests pass
- Existing 32 integration tests still pass
- `lint` and `typecheck` pass

---

### Task 11 — Phase 6 Release Notes

**File to create:** `docs/releases/phase-6-release-notes.md`

**Contents:**
- Date, status, feature summary
- Migration note: `add-attendee-role`
- New env vars: none
- Validation: lint ✅, typecheck ✅, test:integration ✅

**File to update:** `docs/tasks/phase-6-plan.md`
- Mark all tasks as DONE

---

## Status Table

| Task | Description | Status |
|------|-------------|--------|
| 1 | Prisma schema + migration | DONE |
| 2 | Attendee register API | DONE |
| 3 | Attendee register + login pages | DONE |
| 4 | Session guard `requireAttendee` | DONE |
| 5 | Account layout + dashboard page | DONE |
| 6 | Orders API + orders page | DONE |
| 7 | Profile API + profile page | DONE |
| 8 | Link orders to attendee on checkout | DONE |
| 9 | Public nav attendee links | DONE |
| 10 | Integration tests | DONE |
| 11 | Release notes | DONE |

---

## Out of Scope
- Attendee can cancel/refund their own order (requires business rule decisions — deferred)
- Saved payment methods via Stripe Customer (stripeCustomerId field added but not wired)
- Social login (Google/GitHub)
- Admin user management (ban/suspend attendees)
- Attendee event reviews or ratings
