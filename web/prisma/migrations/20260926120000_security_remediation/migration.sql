-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "signupGrantExpiresAt" TIMESTAMP(3),
ADD COLUMN     "signupGrantHash" TEXT,
ADD COLUMN     "signupGrantUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "OtpCode_signupGrantHash_key" ON "OtpCode"("signupGrantHash");

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminEnrollmentExpiresAt" TIMESTAMP(3),
ADD COLUMN     "adminEnrollmentHash" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountReservedUntil" TIMESTAMP(3);
