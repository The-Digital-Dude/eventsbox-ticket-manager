-- AlterTable
ALTER TABLE "public"."Venue" ADD COLUMN     "seatState" JSONB,
ADD COLUMN     "seatingConfig" JSONB,
ADD COLUMN     "seatingSchemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seatingUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "totalSeats" INTEGER,
ADD COLUMN     "totalTables" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Venue" ADD CONSTRAINT "Venue_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
