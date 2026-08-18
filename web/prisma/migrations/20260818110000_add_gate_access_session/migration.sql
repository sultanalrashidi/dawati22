-- CreateTable
CREATE TABLE "GateAccessSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GateAccessSession_tokenHash_key" ON "GateAccessSession"("tokenHash");

-- CreateIndex
CREATE INDEX "GateAccessSession_eventId_idx" ON "GateAccessSession"("eventId");

-- AddForeignKey
ALTER TABLE "GateAccessSession" ADD CONSTRAINT "GateAccessSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
