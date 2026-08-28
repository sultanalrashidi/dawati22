-- Re-runnable backfill for orders written during the migrate -> deploy gap.
--
-- The per_invitation_pricing migration snapshots invitationCount/tier onto every
-- order that existed WHEN IT RAN. Orders taken by the still-live old build in
-- the minutes between that migration and the deploy have no snapshot, because
-- the old createOrder never wrote one.
--
-- Nothing breaks in the meantime: orderTerms() falls back to the order's plan
-- for exactly these rows. This just turns the fallback into a real snapshot, so
-- their capacity stops depending on a Plan row anyone could still edit.
--
-- Safe to run any number of times, and safe to run while the site is live: the
-- WHERE clause makes it a no-op once there is nothing left to fix.
--
-- Run it once after deploying, then check it reports 0 rows.

UPDATE "Order" o
SET "invitationCount" = p."invitationCount",
    "tier" = 'WITH_QR'
FROM "Plan" p
WHERE o."planId" = p."id"
  AND o."invitationCount" IS NULL;

-- Should return zero rows. Anything listed here is an order with neither a
-- snapshot nor a plan to fall back on, and its event would have no capacity.
SELECT "id", "userId", "status", "amount", "createdAt"
FROM "Order"
WHERE "invitationCount" IS NULL
  AND "planId" IS NULL;
