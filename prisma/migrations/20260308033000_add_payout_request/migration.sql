-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "amount" DECIMAL,
    "note" TEXT,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutRequest_organizerProfileId_status_idx" ON "PayoutRequest"("organizerProfileId", "status");

-- CreateIndex
CREATE INDEX "PayoutRequest_requestedAt_idx" ON "PayoutRequest"("requestedAt");

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
