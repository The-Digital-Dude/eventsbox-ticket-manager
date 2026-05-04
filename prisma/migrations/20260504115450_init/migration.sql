/*
  Warnings:

  - You are about to alter the column `amount` on the `PayoutRequest` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.

*/
-- CreateEnum
CREATE TYPE "public"."RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- AlterEnum
ALTER TYPE "public"."PayoutMode" ADD VALUE 'AUTO';

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SCANNER';

-- AlterTable
ALTER TABLE "public"."Event" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "customConfirmationMessage" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "timezone" SET DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "public"."EventSeries" ADD COLUMN     "recurrenceDaysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrenceType" "public"."RecurrenceType";

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "affiliateLinkId" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."OrganizerProfile" ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "twitterUrl" TEXT;

-- AlterTable
ALTER TABLE "public"."PayoutRequest" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "stripeTransferId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "public"."PlatformConfig" ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '#000000',
ADD COLUMN     "platformName" TEXT NOT NULL DEFAULT 'EventsBox',
ADD COLUMN     "smtpFromEmail" TEXT NOT NULL DEFAULT 'noreply@eventsbox.com',
ADD COLUMN     "smtpFromName" TEXT NOT NULL DEFAULT 'EventsBox';

-- AlterTable
ALTER TABLE "public"."QRTicket" ADD COLUMN     "checkedInDevice" TEXT,
ADD COLUMN     "isCheckedIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."TicketType" ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE "public"."Waitlist" ADD COLUMN     "attendeeProfileId" TEXT;

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AffiliateLink" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "eventId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "commissionPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventAddOn" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 10,
    "totalStock" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderAddOn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScannerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScannerDevice" (
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerDevice_pkey" PRIMARY KEY ("deviceId")
);

-- CreateTable
CREATE TABLE "public"."EventReview" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeUserId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "public"."Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "public"."AffiliateLink"("code");

-- CreateIndex
CREATE INDEX "AffiliateLink_organizerProfileId_idx" ON "public"."AffiliateLink"("organizerProfileId");

-- CreateIndex
CREATE INDEX "AffiliateLink_eventId_idx" ON "public"."AffiliateLink"("eventId");

-- CreateIndex
CREATE INDEX "EventAddOn_eventId_idx" ON "public"."EventAddOn"("eventId");

-- CreateIndex
CREATE INDEX "OrderAddOn_orderId_idx" ON "public"."OrderAddOn"("orderId");

-- CreateIndex
CREATE INDEX "OrderAddOn_addOnId_idx" ON "public"."OrderAddOn"("addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerProfile_userId_key" ON "public"."ScannerProfile"("userId");

-- CreateIndex
CREATE INDEX "ScannerProfile_userId_idx" ON "public"."ScannerProfile"("userId");

-- CreateIndex
CREATE INDEX "ScannerProfile_organizerProfileId_idx" ON "public"."ScannerProfile"("organizerProfileId");

-- CreateIndex
CREATE INDEX "ScannerDevice_userId_idx" ON "public"."ScannerDevice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventReview_orderId_key" ON "public"."EventReview"("orderId");

-- CreateIndex
CREATE INDEX "EventReview_eventId_idx" ON "public"."EventReview"("eventId");

-- CreateIndex
CREATE INDEX "EventReview_eventId_isVisible_idx" ON "public"."EventReview"("eventId", "isVisible");

-- CreateIndex
CREATE INDEX "EventReview_attendeeUserId_idx" ON "public"."EventReview"("attendeeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EventReview_eventId_attendeeUserId_key" ON "public"."EventReview"("eventId", "attendeeUserId");

-- CreateIndex
CREATE INDEX "Order_affiliateLinkId_idx" ON "public"."Order"("affiliateLinkId");

-- CreateIndex
CREATE INDEX "Waitlist_attendeeProfileId_idx" ON "public"."Waitlist"("attendeeProfileId");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "public"."AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Waitlist" ADD CONSTRAINT "Waitlist_attendeeProfileId_fkey" FOREIGN KEY ("attendeeProfileId") REFERENCES "public"."AttendeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AffiliateLink" ADD CONSTRAINT "AffiliateLink_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "public"."OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AffiliateLink" ADD CONSTRAINT "AffiliateLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventAddOn" ADD CONSTRAINT "EventAddOn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderAddOn" ADD CONSTRAINT "OrderAddOn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderAddOn" ADD CONSTRAINT "OrderAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "public"."EventAddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScannerProfile" ADD CONSTRAINT "ScannerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScannerProfile" ADD CONSTRAINT "ScannerProfile_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "public"."OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScannerDevice" ADD CONSTRAINT "ScannerDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventReview" ADD CONSTRAINT "EventReview_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventReview" ADD CONSTRAINT "EventReview_attendeeUserId_fkey" FOREIGN KEY ("attendeeUserId") REFERENCES "public"."AttendeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventReview" ADD CONSTRAINT "EventReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
