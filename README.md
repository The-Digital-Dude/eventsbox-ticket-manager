# EventsBox Client

## Local App

Run the Next.js app:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Open it locally at `http://localhost:3000` or from another device on your Wi-Fi at your LAN URL, for example `http://192.168.0.23:3000`.

If you test Stripe redirects from another device, keep `APP_URL` in `.env` aligned with that LAN URL.

## Stripe Webhooks

This app expects Stripe to post webhooks to:

```text
POST /api/webhooks/stripe
```

The webhook route now:

- verifies the Stripe signature with `STRIPE_WEBHOOK_SECRET`
- stores each Stripe event ID for idempotency
- safely ignores duplicate retries after successful processing
- updates organizer Stripe onboarding state from `account.updated`
- handles `account.application.deauthorized`
- exposes a small debug endpoint at `GET /api/webhooks/stripe`

### Local forwarding with Stripe CLI

Install and sign in to the Stripe CLI, then forward events to your local app:

```bash
stripe listen --forward-to http://192.168.0.23:3000/api/webhooks/stripe
```

Stripe CLI will print a webhook signing secret that starts with `whsec_...`. Copy that into `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the dev server.

### Check webhook health

Open:

```text
http://192.168.0.23:3000/api/webhooks/stripe
```

That endpoint shows:

- whether Stripe API keys are configured
- whether a webhook secret is configured
- the most recent webhook events recorded by the app

### Recommended Stripe events

For this project, forward or subscribe at least these Stripe events:

- `account.updated`
- `account.application.deauthorized`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## Quality Checks

Run:

```bash
npm run lint
npm run typecheck
```
