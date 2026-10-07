-- Renewals: a subscription that knows what it is paid up to, a record of each
-- payment that moved it, and the read-only rule the terms promise.
--
-- The terms are the specification here. "You get a grace period. After it,
-- MOTION becomes read-only: you can still see everything, still print, still
-- export, still get your books out. You cannot raise new documents until the
-- account is settled." So `PAST_DUE` is not a closed door — it already keeps
-- `isActive` true — and the one thing it refuses is a new document. That
-- refusal is enforced below, in the database, for the same reason tenant
-- isolation is: there are six places in the application that create a
-- document, and a seventh will be added by somebody who has never read this.

-- ── What a subscription is paid up to ───────────────────────────────────────
ALTER TABLE "Subscription"
    ADD COLUMN "startedAt"        TIMESTAMP(3),
    ADD COLUMN "periodEndsAt"     TIMESTAMP(3),
    ADD COLUMN "remindedFor"      TIMESTAMP(3),
    ADD COLUMN "overdueNoticeFor" TIMESTAMP(3);

CREATE INDEX "Subscription_periodEndsAt_idx" ON "Subscription"("periodEndsAt");

-- ── The daily run acts as nobody in particular ──────────────────────────────
-- Marking a workshop read-only after its grace period is MOTION's rule applied
-- on a date, not a decision any member of staff took, and the trail should say
-- so rather than borrow somebody's name.
ALTER TABLE "PlatformAuditEvent" ALTER COLUMN "actorUserId" DROP NOT NULL;

-- ── Payments MOTION confirmed ───────────────────────────────────────────────
CREATE TABLE "SubscriptionPayment" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountExclVat"  DECIMAL(12,2) NOT NULL,
    "amountInclVat"  DECIMAL(12,2) NOT NULL,
    "periodFrom"     TIMESTAMP(3) NOT NULL,
    "periodTo"       TIMESTAMP(3) NOT NULL,
    "confirmedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById"  TEXT,
    "note"           TEXT,
    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionPayment_tenantId_confirmedAt_idx" ON "SubscriptionPayment"("tenantId", "confirmedAt");

ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A workshop reads its own payment history; staff read everyone's. The same
-- two policies as Subscription, side by side and separately named.
ALTER TABLE "SubscriptionPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubscriptionPayment"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));
CREATE POLICY platform_admin ON "SubscriptionPayment"
    USING (motion_is_platform_admin())
    WITH CHECK (motion_is_platform_admin());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "SubscriptionPayment" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
        GRANT SELECT ON "SubscriptionPayment" TO motion_backup;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_backup';
END $$;

-- ── Read-only means no new documents ────────────────────────────────────────
-- Everything else a past-due workshop does is allowed: editing, printing,
-- taking a payment against an invoice that already exists, exporting. Only a
-- new row in "Document" is refused, which is "raise new documents" exactly.
--
-- The application checks first and explains itself; this is what holds when
-- a path it did not think of — an import, an approval, an API call — tries.
CREATE OR REPLACE FUNCTION motion_refuse_document_when_past_due() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = NEW."tenantId" AND "status" = 'PAST_DUE') THEN
        RAISE EXCEPTION 'MOTION_READ_ONLY: this workshop''s MOTION subscription is overdue, so new documents are paused until it is paid.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER document_refused_when_past_due
    BEFORE INSERT ON "Document"
    FOR EACH ROW EXECUTE FUNCTION motion_refuse_document_when_past_due();

-- ── Dating what is already live ─────────────────────────────────────────────
-- A subscription confirmed before this migration has no period. Date it from
-- the moment staff approved it (the ACTIVATED entry in MOTION's own trail),
-- or failing that its last change, and give it the one period that payment
-- bought. Without this the live workshops would never be reminded and never
-- fall due — renewals would quietly not apply to the people already paying.
--
-- Both tables are FORCE RLS and this runs as their owner, so the staff flag is
-- set for the statement and put back after it.
SELECT set_config('motion.platform_admin', 'on', false);

UPDATE "Subscription" s
SET "startedAt" = coalesce(
        (SELECT min(e."createdAt") FROM "PlatformAuditEvent" e WHERE e."tenantId" = s."tenantId" AND e."action" = 'ACTIVATED'),
        s."updatedAt")
WHERE s."status" = 'ACTIVE' AND s."startedAt" IS NULL;

UPDATE "Subscription" s
SET "periodEndsAt" = s."startedAt" + CASE s."period"
        WHEN 'ANNUAL'    THEN interval '1 year'
        WHEN 'QUARTERLY' THEN interval '3 months'
        ELSE interval '1 month' END
WHERE s."status" = 'ACTIVE' AND s."periodEndsAt" IS NULL AND s."startedAt" IS NOT NULL;

SELECT set_config('motion.platform_admin', '', false);
