-- Row-level security becomes load-bearing.
--
-- FORCE was stood down in 20260922170000 because the application connected as
-- the role that owns the tables, and forcing it then would have brought MOTION
-- up with every screen empty. The application now announces its tenant on every
-- connection before it reads anything — per transaction, so the setting and the
-- query share a pooled connection — which is the piece that was missing.
--
-- With this applied, the policies bind the table owner too. A query that has
-- not said which workshop it is for returns nothing and writes nothing, rather
-- than quietly returning everything.
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
          AND NOT c.relforcerowsecurity
          -- The four tables that answer "which workshop is this?" cannot be
          -- forced, because the query that establishes the tenant cannot itself
          -- be tenant-scoped. A session looks up a membership before it knows
          -- the workshop; an API request looks up a key; a customer opening a
          -- WhatsApp link presents a token and nothing else. Forcing these
          -- would mean nobody could sign in at all.
          --
          -- They keep row-level security enabled, so any role that does not own
          -- the tables is still bound by it. What they lose is the extra guard
          -- against the owner — and each is reachable only by presenting a
          -- value that cannot be guessed: a hashed session token, a hashed API
          -- key, a hashed invitation or share token, or a user id that is
          -- already authenticated.
          --
          -- Every table holding a workshop's actual work — customers,
          -- documents, payments, stock, all fifty of them — is forced.
          AND c.relname NOT IN ('Membership', 'ApiKey', 'Invitation', 'ShareLink')
        ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Tables added since the policies were written need the same treatment, and
-- new roles need the same reach. Re-granting is cheap and idempotent.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO motion_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app; grant by hand';
END $$;
