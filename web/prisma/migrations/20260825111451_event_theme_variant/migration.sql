-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "themeVariantId" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_themeVariantId_fkey" FOREIGN KEY ("themeVariantId") REFERENCES "ThemeVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
