-- CreateEnum
CREATE TYPE "public"."SeatInventoryStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED');

-- CreateTable
CREATE TABLE "public"."SeatingSection" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeatingRow" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeatInventory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "seatLabel" TEXT NOT NULL,
    "status" "public"."SeatInventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TableZone" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seatsPerTable" INTEGER NOT NULL,
    "totalTables" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatingSection_eventId_idx" ON "public"."SeatingSection"("eventId");

-- CreateIndex
CREATE INDEX "SeatingSection_eventId_sortOrder_idx" ON "public"."SeatingSection"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "SeatingRow_sectionId_idx" ON "public"."SeatingRow"("sectionId");

-- CreateIndex
CREATE INDEX "SeatingRow_sectionId_sortOrder_idx" ON "public"."SeatingRow"("sectionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SeatInventory_eventId_seatLabel_key" ON "public"."SeatInventory"("eventId", "seatLabel");

-- CreateIndex
CREATE INDEX "SeatInventory_eventId_status_expiresAt_idx" ON "public"."SeatInventory"("eventId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SeatInventory_sectionId_idx" ON "public"."SeatInventory"("sectionId");

-- CreateIndex
CREATE INDEX "SeatInventory_rowId_idx" ON "public"."SeatInventory"("rowId");

-- CreateIndex
CREATE INDEX "SeatInventory_orderId_idx" ON "public"."SeatInventory"("orderId");

-- CreateIndex
CREATE INDEX "TableZone_eventId_idx" ON "public"."TableZone"("eventId");

-- AddForeignKey
ALTER TABLE "public"."SeatingSection" ADD CONSTRAINT "SeatingSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatingRow" ADD CONSTRAINT "SeatingRow_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."SeatingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatInventory" ADD CONSTRAINT "SeatInventory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatInventory" ADD CONSTRAINT "SeatInventory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."SeatingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatInventory" ADD CONSTRAINT "SeatInventory_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "public"."SeatingRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatInventory" ADD CONSTRAINT "SeatInventory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TableZone" ADD CONSTRAINT "TableZone_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
