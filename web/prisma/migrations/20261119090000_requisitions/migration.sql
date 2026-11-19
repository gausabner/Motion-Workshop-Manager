-- Requisitions: a council's request for supplies, signed off before anything
-- leaves the shelf or is ordered. Benchmarked on the paper "Requisition for
-- Supplies" (Prime Press 042021): a serial number, the department, the lines,
-- the job or vote it is charged to, and signatures from the requester, the
-- foreman, the divisional head and, on handover, stores and the receiver.
--
-- Approval is by assignment (RequisitionApprover), not by role, and each
-- signature is a row that copies the signer's name, role and pay number at the
-- moment of signing. What has been issued or ordered is read from the stock
-- movements and order lines that point at a requisition line, never stored.
--
-- The enum values are added here but not used until a later migration's code
-- runs, which is what lets ADD VALUE sit inside a migration's transaction.

-- CreateEnum
CREATE TYPE "RequisitionState" AS ENUM ('DRAFT', 'AWAITING_FOREMAN', 'AWAITING_HEAD', 'AWAITING_OVER_LIMIT', 'APPROVED', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequisitionStep" AS ENUM ('REQUESTED', 'FOREMAN', 'DIVISIONAL_HEAD', 'OVER_LIMIT');

-- CreateEnum
CREATE TYPE "RequisitionDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED', 'REJECTED', 'RAISED_BY_FOREMAN', 'CANCELLED');

-- AlterEnum
ALTER TYPE "SequenceKey" ADD VALUE 'REQUISITION';

-- AlterEnum
ALTER TYPE "StockMovementKind" ADD VALUE 'ISSUE';

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "payNumber" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "requisitionLineId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "requisitionIssueId" TEXT,
ADD COLUMN     "requisitionLineId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionApprover" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "step" "RequisitionStep" NOT NULL,
    "departmentId" TEXT,
    "membershipId" TEXT NOT NULL,
    "deputy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionApprover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT,
    "state" "RequisitionState" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT,
    "location" TEXT,
    "requestedById" TEXT NOT NULL,
    "requiredBy" DATE,
    "purpose" TEXT,
    "chargeDocumentId" TEXT,
    "chargeVoteId" TEXT,
    "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "RequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionSignoff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "step" "RequisitionStep" NOT NULL,
    "decision" "RequisitionDecision" NOT NULL,
    "membershipId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "payNumber" TEXT,
    "value" DECIMAL(12,2) NOT NULL,
    "comment" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisitionIssue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "receiverMembershipId" TEXT,
    "receiverName" TEXT NOT NULL,
    "receiverPayNumber" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_tenantId_code_key" ON "Vote"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RequisitionApprover_tenantId_membershipId_idx" ON "RequisitionApprover"("tenantId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionApprover_tenantId_step_departmentId_membershipId_key" ON "RequisitionApprover"("tenantId", "step", "departmentId", "membershipId");

-- CreateIndex
CREATE INDEX "Requisition_tenantId_state_createdAt_idx" ON "Requisition"("tenantId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "Requisition_tenantId_requestedById_idx" ON "Requisition"("tenantId", "requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_tenantId_number_key" ON "Requisition"("tenantId", "number");

-- CreateIndex
CREATE INDEX "RequisitionLine_requisitionId_sortOrder_idx" ON "RequisitionLine"("requisitionId", "sortOrder");

-- CreateIndex
CREATE INDEX "RequisitionSignoff_requisitionId_at_idx" ON "RequisitionSignoff"("requisitionId", "at");

-- CreateIndex
CREATE INDEX "RequisitionIssue_requisitionId_at_idx" ON "RequisitionIssue"("requisitionId", "at");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_requisitionLineId_idx" ON "PurchaseOrderLine"("requisitionLineId");

-- CreateIndex
CREATE INDEX "StockMovement_requisitionLineId_idx" ON "StockMovement"("requisitionLineId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "RequisitionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_requisitionIssueId_fkey" FOREIGN KEY ("requisitionIssueId") REFERENCES "RequisitionIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "RequisitionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionApprover" ADD CONSTRAINT "RequisitionApprover_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionApprover" ADD CONSTRAINT "RequisitionApprover_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionApprover" ADD CONSTRAINT "RequisitionApprover_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_chargeDocumentId_fkey" FOREIGN KEY ("chargeDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_chargeVoteId_fkey" FOREIGN KEY ("chargeVoteId") REFERENCES "Vote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionSignoff" ADD CONSTRAINT "RequisitionSignoff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionSignoff" ADD CONSTRAINT "RequisitionSignoff_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionSignoff" ADD CONSTRAINT "RequisitionSignoff_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssue" ADD CONSTRAINT "RequisitionIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssue" ADD CONSTRAINT "RequisitionIssue_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssue" ADD CONSTRAINT "RequisitionIssue_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssue" ADD CONSTRAINT "RequisitionIssue_receiverMembershipId_fkey" FOREIGN KEY ("receiverMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- What the application already refuses, refused again where nothing can go
-- round it.

-- A requisition is charged to a job card or to a vote, never both.
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_one_charge"
    CHECK (NOT ("chargeDocumentId" IS NOT NULL AND "chargeVoteId" IS NOT NULL));

-- A request for nothing, or for less than nothing, is not a request.
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_quantity_positive"
    CHECK ("quantity" > 0);

-- Nobody is assigned to "request": everybody may. A department-level step
-- names its department; the value-limit step is the council's, not a
-- department's.
ALTER TABLE "RequisitionApprover" ADD CONSTRAINT "RequisitionApprover_step_scope"
    CHECK ("step" <> 'REQUESTED' AND (("step" = 'OVER_LIMIT') = ("departmentId" IS NULL)));

-- The unique index above treats every null department as different, so the
-- same person could be assigned to the value limit twice. This closes it.
CREATE UNIQUE INDEX "RequisitionApprover_over_limit_once"
    ON "RequisitionApprover"("tenantId", "membershipId") WHERE "departmentId" IS NULL;

-- Each workshop reads and writes only its own, as every tenant table does.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['Department', 'Vote', 'RequisitionApprover', 'Requisition', 'RequisitionLine', 'RequisitionSignoff', 'RequisitionIssue']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I'
            ' USING ("tenantId" = NULLIF(current_setting(''motion.tenant_id'', true), ''''))'
            ' WITH CHECK ("tenantId" = NULLIF(current_setting(''motion.tenant_id'', true), ''''))', t);
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
                EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO motion_app', t);
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'not permitted to grant % to motion_app', t;
        END;
        -- Insurance: default privileges cover tables created by the migration
        -- role, not by anybody else (see 20261002060000).
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
                EXECUTE format('GRANT SELECT ON %I TO motion_backup', t);
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'not permitted to grant % to motion_backup', t;
        END;
    END LOOP;
END $$;
