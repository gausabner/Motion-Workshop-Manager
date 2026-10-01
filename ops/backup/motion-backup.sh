#!/usr/bin/env bash
#
# One backup: dump, seal, upload, prune.
#
# Run nightly from the systemd timer beside this file, or by hand. Exits
# non-zero on any failure, having uploaded nothing partial — the LATEST pointer
# only moves once every object for a backup is in the bucket, so a run that
# dies halfway leaves the previous backup as the newest complete one rather
# than leaving a torn one to be discovered during a restore.
#
#   ops/backup/motion-backup.sh
#
set -euo pipefail
cd "$(dirname "$0")"
. ./common.sh
. ./s3.sh
. ./crypt.sh
. ./rotate.sh

load_config
: "${DATABASE_URL:?set DATABASE_URL in the config}"

PREFIX=${BACKUP_PREFIX:-motion}
STAMP=$(stamp_now)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"

DB_URL=$(pg_url_without_query "$DATABASE_URL")
SEAL=true
if [ -z "${BACKUP_PUBLIC_KEY:-}" ]; then
    # Refusing by default matters: this data leaves the country, and the
    # failure mode of "encryption was not configured" is indistinguishable
    # from "encryption worked" until the bucket leaks.
    [ "${BACKUP_ALLOW_PLAINTEXT:-false}" = true ] \
        || die "BACKUP_PUBLIC_KEY is not set. Generate a key pair (see ops/backup/README.md), or set BACKUP_ALLOW_PLAINTEXT=true to accept unencrypted off-site backups"
    SEAL=false
    say "WARNING uploading unencrypted — BACKUP_ALLOW_PLAINTEXT is set"
else
    [ -f "$BACKUP_PUBLIC_KEY" ] || die "BACKUP_PUBLIC_KEY points at nothing: $BACKUP_PUBLIC_KEY"
fi

say "backup $STAMP starting"

# ---------------------------------------------------------------- the database
#
# Custom format, which is compressed, restorable table by table, and the only
# format pg_restore can reorder for a clean rebuild.
#
# Note what is NOT passed: --no-owner and --no-privileges. Row-level security
# is enforced through ownership and grants, so a dump that discards them
# restores a database whose policies no longer bite. The cost is that roles
# must exist before the restore, which is why the roles are dumped too.
say "dumping the database"
# To stdout, redirected here, rather than --file. PG_DUMP may be a
# `docker exec` wrapper, in which case --file names a path inside the
# container and the dump lands somewhere this script cannot reach. Streaming
# through stdout works the same whether the client is local or containerised.
pg dump -d "$DB_URL" --format=custom --compress=9 --verbose \
    > "$WORK/db.dump" 2>"$WORK/dump.log" \
    || { sed 's/^/           /' "$WORK/dump.log" >&2; die "pg_dump failed"; }
DB_BYTES=$(wc -c < "$WORK/db.dump" | tr -d ' ')
[ "$DB_BYTES" -gt 1000 ] || die "the dump is only $DB_BYTES bytes, which is not a database"
say "dumped $(( DB_BYTES / 1024 )) KiB"

# Roles are cluster-wide and so are not in a database dump. Without them a
# restore onto bare metal produces a database whose RLS policies reference
# roles that do not exist. Passwords are deliberately excluded — the hashes
# are not something to ship off-site, and deployment sets them from its own
# environment anyway.
say "dumping the roles"
if pg dumpall -d "$DB_URL" --roles-only --no-role-passwords > "$WORK/roles.sql" 2>"$WORK/roles.log"; then
    say "dumped $(grep -c 'CREATE ROLE' "$WORK/roles.sql" || true) roles"
else
    sed 's/^/           /' "$WORK/roles.log" >&2
    die "pg_dumpall --roles-only failed"
fi

# ------------------------------------------------------------- the attachments
#
# Only for the local storage driver. With STORAGE_DRIVER=s3 the attachments are
# already in a bucket and copying them into this one would double the bill to
# no purpose.
FILES_BYTES=0
if [ -n "${BACKUP_ATTACHMENTS_DIR:-}" ]; then
    if [ -d "$BACKUP_ATTACHMENTS_DIR" ]; then
        say "archiving the attachments"
        tar -czf "$WORK/files.tar.gz" -C "$BACKUP_ATTACHMENTS_DIR" .
        FILES_BYTES=$(wc -c < "$WORK/files.tar.gz" | tr -d ' ')
        say "archived $(( FILES_BYTES / 1024 )) KiB"
    else
        die "BACKUP_ATTACHMENTS_DIR points at nothing: $BACKUP_ATTACHMENTS_DIR"
    fi
