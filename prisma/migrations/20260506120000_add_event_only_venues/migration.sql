ALTER TABLE "Venue"
ADD COLUMN "isEventOnly" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Venue_organizerProfileId_isEventOnly_idx" ON "Venue"("organizerProfileId", "isEventOnly");
