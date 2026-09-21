-- CreateEnum
CREATE TYPE "SerialState" AS ENUM ('IN_STOCK', 'SOLD', 'RETURNED', 'WRITTEN_OFF');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "warrantyMonths" INTEGER;

-- CreateTable
CREATE TABLE "SerialUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "state" "SerialState" NOT NULL DEFAULT 'IN_STOCK',
    "supplierInvoiceLineId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "documentLineId" TEXT,
    "soldAt" TIMESTAMP(3),
    "warrantyUntil" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SerialUnit_tenantId_serial_idx" ON "SerialUnit"("tenantId", "serial");

-- CreateIndex
CREATE INDEX "SerialUnit_tenantId_productId_state_idx" ON "SerialUnit"("tenantId", "productId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_tenantId_productId_serial_key" ON "SerialUnit"("tenantId", "productId", "serial");

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_supplierInvoiceLineId_fkey" FOREIGN KEY ("supplierInvoiceLineId") REFERENCES "SupplierInvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialUnit" ADD CONSTRAINT "SerialUnit_documentLineId_fkey" FOREIGN KEY ("documentLineId") REFERENCES "DocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

