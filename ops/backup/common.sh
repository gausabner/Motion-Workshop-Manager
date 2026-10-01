# shellcheck shell=bash
#
# Configuration and the small things all three scripts need.
#
# Provides: load_config say die pg_url_without_query pg stamp_now

say() { printf '%s  %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die() { printf 'ops/backup: %s\n' "$*" >&2; exit 1; }

# The config file, which holds credentials and so is never in the repository.
# MOTION_BACKUP_ENV overrides the location, which is how the tests point the
# scripts at a throwaway bucket.
load_config() {
    local file=${MOTION_BACKUP_ENV:-/etc/motion/backup.env}
    [ -f "$file" ] || die "no config at $file (copy ops/backup/backup.env.example)"
    # shellcheck disable=SC1090
    set -a; . "$file"; set +a
}

# libpq rejects connection URIs carrying parameters it does not know, and
# Prisma's DATABASE_URL ends in ?schema=public. Passing it to pg_dump
# unchanged fails with `invalid URI query parameter: "schema"`, so the query
# string comes off here. A non-public schema would need more than stripping,
# hence the refusal rather than a silent trim.
pg_url_without_query() {
    local url=$1 query=${1#*\?}
    case $url in
        *\?*)
            case $query in
                schema=public|schema=public\&*|*\&schema=public|*\&schema=public\&*|"") ;;
                *) case $query in *schema=*) die "DATABASE_URL names a schema other than public; the backup scripts assume public" ;; esac ;;
            esac
            printf '%s' "${url%%\?*}" ;;
        *) printf '%s' "$url" ;;
    esac
}

# PostgreSQL client commands. PG_DUMP and friends may be several words — on a
# host where the database runs in a container there is no client installed, and
# the natural answer is `docker exec -i motion-db pg_dump`. Hence the array.
pg() {
    local which=$1; shift
    local -a cmd
    case $which in
        dump)    read -r -a cmd <<< "${PG_DUMP:-pg_dump}" ;;
        dumpall) read -r -a cmd <<< "${PG_DUMPALL:-pg_dumpall}" ;;
        restore) read -r -a cmd <<< "${PG_RESTORE:-pg_restore}" ;;
        psql)    read -r -a cmd <<< "${PSQL:-psql}" ;;
        *) die "pg: unknown client $which" ;;
    esac
    "${cmd[@]}" "$@"
}

stamp_now() { date -u +%Y%m%dT%H%M%SZ; }
