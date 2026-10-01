#!/usr/bin/env bash
#
# Put a backup back.
#
#   ops/backup/motion-restore.sh latest           --into "postgresql://..."
#   ops/backup/motion-restore.sh 20261001T020000Z --into "postgresql://..." --files ./restored
#
# --into is required and must be spelled out. There is no default, because the
# obvious default is the production database and this command replaces every
# table in its target. Restoring over the database named by DATABASE_URL is
# refused unless --force is given as well.
#
# Needs BACKUP_PRIVATE_KEY for an encrypted backup. That key does not live on
# the server, so this is normally run from wherever the key is kept.
#
set -euo pipefail
cd "$(dirname "$0")"
. ./common.sh
. ./s3.sh
. ./crypt.sh

usage() { sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

WANT=${1:-}; shift || usage
[ -n "$WANT" ] || usage
INTO="" FILES_INTO="" FORCE=false ROLES=false
while [ $# -gt 0 ]; do
    case $1 in
        --into) INTO=${2:-}; shift 2 ;;
        --files) FILES_INTO=${2:-}; shift 2 ;;
        --roles) ROLES=true; shift ;;
        --force) FORCE=true; shift ;;
        *) echo "ops/backup: unknown option $1" >&2; usage ;;
    esac
done

load_config
[ -n "$INTO" ] || die "--into is required: name the database to restore into"

PREFIX=${BACKUP_PREFIX:-motion}
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT; chmod 700 "$WORK"

INTO_URL=$(pg_url_without_query "$INTO")
if [ -n "${DATABASE_URL:-}" ] && [ "$INTO_URL" = "$(pg_url_without_query "$DATABASE_URL")" ] && [ "$FORCE" != true ]; then
    die "--into is the live database from the config. Every table in it would be dropped and rebuilt. Add --force if that is genuinely what you want"
fi

# "latest" reads the pointer the backup script writes last, so it always names
# a backup whose every object finished uploading.
STAMP=$WANT
if [ "$WANT" = latest ]; then
    s3_get "$PREFIX/LATEST" "$WORK/LATEST" || die "no $PREFIX/LATEST in the bucket — has a backup ever run?"
    STAMP=$(tr -d ' \r\n' < "$WORK/LATEST")
    say "latest is $STAMP"
fi
case $STAMP in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z) ;;
    *) die "$STAMP is not a backup stamp (expected 20261001T020000Z)" ;;
esac

say "fetching the manifest"
s3_get "$PREFIX/manifest/$STAMP.txt" "$WORK/manifest.txt" || die "no manifest for $STAMP; that backup may be incomplete"
sed 's/^/           /' "$WORK/manifest.txt"
ENCRYPTED=$(sed -n 's/^encrypted=//p' "$WORK/manifest.txt")

# Fetch one artefact and, if it was sealed, open it. crypt_open checks the
# recovered bytes against the hash recorded at seal time, so anything that
# reaches the next step is byte-identical to what was dumped.
fetch_sealed() {
    local key_base=$1 out=$2
    if [ "$ENCRYPTED" = true ]; then
        : "${BACKUP_PRIVATE_KEY:?this backup is encrypted; set BACKUP_PRIVATE_KEY to the matching private key}"
        [ -f "$BACKUP_PRIVATE_KEY" ] || die "BACKUP_PRIVATE_KEY points at nothing: $BACKUP_PRIVATE_KEY"
        s3_get "$key_base.enc" "$WORK/sealed"
        s3_get "$key_base.envelope" "$WORK/envelope"
        crypt_open "$WORK/sealed" "$WORK/envelope" "$BACKUP_PRIVATE_KEY" "$out"
        rm -f "$WORK/sealed" "$WORK/envelope"
    else
        s3_get "$key_base" "$out"
    fi
}

if [ "$ROLES" = true ]; then
    say "restoring the roles"
    fetch_sealed "$PREFIX/roles/$STAMP.sql" "$WORK/roles.sql"
    # Roles are cluster-wide, so this runs against the target server rather
    # than the target database. Passwords were excluded from the dump; set
    # them from the deployment's own environment afterwards.
    pg psql -d "$INTO_URL" -v ON_ERROR_STOP=0 -f - < "$WORK/roles.sql" > "$WORK/roles.out" 2>&1 || true
    say "roles applied ($(grep -c 'CREATE ROLE' "$WORK/roles.sql" || true) in the dump; roles that already existed were skipped)"
fi

say "fetching the dump"
fetch_sealed "$PREFIX/db/$STAMP.dump" "$WORK/db.dump"
say "fetched and verified $(( $(wc -c < "$WORK/db.dump" | tr -d ' ') / 1024 )) KiB"

# --clean --if-exists so a restore onto a populated database replaces it rather
# than colliding with it. --exit-on-error is deliberately absent: dropping
# objects that are not there is noisy but harmless, and a hard stop on the
# first such notice would make a routine restore look like a failure. Real
# errors are counted below instead.
say "restoring into the target"
set +e
# From stdin, for the same reason the dump goes to stdout: a containerised
# pg_restore cannot open a path on this host.
pg restore -d "$INTO_URL" --format=custom --clean --if-exists --no-password --verbose \
    < "$WORK/db.dump" > "$WORK/restore.log" 2>&1
code=$?
set -e
errors=$(grep -c '^pg_restore: error:' "$WORK/restore.log" || true)
if [ "$errors" -gt 0 ]; then
    grep '^pg_restore: error:' "$WORK/restore.log" | head -20 | sed 's/^/           /' >&2
    die "pg_restore reported $errors error(s) — the full log is $WORK/restore.log, which this script is about to remove; copy it now if you need it"
fi
[ "$code" -eq 0 ] || say "pg_restore exited $code with no errors logged, which usually means drop notices only"

TABLES=$(pg psql -d "$INTO_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'" | tr -d '\r ')
WANT_TABLES=$(sed -n 's/^tables=//p' "$WORK/manifest.txt")
say "restored $TABLES tables (the manifest recorded $WANT_TABLES)"
[ "$TABLES" = "$WANT_TABLES" ] || die "the restored table count does not match the manifest"

if [ -n "$FILES_INTO" ]; then
    FILES_BYTES=$(sed -n 's/^files_bytes=//p' "$WORK/manifest.txt")
    if [ "${FILES_BYTES:-0}" -gt 0 ]; then
        say "restoring the attachments into $FILES_INTO"
        mkdir -p "$FILES_INTO"
        fetch_sealed "$PREFIX/files/$STAMP.tar.gz" "$WORK/files.tar.gz"
        tar -xzf "$WORK/files.tar.gz" -C "$FILES_INTO"
        say "restored $(find "$FILES_INTO" -type f | wc -l | tr -d ' ') file(s)"
    else
        say "this backup holds no attachments (the S3 storage driver was in use)"
    fi
fi

say "restore of $STAMP complete"
