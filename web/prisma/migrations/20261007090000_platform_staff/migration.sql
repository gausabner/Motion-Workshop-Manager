-- MOTION's own team, and the one exemption they need.
--
-- Until now the only way to approve a paid registration was a script run over
-- SSH. This adds what a screen needs: a way to know who is staff, a record of
-- what staff did, and a deliberately narrow way for a staff session to read
-- across workshops.
--
-- **Narrow is the whole point.** Every table carrying a tenantId is FORCE RLS,
-- and a page listing every workshop's registration is, by construction, the
-- thing the database is configured to refuse. The exemption granted here
-- applies to the billing tables and to nothing else. A staff session that
-- confirms a deposit can see what each workshop agreed to pay; it cannot see a
-- single customer, vehicle, document or payment, because those policies are
-- untouched. That is enforced here rather than by the admin screen choosing
-- not to offer it, and `platform.dbtest.ts` asserts it.

ALTER TABLE "User" ADD COLUMN "isPlatformStaff" BOOLEAN NOT NULL DEFAULT false;

-- One place that says what "this session is platform staff" means. Read from a
-- transaction-local setting, exactly like motion.tenant_id: set inside a
-- transaction with set_config(..., true), so it cannot outlive the transaction
-- or leak to the next borrower of a pooled connection. The application sets it
-- only after reading isPlatformStaff for the signed-in user from this
-- database — never from a header, a cookie or a query parameter.
CREATE OR REPLACE FUNCTION motion_is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT coalesce(current_setting('motion.platform_admin', true), '') = 'on';
$$;

COMMENT ON FUNCTION motion_is_platform_admin() IS
    'True inside a transaction that has declared itself MOTION platform staff. Grants the billing tables only.';

-- ── Subscription: a second policy, not a rewritten first one ───────────────
--
-- `tenant_isolation` is left exactly as it was. Permissive policies are OR-ed,
-- so adding `platform_admin` beside it widens access for a declared staff
-- session without touching the rule every workshop relies on.
--
-- An earlier draft dropped `tenant_isolation` and replaced it with one combined
-- policy. The RLS coverage test refused it — every table carrying a tenantId
-- must keep a policy of that name — and it was right to: the exemption should
-- be a separate, separately named thing that can be found and audited on its
-- own, not folded into the guarantee it is an exception to.
CREATE POLICY platform_admin ON "Subscription"
    USING (motion_is_platform_admin())
    WITH CHECK (motion_is_platform_admin());

-- ── What staff did ─────────────────────────────────────────────────────────
CREATE TABLE "PlatformAuditEvent" (
    "id"          TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "tenantId"    TEXT,
    "detail"      JSONB NOT NULL DEFAULT '{}',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");
CREATE INDEX "PlatformAuditEvent_tenantId_createdAt_idx" ON "PlatformAuditEvent"("tenantId", "createdAt");

ALTER TABLE "PlatformAuditEvent" ADD CONSTRAINT "PlatformAuditEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- SET NULL rather than CASCADE: the record of who switched a workshop on must
-- survive the workshop being removed, or the trail deletes itself exactly when
-- somebody comes asking about it.
ALTER TABLE "PlatformAuditEvent" ADD CONSTRAINT "PlatformAuditEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MOTION's record, readable and writable only by a session declared as staff.
-- Forced, so the table owner — which is what the application connects as — is
-- bound too. A workshop session, or one that has declared nothing, sees none of
-- it and cannot add to it.
ALTER TABLE "PlatformAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformAuditEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_only ON "PlatformAuditEvent"
    USING (motion_is_platform_admin())
    WITH CHECK (motion_is_platform_admin());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "PlatformAuditEvent" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;

-- Insurance, as in the subscription migration: default privileges cover a table
-- created by `motion`, and nothing else, so a migration applied by another role
-- would otherwise leave this out of the nightly dump.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
        GRANT SELECT ON "PlatformAuditEvent" TO motion_backup;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_backup';
END $$;
