-- CreateEnum
CREATE TYPE "BundlePricing" AS ENUM ('FIXED', 'SUM');

-- CreateEnum
CREATE TYPE "BundlePrinting" AS ENUM ('COMPONENTS', 'BUNDLE_ONLY');

-- CreateEnum
CREATE TYPE "BundleRole" AS ENUM ('PARENT', 'COMPONENT');

-- AlterTable
ALTER TABLE "DocumentLine" ADD COLUMN     "bundleGroup" TEXT,
ADD COLUMN     "bundleRole" "BundleRole";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "bundlePricing" "BundlePricing" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "bundlePrinting" "BundlePrinting" NOT NULL DEFAULT 'COMPONENTS',
ADD COLUMN     "isBundle" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleItem_bundleId_sortOrder_idx" ON "BundleItem"("bundleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BundleItem_bundleId_componentId_key" ON "BundleItem"("bundleId", "componentId");

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

