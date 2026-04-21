/*
  Warnings:

  - You are about to drop the column `inventoryMode` on the `TicketType` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."TicketClassType" AS ENUM ('GENERAL_ADMISSION', 'ASSIGNED_SEAT', 'TABLE', 'SECTIONED_GA');

-- AlterTable
ALTER TABLE "public"."TicketType" DROP COLUMN "inventoryMode",
ADD COLUMN     "classType" "public"."TicketClassType" NOT NULL DEFAULT 'GENERAL_ADMISSION';

-- DropEnum
DROP TYPE "public"."TicketInventoryMode";
