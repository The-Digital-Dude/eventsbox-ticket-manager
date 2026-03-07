# Feature Plan: Admin Organizer Filter + Search

## Feature Name
Admin organizer governance list: status filter + text search

## Objective
Help admins find organizer accounts faster by allowing filter-by-status and search-by-email/company from the organizer governance page.

## Scope
- In scope:
  - Add status filter control in admin organizers UI.
  - Add text search input in admin organizers UI.
  - Extend organizers API query handling to support search term (email/company/brand/contact where practical).
  - Preserve existing approve/reject/suspend flows.
- Out of scope:
  - Pagination redesign.
  - Export/download.
  - New database schema/index changes (unless discovered necessary during implementation).

## Affected Files (Planned)
- `app/admin/organizers/page.tsx`
- `app/api/admin/organizers/route.ts`
- `src/tests/integration/*` (new or updated tests)
- `docs/tasks/current-task.md`
- `docs/reviews/admin-organizer-filter-search-review.md`

## Backend Changes
- New/updated routes:
  - `GET /api/admin/organizers`
  - Existing `status` query param retained.
  - Add optional search param (proposed: `q`).
- Auth/role requirements:
  - Must remain `SUPER_ADMIN` via `requireRole`.
- Validation schema updates:
  - Inline parsing is acceptable for query params; optional dedicated schema may be added if logic grows.
- Business logic updates:
  - Apply status filter and search criteria together.
  - Search should be case-insensitive when supported by Prisma mode.

## Frontend Changes
- Pages/components impacted:
  - `app/admin/organizers/page.tsx`
- State/data fetching changes:
  - Manage `status` and `q` UI state.
  - Refetch list when filter/search changes.
- UX/loading/error behavior:
  - Keep existing toast/error behavior for decision actions.
  - Include empty-state message when no matches.

## Schema / Data Changes
- Prisma model/migration needed? (`No` expected)
- Data backfill/seed impact: None expected.
- Rollback considerations:
  - Revert route query behavior and UI controls if regressions appear.

## Edge Cases
- Status filter set + empty search.
- Search term with no matches.
- Leading/trailing spaces in search term.
- Missing/invalid status query should gracefully default to all.

## Risks
- Regression risks:
  - Breaking existing organizer list retrieval.
  - Accidentally broadening data access behavior.
- Performance risks:
  - Search query may become heavier on large data.
- Security risks:
  - Ensure admin-only protection remains unchanged.

## Tests
- Unit:
  - Optional helper-level query parsing test if extracted.
- Integration:
  - Add/update route test for `status` + `q` combinations.
- E2E/Smoke:
  - Optional manual smoke on admin organizers page.
- Manual QA notes:
  - Verify filtering and search combined results.
  - Verify approve/reject/suspend still works after filtering/searching.

## Acceptance Criteria
1. Admin can filter organizer list by status using the UI.
2. Admin can search organizer list by text (email and organizer profile/company fields where available).
3. API supports combined `status` + `q` query parameters and returns expected filtered data.
4. Existing organizer decision actions remain functional.
5. Lint, typecheck, and relevant tests pass.

## Dependencies
- External services/env vars: None new.
- Parallel work assumptions: None.

## Notes
- If search-field scope is ambiguous in implementation, default to `user.email` + `organizerProfile.companyName` and mark any extra field matching as `TBD`.
