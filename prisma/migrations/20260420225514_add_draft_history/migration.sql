-- CreateTable
CREATE TABLE "public"."DraftHistory" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stepName" TEXT NOT NULL,
    "changeSummary" TEXT,
    "formData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftHistory_organizerId_idx" ON "public"."DraftHistory"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftHistory_organizerId_version_key" ON "public"."DraftHistory"("organizerId", "version");

-- AddForeignKey
ALTER TABLE "public"."DraftHistory" ADD CONSTRAINT "DraftHistory_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "public"."OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
