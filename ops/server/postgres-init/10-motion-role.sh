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

echo "› created role motion (owner of motion_app, NOBYPASSRLS)"
