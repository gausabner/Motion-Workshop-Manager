-- The vehicle's route through a council workshop, and the job card's
-- signatures (docs/fleet-job-flow-plan.md §4.3–4.4).
--
-- A route is a list of visits, each a stay in one place: reception, the check
-- bay, a workshop or bay. Moving a vehicle is a handover: the place it leaves
-- sends it, the next accepts it. Where it is now is the visit not yet left,
-- and there is never more than one. Signatures copy the signer's name, role
-- and pay number at that moment; a driver without a login is named, not linked.

-- CreateEnum
CREATE TYPE "VisitPurpose" AS ENUM ('INTAKE', 'ASSESSMENT', 'WORK', 'QUALITY_CHECK', 'RELEASE');

-- CreateEnum
CREATE TYPE "JobSignRole" AS ENUM ('RECEPTION', 'DRIVER', 'FOREMAN', 'FLEET_COORDINATOR', 'MECHANIC', 'INSPECTOR');

-- CreateEnum
CREATE TYPE "JobSignStage" AS ENUM ('ISSUE', 'ASSESSMENT', 'QUALITY_CHECK', 'COLLECTION');

-- CreateEnum
CREATE TYPE "JobSignDecision" AS ENUM ('SIGNED', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "JobVisit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "purpose" "VisitPurpose" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "leftAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "JobVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSignoff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stage" "JobSignStage" NOT NULL,
    "role" "JobSignRole" NOT NULL,
    "decision" "JobSignDecision" NOT NULL DEFAULT 'SIGNED',
    "membershipId" TEXT,
    "name" TEXT NOT NULL,
    "payNumber" TEXT,
    "comment" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobVisit_documentId_sentAt_idx" ON "JobVisit"("documentId", "sentAt");

-- CreateIndex
CREATE INDEX "JobVisit_tenantId_workshopId_leftAt_idx" ON "JobVisit"("tenantId", "workshopId", "leftAt");

-- CreateIndex
CREATE INDEX "JobSignoff_documentId_at_idx" ON "JobSignoff"("documentId", "at");

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSignoff" ADD CONSTRAINT "JobSignoff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSignoff" ADD CONSTRAINT "JobSignoff_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSignoff" ADD CONSTRAINT "JobSignoff_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One place at a time: a vehicle has at most one visit it has not left.
CREATE UNIQUE INDEX "JobVisit_one_open_per_job" ON "JobVisit"("documentId") WHERE "leftAt" IS NULL;

-- Nobody receives a vehicle without a time it was received. (The receiver
-- may later be cleared, if their membership is removed; the time stays.)
ALTER TABLE "JobVisit" ADD CONSTRAINT "JobVisit_received_has_time"
    CHECK (NOT ("receivedAt" IS NULL AND "receivedById" IS NOT NULL));

-- A pass or a fail belongs to a quality check, and only there.
ALTER TABLE "JobSignoff" ADD CONSTRAINT "JobSignoff_decision_stage"
    CHECK (("decision" = 'SIGNED') = ("stage" <> 'QUALITY_CHECK'));

-- Each workshop reads and writes only its own, as every tenant table does.
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['JobVisit', 'JobSignoff']
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
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
                EXECUTE format('GRANT SELECT ON %I TO motion_backup', t);
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            RAISE NOTICE 'not permitted to grant % to motion_backup', t;
        END;
    END LOOP;
END $$;
