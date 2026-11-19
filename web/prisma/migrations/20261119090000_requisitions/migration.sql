-- Requisitions, and the organisation and workshop they belong to.
--
-- A council's request for supplies, signed off before anything leaves the
-- shelf or is ordered. Benchmarked on the paper "Requisition for Supplies"
-- (Prime Press 042021) and the owner's job flow brief of 19 November 2026; the
-- plans are docs/requisitions-plan.md and docs/fleet-job-flow-plan.md.
--
-- Two lists, deliberately apart:
--   the organisation (OrgUnit, one or two levels named by the council, with
--   its votes) owns the vehicles and pays;
--   the workshop (Workshop, with a kind) is where a vehicle is.
-- Who may sign is an appointment (SigningAuthority): a foreman to a workshop,
-- a division head or fleet coordinator to a unit of the organisation, the
-- over-limit approver to the council.
--
-- Two kinds of requisition: a stores requisition issued from stock, and a
-- purchase requisition approved against a chosen quotation. Every signature is
-- a row that copies the signer's name, role and pay number at that moment.
-- What has been issued or ordered is read from stock movements and order lines
-- that point at a requisition line, never stored.

-- New values for existing types. IF NOT EXISTS, so a database that met an
-- earlier draft of this migration (one developer's, never production's)
-- applies it as cleanly as one that never did. They are not used until later
-- statements' code runs, which is what lets ADD VALUE sit in a transaction.
ALTER TYPE "SequenceKey" ADD VALUE IF NOT EXISTS 'REQUISITION';
ALTER TYPE "StockMovementKind" ADD VALUE IF NOT EXISTS 'ISSUE';

-- CreateEnum
CREATE TYPE "RequisitionKind" AS ENUM ('STORES', 'PURCHASE');

