-- Who works at each workshop or bay besides its foremen, and who works on a
-- job during each stay at one.


-- CreateTable
CREATE TABLE "WorkshopStaff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "role" "Designation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "VisitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopStaff_tenantId_membershipId_idx" ON "WorkshopStaff"("tenantId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopStaff_tenantId_workshopId_membershipId_key" ON "WorkshopStaff"("tenantId", "workshopId", "membershipId");

-- CreateIndex
CREATE INDEX "VisitAssignment_visitId_assignedAt_idx" ON "VisitAssignment"("visitId", "assignedAt");

-- CreateIndex
CREATE INDEX "VisitAssignment_tenantId_membershipId_removedAt_idx" ON "VisitAssignment"("tenantId", "membershipId", "removedAt");

-- AddForeignKey
ALTER TABLE "WorkshopStaff" ADD CONSTRAINT "WorkshopStaff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStaff" ADD CONSTRAINT "WorkshopStaff_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStaff" ADD CONSTRAINT "WorkshopStaff_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "JobVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitAssignment" ADD CONSTRAINT "VisitAssignment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One live assignment per person per stay; ended ones stay as history.
CREATE UNIQUE INDEX "VisitAssignment_one_live" ON "VisitAssignment"("visitId", "membershipId") WHERE "removedAt" IS NULL;

-- ── Row-level security, as every tenant table ──
ALTER TABLE "WorkshopStaff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkshopStaff" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WorkshopStaff"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));

ALTER TABLE "VisitAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VisitAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "VisitAssignment"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));
