-- Retire the three fixed packages. Run this AFTER the new pricing page is live.
--
-- Order matters. The old /plans page selects `WHERE status = 'ACTIVE'`, so
-- running this BEFORE the deploy would leave the live pricing page showing
-- "no data" for the minutes in between. The new page does not read this table
-- at all, so once it is deployed the rows are already invisible to customers
-- and this is only tidying.
--
-- The rows themselves are kept forever: they are the only record of what an old
-- order bought, the Order -> Plan foreign key is ON DELETE RESTRICT, and the
-- admin's pricing screen lists them read-only under "legacy packages".
-- Do not DELETE them.

UPDATE "Plan" SET "status" = 'ARCHIVED' WHERE "status" = 'ACTIVE';

-- Sanity: every remaining ACTIVE plan should be gone, and every paid order
-- should still resolve to a capacity.
SELECT "nameAr", "status" FROM "Plan" ORDER BY "sortOrder";
SELECT count(*) AS orders_without_capacity
FROM "Order"
WHERE "invitationCount" IS NULL AND "planId" IS NULL;
