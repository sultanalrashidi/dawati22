-- ===========================================================================
-- Per-invitation pricing.
--
-- RUN THIS FILE AS ONE BATCH. `prisma migrate deploy` wraps it in a
-- transaction; pasting it into the Neon SQL editor does not, so paste the
-- WHOLE file and run it once — never statement by statement. If it dies
-- part-way, the two data statements at the bottom (the backfill and the rate
-- seed) are both safe to run again on their own: the backfill is guarded by
-- `invitationCount IS NULL` and the seed by `ON CONFLICT DO NOTHING`.
--
-- ORDERING: migrate FIRST, deploy SECOND. Every statement here is additive, so
-- the currently-deployed build keeps working against the new schema. The
-- reverse order does not work — the new build reads columns that would not
-- exist yet.
--
-- The gap between the two is real: for those minutes the old build keeps
-- writing plan-only orders that this backfill has already run past. Those rows
-- are handled — orderTerms() falls back to the plan's own invitationCount — and
-- prisma/manual/backfill-order-terms.sql converts them into proper snapshots
-- whenever you get round to it.
-- ===========================================================================

-- CreateEnum
CREATE TYPE "InvitationTier" AS ENUM ('NO_QR', 'WITH_QR');

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_planId_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "hasQr" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "invitationCount" INTEGER,
ADD COLUMN     "tier" "InvitationTier",
ADD COLUMN     "unitPrice" DECIMAL(10,2),
ALTER COLUMN "planId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PricingRate" (
    "id" TEXT NOT NULL,
    "tier" "InvitationTier" NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingRate_tier_key" ON "PricingRate"("tier");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill. This is NOT optional and must not be split into a later migration.
--
-- Capacity used to be read live through Order -> Plan. The code that replaces
-- that read falls back to 0 rather than undefined, because `guests >= undefined`
-- is false in JS -- i.e. an unbackfilled row would stop enforcing capacity
-- ENTIRELY and silently, and every live event would accept unlimited guests.
-- Freezing the count here is what makes the new read safe.
--
-- unitPrice stays NULL on these rows on purpose: they were sold as a bundle,
-- not per invitation, so `amount` is the only honest price for them.
-- ---------------------------------------------------------------------------
UPDATE "Order" o
SET "invitationCount" = p."invitationCount",
    "tier" = 'WITH_QR'
FROM "Plan" p
WHERE o."planId" = p."id"
  AND o."invitationCount" IS NULL;

-- Every event that already exists was sold with a QR; the column default says
-- the same thing, this is belt-and-braces for rows created mid-migration.
UPDATE "Event" SET "hasQr" = true WHERE "hasQr" IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- The live price list. Must exist BEFORE the new plans page deploys -- without
-- these two rows that page has no prices to show.
-- ---------------------------------------------------------------------------
INSERT INTO "PricingRate" ("id", "tier", "unitPrice", "currency", "updatedAt")
VALUES
  ('rate_with_qr_default', 'WITH_QR', 3.00, 'SAR', NOW()),
  ('rate_no_qr_default',   'NO_QR',   2.00, 'SAR', NOW())
ON CONFLICT ("tier") DO NOTHING;
