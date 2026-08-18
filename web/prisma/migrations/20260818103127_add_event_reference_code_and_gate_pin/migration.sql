-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "referenceCode" TEXT,
ADD COLUMN     "gatePinHash" TEXT,
ADD COLUMN     "gatePinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gatePinLockedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Event_referenceCode_key" ON "Event"("referenceCode");
