-- Invitations the owner grants by hand, on top of what the order bought.
--
-- A separate column rather than an edit to Order.invitationCount, which is the
-- figure Moyasar payments are reconciled against; and not a second order,
-- because Event.orderId is UNIQUE. Capacity becomes the sum of the two.
ALTER TABLE "Event" ADD COLUMN "extraInvitationCount" INTEGER NOT NULL DEFAULT 0;
