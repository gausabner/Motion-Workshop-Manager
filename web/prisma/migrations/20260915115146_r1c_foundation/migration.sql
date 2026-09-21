-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('DRAFT', 'PROCESSED', 'VOID');

-- AlterEnum
ALTER TYPE "DocumentState" ADD VALUE 'CLOSED';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_methodId_fkey";

-- DropIndex
DROP INDEX "Payment_tenantId_customerId_receivedAt_idx";

-- DropIndex
DROP INDEX "Payment_tenantId_status_idx";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "amountPaid",
ADD COLUMN     "discountApplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rounding" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxName" TEXT NOT NULL DEFAULT 'VAT',
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
ADD COLUMN     "unroundedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DocumentLine" ADD COLUMN     "hours" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "methodId",
DROP COLUMN "proofAttachmentId",
DROP COLUMN "receiptNumber",
DROP COLUMN "receivedAt",
DROP COLUMN "reference",
DROP COLUMN "status",
ADD COLUMN     "number" TEXT,
ADD COLUMN     "postDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "state" "PaymentState" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "extras" JSONB NOT NULL DEFAULT '{}';

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "PaymentTender" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "proofAttachmentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentTender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "syncState" TEXT NOT NULL DEFAULT 'SYNCED',
    "syncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentTender_paymentId_idx" ON "PaymentTender"("paymentId");

-- CreateIndex
CREATE INDEX "ExternalRef_tenantId_provider_externalId_idx" ON "ExternalRef"("tenantId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_tenantId_provider_entityType_entityId_key" ON "ExternalRef"("tenantId", "provider", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_customerId_postDate_idx" ON "Payment"("tenantId", "customerId", "postDate");

-- CreateIndex
CREATE INDEX "Payment_tenantId_state_idx" ON "Payment"("tenantId", "state");

-- AddForeignKey
ALTER TABLE "PaymentTender" ADD CONSTRAINT "PaymentTender_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTender" ADD CONSTRAINT "PaymentTender_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTender" ADD CONSTRAINT "PaymentTender_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRef" ADD CONSTRAINT "ExternalRef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── R1c backfill ───────────────────────────────────────────────────────────
-- Every existing document was calculated with its tenant's current tax settings,
-- so that is exactly what its snapshot must record.
UPDATE "Document" d
SET "taxName" = t."taxName",
    "taxRate" = t."salesTaxRate",
    "pricesIncludeTax" = t."pricesIncludeTax"
FROM "Tenant" t
WHERE d."tenantId" = t."id";

-- Rounding was never applied before R1c, so the stored total is the unrounded total.
UPDATE "Document" SET "unroundedTotal" = "total";
