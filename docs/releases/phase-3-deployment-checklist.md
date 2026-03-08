# Phase 3 Deployment Checklist

Date: 2026-03-08  
Owner: Engineering

## 1) Pre-Deployment

- [ ] Confirm target commit is merged and pushed (`main` and release branch if used).
- [ ] Confirm production database backup/snapshot is available.
- [ ] Confirm required env vars are set:
- [ ] `DATABASE_URL`
- [ ] `JWT_ACCESS_SECRET`
- [ ] `JWT_REFRESH_SECRET`
- [ ] `APP_URL`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET`
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM`
- [ ] `EMAIL_REPLY_TO` (optional)
- [ ] `CLOUDINARY_CLOUD_NAME`
- [ ] `CLOUDINARY_API_KEY`
- [ ] `CLOUDINARY_API_SECRET`
- [ ] `CLOUDINARY_UPLOAD_FOLDER`
- [ ] Confirm Stripe webhook endpoints target `/api/webhooks/stripe`.
- [ ] Confirm Resend domain/sender is verified for `EMAIL_FROM`.
- [ ] Confirm Cloudinary credentials can upload into configured folder.

## 2) Build and Deploy

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:integration`
- [ ] `npm run db:generate`
- [ ] `npm run db:migrate`
- [ ] `npm run build`
- [ ] Deploy application artifacts.
- [ ] Run/start application in production environment.

## 3) Post-Deploy Verification

- [ ] Open public events list and detail pages; verify hero image rendering.
- [ ] Create and edit an organizer event with image upload.
- [ ] Submit/publish/cancel an event and verify organizer status visibility.
- [ ] Verify cancellation attendee emails are delivered when Resend is configured.
- [ ] Refund a paid order from organizer/admin path and verify refund status + email.
- [ ] Verify Stripe webhook processing via `/api/webhooks/stripe` debug endpoint.
- [ ] Validate scanner page behavior on mobile viewport.
- [ ] Validate organizer analytics period filters (`3/6/12/24`) and chart data loading.

## 4) Monitoring Window (First 24 Hours)

- [ ] Check server logs for auth/register, event cancel, order refund, and webhook errors.
- [ ] Monitor webhook retries or signature verification failures.
- [ ] Monitor email send failures and Cloudinary upload errors.
- [ ] Track support reports for checkout, order confirmation, and scanner flows.

## 5) Rollback Plan

- [ ] If release-blocking issues are detected, rollback app to previous stable artifact.
- [ ] Restore previous environment configuration if needed.
- [ ] Run smoke checks on rolled-back version.
- [ ] Communicate incident summary and follow-up patch plan.
