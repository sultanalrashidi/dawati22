-- Free-first journey, phase 0.
--
-- Makes the schema able to hold an invitation that nobody has paid for yet: a
-- draft Event with no owner and no order. Nothing writes such a row until the
-- next phase ships, so this migration changes no behaviour on its own.
--
-- Every statement here is relaxing or additive, which is what lets the
-- currently-deployed build keep running normally for the whole gap between
-- "migrate" and "deploy".
--
-- ownerId / orderId lose NOT NULL but KEEP ON DELETE RESTRICT — the relations
-- say so explicitly in schema.prisma, because Prisma's default action for an
-- optional relation is SetNull, which would have quietly made a paid
-- customer's event ownerless the moment anyone deleted the User.
--
-- One invariant is deliberately NOT a database CHECK ("an ownerless row must
-- be an anonymous, unpaid draft"): Prisma cannot express CHECK constraints, so
-- it would show as permanent drift and a future `migrate dev` could silently
-- drop it. It is enforced in the two functions that write these columns.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "detailsLockedAt" TIMESTAMP(3),
ADD COLUMN     "draftTokenHash" TEXT,
ADD COLUMN     "intendedCount" INTEGER,
ADD COLUMN     "intendedTier" "InvitationTier",
ADD COLUMN     "previewShareToken" TEXT,
ADD COLUMN     "selfPreviewToken" TEXT,
ALTER COLUMN "ownerId" DROP NOT NULL,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "importBatchId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "draftEventId" TEXT;

-- CreateTable
CREATE TABLE "PreviewShareView" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreviewShareView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewShareView_eventId_idx" ON "PreviewShareView"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "PreviewShareView_eventId_viewerKey_key" ON "PreviewShareView"("eventId", "viewerKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_draftTokenHash_key" ON "Event"("draftTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Event_previewShareToken_key" ON "Event"("previewShareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Event_selfPreviewToken_key" ON "Event"("selfPreviewToken");

-- CreateIndex
CREATE INDEX "Guest_eventId_importBatchId_idx" ON "Guest"("eventId", "importBatchId");

-- CreateIndex
CREATE INDEX "Order_draftEventId_idx" ON "Order"("draftEventId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_draftEventId_fkey" FOREIGN KEY ("draftEventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewShareView" ADD CONSTRAINT "PreviewShareView_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LOAD-BEARING BACKFILL. detailsLockedAt is null-means-editable, and every
-- event that already exists was created under the old contract, which the
-- dashboard states as unconditional fact: "بيانات المناسبة ما تنعدّل من هنا بعد
-- الإنشاء". Leaving them null would silently hand every live wedding an edit
-- form it was never promised. Lock each one at the moment its first invitation
-- actually went out, falling back to its creation time.
UPDATE "Event" e
SET "detailsLockedAt" = COALESCE(
  (SELECT MIN(i."sentAt") FROM "Invitation" i WHERE i."eventId" = e."id" AND i."sentAt" IS NOT NULL),
  e."createdAt"
)
WHERE "detailsLockedAt" IS NULL;

-- COSMETIC BACKFILL, safe to get wrong. Nothing has ever written PUBLISHED, so
-- every paid event in production still sits at the DRAFT default and the events
-- list prints «مسودة» on all of them. Activation writes PUBLISHED from now on;
-- this brings existing rows in line. status gates NOTHING — the activation
-- predicate is `orderId IS NOT NULL` precisely so that a wrong value here is a
-- wrong badge and never a dark wedding.
UPDATE "Event" SET "status" = 'PUBLISHED' WHERE "status" = 'DRAFT' AND "orderId" IS NOT NULL;

