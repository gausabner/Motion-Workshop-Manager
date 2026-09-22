-- Stand FORCE down until the application can say who it is.
--
-- The previous migration enabled row-level security and forced it. FORCE is
-- what makes a policy bind the table's *owner* as well as everyone else, and
-- that is the half that cannot ship yet.
--
-- On managed Postgres — Render, and most others — the application connects as
-- the role that owns the tables, and that role is deliberately not a superuser.
-- So FORCE binds it. With no `motion.tenant_id` set on the connection, the
-- policy compares against NULL, nothing matches, and every screen in MOTION
-- comes up empty. Verified rather than assumed: a database migrated and read by
-- a non-superuser owner returned `customers visible: 0`.
--
-- Nothing is lost by standing it down. RLS stays enabled and the policies stay
-- exactly as written, so any role that does not own the tables — `motion_app`,
-- which is what the application will connect as — is still fully subject to
-- them, and `rls.dbtest.ts` still proves isolation by connecting as that role.
-- FORCE only ever covered the owner.
--
-- It comes back in the same change that sets `motion.tenant_id` per
-- transaction, because from that moment the owner can also satisfy the policy.
-- Landing it before then is a loaded gun pointed at the first deploy.
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
          AND c.relforcerowsecurity
        ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;
