-- Add optional organizer profile fields for richer onboarding details
ALTER TABLE "public"."OrganizerProfile"
ADD COLUMN "brandName" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "alternatePhone" TEXT,
ADD COLUMN "supportEmail" TEXT,
ADD COLUMN "facebookPage" TEXT,
ADD COLUMN "socialMediaLink" TEXT;

