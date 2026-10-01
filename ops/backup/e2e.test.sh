#!/usr/bin/env bash
#
# The whole thing, end to end, against a real PostgreSQL and a bucket that
# checks its own signatures: dump, seal, upload, list, prune, fetch, unseal,
# restore, and confirm the data and its row-level security came back.
#
# Needs the local database up (`make db`) and python3. Skips rather than fails
# if the database is not running, so this is safe to leave in CI for a job
# without one.
#
# Run: bash ops/backup/e2e.test.sh
set -uo pipefail
cd "$(dirname "$0")"

# Two ways to reach PostgreSQL, because this has to run in both places it
# matters. On a laptop the database is a container and the host has no client
# tools; on a CI runner it is a service container and the client tools are
# already there. Anything else skips rather than fails, so a job without a
# database does not go red for the wrong reason.
E2E_DB_URL=${E2E_DB_URL:-postgresql://postgres:postgres@localhost:5432/motion_app}
DB_CONTAINER=${DB_CONTAINER:-motionworkshopmanager-db-1}

if command -v psql >/dev/null 2>&1 && psql -d "$E2E_DB_URL" -tAc 'select 1' >/dev/null 2>&1; then
    MODE="local client tools"
    CLIENT_PREFIX=""
elif docker exec "$DB_CONTAINER" pg_isready -q 2>/dev/null; then
    MODE="docker exec $DB_CONTAINER"
    CLIENT_PREFIX="docker exec -i $DB_CONTAINER "
else
    echo "e2e: no reachable PostgreSQL — skipping"
    echo "     locally: make db"
    echo "     or set E2E_DB_URL to a database with the MOTION schema in it"
    exit 0
fi

# The admin connection for creating and dropping the scratch database, and for
# the direct queries the checks below make.
ADMIN_URL="${E2E_DB_URL%/*}/postgres"
admin() { ${CLIENT_PREFIX}psql -d "$ADMIN_URL" -tAc "$1"; }

tmp=$(mktemp -d)
stub_pid=""
cleanup() {
    # `wait` as well as `kill`, with both silenced: otherwise bash prints its
    # own "Terminated" notice for the stub and the run ends looking like it
    # crashed when it passed.
    if [ -n "$stub_pid" ]; then
        { kill "$stub_pid" && wait "$stub_pid"; } 2>/dev/null
    fi
    admin "drop database if exists \"$SCRATCH\" with (force)" >/dev/null 2>&1
    rm -rf "$tmp"
}
trap cleanup EXIT

fails=0
check() {
    local what=$1 got=$2 want=$3
    if [ "$got" = "$want" ]; then
        printf '  ok   %s\n' "$what"
    else
        printf '  FAIL %s\n       got  %s\n       want %s\n' "$what" "$got" "$want"
        fails=$((fails + 1))
    fi
}

SCRATCH="motion_e2e_$$"
BUCKET_DIR="$tmp/bucket"
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')

# What is in the source database now. The checks below compare the restored
# copy against these rather than against numbers written into the test: the
# claim worth making is "everything came back", and a hard-coded count would
# only ever assert that one developer's seed had not changed.
src() { ${CLIENT_PREFIX}psql -d "$E2E_DB_URL" -tAc "$1" 2>/dev/null | tr -d ' \r'; }
SRC_TABLES=$(src "select count(*) from information_schema.tables where table_schema='public'")
SRC_RLS=$(src "select count(*) from pg_class where relrowsecurity and relnamespace='public'::regnamespace")
SRC_POLICIES=$(src "select count(*) from pg_policies where schemaname='public'")
declare -a COUNTED=(Tenant User Customer Vehicle)
declare -a SRC_ROWS=()
for table in "${COUNTED[@]}"; do
    SRC_ROWS+=("$(src "select count(*) from \"$table\"")")
done

if [ "${SRC_TABLES:-0}" -lt 10 ]; then
    echo "e2e: $E2E_DB_URL has only ${SRC_TABLES:-0} tables — migrate it first, then rerun"
    exit 1
fi

echo "setting up — PostgreSQL via $MODE, $SRC_TABLES tables, ${SRC_ROWS[0]} tenant(s)"
STUB_PAGE_SIZE=2 STUB_REGION=auto python3 s3.stub.py "$BUCKET_DIR" "$PORT" e2ekey e2esecret123 &
stub_pid=$!
for _ in $(seq 1 40); do
    curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
    sleep 0.1
done

openssl genrsa -out "$tmp/priv.pem" 3072 2>/dev/null
openssl rsa -in "$tmp/priv.pem" -pubout -out "$tmp/pub.pem" 2>/dev/null

# A couple of attachments, one in a subdirectory, so the tar and its restore
# are exercised rather than assumed.
mkdir -p "$tmp/attachments/t/abc/invoice"
echo "a job card pdf would be here" > "$tmp/attachments/t/abc/invoice/1.pdf"
printf 'binary\x00\xff\xfedata' > "$tmp/attachments/t/abc/photo.bin"

# DATABASE_URL deliberately keeps ?schema=public, which libpq rejects. If the
# stripping in common.sh regresses, every run below fails at the first dump.
cat > "$tmp/backup.env" <<ENV
DATABASE_URL="$E2E_DB_URL?schema=public"
PG_DUMP="${CLIENT_PREFIX}pg_dump"
PG_DUMPALL="${CLIENT_PREFIX}pg_dumpall"
PG_RESTORE="${CLIENT_PREFIX}pg_restore"
PSQL="${CLIENT_PREFIX}psql"
S3_ENDPOINT="http://127.0.0.1:$PORT"
S3_BUCKET="e2e"
S3_REGION="auto"
S3_ACCESS_KEY_ID="e2ekey"
S3_SECRET_ACCESS_KEY="e2esecret123"
S3_FORCE_PATH_STYLE="true"
BACKUP_PREFIX="motion"
BACKUP_PUBLIC_KEY="$tmp/pub.pem"
BACKUP_PRIVATE_KEY="$tmp/priv.pem"
BACKUP_ATTACHMENTS_DIR="$tmp/attachments"
KEEP_DAILY=14
KEEP_MONTHLY=12
KEEP_YEARLY=7
ENV
export MOTION_BACKUP_ENV="$tmp/backup.env"

echo
echo "row-level security against the dump"
# This is the case that reached a live server before it was caught. The suite
# dumped as the superuser, which bypasses RLS unconditionally, so it never
# exercised the configuration production actually uses — and the first real
# backup failed on the first table:
#
#   ERROR: query would be affected by row-level security policy
#
# A dump that cannot read is a loud failure, which is the good outcome. The
# bad outcome this guards against is the opposite: a configuration that
# silently captures nothing. So both halves are checked.
RLS_FORCED=$(src "select count(*) from pg_class where relforcerowsecurity and relnamespace='"'"'public'"'"'::regnamespace")
if [ "${RLS_FORCED:-0}" -gt 0 ]; then
    # Clearing up after a previous run is best-effort and its noise is not a
    # result. DROP ROLE refuses while the role still holds grants, so a run
    # that ended early leaves one behind, and counting that as a setup failure
    # made this check pass or fail depending on how the *last* run ended. A
    # flaky test is worse than no test: people learn to ignore it.
    rls_cleanup() {
        ${CLIENT_PREFIX}psql -d "$E2E_DB_URL" -tAc "drop owned by zz_e2e_norls" >/dev/null 2>&1 </dev/null || true
        ${CLIENT_PREFIX}psql -d "$ADMIN_URL" -tAc "drop role if exists zz_e2e_norls" >/dev/null 2>&1 </dev/null || true
    }
    rls_cleanup

    # NOLOGIN and no password, because the dump reaches this role through
    # pg_dump --role, which issues SET ROLE after connecting as somebody who
    # can. A superuser that has SET ROLE to a NOBYPASSRLS role is subject to
    # the policies, which is the whole point.
    #
    # The previous version gave the role a password, and the shell quoting
    # mangled it. It passed on a laptop anyway, because `docker exec` connects
    # from inside the container where pg_hba trusts local connections and never
    # checks a password; CI connects over TCP and does. A test that only works
    # where authentication is switched off is not testing what it claims to.
    rls_setup=$(
        ${CLIENT_PREFIX}psql -d "$ADMIN_URL" -v ON_ERROR_STOP=1 -tAc \
            "create role zz_e2e_norls nologin nosuperuser nobypassrls" 2>&1 </dev/null
        ${CLIENT_PREFIX}psql -d "$E2E_DB_URL" -v ON_ERROR_STOP=1 -tAc \
            "grant usage on schema public to zz_e2e_norls; grant select on all tables in schema public to zz_e2e_norls" 2>&1 </dev/null
    )
    check "the restricted role is created and granted" \
        "$(printf '%s' "$rls_setup" | grep -ci 'error')" "0"

    # The whole schema, not one --table pattern: quoting a mixed-case relation
    # through two layers of shell produced "no matching tables were found"
    # rather than an RLS error, failing for a reason with nothing to do with RLS.
    rls_out=$(${CLIENT_PREFIX}pg_dump -d "${E2E_DB_URL%%\?*}" --role=zz_e2e_norls \
        --format=custom --data-only --schema=public 2>&1 >/dev/null </dev/null || true)

    if printf '%s' "$rls_out" | grep -q 'row-level security'; then
        check "a dump by a NOBYPASSRLS role is refused, not silently empty" refused refused
    else
        check "a dump by a NOBYPASSRLS role is refused, not silently empty" \
            "not refused — pg_dump said: $(printf '%s' "$rls_out" | head -2 | tr '\n' ' ')" "refused"
    fi

    rls_cleanup
else
    echo "  skip  this database has no FORCEd policies to test against"
fi

echo
echo "taking a backup"
if ./motion-backup.sh > "$tmp/backup.log" 2>&1; then
    check "the backup script succeeds" ok ok
else
    sed 's/^/       /' "$tmp/backup.log"
    check "the backup script succeeds" failed ok
    echo; echo "e2e: cannot continue without a backup"; exit 1
fi
sed 's/^/       /' "$tmp/backup.log"

STAMP=$(tr -d ' \n' < "$BUCKET_DIR/motion/LATEST")
echo
echo "what landed in the bucket"
check "a LATEST pointer naming this backup" \
    "$(printf '%s' "$STAMP" | grep -cE '^[0-9]{8}T[0-9]{6}Z$')" "1"
check "the database dump, sealed" "$([ -s "$BUCKET_DIR/motion/db/$STAMP.dump.enc" ] && echo yes || echo no)" "yes"
check "its wrapped envelope" "$([ -s "$BUCKET_DIR/motion/db/$STAMP.dump.envelope" ] && echo yes || echo no)" "yes"
check "the roles dump, sealed" "$([ -s "$BUCKET_DIR/motion/roles/$STAMP.sql.enc" ] && echo yes || echo no)" "yes"
check "the attachments archive, sealed" "$([ -s "$BUCKET_DIR/motion/files/$STAMP.tar.gz.enc" ] && echo yes || echo no)" "yes"
check "a plaintext manifest" "$([ -s "$BUCKET_DIR/motion/manifest/$STAMP.txt" ] && echo yes || echo no)" "yes"
check "no plaintext dump was left in the bucket" \
    "$(find "$BUCKET_DIR" -name '*.dump' | wc -l | tr -d ' ')" "0"
check "the manifest records the table count" \
    "$(sed -n 's/^tables=//p' "$BUCKET_DIR/motion/manifest/$STAMP.txt")" "$SRC_TABLES"
check "the manifest records that it is encrypted" \
    "$(sed -n 's/^encrypted=//p' "$BUCKET_DIR/motion/manifest/$STAMP.txt")" "true"
check "the manifest names no customer data" \
    "$(grep -icE 'customer|vehicle|invoice|@' "$BUCKET_DIR/motion/manifest/$STAMP.txt" || true)" "0"

echo
echo "restoring it into a scratch database"
admin "create database \"$SCRATCH\"" >/dev/null
SCRATCH_URL="${E2E_DB_URL%/*}/$SCRATCH"
if ./motion-restore.sh latest \
        --into "$SCRATCH_URL" \
        --files "$tmp/restored" > "$tmp/restore.log" 2>&1; then
    check "the restore script succeeds" ok ok
else
    sed 's/^/       /' "$tmp/restore.log"
    check "the restore script succeeds" failed ok
fi

q() { ${CLIENT_PREFIX}psql -d "$SCRATCH_URL" -tAc "$1" 2>/dev/null | tr -d ' \r'; }
check "every table is back" "$(q "select count(*) from information_schema.tables where table_schema='public'")" "$SRC_TABLES"
for i in "${!COUNTED[@]}"; do
    table=${COUNTED[$i]}
    check "\"$table\" came back with all ${SRC_ROWS[$i]} of its rows" \
        "$(q "select count(*) from \"$table\"")" "${SRC_ROWS[$i]}"
