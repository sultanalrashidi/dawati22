-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "gateLinkToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Event_gateLinkToken_key" ON "Event"("gateLinkToken");
