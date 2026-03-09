# Phase 9 Release Notes

## Summary

Phase 9 completes the attendee-side purchase loop and the soft-launch readiness work for EventsBox Ticket Manager.

## Highlights

- Added `sitemap.xml` and `robots.txt` generators for public event discovery while excluding admin, organizer, account, and API routes from indexing.
- Added event-level social metadata with Open Graph and Twitter preview support, including hero-image fallback behavior.
- Added public organizer profile pages with upcoming published events and event-page links to discover more events from the same organizer.
- Added Stripe webhook-driven order confirmation emails with one QR code per ticket and scanner-compatible ticket IDs.
- Added an attendee ticket wallet at `/account/tickets`, including downloadable QR images and a protected QR PNG route with ownership checks.
- Added admin bulk event actions for approve, reject, feature, and unfeature flows with audit logging for each affected event.
- Added dedicated Phase 9 integration coverage for order confirmation emails, attendee QR wallet access, and admin bulk event moderation.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test:integration`

## Notes

- No Prisma schema changes or migrations were required for Phase 9.
- The existing `qrcode` dependency was reused for email, wallet, and scanner-compatible QR output.