done
# Row-level security is the entire tenant boundary. A restore that lost it
# would look healthy and quietly serve every workshop's data to every other.
check "row-level security is still forced on the same $SRC_RLS tables" \
    "$(q "select count(*) from pg_class where relrowsecurity and relnamespace='public'::regnamespace")" "$SRC_RLS"
check "and all $SRC_POLICIES policies came with it" \
    "$(q "select count(*) from pg_policies where schemaname='public'")" "$SRC_POLICIES"
check "the seeded data is genuinely there, not an empty schema that counted clean" \
    "$([ "${SRC_ROWS[0]}" -gt 0 ] && echo seeded || echo empty)" "seeded"

echo
echo "the attachments"
check "the file in a subdirectory is back, byte for byte" \
    "$(cmp -s "$tmp/attachments/t/abc/invoice/1.pdf" "$tmp/restored/t/abc/invoice/1.pdf" && echo same || echo different)" "same"
check "so are the bytes that are not text" \
    "$(cmp -s "$tmp/attachments/t/abc/photo.bin" "$tmp/restored/t/abc/photo.bin" && echo same || echo different)" "same"

echo
echo "a damaged backup is refused rather than half-restored"
cp "$BUCKET_DIR/motion/db/$STAMP.dump.enc" "$tmp/good.enc"
printf '\x00' | dd of="$BUCKET_DIR/motion/db/$STAMP.dump.enc" bs=1 seek=4096 count=1 conv=notrunc status=none
./motion-restore.sh latest --into "$SCRATCH_URL" > "$tmp/tampered.log" 2>&1 && r=restored || r=refused
check "a flipped byte in the ciphertext stops the restore" "$r" "refused"
check "and it says why, rather than failing obscurely" \
    "$(grep -cE 'does not match its recorded hash|decryption failed' "$tmp/tampered.log")" "1"
