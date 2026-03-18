# Gemini Prompt — Phase 15: Platform Polish

Paste everything below this line into Gemini CLI:

---

You are implementing Phase 15 of the EventsBox Ticket Manager — a Next.js 16 + Prisma + PostgreSQL + Tailwind CSS v4 app. The codebase is at the repo root.

Read `docs/tasks/phase-15-plan.md` in full before writing any code. Follow the plan exactly. Do not add features beyond what is specified.

## Ground rules

- API responses always use `ok(...)` / `fail(...)` from `src/lib/http/response.ts`
- Auth guards: use `requireRole` from `src/lib/auth/guards.ts` or `requireAttendee` from `src/lib/auth/require-attendee.ts`
- Zod validation on all request bodies and route params
- No new dependencies unless the plan explicitly requires one
- Keep existing code patterns — look at adjacent files before writing new ones

## Your tasks

### Task 1 — OrganizerProfile Logo

1. Add `logoUrl String?` to `OrganizerProfile` in `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add-organizer-logo && npx prisma generate`
3. Create `app/api/organizer/uploads/logo/route.ts`
   - POST handler, multipart/form-data
   - Requires ORGANIZER session (use `requireRole`)
   - Upload image to Cloudinary using the same pattern as `src/lib/services/event-image-upload.ts`
   - Update `OrganizerProfile.logoUrl` for the current organizer
   - Return `ok({ logoUrl })`
4. Edit `app/organizer/onboarding/page.tsx` — add a Logo section with file input, image preview, and upload-on-select behaviour (call the new endpoint, update local state)
5. Edit `app/organizers/[id]/page.tsx` — show `<img src={profile.logoUrl} />` above the brand name when `logoUrl` is present
6. Edit `app/api/account/tickets/[ticketId]/pdf/route.ts` — if `organizerProfile.logoUrl` is set, `fetch(logoUrl)` → `arrayBuffer()` → `Buffer.from(...)` → pass to `doc.image(buffer, 50, 40, { width: 100 })` at the top of the PDF

### Task 2 — Extended Platform Config

1. Extend `PlatformConfig` in `prisma/schema.prisma`:
   ```prisma
   platformName   String   @default("EventsBox")
   brandColor     String   @default("#000000")
   smtpFromName   String   @default("EventsBox")
   smtpFromEmail  String   @default("noreply@eventsbox.com")
   ```
2. Run `npx prisma migrate dev --name extend-platform-config && npx prisma generate`
3. Edit `app/api/admin/config/route.ts`
   - GET: include the new fields in the response
   - PATCH: add the 4 new fields to the Zod schema and `prisma.platformConfig.update`
4. Edit `app/admin/config/page.tsx` — add form fields for Platform Name, Brand Color (`<input type="color">`), From Name, From Email
5. Edit `src/lib/services/notifications.ts`
   - Add a cached loader: `let _config: PlatformConfig | null = null; async function getConfig() { if (!_config) _config = await prisma.platformConfig.findUnique({ where: { id: 'singleton' } }); return _config; }`
   - In each `resend.emails.send(...)` call, replace the hardcoded `from` string with `` `${config.smtpFromName} <${config.smtpFromEmail}>` ``

### Task 3 — Recurring Event Schedules

1. Add to `prisma/schema.prisma`:
   ```prisma
   enum RecurrenceType {
     DAILY
     WEEKLY
     BIWEEKLY
     MONTHLY
   }
   ```
   Add to `EventSeries`:
   ```prisma
   recurrenceType       RecurrenceType?
   recurrenceDaysOfWeek Int[]           @default([])
   recurrenceEndDate    DateTime?
   ```
2. Run `npx prisma migrate dev --name add-series-recurrence && npx prisma generate`
3. Create `app/api/organizer/series/[id]/generate/route.ts`
   - POST handler, requires ORGANIZER session + series ownership
   - Body: `{ count: number }` where `count` is 1–52 (Zod: `z.number().int().min(1).max(52)`)
   - Fetch the series and its latest event (order by `startAt DESC`)
   - Compute new event dates:
     - DAILY: `startAt + 1 day`, WEEKLY: `+7 days`, BIWEEKLY: `+14 days`, MONTHLY: same day + 1 month
   - Stop early if date would exceed `series.recurrenceEndDate`
   - Create new events by copying all scalar fields from the latest event (`title`, `description`, `heroImage`, `images`, `venueId`, `timezone`, `currency`, `ticketTypes` copied via `createMany`, etc.)
   - Set each new event `status = DRAFT`, `seriesId`, new `startAt`/`endAt`, new `slug` (append `-2`, `-3`, etc. or use `nanoid`)
   - Return `ok({ created: number })`
4. Edit `app/api/organizer/series/route.ts` (POST) and `app/api/organizer/series/[id]/route.ts` (PATCH)
   - Accept `recurrenceType`, `recurrenceDaysOfWeek`, `recurrenceEndDate` as optional fields
5. Edit `app/organizer/series/page.tsx`
   - Add Recurrence column showing a badge (e.g. "Weekly") when `recurrenceType` is set
   - Add a "Generate Events" button per row that opens a dialog with a number input (1–52) and a Confirm button
   - On confirm, POST to `/api/organizer/series/[id]/generate`, show success toast with count created

### Task 4 — Integration Tests

Write these three test files following the same patterns as existing integration tests in `src/tests/integration/`:

- `src/tests/integration/organizer-logo.test.ts`
  - POST to logo upload endpoint returns `logoUrl`
  - PDF route includes logo bytes when `logoUrl` is set (mock the `fetch` call)

- `src/tests/integration/platform-config.test.ts`
  - GET `/api/admin/config` returns `platformName`, `brandColor`, `smtpFromName`, `smtpFromEmail`
  - PATCH `/api/admin/config` with `{ platformName: "TestBox" }` → GET returns updated value

- `src/tests/integration/series-recurrence.test.ts`
  - POST `/api/organizer/series/[id]/generate` with `{ count: 3 }` on a series with `recurrenceType: WEEKLY` → returns `{ created: 3 }`, events exist with 7-day intervals
  - Stops at `recurrenceEndDate` if set

## After all tasks

Run and fix until clean:
```bash
npm run lint
npm run typecheck
npm run test:integration
npm run build
```

Then output a summary of every file created or modified.
