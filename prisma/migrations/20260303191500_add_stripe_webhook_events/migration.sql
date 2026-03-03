-- Track Stripe webhook deliveries for idempotency and diagnostics
CREATE TABLE "public"."StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "public"."StripeWebhookEvent"("stripeEventId");
CREATE INDEX "StripeWebhookEvent_type_idx" ON "public"."StripeWebhookEvent"("type");
CREATE INDEX "StripeWebhookEvent_processedAt_idx" ON "public"."StripeWebhookEvent"("processedAt");
