# Phase 14 Plan — Event Richness + Hardening (Final Phase)

**Status:** DONE
**Depends on:** Phase 13 complete ✅
**Goal:** Multi-image gallery and email unsubscribe. This is the final phase to reach 100%.

---

## Audit Results (verified against source 2026-03-11)

| Item | Status |
|------|--------|
| RICH-01 — Event search + filter | ✅ ALREADY DONE — API + UI support q, category, state, date range |
| RICH-02 — Featured events homepage | ✅ ALREADY DONE — homepage shows isFeatured events with fallback |
| RICH-03 — Percentage + 100%-off promo codes | ✅ ALREADY DONE — PERCENTAGE enum in schema, handled in checkout |
| RICH-06 — Sentry error monitoring | ✅ ALREADY DONE — @sentry/nextjs installed, sentry.*.config.ts configured |
| RICH-04 — Multi-image gallery per event | ✅ DONE — organizers can manage event galleries and attendees see a public gallery/lightbox |
| RICH-05 — Email unsubscribe preferences | ✅ DONE — waitlist emails respect opt-out and users can unsubscribe publicly or from profile |

**Remaining work: 0 features.**

---

## Task 1 — Schema Migration (do first)

**File:** `prisma/schema.prisma`

### 1a. Add `images` field to `Event` model
```prisma
images  String[]  @default([])   // ordered array of image URLs (CDN/uploaded)
```

### 1b. Add unsubscribe fields to `User` model
```prisma
marketingOptOut      Boolean  @default(false)
unsubscribeToken     String   @unique @default(cuid())
```

### Run:
```bash
npx prisma migrate dev --name add-event-gallery-and-unsubscribe
npx prisma generate
npm run lint && npm run typecheck
```

**Commit:** `feat: schema — event image gallery and email unsubscribe token`

---

## Task 2 — RICH-04: Multi-Image Gallery

### 2a. File to modify: `app/api/organizer/uploads/event-image/route.ts`

Currently handles single hero image upload. Extend it to also accept gallery uploads:
- Add query param `?type=gallery` (default: `hero`)
- If `type=gallery`: upload image to storage and return the URL without updating `heroImage`
- The organizer calls this endpoint per image and manages the `images[]` array themselves

### 2b. File to modify: `app/api/organizer/events/[id]/route.ts`

In the PATCH handler, accept `images` (array of strings) in the body schema:
- Add `images: z.array(z.string().url()).max(10).optional()` to the Zod schema
- Update `event.images` when provided

### 2c. File to modify: `app/organizer/events/[id]/edit/page.tsx`

Add image gallery management section below the hero image:
- "Event Gallery" heading
- Grid of uploaded images (show thumbnails), each with a remove (×) button
- "Add Photo" button → triggers file input → uploads via `/api/organizer/uploads/event-image?type=gallery` → appends URL to local images array
- On save, include `images` array in the PATCH body
- Max 10 images, show count "3 / 10"

### 2d. File to modify: `app/events/[slug]/EventDetailClient.tsx`

Below the hero image, if `event.images` has items, show a scrollable gallery:
- Horizontal scroll row of image thumbnails
- Click thumbnail → lightbox/modal showing full image
- Simple implementation: use a `<dialog>` element or a small state variable `selectedImage`
- If no gallery images: render nothing (no empty state needed)

### 2e. File to modify: `app/api/public/events/[slug]/route.ts`

Include `images` field in the public event response:
```ts
select: {
  ...existingFields,
  images: true,
}
```

**Files to change:**
- `prisma/schema.prisma`
- `app/api/organizer/uploads/event-image/route.ts`
- `app/api/organizer/events/[id]/route.ts`
- `app/organizer/events/[id]/edit/page.tsx`
- `app/events/[slug]/EventDetailClient.tsx`
- `app/api/public/events/[slug]/route.ts`

**Commit:** `feat: multi-image gallery for event pages`

---

## Task 3 — RICH-05: Email Unsubscribe

### 3a. File to create: `app/api/unsubscribe/route.ts` (public — no auth)

**GET** — query param `?token=[unsubscribeToken]`
- Find user by `unsubscribeToken`
- If not found: return 400 `INVALID_TOKEN`
- Set `user.marketingOptOut = true`
- Return `ok({ unsubscribed: true, email: user.email })`

### 3b. File to create: `app/unsubscribe/page.tsx` (public, no auth)

