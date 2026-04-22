-- CreateEnum
CREATE TYPE "public"."EventLocationType" AS ENUM ('PHYSICAL', 'ONLINE');

-- AlterTable
ALTER TABLE "public"."Event" ADD COLUMN     "eventLocationType" "public"."EventLocationType" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN     "location" JSONB;
