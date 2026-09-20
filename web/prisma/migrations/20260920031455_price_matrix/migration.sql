-- CreateEnum
CREATE TYPE "MatrixBasis" AS ENUM ('MARKUP', 'MARGIN');

-- CreateEnum
CREATE TYPE "PriceRounding" AS ENUM ('NONE', 'WHOLE', 'NEAREST_5', 'NEAREST_10', 'ENDS_99');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceMatrixId" TEXT;

-- CreateTable
CREATE TABLE "PriceMatrix" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" "MatrixBasis" NOT NULL DEFAULT 'MARKUP',
    "rounding" "PriceRounding" NOT NULL DEFAULT 'NONE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceMatrixBand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "costFrom" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costTo" DECIMAL(12,2),
    "percent" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "PriceMatrixBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceMatrix_tenantId_name_key" ON "PriceMatrix"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PriceMatrixBand_matrixId_costFrom_idx" ON "PriceMatrixBand"("matrixId", "costFrom");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_priceMatrixId_fkey" FOREIGN KEY ("priceMatrixId") REFERENCES "PriceMatrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatrix" ADD CONSTRAINT "PriceMatrix_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatrixBand" ADD CONSTRAINT "PriceMatrixBand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatrixBand" ADD CONSTRAINT "PriceMatrixBand_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "PriceMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

