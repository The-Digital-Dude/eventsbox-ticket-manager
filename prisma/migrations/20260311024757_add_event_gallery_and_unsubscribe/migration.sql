-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unsubscribeToken" TEXT;

-- Backfill existing rows with unique unsubscribe tokens before enforcing NOT NULL.
UPDATE "User"
SET "unsubscribeToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "unsubscribeToken" IS NULL;

-- AlterTable
ALTER TABLE "User"
ALTER COLUMN "unsubscribeToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");