- Read `?token=` from URL, POST to `/api/unsubscribe`
- On success: "You've been unsubscribed from marketing emails. You'll still receive order confirmations and important account emails."
- On error: "This unsubscribe link is invalid or has already been used."
- Link back to homepage

### 3c. File to modify: `src/lib/services/notifications.ts`

Add helper to build unsubscribe URL:
```ts
function unsubscribeUrl(token: string) {
  return `${env.APP_URL}/unsubscribe?token=${token}`;
}
```

Add unsubscribe footer link to these marketing/promotional emails only:
- `sendWaitlistConfirmationEmail` — "You're on the waitlist"
- `sendWaitlistNotifyEmail` — "Tickets available"

Do NOT add unsubscribe to transactional emails:
- `sendOrderConfirmationEmail` — transactional, required by law
- `sendPasswordResetEmail` — transactional
- `sendOrderRefundedEmail` — transactional
- `sendOrganizerApprovedEmail` / `sendOrganizerRejectedEmail` — transactional

### 3d. File to modify: notification functions that send to waitlist

When sending waitlist emails, fetch `user.unsubscribeToken` from the DB:
```ts
const user = await prisma.user.findUnique({
  where: { email: to },
  select: { marketingOptOut: true, unsubscribeToken: true },
});
if (user?.marketingOptOut) return { sent: false, reason: "OPT_OUT" };
// include unsubscribeUrl(user.unsubscribeToken) in email footer
```

### 3e. File to modify: `app/account/profile/page.tsx`

Add a toggle in account settings:
- "Email Preferences" section
- Checkbox: "Receive notifications when waitlisted events get new tickets"
- Calls PATCH `/api/account/profile` with `{ marketingOptOut: true/false }`

### 3f. File to modify: `app/api/account/profile/route.ts`

In the PATCH handler, accept `marketingOptOut: boolean` in the body:
```ts
await prisma.user.update({
  where: { id: session.user.id },
  data: { marketingOptOut: parsed.data.marketingOptOut },
});
```

**Files to create/modify:**
- `app/api/unsubscribe/route.ts` — new
- `app/unsubscribe/page.tsx` — new
- `src/lib/services/notifications.ts` — add unsubscribe link to marketing emails + opt-out check
- `app/account/profile/page.tsx` — add email preference toggle
- `app/api/account/profile/route.ts` — accept marketingOptOut in PATCH

**Commit:** `feat: email unsubscribe and marketing opt-out`

---

## Task 4 — Integration Tests

**File:** `src/tests/integration/unsubscribe.test.ts`
- GET `/api/unsubscribe?token=[validToken]` → 200, `marketingOptOut = true`
- GET `/api/unsubscribe?token=invalid` → 400
- Waitlist email skipped for opted-out user

**File:** extend `src/tests/integration/event-series.test.ts` or create `gallery.test.ts`
- PATCH event with `images: ["https://example.com/a.jpg"]` → 200
- GET public event → `images` array returned

**Commit:** `test: phase 14 integration tests`

---

## Execution Order

```
Task 1 (schema migration)        → MUST be first
Task 2 (multi-image gallery)     → no auth complexity, good warm-up
Task 3 (email unsubscribe)       → after gallery, touches notifications
Task 4 (tests)                   → last
```

---

## Acceptance Gate

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing
- `npm run build` — clean build, zero errors

---

## Status Tracking

| Task | Status |
|------|--------|
| Task 1 — Schema migration | DONE |
| Task 2 — Multi-image gallery | DONE |
| Task 3 — Email unsubscribe | DONE |
| Task 4 — Tests | DONE |

## Completion Notes

- Added `Event.images`, `User.marketingOptOut`, and `User.unsubscribeToken` to the Prisma schema. Because `prisma migrate dev` is currently blocked by pre-existing drift in the shared Neon development database, the schema change was shipped with a manual SQL migration at `prisma/migrations/20260311024757_add_event_gallery_and_unsubscribe/migration.sql`, applied via `npx prisma db execute`, followed by `npx prisma generate`.
- Organizers can now upload up to 10 gallery images per event, manage them from the edit page, and publish them through the existing public event API. Attendees see those images in a horizontal gallery with a lightbox on the event detail page.
- Waitlist emails now respect marketing opt-out, include an unsubscribe footer when a registered user is known, and the public `/unsubscribe` page updates the opt-out preference without requiring login.
- Attendees can now manage waitlist email preferences from `/account/profile`.
- Final validation passed with `npm run lint`, `npm run typecheck`, `npm run test:integration`, and `npm run build`.
