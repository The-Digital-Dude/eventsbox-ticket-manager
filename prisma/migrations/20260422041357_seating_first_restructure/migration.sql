/*
  Warnings:

  - You are about to drop the column `schemaVersion` on the `EventSeatingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `seatState` on the `EventSeatingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `seatingConfig` on the `EventSeatingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `EventSeatingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `eventSeatingSectionId` on the `TicketType` table. All the data in the column will be lost.
  - You are about to drop the column `sectionId` on the `TicketType` table. All the data in the column will be lost.
  - You are about to drop the column `seatState` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `seatingConfig` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `seatingSchemaVersion` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `seatingUpdatedAt` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `totalSeats` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `totalTables` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `schemaVersion` on the `VenueSeatingTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `seatState` on the `VenueSeatingTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `seatingConfig` on the `VenueSeatingTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `VenueSeatingTemplate` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[generatedTicketTypeId]` on the table `EventSeatingSection` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceSeatingSectionId]` on the table `TicketType` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `price` to the `EventSeatingSection` table without a default value. This is not possible if the table is not empty.
  - Made the column `capacity` on table `EventSeatingSection` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."TicketType" DROP CONSTRAINT "TicketType_eventSeatingSectionId_fkey";

-- DropIndex
DROP INDEX "public"."TicketType_eventSeatingSectionId_idx";

-- AlterTable
ALTER TABLE "public"."EventSeatingPlan" DROP COLUMN "schemaVersion",
DROP COLUMN "seatState",
DROP COLUMN "seatingConfig",
DROP COLUMN "summary";

-- AlterTable
ALTER TABLE "public"."EventSeatingSection" ADD COLUMN     "generatedTicketTypeId" TEXT;

-- Add price with a default for existing rows
ALTER TABLE "public"."EventSeatingSection" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Update existing NULL capacities to 0
UPDATE "public"."EventSeatingSection" SET "capacity" = 0 WHERE "capacity" IS NULL;

-- Now, make capacity non-nullable
ALTER TABLE "public"."EventSeatingSection" ALTER COLUMN "capacity" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."TicketType" DROP COLUMN "eventSeatingSectionId",
DROP COLUMN "sectionId",
ADD COLUMN     "isGenerated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceSeatingSectionId" TEXT;

-- AlterTable
ALTER TABLE "public"."Venue" DROP COLUMN "seatState",
DROP COLUMN "seatingConfig",
DROP COLUMN "seatingSchemaVersion",
DROP COLUMN "seatingUpdatedAt",
DROP COLUMN "totalSeats",
DROP COLUMN "totalTables";

-- AlterTable
ALTER TABLE "public"."VenueSeatingTemplate" DROP COLUMN "schemaVersion",
DROP COLUMN "seatState",
DROP COLUMN "seatingConfig",
DROP COLUMN "summary";

-- CreateIndex
CREATE UNIQUE INDEX "EventSeatingSection_generatedTicketTypeId_key" ON "public"."EventSeatingSection"("generatedTicketTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketType_sourceSeatingSectionId_key" ON "public"."TicketType"("sourceSeatingSectionId");

-- AddForeignKey
ALTER TABLE "public"."EventSeatingSection" ADD CONSTRAINT "EventSeatingSection_generatedTicketTypeId_fkey" FOREIGN KEY ("generatedTicketTypeId") REFERENCES "public"."TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
