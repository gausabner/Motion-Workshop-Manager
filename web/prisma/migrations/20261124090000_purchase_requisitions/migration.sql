-- AlterEnum
ALTER TYPE "ShareKind" ADD VALUE 'QUOTATION_REQUEST';



-- AlterTable
ALTER TABLE "RequisitionLine" ADD COLUMN     "sourceLineId" TEXT;

-- CreateTable
CREATE TABLE "RequisitionIssueLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "requisitionLineId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "stockMovementId" TEXT,

    CONSTRAINT "RequisitionIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequisitionIssueLine_stockMovementId_key" ON "RequisitionIssueLine"("stockMovementId");

-- CreateIndex
CREATE INDEX "RequisitionIssueLine_requisitionLineId_idx" ON "RequisitionIssueLine"("requisitionLineId");

-- CreateIndex
CREATE INDEX "RequisitionIssueLine_issueId_idx" ON "RequisitionIssueLine"("issueId");

-- CreateIndex
CREATE INDEX "RequisitionLine_sourceLineId_idx" ON "RequisitionLine"("sourceLineId");

-- AddForeignKey
ALTER TABLE "RequisitionLine" ADD CONSTRAINT "RequisitionLine_sourceLineId_fkey" FOREIGN KEY ("sourceLineId") REFERENCES "RequisitionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssueLine" ADD CONSTRAINT "RequisitionIssueLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssueLine" ADD CONSTRAINT "RequisitionIssueLine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "RequisitionIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssueLine" ADD CONSTRAINT "RequisitionIssueLine_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "RequisitionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisitionIssueLine" ADD CONSTRAINT "RequisitionIssueLine_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Tenant isolation for the new table, as every tenant table has ──
ALTER TABLE "RequisitionIssueLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequisitionIssueLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RequisitionIssueLine"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));

-- ── Handovers already made: one line per ISSUE movement ──
-- Production migrates as a role that row-level security applies to, so the
-- rows are read and written one tenant at a time, under that tenant.
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT "id" FROM "Tenant" LOOP
        PERFORM set_config('motion.tenant_id', t, false);
        INSERT INTO "RequisitionIssueLine" ("id", "tenantId", "issueId", "requisitionLineId", "quantity", "unitCost", "stockMovementId")
        SELECT 'cmril' || substr(md5(m."id"), 1, 20), m."tenantId", m."requisitionIssueId", m."requisitionLineId", -m."quantity", m."unitCost", m."id"
        FROM "StockMovement" m
        WHERE m."tenantId" = t AND m."kind" = 'ISSUE' AND m."requisitionIssueId" IS NOT NULL AND m."requisitionLineId" IS NOT NULL;
    END LOOP;
    PERFORM set_config('motion.tenant_id', '', false);
END $$;