cp "$tmp/good.enc" "$BUCKET_DIR/motion/db/$STAMP.dump.enc"

echo
echo "restoring over the live database is refused without --force"
./motion-restore.sh latest --into "$E2E_DB_URL?schema=public" > "$tmp/guard.log" 2>&1 && r=restored || r=refused
check "the guard holds" "$r" "refused"
check "and names the reason" "$(grep -c 'live database from the config' "$tmp/guard.log")" "1"

echo
echo "the cluster roles, which a bare-metal restore needs"
# Re-applying this cluster's own roles is a no-op: the CREATE ROLE statements
# fail harmlessly because the roles exist, and the ALTER ROLE statements set
# the attributes they already have. What is being tested is that the object
# fetches, unseals and applies at all.
./motion-restore.sh latest --into "$SCRATCH_URL" --roles > "$tmp/roles.log" 2>&1 && r=ok || r=failed
check "a restore with --roles succeeds" "$r" "ok"
check "and the roles dump it applied was not empty" \
    "$([ "$(sed -n 's/.*roles applied (\([0-9]*\) in the dump.*/\1/p' "$tmp/roles.log")" -ge 1 ] && echo yes || echo no)" "yes"
check "the application's restricted role is present in the target" \
    "$(admin "select count(*) from pg_roles where rolname = 'motion_app' and not rolbypassrls")" "1"

