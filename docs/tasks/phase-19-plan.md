# Phase 19 Plan — Event Reviews & Ratings

**Status:** DONE (2026-03-18)
**Depends on:** Phase 18 complete
**Goal:** Attendees who attended a paid event can leave a 1–5 star rating and comment. Reviews show publicly on event pages and organizer profile pages. Admins can moderate (hide) reviews. Organizers see reviews on their event dashboard.

---

## Schema Changes

### New model: `EventReview`
```prisma
model EventReview {
  id                String          @id @default(cuid())
  eventId           String
  attendeeProfileId String
  rating            Int             // 1–5
  comment           String?
  isVisible         Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  event             Event           @relation(fields: [eventId], references: [id], onDelete: Cascade)
  attendeeProfile   AttendeeProfile @relation(fields: [attendeeProfileId], references: [id], onDelete: Cascade)

  @@unique([eventId, attendeeProfileId])
  @@index([eventId])
}
```

### Extend `Event`:
```prisma
reviews  EventReview[]
```

### Extend `AttendeeProfile`:
```prisma
reviews  EventReview[]
```

**Migration name:** `add-event-reviews`

---

## Task 1 — Public Review API

### `app/api/events/[slug]/reviews/route.ts` (new)

**GET** — returns visible reviews for the event, sorted by `createdAt DESC`; no auth required
- Response: `{ reviews: [{ id, rating, comment, createdAt, attendeeName }], averageRating, totalCount }`
- `attendeeName`: use `AttendeeProfile.firstName + lastName` if set, else `"Anonymous"`

**POST** — create a review; requires ATTENDEE session
- Body: `{ rating: number (1-5), comment?: string }`
- Validate: the attendee must have at least one `PAID` order for this event
- Validate: one review per attendee per event (`@@unique` enforced at DB level, return 409 if duplicate)
- Return `ok(review)`

---

## Task 2 — Attendee Review Management API

### `app/api/account/reviews/route.ts` (new)

**GET** — returns all reviews written by the current attendee
- Include: `event.title`, `event.slug`, `event.startAt`, `event.heroImage`, `rating`, `comment`, `createdAt`

**DELETE `/api/account/reviews/[reviewId]/route.ts`** (new)
- Attendee can delete their own review; ownership check
- Hard delete

---

## Task 3 — Admin Moderation API

### `app/api/admin/reviews/[id]/route.ts` (new)
- **PATCH** — toggle `isVisible`; body: `{ isVisible: boolean }`; requires SUPER_ADMIN
- Write audit log entry on visibility change

### `app/api/admin/reviews/route.ts` (new)
- **GET** — list all reviews across the platform with filters: `?eventId=`, `?isVisible=`, `?page=`
- Returns review + event title + attendee name

---

## Task 4 — Public Event Page

### `app/events/[slug]/EventDetailClient.tsx` (modify)
- Below the event description, add a **Reviews** section
- Show average star rating (e.g. "★ 4.2 / 5 — 18 reviews") if reviews exist
- List up to 10 reviews: star display, comment, date, attendee name
- "Load more" button if more than 10
- If the current user is an attendee AND the event has ended AND they have a PAID order for this event AND haven't reviewed yet: show a "Leave a Review" inline form (rating stars + comment textarea + submit)
- If they already reviewed: show their review with a delete button

---

## Task 5 — Organizer Event Dashboard

### `app/organizer/events/[id]/page.tsx` (modify)
- Add a "Reviews" tab alongside existing tabs
- Table: Rating, Comment, Date, Attendee (anonymous), Visible status
- No moderation action for organizers (read-only — admin moderates)

---

## Task 6 — Admin Reviews Page

### `app/admin/reviews/page.tsx` (new)
- Table: Event, Rating, Comment, Attendee (masked), Date, Visible toggle
- Filter by: event name (search), visibility
- Toggle `isVisible` inline via PATCH
- Add "Reviews" to admin sidebar nav

---

## Task 7 — Public Organizer Profile

### `app/organizers/[id]/page.tsx` (modify)
- Show aggregate review stats for the organizer:
  - "Avg rating across all events: ★ 4.3 (94 reviews)"
  - Query: average of all visible `EventReview.rating` across all events by this organizer

---

## Task 8 — In-App Review Prompt

### `app/account/orders/page.tsx` (modify)
- For each PAID order where `event.endAt < now()` and no review exists for that event by this attendee: show a "Rate this event" button linking to `/events/[slug]#reviews`
- This avoids building a separate email trigger; keeps it in-app

---

## Task 9 — Integration Tests

### `src/tests/integration/event-reviews.test.ts`
- POST `/api/events/[slug]/reviews` with valid ATTENDEE session + PAID order → 200, review created
- POST same review again → 409 DUPLICATE
- POST by attendee without PAID order → 403
- GET `/api/events/[slug]/reviews` → returns reviews with averageRating
- PATCH `/api/admin/reviews/[id]` with `{ isVisible: false }` → hidden from public GET
- DELETE `/api/account/reviews/[id]` → review removed; re-count returns updated average

---

## Execution Order
```
Schema migration
Task 1 (public review API)
Task 2 (attendee review management)
Task 3 (admin moderation API)
Task 4 (public event page — review section)
Task 5 (organizer event dashboard tab)
Task 6 (admin reviews page)
Task 7 (organizer public profile stats)
Task 8 (in-app review prompt)
Task 9 (tests)
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
| Public review API | TODO |
| Attendee review management | TODO |
| Admin moderation API | TODO |
| Public event page | TODO |
| Organizer dashboard tab | TODO |
| Admin reviews page | TODO |
| Organizer public profile | TODO |
| In-app review prompt | TODO |
| Tests | TODO |
