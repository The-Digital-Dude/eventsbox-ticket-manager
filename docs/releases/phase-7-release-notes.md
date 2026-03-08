# Phase 7 Release Notes

- Date: 2026-03-09
- Status: Complete
- Migration: `add-promo-codes-and-cancellation` (schema already present in repo as `20260309190000_sync_promo_and_cancellation_schema`)

## Delivered

- Organizer promo code CRUD API and promo management page.
- Checkout promo validation and discount application with persisted `promoCodeId` and `discountAmount`.
- Attendee cancellation request flow and organizer cancellation review/decision workflow.
- Organizer attendee CSV export endpoint.
- Admin attendee management API and SSR page with suspend/unsuspend actions.
- New Phase 7 integration test coverage:
  - `src/tests/integration/promo-codes.test.ts`
  - `src/tests/integration/cancellation-requests.test.ts`

## Validation

- `npm run test:integration` ✅ (46/46)
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run build` ✅
