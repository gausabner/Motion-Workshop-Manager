-- CreateEnum
CREATE TYPE "StockTakeState" AS ENUM ('DRAFT', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockTake" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT,
    "state" "StockTakeState" NOT NULL DEFAULT 'DRAFT',
    "scope" JSONB NOT NULL DEFAULT '{}',
    "blind" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedById" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "StockTake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTakeLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "takeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expected" DECIMAL(12,2) NOT NULL,
    "counted" DECIMAL(12,2),
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "countedAt" TIMESTAMP(3),

    CONSTRAINT "StockTakeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTake_tenantId_state_startedAt_idx" ON "StockTake"("tenantId", "state", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockTake_tenantId_number_key" ON "StockTake"("tenantId", "number");

-- CreateIndex
CREATE INDEX "StockTakeLine_tenantId_takeId_idx" ON "StockTakeLine"("tenantId", "takeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTakeLine_takeId_productId_key" ON "StockTakeLine"("takeId", "productId");

-- AddForeignKey
ALTER TABLE "StockTake" ADD CONSTRAINT "StockTake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTake" ADD CONSTRAINT "StockTake_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTake" ADD CONSTRAINT "StockTake_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTakeLine" ADD CONSTRAINT "StockTakeLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTakeLine" ADD CONSTRAINT "StockTakeLine_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "StockTake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTakeLine" ADD CONSTRAINT "StockTakeLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

