-- CreateEnum
CREATE TYPE "InspectionState" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'REFUSED', 'FINALISED');

-- AlterEnum
ALTER TYPE "SequenceKey" ADD VALUE 'INSPECTION';

-- AlterEnum
ALTER TYPE "ShareKind" ADD VALUE 'INSPECTION';

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "inputLabels" JSONB NOT NULL DEFAULT '[]',
    "productId" TEXT,

    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT,
    "state" "InspectionState" NOT NULL DEFAULT 'DRAFT',
    "documentId" TEXT,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "templateId" TEXT,
    "mechanicId" TEXT,
    "description" TEXT,
    "odometer" INTEGER,
    "requestedAt" TIMESTAMP(3),
    "customerViewedAt" TIMESTAMP(3),
    "customerComments" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "group" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "inputLabels" JSONB NOT NULL DEFAULT '[]',
    "input1" TEXT,
    "input2" TEXT,
    "input3" TEXT,
    "input4" TEXT,
    "comment" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "soon" BOOLEAN NOT NULL DEFAULT false,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "estimate" DECIMAL(12,2),
    "productId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "declinedAt" TIMESTAMP(3),
    "documentLineId" TEXT,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplate_tenantId_name_key" ON "InspectionTemplate"("tenantId", "name");

-- CreateIndex
CREATE INDEX "InspectionTemplateItem_templateId_ordering_idx" ON "InspectionTemplateItem"("templateId", "ordering");

-- CreateIndex
CREATE INDEX "Inspection_tenantId_state_idx" ON "Inspection"("tenantId", "state");

-- CreateIndex
CREATE INDEX "Inspection_documentId_idx" ON "Inspection"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionItem_documentLineId_key" ON "InspectionItem"("documentLineId");

-- CreateIndex
CREATE INDEX "InspectionItem_inspectionId_ordering_idx" ON "InspectionItem"("inspectionId", "ordering");

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_documentLineId_fkey" FOREIGN KEY ("documentLineId") REFERENCES "DocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

