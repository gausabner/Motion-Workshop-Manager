-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('SALE', 'CREDIT', 'PURCHASE', 'RETURN_TO_SUPPLIER', 'ADJUSTMENT', 'STOCKTAKE', 'OPENING', 'VOID_REVERSAL');

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "StockMovementKind" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "documentId" TEXT,
    "documentLineId" TEXT,
    "note" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_productId_at_idx" ON "StockMovement"("tenantId", "productId", "at");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_at_idx" ON "StockMovement"("tenantId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_documentLineId_kind_key" ON "StockMovement"("documentLineId", "kind");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_byId_fkey" FOREIGN KEY ("byId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

