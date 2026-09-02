-- ===========================================================================
-- Reverts prisma/migrations/*_women_invitation_content (LOCAL DEV ONLY).
--
-- Drops the columns and enums that migration added and removes the ""
-- defaults it put on the English-name / extra-text columns. Data typed into
-- the new columns is lost — that is the point of an undo.
--
-- After running it, also delete the migration's row so Prisma stops
-- considering it applied (the last statement does that).
-- ===========================================================================

ALTER TABLE "EventCouple"
  ALTER COLUMN "groomNameEn" DROP DEFAULT,
  ALTER COLUMN "brideNameEn" DROP DEFAULT;

ALTER TABLE "Event"
  ALTER COLUMN "groomNameEn" DROP DEFAULT,
  ALTER COLUMN "brideNameEn" DROP DEFAULT,
  ALTER COLUMN "invitationTextAr" DROP DEFAULT,
  DROP COLUMN "brideMotherAr",
  DROP COLUMN "closingAr",
  DROP COLUMN "coupleFormat",
  DROP COLUMN "groomMotherAr",
  DROP COLUMN "hostLineAr",
  DROP COLUMN "hostMode",
  DROP COLUMN "noteNoChildren",
  DROP COLUMN "noteNoPhotos",
  DROP COLUMN "noteShowPass",
  DROP COLUMN "openingKind";

DROP TYPE "CoupleFormat";
DROP TYPE "HostMode";
DROP TYPE "InvitationOpening";

DELETE FROM "_prisma_migrations" WHERE migration_name LIKE '%_women_invitation_content';
