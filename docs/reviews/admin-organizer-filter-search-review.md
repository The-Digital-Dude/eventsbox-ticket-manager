# Review: Admin Organizer Filter + Search

## Verdict
- TBD

## Blockers
- None (pre-implementation review shell)

## Important Fixes
- None

## Optional Improvements
- None

## Regression Risks
- Risk: query logic may unintentionally exclude records when status and search are combined.
- Affected flow: `GET /api/admin/organizers` and admin organizers table.
- Suggested test/mitigation: integration tests for no filter, status-only, search-only, status+search.

## Architecture Concerns
- Keep route guard and response envelope unchanged.
- If query logic grows, consider extracting to `src/lib/services` in a future task.

## Validation Evidence
- Commands run (baseline before implementation):
  - `npm run lint` -> Pass
  - `npm run typecheck` -> Pass
  - `npm run test:integration` -> Fail (DB host unreachable in current environment)
- Result summary:
  - Repository is ready for implementation except integration test environment dependency.

## Notes for Implementer
- Preserve existing approve/reject/suspend action behavior in the admin table.
