-- ===========================================================================
-- Custom design requests: a customer asks the team for a design that is not
-- in the catalogue, and pays the fee only after they approve what came back.
--
-- RUN THIS FILE AS ONE BATCH. `prisma migrate deploy` wraps it in a
-- transaction; pasting it into the Neon SQL editor does not, so paste the
-- WHOLE file and run it once — never statement by statement.
--
-- ORDERING: migrate FIRST, deploy SECOND. Every statement here is additive
-- (one new enum pair, one new table, one column with a default), so the
-- currently-deployed build keeps working against the new schema for the
-- minutes in between. The reverse order does not work — the new build reads
-- `Order.kind`, which would not exist yet.
--
-- `Order.kind` defaults to INVITATIONS, which is what every existing row is:
-- design fees did not exist before this migration. That default is also what
-- keeps `listEligibleOrders` honest — it now filters on it, so a paid design
-- fee can never be spent as a free event.
-- ===========================================================================

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('INVITATIONS', 'CUSTOM_DESIGN');

-- CreateEnum
CREATE TYPE "DesignRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'READY', 'CHANGES_REQUESTED', 'APPROVED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "kind" "OrderKind" NOT NULL DEFAULT 'INVITATIONS';

-- CreateTable
CREATE TABLE "CustomDesignRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "DesignRequestStatus" NOT NULL DEFAULT 'NEW',
    "colorTags" TEXT[],
    "styleCategory" TEXT,
    "inspirationThemeId" TEXT,
    "notes" TEXT,
    "deliveredThemeId" TEXT,
    "deliveredById" TEXT,
    "priceSar" DECIMAL(10,2) NOT NULL,
    "orderId" TEXT,
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "revisionNote" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "CustomDesignRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomDesignRequest_reference_key" ON "CustomDesignRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDesignRequest_eventId_key" ON "CustomDesignRequest"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDesignRequest_orderId_key" ON "CustomDesignRequest"("orderId");

-- CreateIndex
CREATE INDEX "CustomDesignRequest_status_idx" ON "CustomDesignRequest"("status");

-- CreateIndex
CREATE INDEX "CustomDesignRequest_userId_idx" ON "CustomDesignRequest"("userId");

-- AddForeignKey
ALTER TABLE "CustomDesignRequest" ADD CONSTRAINT "CustomDesignRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDesignRequest" ADD CONSTRAINT "CustomDesignRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDesignRequest" ADD CONSTRAINT "CustomDesignRequest_inspirationThemeId_fkey" FOREIGN KEY ("inspirationThemeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDesignRequest" ADD CONSTRAINT "CustomDesignRequest_deliveredThemeId_fkey" FOREIGN KEY ("deliveredThemeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDesignRequest" ADD CONSTRAINT "CustomDesignRequest_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDesignRequest" ADD CONSTRAINT "CustomDesignRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

