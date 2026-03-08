-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'ATTENDEE';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "attendeeUserId" TEXT;

-- CreateTable
CREATE TABLE "public"."AttendeeProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendeeProfile_userId_key" ON "public"."AttendeeProfile"("userId");

-- CreateIndex
CREATE INDEX "Order_attendeeUserId_idx" ON "public"."Order"("attendeeUserId");

-- AddForeignKey
ALTER TABLE "public"."AttendeeProfile" ADD CONSTRAINT "AttendeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_attendeeUserId_fkey" FOREIGN KEY ("attendeeUserId") REFERENCES "public"."AttendeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
