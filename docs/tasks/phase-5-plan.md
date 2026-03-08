# Phase 5 Plan — Deployment & Infrastructure

**Status:** COMPLETE
**Depends on:** Phase 4 complete ✅
**Goal:** Make the app production-deployable with proper CI, error monitoring, and scalable rate limiting.

---

## Task Order (Sequential — do not reorder)

---

### Task 1 — `vercel.json` + `.env.example`

**Files to create/modify:**
- `vercel.json` (new)
- `.env.example` (new)

**`vercel.json` contents:**
```json
{
  "framework": "nextjs",
  "regions": ["syd1"],
  "buildCommand": "npm run build",
  "installCommand": "npm ci"
}
```

**`.env.example` — list every env var the app needs, no values:**
```
DATABASE_URL=
DIRECT_DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
APP_URL=
NEXT_PUBLIC_APP_URL=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_WEBHOOK_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_FOLDER=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
```

**Acceptance criteria:**
- Both files exist
- `lint` and `typecheck` still pass (no code changes)

---

### Task 2 — GitHub Actions CI Pipeline

**File to create:** `.github/workflows/ci.yml`

**Behavior:**
- Triggers on: push to `main`, pull_request to `main`
- Steps in order:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with node version `20`, npm cache enabled
  3. `npm ci`
  4. `npm run lint`
  5. `npm run typecheck`
  6. `npm run test:integration` — with env var `DATABASE_URL` from GitHub secret `TEST_DATABASE_URL`
- If any step fails, pipeline fails and no deploy happens

**Acceptance criteria:**
- `.github/workflows/ci.yml` exists and is valid YAML
- `lint` and `typecheck` pass locally

---

### Task 3 — Redis-Backed Rate Limiting

**Install:** `npm install @upstash/ratelimit @upstash/redis`

**File to create:** `src/lib/http/rate-limit-redis.ts`

**Behavior:**
- Export `rateLimitRedis(key: string, max: number, windowMs: number): Promise<{ limited: boolean }>`
- Uses `@upstash/ratelimit` sliding window algorithm
- Reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from `process.env`
- If either env var is missing, falls back silently to `{ limited: false }` (graceful degradation — tests don't have Redis)

**File to modify:** `src/lib/http/rate-limit.ts`
- No changes to existing `rateLimit()` function (still used in tests)

**Files to modify** — replace `rateLimit()` with `rateLimitRedis()` in these route handlers:
- `app/api/auth/login/route.ts` — both IP and email checks
- `app/api/auth/register/route.ts`
- `app/api/orders/lookup/route.ts`
- `app/api/auth/reset-password/route.ts`

**Pattern in each route:**
```ts
// Before (sync):
const rl = rateLimit(`login:${ip}`, 20, 60_000);
if (rl.limited) return fail(429, ...);

// After (async):
const rl = await rateLimitRedis(`login:${ip}`, 20, 60_000);
if (rl.limited) return fail(429, ...);
```

**Acceptance criteria:**
- `lint` and `typecheck` pass
- `test:integration` still passes (graceful fallback when no Redis)
- When `UPSTASH_*` vars are set, rate limits are enforced across restarts

---

### Task 4 — Database Connection Pooling

**File to modify:** `prisma/schema.prisma`

**Change:** Add `directUrl` to the datasource block:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

**Why:** `DATABASE_URL` will point to the pooler (PgBouncer / Prisma Accelerate) in production. Migrations must bypass the pooler via `DIRECT_DATABASE_URL`. In local dev and tests, both vars can be the same value.

**Acceptance criteria:**
- `prisma/schema.prisma` compiles: `npx prisma generate` succeeds
- `lint` and `typecheck` pass
- No migration file needed (datasource config change only)

---

### Task 5 — Sentry Error Monitoring

**Install:** `npm install @sentry/nextjs`

**Files to create:**
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

**Each file — minimal config:**
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: process.env.NODE_ENV === "production",
});
```

**File to modify:** `next.config.ts`
Wrap existing config with `withSentryConfig`:
```ts
import { withSentryConfig } from "@sentry/nextjs";
// existing config...
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
```

**Acceptance criteria:**
- `npm run build` succeeds
- `lint` and `typecheck` pass
- When `SENTRY_DSN` is not set, app starts normally (no crash)

---

### Task 6 — Phase 5 Release Notes

**File to create:** `docs/releases/phase-5-release-notes.md`

**Contents:**
- Date, status, summary of all 5 tasks above
- List of new env vars added
- Validation evidence: lint ✅, typecheck ✅, test:integration ✅

**File to update:** `docs/tasks/phase-5-plan.md`
- Mark all tasks as DONE in the status table

---

## Status Table

| Task | Description | Status |
|------|-------------|--------|
| 1 | `vercel.json` + `.env.example` | DONE |
| 2 | GitHub Actions CI pipeline | DONE |
| 3 | Redis rate limiting (Upstash) | DONE |
| 4 | DB connection pooling (`directUrl`) | DONE |
| 5 | Sentry error monitoring | DONE |
| 6 | Release notes | DONE |

---

## Out of Scope
- Actually creating Vercel/Upstash/Sentry accounts (manual human step)
- Setting env vars in Vercel dashboard (manual human step)
- Registering Stripe webhook endpoints in production (manual human step)
- Load testing or performance benchmarks
