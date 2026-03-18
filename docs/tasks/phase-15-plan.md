# Phase 15 Plan — Platform Polish

**Status:** READY
**Depends on:** Phase 14 complete ✅
**Goal:** Fill the remaining small-to-medium gaps: organizer logo, extended platform config, and true recurring event schedules.

---

## Task 1 — OrganizerProfile Logo

### 1a. Schema — `prisma/schema.prisma`
Add one field to `OrganizerProfile`:
```prisma
logoUrl  String?
```

Run:
```bash
npx prisma migrate dev --name add-organizer-logo
npx prisma generate
```

### 1b. Upload endpoint — `app/api/organizer/uploads/logo/route.ts` (new)
- POST, multipart/form-data, requires ORGANIZER session
- Upload to Cloudinary (use existing `src/lib/services/event-image-upload.ts` as reference)
- Update `OrganizerProfile.logoUrl` with the returned URL
- Return `ok({ logoUrl })`

### 1c. Onboarding page — `app/organizer/onboarding/page.tsx`
- Add "Logo" upload section (file input, preview, upload button)
- Calls the new upload endpoint on file select

### 1d. Public organizer profile — `app/organizers/[id]/page.tsx`
- Show logo above brand name if `logoUrl` is set

### 1e. PDF ticket — `app/api/account/tickets/[ticketId]/pdf/route.ts`
- If `organizerProfile.logoUrl` is set, fetch the image and embed it at the top of the PDF using pdfkit's `doc.image(buffer, x, y, { width })`
- Fetch the logoUrl with `fetch(logoUrl)` → get ArrayBuffer → pass as Buffer to pdfkit

**Files:**
- `prisma/schema.prisma`
- `app/api/organizer/uploads/logo/route.ts` — new
- `app/organizer/onboarding/page.tsx`
- `app/organizers/[id]/page.tsx`
- `app/api/account/tickets/[ticketId]/pdf/route.ts`

---

## Task 2 — Extended Platform Config

### 2a. Schema — `prisma/schema.prisma`
Extend `PlatformConfig` with:
```prisma
platformName   String   @default("EventsBox")
brandColor     String   @default("#000000")
smtpFromName   String   @default("EventsBox")
smtpFromEmail  String   @default("noreply@eventsbox.com")
```

Run:
```bash
npx prisma migrate dev --name extend-platform-config
npx prisma generate
```

### 2b. Admin config API — `app/api/admin/config/route.ts`
- GET: return all fields including new ones
- PATCH: accept `platformName`, `brandColor`, `smtpFromName`, `smtpFromEmail` in body (Zod validation)

### 2c. Admin config UI — `app/admin/config/page.tsx`
- Add fields to the form: Platform Name, Brand Color (color picker input), From Name, From Email
- Show current values, save via PATCH

### 2d. Notifications — `src/lib/services/notifications.ts`
- In the `from` field of `resend.emails.send(...)`, replace the hardcoded "EventsBox <noreply@...>" string with a call to fetch `PlatformConfig` and use `smtpFromName` + `smtpFromEmail`
- Cache the config with a module-level variable (refresh on first call per cold start)

**Files:**
- `prisma/schema.prisma`
- `app/api/admin/config/route.ts`
- `app/admin/config/page.tsx`
- `src/lib/services/notifications.ts`

---

## Task 3 — True Recurring Event Schedules

### 3a. Schema — `prisma/schema.prisma`
Add recurrence fields to `EventSeries`:
```prisma
recurrenceType    RecurrenceType?   // DAILY, WEEKLY, BIWEEKLY, MONTHLY
recurrenceDaysOfWeek  Int[]         @default([])  // 0=Sun..6=Sat for WEEKLY/BIWEEKLY
recurrenceEndDate DateTime?
```

Add enum:
```prisma
enum RecurrenceType {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
}
```

Run:
```bash
npx prisma migrate dev --name add-series-recurrence
npx prisma generate
```

### 3b. Generate endpoint — `app/api/organizer/series/[id]/generate/route.ts` (new)
- POST, requires ORGANIZER session + series ownership
- Body: `{ count: number }` (max 52)
- Read `series.recurrenceType`, `series.recurrenceDaysOfWeek`, `series.recurrenceEndDate`, and the latest event in the series
- Generate `count` new Event records by duplicating the last event and advancing the date by the recurrence interval
- Link each new event to the series (`seriesId`)
- Return `ok({ created: number })`

**Date logic:**
- DAILY: +1 day
- WEEKLY: +7 days
- BIWEEKLY: +14 days
- MONTHLY: same day-of-month, +1 month (use JS `Date.setMonth(m+1)`)
- Skip generation past `recurrenceEndDate` if set

### 3c. Series management UI — `app/organizer/series/page.tsx`
- Add "Recurrence" column showing recurrence type badge
- Add "Generate Events" button per series row → opens a dialog with count input → calls the generate endpoint → shows success toast

### 3d. Series create/edit — `app/api/organizer/series/route.ts` and `app/api/organizer/series/[id]/route.ts`
- Accept `recurrenceType`, `recurrenceDaysOfWeek`, `recurrenceEndDate` in POST/PATCH bodies (all optional)

**Files:**
- `prisma/schema.prisma`
- `app/api/organizer/series/[id]/generate/route.ts` — new
- `app/api/organizer/series/route.ts`
- `app/api/organizer/series/[id]/route.ts`
- `app/organizer/series/page.tsx`

---

## Task 4 — Integration Tests

### `src/tests/integration/organizer-logo.test.ts`
- POST `/api/organizer/uploads/logo` returns `logoUrl`
- GET `/api/public/organizer/[id]` includes `logoUrl`

### `src/tests/integration/platform-config.test.ts`
- GET `/api/admin/config` returns new fields
- PATCH `/api/admin/config` with `platformName` → persisted

### `src/tests/integration/series-recurrence.test.ts`
- POST `/api/organizer/series/[id]/generate` with `count: 3` → creates 3 events with correct dates

---

## Execution Order

```
Task 1 (logo)                  → schema + upload + PDF embed
Task 2 (platform config)       → schema + admin UI + email from
Task 3 (recurring schedules)   → schema + generate endpoint + UI
Task 4 (tests)                 → last
```

---

## Acceptance Gate

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run test:integration` — all passing
- `npm run build` — clean build

---

## Status Tracking

| Task | Status |
|------|--------|
| Task 1 — Organizer Logo | TODO |
| Task 2 — Extended Platform Config | TODO |
| Task 3 — Recurring Schedules | TODO |
| Task 4 — Integration Tests | TODO |
