-- CreateTable
CREATE TABLE "EventCouple" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groomNameEn" TEXT NOT NULL,
    "brideNameEn" TEXT NOT NULL,
    "groomNameAr" TEXT,
    "groomFamilyAr" TEXT,
    "brideNameAr" TEXT,
    "brideFamilyAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCouple_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventCouple_eventId_idx" ON "EventCouple"("eventId");

-- AddForeignKey
ALTER TABLE "EventCouple" ADD CONSTRAINT "EventCouple_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing event announces exactly one couple, the one already
-- stored in Event's own columns. Seed it as sortOrder 0 so `couplesFor()` never
-- has to fall back to the legacy columns for pre-existing rows, and so a joint
-- wedding is just "this list, plus more".
-- Event's singular columns are deliberately left in place and untouched.
INSERT INTO "EventCouple" (
    "id",
    "eventId",
    "sortOrder",
    "groomNameEn",
    "brideNameEn",
    "groomNameAr",
    "groomFamilyAr",
    "brideNameAr",
    "brideFamilyAr",
    "createdAt"
)
SELECT
    'c' || replace(gen_random_uuid()::text, '-', ''),
    e."id",
    0,
    e."groomNameEn",
    e."brideNameEn",
    e."groomNameAr",
    e."groomFamilyAr",
    e."brideNameAr",
    e."brideFamilyAr",
    e."createdAt"
FROM "Event" e
WHERE NOT EXISTS (
    SELECT 1 FROM "EventCouple" c WHERE c."eventId" = e."id"
);
