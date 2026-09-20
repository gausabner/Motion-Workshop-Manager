-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "supplierInvoiceLineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_supplierInvoiceLineId_key" ON "StockMovement"("supplierInvoiceLineId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierInvoiceLineId_fkey" FOREIGN KEY ("supplierInvoiceLineId") REFERENCES "SupplierInvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

