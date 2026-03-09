-- CreateEnum
CREATE TYPE "SeatBookingStatus" AS ENUM ('RESERVED', 'BOOKED');

-- AlterTable
ALTER TABLE "QRTicket"
ADD COLUMN "seatId" TEXT,
ADD COLUMN "seatLabel" TEXT;

-- CreateTable
CREATE TABLE "EventSeatBooking" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "seatLabel" TEXT NOT NULL,
    "status" "SeatBookingStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeatBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSeatBooking_eventId_seatId_key" ON "EventSeatBooking"("eventId", "seatId");

-- CreateIndex
CREATE INDEX "EventSeatBooking_orderId_idx" ON "EventSeatBooking"("orderId");

-- CreateIndex
CREATE INDEX "EventSeatBooking_eventId_status_expiresAt_idx" ON "EventSeatBooking"("eventId", "status", "expiresAt");

-- AddForeignKey
ALTER TABLE "EventSeatBooking" ADD CONSTRAINT "EventSeatBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatBooking" ADD CONSTRAINT "EventSeatBooking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
