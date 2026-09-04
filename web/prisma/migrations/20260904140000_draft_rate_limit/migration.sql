-- CreateTable
CREATE TABLE "DraftCreationAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftCreationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftCreationAttempt_ipHash_createdAt_idx" ON "DraftCreationAttempt"("ipHash", "createdAt");

