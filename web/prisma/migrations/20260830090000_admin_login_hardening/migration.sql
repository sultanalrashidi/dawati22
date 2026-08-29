-- ===========================================================================
-- Private admin sign-in, and the switches that go with it.
--
-- RUN THIS FILE AS ONE BATCH — paste the WHOLE file into the Neon SQL editor
-- and run it once, never statement by statement.
--
-- ORDERING: migrate FIRST, deploy SECOND. Everything here is additive (one
-- table, two columns with defaults), so the currently-deployed build keeps
-- working against the new schema in between.
--
-- BREAK GLASS — if the admin password is ever forgotten, this puts the private
-- route back into "set a new password" mode, where the phone's SMS code is the
-- only way in and a new password must be set immediately:
--
--   UPDATE "User" SET "passwordHash" = NULL,
--                     "adminLoginFailedAttempts" = 0,
--                     "adminLoginLockedUntil" = NULL
--   WHERE role = 'ADMIN';
--
-- It needs database access AND the admin's phone, which is the point.
-- ===========================================================================

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminLoginFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "adminLoginLockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

