#!/usr/bin/env bash
#
# Prove the newest backup restores.
#
#   ops/backup/motion-verify.sh
#
# Restores the latest backup into a scratch database beside the live one,
# checks that the data is actually there, and drops the scratch database again.
# Exits non-zero if any of that fails.
#
# This exists because every other part of this directory can work perfectly
# and still leave you with nothing. A backup is a belief until it has been
# restored; running this weekly from the timer beside it is what converts the
# recovery point and recovery time in docs/continuity-and-recovery.md from
# intentions into measurements.
#
# Needs BACKUP_PRIVATE_KEY, so it runs wherever the key is kept — which is
# deliberately not the server that takes the backups.
#
set -euo pipefail
cd "$(dirname "$0")"
. ./common.sh

load_config
: "${DATABASE_URL:?set DATABASE_URL in the config}"
: "${VERIFY_ADMIN_URL:?set VERIFY_ADMIN_URL to a connection that may create and drop databases}"

ADMIN=$(pg_url_without_query "$VERIFY_ADMIN_URL")
SCRATCH="motion_verify_$(date -u +%Y%m%d%H%M%S)"
STARTED=$(date -u +%s)

# The scratch database goes away whether this succeeds or fails. A verify run
# that leaves databases behind fills the disk and then takes the live site
# down with it, which is a remarkable way for a backup system to cause an
# outage.
cleanup() {
    say "dropping $SCRATCH"
    pg psql -d "$ADMIN" -tAc "drop database if exists \"$SCRATCH\" with (force)" >/dev/null 2>&1 \
        || pg psql -d "$ADMIN" -tAc "drop database if exists \"$SCRATCH\"" >/dev/null 2>&1 \
        || say "WARNING $SCRATCH could not be dropped; drop it by hand"
}
trap cleanup EXIT

say "creating $SCRATCH"
pg psql -d "$ADMIN" -tAc "create database \"$SCRATCH\"" >/dev/null

# Point --into at the scratch database on the same server as the admin
# connection, keeping credentials and host but swapping the database name.
INTO="${ADMIN%/*}/$SCRATCH"

say "restoring the latest backup into it"
./motion-restore.sh latest --into "$INTO" > "/tmp/motion-verify.$$.log" 2>&1 || {
    sed 's/^/           /' "/tmp/motion-verify.$$.log" >&2
    rm -f "/tmp/motion-verify.$$.log"
    die "the latest backup did not restore"
}
sed -n 's/^/           /p' "/tmp/motion-verify.$$.log" | tail -6
rm -f "/tmp/motion-verify.$$.log"

# A restore that creates the schema and no rows passes a table count and is
# still useless. These are the tables whose emptiness would mean the dump
# captured structure but not content.
say "checking the restored data"
problems=0
for table in Tenant User Customer Vehicle; do
    rows=$(pg psql -d "$INTO" -tAc "select count(*) from \"$table\"" 2>/dev/null | tr -d '\r ' || echo error)
    case $rows in
        error)  say "FAIL  \"$table\" could not be read"; problems=$((problems + 1)) ;;
        0)      say "FAIL  \"$table\" restored with no rows"; problems=$((problems + 1)) ;;
        *)      say "ok    \"$table\" $rows row(s)" ;;
    esac
done

# Row-level security is the whole tenant boundary. A restore that lost it would
# look healthy and quietly serve every workshop's data to every other one.
rls=$(pg psql -d "$INTO" -tAc "select count(*) from pg_class where relrowsecurity and relnamespace = 'public'::regnamespace" | tr -d '\r ')
policies=$(pg psql -d "$INTO" -tAc "select count(*) from pg_policies where schemaname = 'public'" | tr -d '\r ')
if [ "$rls" -gt 0 ] && [ "$policies" -gt 0 ]; then
    say "ok    row-level security survived: $rls table(s), $policies policy/policies"
else
    say "FAIL  row-level security did not survive the restore ($rls tables, $policies policies)"
    problems=$((problems + 1))
fi

ELAPSED=$(( $(date -u +%s) - STARTED ))
say "verify finished in ${ELAPSED}s"

if [ "$problems" -gt 0 ]; then
    die "$problems check(s) failed — the latest backup is not a working backup"
fi
say "the latest backup restores and the data is intact (recovery took ${ELAPSED}s)"
