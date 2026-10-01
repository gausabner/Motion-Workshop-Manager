#!/bin/bash
# Creates the role MOTION actually runs as. Runs once, when the data directory
# is empty — never again, and never against an existing database.
#
# The distinction this draws is the entire tenant boundary:
#
#   postgres  superuser, administration and backups only
#   motion    owns every table, cannot create roles or databases, and —
#             critically — NOBYPASSRLS
#
# Row-level security is FORCEd on every table carrying a tenantId, which makes
# the policies bind even the table owner. But PostgreSQL exempts superusers
# from RLS unconditionally, FORCE or not. Run the application as the superuser
# and every policy in the product quietly stops applying, with no error and no
# symptom until one workshop sees another's books.
#
# The app's own migrations create a further `motion_app` role for the isolation
# tests. It has no password and cannot log in usefully; leave it.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname motion_app <<EOSQL
    CREATE ROLE motion LOGIN PASSWORD '${MOTION_DB_PASSWORD}'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

    -- It must own the database and the schema, because `prisma migrate deploy`
    -- runs as this role on every boot and has to be able to alter tables.
    ALTER DATABASE motion_app OWNER TO motion;
    ALTER SCHEMA public OWNER TO motion;
    GRANT ALL ON SCHEMA public TO motion;
EOSQL

# And the role backups run as.
#
# pg_dump has to read every tenant's rows; row-level security exists to stop
# exactly that, and it is FORCEd, so it binds the owner too. Dumping as
# `motion` fails outright — "query would be affected by row-level security
# policy" — which is the correct behaviour and why the application's own role
# must never be the way around it.
#
# So the exception is a separate, auditable identity: BYPASSRLS so the dump can
# read, SELECT only so a leak of it cannot alter a row or drop a table. The
# password is set by the operator at commissioning, as with motion_app.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname motion_app <<EOSQL
    CREATE ROLE motion_backup LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT CONNECT ON DATABASE motion_app TO motion_backup;
    GRANT USAGE ON SCHEMA public TO motion_backup;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO motion_backup;
    GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO motion_backup;
    ALTER DEFAULT PRIVILEGES FOR ROLE motion IN SCHEMA public
        GRANT SELECT ON TABLES TO motion_backup;
EOSQL

echo "› created role motion (owner of motion_app, NOBYPASSRLS)"
echo "› created role motion_backup (BYPASSRLS, SELECT only — set its password before backups run)"