fi

# ------------------------------------------------------------------- the upload
#
# The manifest is deliberately plaintext. It lets anyone with bucket access
# audit what was taken and when, and check a downloaded object against its
# hash, without holding the private key — and it names no customer, vehicle or
# amount, so there is nothing in it to protect.
{
    printf 'motion-backup 1\n'
    printf 'stamp=%s\n' "$STAMP"
    printf 'host=%s\n' "$(hostname)"
    printf 'postgres=%s\n' "$(pg psql -d "$DB_URL" -tAc 'show server_version' 2>/dev/null | tr -d '\r' || echo unknown)"
    printf 'tables=%s\n' "$(pg psql -d "$DB_URL" -tAc "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null | tr -d '\r ' || echo unknown)"
    printf 'encrypted=%s\n' "$SEAL"
    printf 'db_bytes=%s\n' "$DB_BYTES"
    printf 'db_sha256=%s\n' "$(openssl dgst -sha256 "$WORK/db.dump" | awk '{print $NF}')"
    printf 'files_bytes=%s\n' "$FILES_BYTES"
    if [ "$FILES_BYTES" -gt 0 ]; then
        printf 'files_sha256=%s\n' "$(openssl dgst -sha256 "$WORK/files.tar.gz" | awk '{print $NF}')"
    fi
    printf 'retention=daily:%s monthly:%s yearly:%s\n' "${KEEP_DAILY:-14}" "${KEEP_MONTHLY:-12}" "${KEEP_YEARLY:-7}"
} > "$WORK/manifest.txt"

# Seal and upload one artefact: plaintext becomes <name>.enc plus a wrapped
# envelope, or goes up as-is when encryption is off.
upload_sealed() {
    local file=$1 key_base=$2
    if [ "$SEAL" = true ]; then
        crypt_seal "$file" "$file.enc" "$file.envelope" "$BACKUP_PUBLIC_KEY"
        s3_put "$file.enc" "$key_base.enc"
        s3_put "$file.envelope" "$key_base.envelope"
    else
        s3_put "$file" "$key_base"
    fi
}

say "uploading to $S3_BUCKET"
upload_sealed "$WORK/db.dump" "$PREFIX/db/$STAMP.dump"
upload_sealed "$WORK/roles.sql" "$PREFIX/roles/$STAMP.sql"
# An `if` rather than `[ ... ] && ...`: under `set -e` a false test as the
# whole command is a failing command, and would end the run here.
if [ "$FILES_BYTES" -gt 0 ]; then
    upload_sealed "$WORK/files.tar.gz" "$PREFIX/files/$STAMP.tar.gz"
fi
s3_put "$WORK/manifest.txt" "$PREFIX/manifest/$STAMP.txt"

# Last, and only now: everything above is in the bucket, so this stamp is a
# complete backup and may be advertised as the newest one.
printf '%s\n' "$STAMP" > "$WORK/LATEST"
s3_put "$WORK/LATEST" "$PREFIX/LATEST"
say "uploaded $STAMP"

# -------------------------------------------------------------------- the prune
say "pruning"
s3_list "$PREFIX/" > "$WORK/keys" || die "could not list the bucket; nothing pruned"
rotate_stamps < "$WORK/keys" | rotate_plan > "$WORK/expired"

before=$(rotate_stamps < "$WORK/keys" | wc -l | tr -d ' ')
expired_count=$(grep -c . "$WORK/expired" || true)

if grep -qxF "$STAMP" "$WORK/expired"; then
    die "the prune wanted to delete the backup just taken; refusing and leaving the bucket alone"
fi

# One pass with grep rather than a loop per expired stamp over every key. The
# nested form was O(stamps x keys) in bash, which on two years of history meant
# half a million iterations before the first delete was sent.
pruned=0
if [ "$expired_count" -gt 0 ]; then
    grep -F -f "$WORK/expired" "$WORK/keys" > "$WORK/doomed" || true
    while read -r key; do
        [ -n "$key" ] || continue
        s3_delete "$key"
        pruned=$((pruned + 1))
    done < "$WORK/doomed"
fi

say "pruning removed $pruned object(s) across $expired_count expired backup(s); $(( before - expired_count )) retained"

# A nightly job that stops running is the most common way backups fail, and it
# fails silently — nobody notices the absence of an email. If a heartbeat URL
# is configured, the monitor on the other end complains when this stops
# arriving.
if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
    curl --silent --show-error --max-time 20 --fail -o /dev/null "$BACKUP_HEARTBEAT_URL" \
        && say "heartbeat sent" || say "WARNING the heartbeat could not be sent"
fi

say "backup $STAMP complete"
