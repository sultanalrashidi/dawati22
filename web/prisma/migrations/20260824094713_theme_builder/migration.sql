-- CreateEnum
CREATE TYPE "ThemeEngine" AS ENUM ('LEGACY', 'BUILDER');

-- CreateEnum
CREATE TYPE "ThemeOccasion" AS ENUM ('WEDDING', 'ENGAGEMENT', 'BIRTHDAY', 'BACHELORETTE');

-- CreateEnum
CREATE TYPE "ThemeVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ThemeFontSource" AS ENUM ('BUILTIN', 'GOOGLE');

-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "engine" "ThemeEngine" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "occasion" "ThemeOccasion" NOT NULL DEFAULT 'WEDDING',
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "visibility" "ThemeVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
-- `kind` and `slot` are the same concept (a role name for the image), so rename
-- in place rather than drop-and-add: any asset rows that already exist keep
-- their value, and the NOT NULL column arrives without needing an empty table.
ALTER TABLE "ThemeAsset" RENAME COLUMN "kind" TO "slot";
ALTER TABLE "ThemeAsset" ADD COLUMN     "blobPath" TEXT,
ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "ThemeVariant" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "colorTag" TEXT,
    "palette" JSONB NOT NULL,
    "layoutOverrides" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeLayout" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeTypography" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemeTypography_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeAssignment" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeFont" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT,
    "source" "ThemeFontSource" NOT NULL DEFAULT 'GOOGLE',
    "weights" TEXT NOT NULL DEFAULT '400,700',
    "subsets" TEXT NOT NULL DEFAULT 'arabic,latin',
    "cssVar" TEXT,
    "isArabic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeFont_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThemeVariant_themeId_idx" ON "ThemeVariant"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeVariant_themeId_slug_key" ON "ThemeVariant"("themeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeLayout_themeId_key" ON "ThemeLayout"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeTypography_themeId_key" ON "ThemeTypography"("themeId");

-- CreateIndex
CREATE INDEX "ThemeAssignment_userId_idx" ON "ThemeAssignment"("userId");

-- CreateIndex
CREATE INDEX "ThemeAssignment_themeId_idx" ON "ThemeAssignment"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeAssignment_themeId_userId_key" ON "ThemeAssignment"("themeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeFont_family_key" ON "ThemeFont"("family");

-- CreateIndex
CREATE INDEX "ThemeFont_isActive_sortOrder_idx" ON "ThemeFont"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Theme_engine_status_idx" ON "Theme"("engine", "status");

-- CreateIndex
CREATE INDEX "ThemeAsset_variantId_idx" ON "ThemeAsset"("variantId");

-- CreateIndex
CREATE INDEX "ThemeAsset_themeId_slot_idx" ON "ThemeAsset"("themeId", "slot");

-- AddForeignKey
ALTER TABLE "ThemeVariant" ADD CONSTRAINT "ThemeVariant_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeAsset" ADD CONSTRAINT "ThemeAsset_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ThemeVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeLayout" ADD CONSTRAINT "ThemeLayout_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeTypography" ADD CONSTRAINT "ThemeTypography_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeAssignment" ADD CONSTRAINT "ThemeAssignment_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeAssignment" ADD CONSTRAINT "ThemeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemeAssignment" ADD CONSTRAINT "ThemeAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
