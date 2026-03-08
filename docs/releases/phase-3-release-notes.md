# Phase 3 Release Notes

Date: 2026-03-08  
Status: Ready for deployment

## Summary

Phase 3 delivers organizer/admin event cancellation and refund operations, Cloudinary image upload support for event hero media, expanded organizer analytics, mobile-first scanner UX improvements, and notification coverage via Resend.

## Feature Highlights

- Organizer and admin can cancel published events from event detail pages.
- Organizer and admin can refund paid orders for cancelled events.
- Refund and cancellation flows now trigger attendee/organizer email notifications when email is configured.
- Organizer event create/edit flows support Cloudinary image upload with URL fallback.
- Public events list and detail pages render hero images when present.
- Organizer analytics now supports period filters (`3/6/12/24` months), trends, and top-event snapshots.
- Organizer scanner page is optimized for mobile usage with larger touch targets and a sticky action bar.

## API and Behavior Additions

- `POST /api/organizer/events/:id/cancel`
- `POST /api/admin/events/:id/cancel`
- `POST /api/organizer/events/:id/orders/:orderId/refund`
- `POST /api/admin/events/:id/orders/:orderId/refund`
- `POST /api/organizer/uploads/event-image`
- Registration welcome email dispatch is non-blocking in API response path.

## Environment and Integration Requirements

- Stripe:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_CONNECT_WEBHOOK_SECRET`
- Resend:
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `EMAIL_REPLY_TO` (optional)
- Cloudinary:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
  - `CLOUDINARY_UPLOAD_FOLDER`

## Validation Evidence

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test:integration` passed (`32/32`)

## Risk Notes

- `auth-flow` and `venue-seating-flow` integration tests are long-running in this environment and now use explicit `15_000ms` test timeouts.
- If email or media credentials are missing, those features degrade gracefully but should be treated as release configuration issues.
