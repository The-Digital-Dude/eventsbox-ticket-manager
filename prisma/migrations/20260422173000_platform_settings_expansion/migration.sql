-- Extend the existing singleton platform config into grouped platform settings.
CREATE TYPE "PlatformCommissionType" AS ENUM ('PERCENTAGE', 'FIXED', 'BOTH');
CREATE TYPE "PlatformFeeStrategy" AS ENUM ('PASS_TO_BUYER', 'ABSORB');
CREATE TYPE "PlatformAutoPublishMode" AS ENUM ('NEVER', 'APPROVED_ORGANIZERS');

ALTER TABLE "PlatformConfig"
  ADD COLUMN "supportEmail" TEXT NOT NULL DEFAULT 'support@eventsbox.com',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "faviconUrl" TEXT,
  ADD COLUMN "secondaryBrandColor" TEXT NOT NULL DEFAULT '#111827',
  ADD COLUMN "footerText" TEXT,
  ADD COLUMN "defaultEventApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "defaultOrganizerApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoPublishMode" "PlatformAutoPublishMode" NOT NULL DEFAULT 'NEVER',
  ADD COLUMN "defaultCancellationPolicy" TEXT,
  ADD COLUMN "defaultCommissionType" "PlatformCommissionType" NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN "defaultCommissionValue" DECIMAL(10,2) NOT NULL DEFAULT 10,
  ADD COLUMN "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
  ADD COLUMN "defaultFeeStrategy" "PlatformFeeStrategy" NOT NULL DEFAULT 'PASS_TO_BUYER',
  ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "adminAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "organizerApprovalEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "eventApprovalEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "defaultMetaTitle" TEXT,
  ADD COLUMN "defaultMetaDescription" TEXT,
  ADD COLUMN "featuredEventLimit" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "publicSearchEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "searchIndexingEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "PlatformConfig"
SET
  "supportEmail" = COALESCE(NULLIF("smtpFromEmail", ''), 'support@eventsbox.com'),
  "defaultCommissionValue" = "defaultCommissionPct",
  "defaultTaxRate" = "defaultGstPct";