-- CreateEnum
CREATE TYPE "RequisitionState" AS ENUM ('DRAFT', 'AWAITING_FOREMAN', 'AWAITING_HEAD', 'AWAITING_OVER_LIMIT', 'APPROVED', 'AWAITING_FINALISE', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequisitionStep" AS ENUM ('REQUESTED', 'FOREMAN', 'DIVISIONAL_HEAD', 'OVER_LIMIT', 'PAYER', 'FINAL_FOREMAN', 'FINAL_FLEET_COORDINATOR', 'FINAL_DIVISIONAL_HEAD', 'FINAL_FITTER');

-- CreateEnum
CREATE TYPE "RequisitionDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'RETURNED', 'REJECTED', 'RAISED_BY_FOREMAN', 'CANCELLED', 'WITNESSED', 'SIGNED');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('RECEPTION', 'FOREMAN', 'FLEET_COORDINATOR', 'MECHANIC', 'ARTISAN', 'INTERN', 'PARTS_DRIVER', 'STOREMAN', 'DIVISION_HEAD');

-- CreateEnum
CREATE TYPE "WorkshopKind" AS ENUM ('RECEPTION', 'CHECK_BAY', 'WORKSHOP', 'BAY');

-- CreateEnum
CREATE TYPE "AuthorityKind" AS ENUM ('FOREMAN', 'DIVISION_HEAD', 'FLEET_COORDINATOR', 'OVER_LIMIT');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "designations" "Designation"[] DEFAULT ARRAY[]::"Designation"[],
ADD COLUMN     "payNumber" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "requisitionLineId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "requisitionIssueId" TEXT,
ADD COLUMN     "requisitionLineId" TEXT;

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WorkshopKind" NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningAuthority" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "AuthorityKind" NOT NULL,
    "workshopId" TEXT,
    "orgUnitId" TEXT,
    "membershipId" TEXT NOT NULL,
    "deputy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT,
    "kind" "RequisitionKind" NOT NULL DEFAULT 'STORES',
    "state" "RequisitionState" NOT NULL DEFAULT 'DRAFT',
    "workshopId" TEXT,
    "location" TEXT,
    "requestedById" TEXT NOT NULL,
    "requiredBy" DATE,
    "purpose" TEXT,
    "chargeDocumentId" TEXT,
    "chargeVoteId" TEXT,
    "sourceRequisitionId" TEXT,
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
CREATE TABLE "RequisitionQuote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "validUntil" DATE,
    "obtainedById" TEXT NOT NULL,
    "chosen" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequisitionQuote_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "OrgUnit_tenantId_parentId_idx" ON "OrgUnit"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_tenantId_parentId_name_key" ON "OrgUnit"("tenantId", "parentId", "name");

-- CreateIndex
CREATE INDEX "Vote_tenantId_orgUnitId_idx" ON "Vote"("tenantId", "orgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_tenantId_code_key" ON "Vote"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Workshop_tenantId_name_key" ON "Workshop"("tenantId", "name");

-- CreateIndex
CREATE INDEX "SigningAuthority_tenantId_membershipId_idx" ON "SigningAuthority"("tenantId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "SigningAuthority_tenantId_kind_workshopId_orgUnitId_members_key" ON "SigningAuthority"("tenantId", "kind", "workshopId", "orgUnitId", "membershipId");

-- CreateIndex
CREATE INDEX "Requisition_tenantId_state_createdAt_idx" ON "Requisition"("tenantId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "Requisition_tenantId_requestedById_idx" ON "Requisition"("tenantId", "requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "Requisition_tenantId_number_key" ON "Requisition"("tenantId", "number");

-- CreateIndex
CREATE INDEX "RequisitionQuote_requisitionId_idx" ON "RequisitionQuote"("requisitionId");

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
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningAuthority" ADD CONSTRAINT "SigningAuthority_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningAuthority" ADD CONSTRAINT "SigningAuthority_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningAuthority" ADD CONSTRAINT "SigningAuthority_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningAuthority" ADD CONSTRAINT "SigningAuthority_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_chargeDocumentId_fkey" FOREIGN KEY ("chargeDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_chargeVoteId_fkey" FOREIGN KEY ("chargeVoteId") REFERENCES "Vote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_sourceRequisitionId_fkey" FOREIGN KEY ("sourceRequisitionId") REFERENCES "Requisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionQuote" ADD CONSTRAINT "RequisitionQuote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionQuote" ADD CONSTRAINT "RequisitionQuote_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionQuote" ADD CONSTRAINT "RequisitionQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionQuote" ADD CONSTRAINT "RequisitionQuote_obtainedById_fkey" FOREIGN KEY ("obtainedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- Only a purchase requisition is split from another.
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_split_is_purchase"
    CHECK ("sourceRequisitionId" IS NULL OR "kind" = 'PURCHASE');

-- A request for nothing, or for less than nothing, is not a request.
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_quantity_positive"
    CHECK ("quantity" > 0);

-- A quotation for nothing is not a price.
ALTER TABLE "RequisitionQuote" ADD CONSTRAINT "RequisitionQuote_amount_positive"
    CHECK ("amount" > 0);

-- One chosen quotation per requisition: the approvers approve one price.
CREATE UNIQUE INDEX "RequisitionQuote_one_chosen"
    ON "RequisitionQuote"("requisitionId") WHERE "chosen";

-- A foreman is appointed to a workshop; a division head or fleet coordinator
-- to a unit of the organisation; the over-limit approver to neither.
ALTER TABLE "SigningAuthority" ADD CONSTRAINT "SigningAuthority_scope"
    CHECK (
        ("kind" = 'FOREMAN' AND "workshopId" IS NOT NULL AND "orgUnitId" IS NULL)
        OR ("kind" IN ('DIVISION_HEAD', 'FLEET_COORDINATOR') AND "orgUnitId" IS NOT NULL AND "workshopId" IS NULL)
        OR ("kind" = 'OVER_LIMIT' AND "workshopId" IS NULL AND "orgUnitId" IS NULL)
    );

-- The unique index above treats nulls as different, so these close the gaps:
-- the same person appointed twice to the same unit, workshop or limit.
CREATE UNIQUE INDEX "SigningAuthority_once_per_unit"
    ON "SigningAuthority"("tenantId", "kind", "orgUnitId", "membershipId") WHERE "orgUnitId" IS NOT NULL;
CREATE UNIQUE INDEX "SigningAuthority_once_per_workshop"
    ON "SigningAuthority"("tenantId", "kind", "workshopId", "membershipId") WHERE "workshopId" IS NOT NULL;
CREATE UNIQUE INDEX "SigningAuthority_over_limit_once"
    ON "SigningAuthority"("tenantId", "membershipId") WHERE "kind" = 'OVER_LIMIT';

-- Two top-level units with one name would be one division answering to two
-- rows. The unique index above cannot see it, because the parent is null.
CREATE UNIQUE INDEX "OrgUnit_top_level_name"
    ON "OrgUnit"("tenantId", "name") WHERE "parentId" IS NULL;

-- Each workshop reads and writes only its own, as every tenant table does.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['OrgUnit', 'Vote', 'Workshop', 'SigningAuthority', 'Requisition', 'RequisitionLine', 'RequisitionQuote', 'RequisitionSignoff', 'RequisitionIssue']
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