echo
echo "listing and pruning"
# Synthetic history beside the real backup, in the same object shapes. The stub
# pages at two keys, so this also proves continuation tokens are followed — a
# prune that only saw the first page would delete nothing and claim success.
#
# A hundred days rather than two years: it reaches four months back, so the
# daily and monthly tiers both bite, while sending a quarter as many DELETEs.
# The yearly tier and long histories belong to rotate.test.sh, which needs no
# network at all.
SYNTHETIC=100
python3 - "$BUCKET_DIR/motion" "$SYNTHETIC" <<'PY'
import datetime, os, sys
root, days = sys.argv[1], int(sys.argv[2])
start = datetime.date(2026, 10, 1)
for i in range(1, days + 1):
    stamp = (start - datetime.timedelta(days=i)).strftime("%Y%m%dT020000Z")
    for sub, name in (("db", f"{stamp}.dump.enc"), ("db", f"{stamp}.dump.envelope"),
                      ("manifest", f"{stamp}.txt")):
        os.makedirs(os.path.join(root, sub), exist_ok=True)
        open(os.path.join(root, sub, name), "w").write("synthetic\n")
print(f"planted {days} synthetic backups")
PY
# The synthetic backups at three objects each, plus the eight the real backup
# above put there: a sealed artefact and an envelope each for the dump, the
# roles and the attachments, a manifest, and LATEST.
before=$(find "$BUCKET_DIR/motion" -type f | wc -l | tr -d ' ')
check "the bucket now holds the planted objects and the real one" "$before" "$(( SYNTHETIC * 3 + 8 ))"

