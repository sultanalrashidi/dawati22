-- The PIN door can finally write a log.
--
-- `gateStaffId` was NOT NULL with a required FK to GateStaff, and a door
-- opened with the shared gate PIN has no GateStaff row to point at — so
-- `performCheckIn` skipped the write entirely rather than fail the check-in.
-- Null now means exactly that: opened without a staff account.
ALTER TABLE "CheckInLog" ALTER COLUMN "gateStaffId" DROP NOT NULL;
