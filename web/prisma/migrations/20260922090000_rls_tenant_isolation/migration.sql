-- Row-level security: the second wall around a workshop's books.
--
-- `forTenant()` in the application already rewrites every Prisma query to carry
-- the tenant, and denies any operation it has not been taught to scope. This is
-- the layer underneath it, for the paths that layer cannot see:
--
--   * raw SQL (`$queryRaw`), which never passes through the extension at all —
--     there is already a `SELECT … FOR UPDATE` in the inspections service with
--     no tenant in its WHERE clause;
--   * a future model added to the schema but forgotten in TENANT_MODELS;
--   * anything holding the connection string — a console, a migration shell, a
--     restored backup being poked at by hand.
--
-- The policy reads a session variable rather than a database user, because one
-- connection pool serves every workshop. `current_setting(…, true)` returns
-- NULL when nothing has been set, and `"tenantId" = NULL` is never true, so an
-- unset connection sees no rows and can write none. It fails closed: the wrong
-- direction to fail is showing one workshop another's customers.
--
-- FORCE is what makes this apply to the table owner too. Superusers still
-- bypass RLS entirely, which is why the application must connect as
-- `motion_app` for any of this to be load-bearing — see the note at the end.

-- ── the role the application connects as ────────────────────────────────────
-- NOBYPASSRLS is the whole point. No password is set here: a credential in a
-- committed migration is a credential in every clone of this repository. The
-- operator sets one (`ALTER ROLE motion_app PASSWORD …`) when provisioning.
--
-- Managed Postgres does not always let the migration user create roles. That is
-- not a reason to fail the deploy — the policies below are still worth having,
-- and the role can be created by hand — so a privilege error is reported and
-- stepped over rather than thrown.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        CREATE ROLE motion_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        RAISE NOTICE 'created role motion_app (no password set — set one before use)';
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to create role motion_app; create it by hand and re-grant';
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT USAGE ON SCHEMA public TO motion_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO motion_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO motion_app;
        -- Tables created by later migrations must be reachable too, or the next
        -- feature ships and the application cannot read its own new table.
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO motion_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT USAGE, SELECT ON SEQUENCES TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app; grant by hand';
END $$;

-- ── the policy, on every table that carries a tenant ────────────────────────
-- Driven off the column rather than a list of 54 names copied from the schema,
-- because a list is a thing that goes stale silently. A table with a `tenantId`
-- gets the policy; that is the rule, and `rls.dbtest.ts` fails the build if a
-- table ever has the column without the policy.
DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND a.attname = 'tenantId'
          AND NOT a.attisdropped
        ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        -- NULLIF guards the empty string: `SET motion.tenant_id = ''` must not
        -- be treated as a tenant whose id happens to be blank.
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I'
            ' USING ("tenantId" = NULLIF(current_setting(''motion.tenant_id'', true), ''''))'
            ' WITH CHECK ("tenantId" = NULLIF(current_setting(''motion.tenant_id'', true), ''''))',
            t);
    END LOOP;
END $$;

-- ── what this does not yet do ───────────────────────────────────────────────
-- Nothing above changes behaviour while the application connects as a
-- superuser, because superusers bypass RLS unconditionally. Turning this on is
-- two further steps, deliberately not taken in the same change as the policies:
--
--   1. give `motion_app` a password and point the runtime DATABASE_URL at it,
--      keeping an owner URL for `migrate deploy` (motion_app cannot create
--      tables, by design);
--   2. set `motion.tenant_id` on the connection for the life of each request,
--      which is a real piece of design rather than a config line: the pool is
--      shared, so it has to be set per transaction, and there are 77 places
--      that open an interactive transaction on the tenant client.
--
-- Until both are done these policies are dormant. They are still worth landing
-- first: they are verified, and the drift test keeps them true as tables are
-- added.
