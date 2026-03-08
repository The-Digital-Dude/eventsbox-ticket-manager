# Phase 5 Release Notes

Date: 2026-03-08  
Status: Complete

## Summary

Phase 5 deployment and infrastructure work is complete:
- Added production deployment config via `vercel.json`
- Added a clean, no-secret `.env.example` template
- Added GitHub Actions CI for lint, typecheck, and integration tests
- Added Redis-backed rate limiting with graceful fallback when Upstash env vars are unset
- Added Prisma `directUrl` datasource support for pooled runtime + direct migration connections
- Integrated Sentry for client/server/edge with Next.js build wrapping

## New Env Vars

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Validation Evidence

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test:integration` ✅ (`32/32`)
