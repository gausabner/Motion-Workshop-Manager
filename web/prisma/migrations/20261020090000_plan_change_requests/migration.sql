-- Plan change requests: a workshop asking to move to another plan, and what
-- came of it. A move up is paid for first (one full period at the new price),
-- so the change is a request staff act on rather than a switch the owner flips.

CREATE TYPE "PlanChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "PlanChangeRequest" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromPlanId"     TEXT NOT NULL,
    "fromPlanName"   TEXT NOT NULL,
    "fromPrice"      DECIMAL(12,2) NOT NULL,
    "toPlanId"       TEXT NOT NULL,
    "toPlanName"     TEXT NOT NULL,
    "toPrice"        DECIMAL(12,2) NOT NULL,
    "amountExclVat"  DECIMAL(12,2) NOT NULL,
    "amountInclVat"  DECIMAL(12,2) NOT NULL,
    "status"         "PlanChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById"  TEXT,
    "requestedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById"    TEXT,
    "decidedAt"      TIMESTAMP(3),
    "declineReason"  TEXT,
    "paymentId"      TEXT,
    CONSTRAINT "PlanChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanChangeRequest_paymentId_key" ON "PlanChangeRequest"("paymentId");
CREATE INDEX "PlanChangeRequest_tenantId_requestedAt_idx" ON "PlanChangeRequest"("tenantId", "requestedAt");
CREATE INDEX "PlanChangeRequest_status_requestedAt_idx" ON "PlanChangeRequest"("status", "requestedAt");

-- One open request per workshop. Two tabs, or a double tap on the button,
-- must not leave staff two requests to reconcile against one payment.
CREATE UNIQUE INDEX "PlanChangeRequest_one_pending_per_tenant"
    ON "PlanChangeRequest"("tenantId") WHERE "status" = 'PENDING';

ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "PlanChangeRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "PlanChangeRequest_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "PlanChangeRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "PlanChangeRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanChangeRequest" ADD CONSTRAINT "PlanChangeRequest_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A workshop reads and makes its own requests; staff read and decide
-- everyone's. The same two policies as the other billing tables.
ALTER TABLE "PlanChangeRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanChangeRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PlanChangeRequest"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));
CREATE POLICY platform_admin ON "PlanChangeRequest"
    USING (motion_is_platform_admin())
    WITH CHECK (motion_is_platform_admin());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "PlanChangeRequest" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
        GRANT SELECT ON "PlanChangeRequest" TO motion_backup;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_backup';
END $$;
