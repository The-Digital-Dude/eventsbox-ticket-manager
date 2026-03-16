-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "cancellationDeadlineHours" INTEGER,
ADD COLUMN     "refundPercent" INTEGER NOT NULL DEFAULT 100;
