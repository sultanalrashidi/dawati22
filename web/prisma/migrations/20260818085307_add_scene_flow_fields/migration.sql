-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "brideFamilyAr" TEXT,
ADD COLUMN     "brideNameAr" TEXT,
ADD COLUMN     "familiesGreetingAr" TEXT,
ADD COLUMN     "groomFamilyAr" TEXT,
ADD COLUMN     "groomNameAr" TEXT,
ADD COLUMN     "notesAr" TEXT,
ADD COLUMN     "scheduleItems" JSONB;

-- AlterTable
ALTER TABLE "Rsvp" ADD COLUMN     "guestNameAr" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ADD COLUMN     "messageAr" TEXT,
ADD COLUMN     "partySize" INTEGER;