. ./s3.sh
S3_ENDPOINT="http://127.0.0.1:$PORT" S3_BUCKET=e2e S3_REGION=auto \
S3_ACCESS_KEY_ID=e2ekey S3_SECRET_ACCESS_KEY=e2esecret123 S3_FORCE_PATH_STYLE=true \
    listed=$(s3_list "motion/" | wc -l | tr -d ' ')
check "s3_list pages through every object" "$listed" "$before"

./motion-backup.sh > "$tmp/prune.log" 2>&1 || sed 's/^/       /' "$tmp/prune.log"
grep 'pruning removed' "$tmp/prune.log" | sed 's/^/       /'
NEW_STAMP=$(tr -d ' \n' < "$BUCKET_DIR/motion/LATEST")
check "the newest backup survived its own prune" \
    "$([ -s "$BUCKET_DIR/motion/db/$NEW_STAMP.dump.enc" ] && echo yes || echo no)" "yes"
check "so did the first one, still inside the daily window" \
    "$([ -s "$BUCKET_DIR/motion/db/$STAMP.dump.enc" ] && echo yes || echo no)" "yes"
# The planted history runs 100 days back from 1 October 2026, to 23 June. Both
# real backups are from 1 October, so the keeps are: fourteen dailies (the two
# real ones and twelve synthetic, reaching 19 September), then the last day of
# August, July and June as monthlies. September and October need no monthly —
# the daily window already covers them.
remaining=$(ls "$BUCKET_DIR/motion/db" | grep -oE '^[0-9]{8}T[0-9]{6}Z' | sort -u | wc -l | tr -d ' ')
check "a hundred days of history pruned down to the policy's keeps" "$remaining" "17"
# Fourteen kept stamps but only thirteen distinct dates: both real backups
# were taken on 1 October, so the daily window ends one line earlier than the
# stamp count suggests. The monthlies follow from line fourteen.
check "the monthly keeps are the month ends, not the month starts" \
    "$(ls "$BUCKET_DIR/motion/db" | grep -oE '^[0-9]{8}' | sort -ru | sed -n '14,16p' | tr '\n' ' ')" \
    "20260831 20260731 20260630 "
check "every surviving backup still has its envelope" \
    "$(cd "$BUCKET_DIR/motion/db" && for f in *.dump.enc; do [ -e "${f%.enc}.envelope" ] || echo "$f"; done | wc -l | tr -d ' ')" "0"

echo
if [ "$fails" -eq 0 ]; then echo "e2e: all checks passed"; else echo "e2e: $fails check(s) failed"; fi
exit "$fails"
