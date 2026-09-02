-- ===========================================================================
-- Women's-section invitation content: opening, host line (the two mothers),
-- couple-name format, closing line, standard note toggles.
--
-- ORDERING: migrate FIRST, deploy SECOND. Everything here is additive — three
-- enums, nullable/defaulted columns, and "" defaults on the English names so
-- they can be left blank — so the currently-deployed build keeps working
-- against the new schema in between. No existing row changes value.
--
-- Undo (local only): prisma/manual/women_invitation_content_down.sql
-- ===========================================================================

-- CreateEnum
CREATE TYPE "InvitationOpening" AS ENUM ('VERSE', 'DUA', 'BASMALA', 'NONE');

-- CreateEnum
CREATE TYPE "HostMode" AS ENUM ('TEMPLATE', 'FREE');

-- CreateEnum
CREATE TYPE "CoupleFormat" AS ENUM ('ALA', 'WAW', 'BRIDE_FOCUS');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "brideMotherAr" TEXT,
ADD COLUMN     "closingAr" TEXT,
ADD COLUMN     "coupleFormat" "CoupleFormat" NOT NULL DEFAULT 'ALA',
ADD COLUMN     "groomMotherAr" TEXT,
ADD COLUMN     "hostLineAr" TEXT,
ADD COLUMN     "hostMode" "HostMode" NOT NULL DEFAULT 'TEMPLATE',
ADD COLUMN     "noteNoChildren" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noteNoPhotos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noteShowPass" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openingKind" "InvitationOpening" NOT NULL DEFAULT 'VERSE',
ALTER COLUMN "groomNameEn" SET DEFAULT '',
ALTER COLUMN "brideNameEn" SET DEFAULT '',
ALTER COLUMN "invitationTextAr" SET DEFAULT '';

-- AlterTable
ALTER TABLE "EventCouple" ALTER COLUMN "groomNameEn" SET DEFAULT '',
ALTER COLUMN "brideNameEn" SET DEFAULT '';
