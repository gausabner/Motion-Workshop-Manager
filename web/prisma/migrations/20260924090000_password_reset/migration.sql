-- Somewhere to keep a single-use password link.
--
-- MOTION had no way to recover a forgotten password at all: not for the person
-- who forgot it, and not for the owner either. In a workshop that is a working
-- outage for one member of staff until somebody edits the database by hand.
--
-- The token is stored hashed, like invitations and sessions, so a database that
-- leaks does not hand over working links.
CREATE TABLE "PasswordReset" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "usedAt"     TIMESTAMP(3),
    "issuedById" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");
CREATE INDEX "PasswordReset_tenantId_createdAt_idx" ON "PasswordReset"("tenantId", "createdAt");

ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security, and the exemption that goes with it.
--
-- Somebody following a reset link is not signed in — that is the whole point —
-- so the lookup that finds the link has no tenant to be scoped by. This is the
-- same shape as Invitation, Session and ShareLink: a table that establishes who
-- you are cannot be scoped by who you are.
--
-- It keeps the policy, so any role that does not own the tables is still bound,
-- and a row is reachable only by presenting a token that cannot be guessed.
ALTER TABLE "PasswordReset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PasswordReset"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "PasswordReset" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;
