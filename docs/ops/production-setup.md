# Production Setup

## Upstash Redis (rate limiting)

- Create a Redis database at Upstash.
- Copy the REST URL and REST token from the dashboard.
- Add these environment variables in Vercel:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

## Sentry (error monitoring)

- Create a new Next.js project in Sentry.
- Copy the DSN from the project settings.
- Add this environment variable in Vercel:
  - `SENTRY_DSN`

## Vercel Cron (token cleanup + event reminders)

- Cron jobs are defined in [vercel.json](/Users/juhan/Developer/TDD/EventsBox/EventsBox_Ticket_Manager/vercel.json).
- Generate a secret with:

```bash
openssl rand -hex 32
```

- Add this environment variable in Vercel:
  - `CRON_SECRET`
- Scheduled jobs:
  - Token cleanup runs at `2:00 UTC` daily
  - Event reminders run at `9:00 UTC` daily

## Stripe Production Webhook

- In Stripe Dashboard, go to `Developers -> Webhooks`.
- Add endpoint:
  - `https://your-domain.vercel.app/api/webhooks/stripe`
- Subscribe to:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.dispute.created`
- Copy the signing secret and add it in Vercel:
  - `STRIPE_WEBHOOK_SECRET`
- Ensure the production domain is reflected in:
  - `APP_URL`
  - `NEXT_PUBLIC_APP_URL`
