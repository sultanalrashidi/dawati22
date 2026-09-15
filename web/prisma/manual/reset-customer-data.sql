-- ===========================================================================
-- RESET: removes every customer, order and event, and leaves the site ready
-- for its first real customer.
--
-- THIS CANNOT BE UNDONE. Take a Neon branch first (Branches → New branch) —
-- it is instant and free, and it is the only way back if this runs against the
-- wrong database.
--
-- RUN AS ONE BATCH. Paste the WHOLE file and run once. It is wrapped in a
-- transaction, so a failure part-way leaves the data exactly as it was.
--
-- DELETED
--   every account except the admin(s) and the two TEST numbers below —
--   customers and door staff
--   ALL orders, events, guests, invitations, RSVPs and check-ins — including
--   the test accounts' own: their accounts stay, their fake data does not
--   custom design requests, gate sessions, notifications, audit log, OTP codes
--
-- KEPT
--   the ADMIN account, INCLUDING its password — do not lose panel access
--   the two test accounts (+966500000004, +966500000006) — the on-screen-code
--   bypass numbers, kept so the panel switch still has accounts to work with
--   every design: themes, colours, artwork, layouts, typography, fonts
--   the price list (PricingRate) and the panel switches (AppSetting), which
--   include the price offer
--   the discount codes (DiscountCode). Their use counts start again from zero,
--   because uses are counted from paid orders and those go
--   the archived legacy plans, which are kept as a record of what was sold
--
-- NOT touched: files already uploaded to Blob storage. Theme artwork is still
-- in use; any event cover images become orphans, which costs a little storage
-- and nothing else.
-- ===========================================================================

BEGIN;

-- A design created by an account this script is about to delete would block
-- the delete anyway (Theme.createdById refuses it). Stop with a reason a human
-- can act on rather than a foreign-key error nobody can read.
DO $$
DECLARE orphaned int;
BEGIN
  SELECT count(*) INTO orphaned
    FROM "Theme" t JOIN "User" u ON u.id = t."createdById"
   WHERE u.role <> 'ADMIN';
  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'STOPPED: % design(s) were created by a non-admin account. Move them to the admin first, or they would be deleted with it.', orphaned;
  END IF;
END $$;

-- Deepest first: several of these relationships refuse a delete rather than
-- cascading, on purpose, so that nothing disappears by accident in ordinary use.
DELETE FROM "Rsvp";
DELETE FROM "CheckInLog";
DELETE FROM "Invitation";
DELETE FROM "Guest";
DELETE FROM "GateStaffAssignment";
DELETE FROM "GateStaff";
DELETE FROM "GateAccessSession";
DELETE FROM "GuestManagementRequest";
DELETE FROM "CustomDesignRequest";
DELETE FROM "ClientAssignedTheme";
DELETE FROM "EventCouple";
DELETE FROM "Event";
DELETE FROM "Order";

-- Private designs granted to a customer. The DESIGNS themselves stay; only the
-- grant goes, so a theme built for a test account is still there to publish or
-- hand to somebody real.
DELETE FROM "ThemeAssignment"
 WHERE "userId" IN (SELECT id FROM "User"
                     WHERE role <> 'ADMIN'
                       AND (phone IS NULL OR phone NOT IN ('+966500000004', '+966500000006')));

DELETE FROM "Notification";
DELETE FROM "AuditLog";
DELETE FROM "OtpCode";
-- Scoped to the accounts being removed: wiping every session would sign the
-- admin out of the panel mid-cleanup.
DELETE FROM "Session"
 WHERE "userId" IN (SELECT id FROM "User"
                     WHERE role <> 'ADMIN'
                       AND (phone IS NULL OR phone NOT IN ('+966500000004', '+966500000006')));

-- Everyone except the admin(s) and the two test numbers. Their fake orders and
-- events are already gone with everyone else's above; the accounts themselves
-- stay so the test-phone bypass still has something to sign in as.
DELETE FROM "User"
 WHERE role <> 'ADMIN'
   AND (phone IS NULL OR phone NOT IN ('+966500000004', '+966500000006'));

COMMIT;

-- What is left. Users should be your admin(s) plus the two test accounts;
-- designs and rates untouched.
SELECT 'users'    AS what, count(*) FROM "User"
UNION ALL SELECT 'admins',        count(*) FROM "User" WHERE role = 'ADMIN'
UNION ALL SELECT 'test accounts', count(*) FROM "User" WHERE phone IN ('+966500000004', '+966500000006')
UNION ALL SELECT 'events',        count(*) FROM "Event"
UNION ALL SELECT 'orders',        count(*) FROM "Order"
UNION ALL SELECT 'guests',        count(*) FROM "Guest"
UNION ALL SELECT 'designs',       count(*) FROM "Theme"
UNION ALL SELECT 'design colours',count(*) FROM "ThemeVariant"
UNION ALL SELECT 'price rows',    count(*) FROM "PricingRate"
UNION ALL SELECT 'panel switches',count(*) FROM "AppSetting";
