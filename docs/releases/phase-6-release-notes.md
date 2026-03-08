# Phase 6 Release Notes

Date: 2026-03-08  
Status: Complete

## Summary

Phase 6 attendee account delivery is complete:
- Added attendee role/profile data model and schema migration
- Added attendee registration API and registration UI
- Added attendee-specific auth guard (`requireAttendee`)
- Added attendee account area with dashboard, orders, and profile pages
- Added attendee orders/profile APIs with auth protections
- Linked checkout orders to attendee profiles for logged-in attendee users
- Updated public navigation to show attendee account/logout links based on session
- Added attendee account integration tests and passed full integration suite

## Migration

- Migration name: `add-attendee-role`
- Migration directory: `prisma/migrations/20260308213300_add-attendee-role`

## New Routes

API routes:
- `POST /api/auth/register/attendee`
- `GET /api/auth/me`
- `GET /api/account/orders`
- `GET /api/account/profile`
- `PATCH /api/account/profile`

Pages:
- `/auth/register/attendee`
- `/account/dashboard`
- `/account/orders`
- `/account/profile`

## Validation

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:integration` ✅ (`39/39`)
