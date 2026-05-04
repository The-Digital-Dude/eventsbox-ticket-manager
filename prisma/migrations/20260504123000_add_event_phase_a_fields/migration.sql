-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('PHYSICAL', 'ONLINE');

-- CreateEnum
CREATE TYPE "public"."EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "public"."EventMode" AS ENUM ('SIMPLE', 'RESERVED_SEATING');

-- AlterTable
ALTER TABLE "public"."Event"
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "eventType" "public"."EventType" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN     "onlineAccessLink" TEXT,
ADD COLUMN     "visibility" "public"."EventVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "mode" "public"."EventMode" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN     "adminNote" TEXT;
