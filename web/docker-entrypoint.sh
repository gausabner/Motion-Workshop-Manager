#!/bin/sh
# Bring the schema up to the code before the code starts serving.
#
# `migrate deploy` only applies migrations that are already written and
# committed — it never invents one from a schema drift, which is what makes it
# safe to run on every boot. If it fails, the container fails: a MOTION serving
# a workshop's books against a half-migrated database is worse than a MOTION
# that is plainly down.
set -e

if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL is not set — refusing to start." >&2
    exit 1
fi
if [ -z "$SESSION_SECRET" ]; then
    echo "SESSION_SECRET is not set — sessions and share links are signed with it." >&2
    exit 1
fi

echo "› applying migrations"
(cd migrate && node ./node_modules/prisma/build/index.js migrate deploy)

echo "› starting MOTION"
exec "$@"
