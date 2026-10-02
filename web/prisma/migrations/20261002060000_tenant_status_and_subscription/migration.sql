-- Registering stops being the same thing as being allowed in.
--
-- Until now a stranger could reach /register, create a workshop, and be inside
-- the dashboard before anybody had asked them for money. That was not a bug in
-- any one file — nothing in the product had an opinion about billing. This is
-- where that opinion starts.
--
-- Two things are deliberately not done the obvious way.
--
-- **`isActive` is kept, and derived.** Eight places already ask "is this
-- workshop allowed in?" and every one of them reads that boolean: session
-- resolution, the customer portal, public booking, public inspections, team
-- invitations, the sites list and the password reset. Replacing them all with
-- an enum comparison would be eight chances to miss one, and a missed one is a
-- tenant boundary that silently stops being enforced. So the boolean stays and
-- a trigger keeps it true to the status — in the database, because a rule
-- maintained by application code is a rule that holds until the first script
-- that writes around it.
--
-- **PAST_DUE is still active.** The terms of service already promise it:
-- "After it, MOTION becomes read-only: you can still see everything, still
-- print, still export, still get your books out", and "we do not lock a
-- workshop out of its own floor". So an unpaid renewal must not close the door,
-- and the write refusal lives above the database rather than here. The terms
-- are the specification; this follows them.
CREATE TYPE "TenantStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('AWAITING_PAYMENT', 'ACTIVE', 'CANCELLED');

-- The default is the locked state, not the open one. A caller that forgets to
-- set this should fail to let somebody in, rather than quietly give the
-- product away — which is the exact failure being fixed.
ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';

-- Backfill from the boolean that has been carrying this meaning all along, so
-- every workshop trading today keeps trading. Run before the trigger exists;
-- adding a column with a default does not fire row triggers, and this UPDATE
-- would be the first thing that did.
UPDATE "Tenant"
SET "status" = CASE WHEN "isActive" THEN 'ACTIVE'::"TenantStatus" ELSE 'SUSPENDED'::"TenantStatus" END;

CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- The derivation, in one place.
--
-- PENDING_PAYMENT is false rather than true-with-a-banner on purpose: a
-- workshop that has not paid has no data worth protecting yet, and routing it
-- to the activation page is the application's job, done before this boolean is
-- consulted. SUSPENDED and CANCELLED are false because they should be
-- indistinguishable from not existing.
CREATE OR REPLACE FUNCTION motion_tenant_is_active() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW."isActive" := NEW."status" IN ('ACTIVE', 'PAST_DUE');
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION motion_tenant_is_active() IS
    'Keeps Tenant."isActive" true to Tenant."status". Writing isActive directly has no effect.';

CREATE TRIGGER tenant_is_active_from_status
    BEFORE INSERT OR UPDATE ON "Tenant"
    FOR EACH ROW EXECUTE FUNCTION motion_tenant_is_active();

-- ── what a workshop agreed to pay ───────────────────────────────────────────
--
-- The plan catalogue is not here. `lib/pricing/plans.ts` is already the single
-- source for the pricing page, a proposal and the sentence a salesperson says
-- out loud, and a second copy in the database is how a tier comes to read
-- differently in two places.
--
-- What is stored is the deal: the plan's name and its price as they stood on
-- the day somebody agreed to them. A row that re-read today's price list would
-- silently rewrite what a customer signed up for every time the list changed —
-- the same reason tax is snapshotted onto a document instead of recalculated
-- from current settings.
CREATE TABLE "Subscription" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "planId"      TEXT NOT NULL,
    "planName"    TEXT NOT NULL,
    -- Excluding VAT, as published. The 15 % is applied where the figure is
    -- shown, from a rate that is not the one a workshop sets for its own
    -- invoices.
    "priceAmount" DECIMAL(12,2) NOT NULL,
    "currency"    TEXT NOT NULL DEFAULT 'NAD',
    "period"      "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "status"      "SubscriptionStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    -- What the customer types into the bank, and the only thing joining a line
    -- on a statement to a row here. Unique across every workshop, which is why
    -- `Sequence` cannot issue it: that is per-tenant, and two workshops would
    -- both be handed 0001.
    "reference"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- One per workshop. A second subscription for the same tenant is a plan change,
-- which is an amendment to this row and a decision nobody has made yet.
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");
CREATE UNIQUE INDEX "Subscription_reference_key" ON "Subscription"("reference");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Forced, like everything else carrying a tenantId.
--
-- There is no cross-tenant reader yet. The only code that touches this is the
-- activation page, which already knows the workshop from the signed-in member's
-- membership, so it can announce its tenant like any other request. The admin
-- panel that needs to read every workshop's subscription at once is Phase 2,
-- and it will need an exemption written and argued for on its own terms —
-- starting from forced is the right place to argue from.
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Subscription"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "Subscription" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;

-- Insurance, not the main mechanism. `postgres-init/10-motion-role.sh` sets
-- ALTER DEFAULT PRIVILEGES FOR ROLE motion, so a table created *by motion* —
-- which is how migrations run in production — already grants SELECT to the
-- backup role. Default privileges are per-creating-role, though, so a migration
-- applied by anybody else (a superuser in development, or a restore run by
-- hand) leaves the new table unreadable to backups, and the symptom is a
-- nightly dump failing on a permission it was never given. One idempotent
-- GRANT closes that, and costs nothing when it was already true.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
        GRANT SELECT ON "Subscription" TO motion_backup;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_backup';
END $$;
