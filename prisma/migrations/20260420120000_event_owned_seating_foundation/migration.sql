-- CreateEnum
CREATE TYPE "EventSeatingMode" AS ENUM ('GA_ONLY', 'ROWS', 'TABLES', 'MIXED');

-- CreateEnum
CREATE TYPE "EventSeatingSource" AS ENUM ('NONE', 'VENUE_TEMPLATE', 'COPIED_EVENT', 'CUSTOM', 'LEGACY_VENUE');

-- CreateEnum
CREATE TYPE "EventSeatingSectionType" AS ENUM ('ROWS', 'TABLES', 'SECTIONED_GA');

-- CreateEnum
CREATE TYPE "TicketInventoryMode" AS ENUM ('GENERAL_ADMISSION', 'ASSIGNED_SEAT', 'TABLE', 'SECTIONED_GA');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "seatingMode" "EventSeatingMode" NOT NULL DEFAULT 'GA_ONLY';

-- AlterTable
ALTER TABLE "TicketType"
ADD COLUMN "eventSeatingSectionId" TEXT,
ADD COLUMN "inventoryMode" "TicketInventoryMode" NOT NULL DEFAULT 'GENERAL_ADMISSION';

-- CreateTable
CREATE TABLE "VenueSeatingTemplate" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "EventSeatingMode" NOT NULL,
    "seatingConfig" JSONB NOT NULL,
    "seatState" JSONB,
    "summary" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueSeatingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSeatingPlan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mode" "EventSeatingMode" NOT NULL,
    "source" "EventSeatingSource" NOT NULL DEFAULT 'CUSTOM',
    "venueSeatingTemplateId" TEXT,
    "sourceVenueId" TEXT,
    "seatingConfig" JSONB NOT NULL,
    "seatState" JSONB,
    "summary" JSONB,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeatingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSeatingSection" (
    "id" TEXT NOT NULL,
    "eventSeatingPlanId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectionType" "EventSeatingSectionType" NOT NULL,
    "capacity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeatingSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueSeatingTemplate_venueId_idx" ON "VenueSeatingTemplate"("venueId");

-- CreateIndex
CREATE INDEX "VenueSeatingTemplate_venueId_isDefault_idx" ON "VenueSeatingTemplate"("venueId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeatingPlan_eventId_key" ON "EventSeatingPlan"("eventId");

-- CreateIndex
CREATE INDEX "EventSeatingPlan_mode_idx" ON "EventSeatingPlan"("mode");

-- CreateIndex
CREATE INDEX "EventSeatingPlan_venueSeatingTemplateId_idx" ON "EventSeatingPlan"("venueSeatingTemplateId");

-- CreateIndex
CREATE INDEX "EventSeatingPlan_sourceVenueId_idx" ON "EventSeatingPlan"("sourceVenueId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeatingSection_eventSeatingPlanId_key_key" ON "EventSeatingSection"("eventSeatingPlanId", "key");

-- CreateIndex
CREATE INDEX "EventSeatingSection_eventSeatingPlanId_idx" ON "EventSeatingSection"("eventSeatingPlanId");

-- CreateIndex
CREATE INDEX "TicketType_eventSeatingSectionId_idx" ON "TicketType"("eventSeatingSectionId");

-- AddForeignKey
ALTER TABLE "VenueSeatingTemplate" ADD CONSTRAINT "VenueSeatingTemplate_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatingPlan" ADD CONSTRAINT "EventSeatingPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatingPlan" ADD CONSTRAINT "EventSeatingPlan_venueSeatingTemplateId_fkey" FOREIGN KEY ("venueSeatingTemplateId") REFERENCES "VenueSeatingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatingPlan" ADD CONSTRAINT "EventSeatingPlan_sourceVenueId_fkey" FOREIGN KEY ("sourceVenueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatingSection" ADD CONSTRAINT "EventSeatingSection_eventSeatingPlanId_fkey" FOREIGN KEY ("eventSeatingPlanId") REFERENCES "EventSeatingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventSeatingSectionId_fkey" FOREIGN KEY ("eventSeatingSectionId") REFERENCES "EventSeatingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
