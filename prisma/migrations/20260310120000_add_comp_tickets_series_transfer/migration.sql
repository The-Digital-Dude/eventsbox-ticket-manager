-- CreateEnum
CREATE TYPE "TicketTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "seriesId" TEXT;

-- AlterTable
ALTER TABLE "QRTicket"
ADD COLUMN "isComplimentary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TicketType"
ADD COLUMN "reservedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "compIssued" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompTicketIssuance" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "note" TEXT,
    "qrTicketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompTicketIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTransfer" (
    "id" TEXT NOT NULL,
    "qrTicketId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "TicketTransferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

-- CreateIndex
CREATE INDEX "EventSeries_organizerProfileId_idx" ON "EventSeries"("organizerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CompTicketIssuance_qrTicketId_key" ON "CompTicketIssuance"("qrTicketId");

-- CreateIndex
CREATE INDEX "CompTicketIssuance_ticketTypeId_idx" ON "CompTicketIssuance"("ticketTypeId");

-- CreateIndex
CREATE INDEX "CompTicketIssuance_issuedByUserId_idx" ON "CompTicketIssuance"("issuedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTransfer_token_key" ON "TicketTransfer"("token");

-- CreateIndex
CREATE INDEX "TicketTransfer_qrTicketId_idx" ON "TicketTransfer"("qrTicketId");

-- CreateIndex
CREATE INDEX "TicketTransfer_token_idx" ON "TicketTransfer"("token");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompTicketIssuance" ADD CONSTRAINT "CompTicketIssuance_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompTicketIssuance" ADD CONSTRAINT "CompTicketIssuance_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompTicketIssuance" ADD CONSTRAINT "CompTicketIssuance_qrTicketId_fkey" FOREIGN KEY ("qrTicketId") REFERENCES "QRTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_qrTicketId_fkey" FOREIGN KEY ("qrTicketId") REFERENCES "QRTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
