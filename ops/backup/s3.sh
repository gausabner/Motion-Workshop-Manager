# shellcheck shell=bash
#
# AWS Signature Version 4 against any S3-compatible bucket, in bash and
# openssl alone.
#
# This is deliberately not the TypeScript client in web/src/lib/storage. A
# backup has to run when the application will not start — a bad migration, a
# wiped node_modules, a half-pulled image — so it may not depend on the
# application, its runtime, or its packages. What is here needs bash, curl and
# openssl, which a Linux server has before anyone installs anything.
#
# Verified against AWS's published worked example by s3.test.sh. Run it after
# touching anything below.
#
# Reads: S3_ENDPOINT S3_BUCKET S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
#        S3_FORCE_PATH_STYLE
# Provides: s3_put s3_get s3_delete s3_list

S3_EMPTY_SHA256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

# --fail-with-body arrived in curl 7.76; Ubuntu 20.04 still ships 7.68, where
# an unrecognised option fails every request for a reason that looks nothing
# like the cause. Fall back to plain --fail there, which loses the server's
# error document but not the failure itself.
if curl --help all 2>/dev/null | grep -q -- '--fail-with-body'; then
    S3_FAIL_OPT="--fail-with-body"
else
    S3_FAIL_OPT="--fail"
fi

# Hex of a sha256, from stdin. `openssl dgst` prefixes "(stdin)= " on some
# builds and prints bare hex on others, so take the last field either way.
s3__sha256() { openssl dgst -sha256 | awk '{print $NF}'; }

# HMAC-SHA256 keyed by a hex string, returning hex. The chained derivation
# below needs binary keys, and -macopt hexkey is the only portable way to hand
# openssl one without writing it to a file.
s3__hmac() { printf '%s' "$2" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$1" -binary | od -An -vtx1 | tr -d ' \n'; }

# Hex of a literal string, for seeding the derivation with "AWS4<secret>".
s3__hex() { printf '%s' "$1" | od -An -vtx1 | tr -d ' \n'; }

# Percent-encode per RFC 3986. AWS signs the encoded form, and its unreserved
# set is narrower than most encoders use: -_.~ and nothing else.
#
# This walks the string's *bytes*, taken from od, rather than its characters.
# Going character by character and asking printf for the numeric value of a
# multibyte one yields a sign-extended mess, so "é" encoded as a single step
# produced %FFFFFFFFFFFFFFC3%FFFFFFFFFFFFFFA9 instead of %C3%A9. Keys are ASCII
# today, but a workshop name reaching a key one day should not corrupt a
# signature.
#
# `encode_slash` is false for object paths and true for query values.
s3__uri_encode() {
    local s=$1 encode_slash=${2:-true} out="" hex byte n literal
    hex=$(printf '%s' "$s" | od -An -vtx1 | tr -d ' \n')
    while [ -n "$hex" ]; do
        byte=${hex:0:2}
        hex=${hex:2}
        n=$((16#$byte))
        if (( (n >= 48 && n <= 57) || (n >= 65 && n <= 90) || (n >= 97 && n <= 122) \
              || n == 45 || n == 46 || n == 95 || n == 126 )); then
            printf -v literal "\\x$byte"
            out+=$literal
        elif (( n == 47 )) && [ "$encode_slash" != true ]; then
            out+='/'
        else
            out+=$(printf '%%%02X' "$n")
        fi
    done
    printf '%s' "$out"
}

s3__require() {
    local name
    for name in S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
        if [ -z "${!name:-}" ]; then
            echo "ops/backup: $name is not set (see backup.env.example)" >&2
            return 1
        fi
    done
}

# Where a key lives: https://host/bucket/key for path style, or
# https://bucket.host/key for the virtual-hosted form most providers prefer.
# Prints "<url>\n<host>\n<canonical path>", because signing needs all three and
# they have to agree.
s3__target() {
    local key=$1 scheme host base encoded path
    base=${S3_ENDPOINT%/}
    scheme=${base%%://*}
    host=${base#*://}
    encoded=$(s3__uri_encode "$key" false)
    if [ "${S3_FORCE_PATH_STYLE:-false}" = true ]; then
        path="/$(s3__uri_encode "$S3_BUCKET" false)"
        # An empty key means the bucket itself, as a listing does. AWS
        # normalises "/bucket/" to "/bucket"; not every S3-compatible store
        # does, and the signature covers whichever one we send.
        [ -n "$encoded" ] && path="$path/$encoded"
    else
        host="$S3_BUCKET.$host"
        path="/$encoded"
    fi
    printf '%s://%s%s\n%s\n%s\n' "$scheme" "$host" "$path" "$host" "$path"
}

# The Authorization header for one request. Exactly three headers are signed —
# host, x-amz-content-sha256, x-amz-date — which keeps the canonical form small
# enough to reason about. Anything curl adds unsigned is ignored by S3.
s3__authorization() {
    local method=$1 host=$2 path=$3 query=$4 payload_hash=$5 stamp=$6 day=$7
    local canonical scope string_to_sign key signature
    canonical=$(printf '%s\n%s\n%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n\nhost;x-amz-content-sha256;x-amz-date\n%s' \
        "$method" "$path" "$query" "$host" "$payload_hash" "$stamp" "$payload_hash")
    scope="$day/${S3_REGION:-auto}/s3/aws4_request"
    string_to_sign=$(printf 'AWS4-HMAC-SHA256\n%s\n%s\n%s' \
        "$stamp" "$scope" "$(printf '%s' "$canonical" | s3__sha256)")

    key=$(s3__hmac "$(s3__hex "AWS4$S3_SECRET_ACCESS_KEY")" "$day")
    key=$(s3__hmac "$key" "${S3_REGION:-auto}")
    key=$(s3__hmac "$key" "s3")
    key=$(s3__hmac "$key" "aws4_request")
    signature=$(s3__hmac "$key" "$string_to_sign")

    printf 'AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=%s' \
        "$S3_ACCESS_KEY_ID" "$scope" "$signature"
}

# One signed request. Writes the body to $6 when given, and fails on any
# non-2xx so a caller using `set -e` stops rather than carrying on with an
# error document it mistook for data.
s3__request() {
    local method=$1 key=$2 query=$3 payload_hash=$4 body_file=$5 out_file=${6:-/dev/null}
    local url host path stamp day auth code
    s3__require || return 1
    { read -r url; read -r host; read -r path; } < <(s3__target "$key")
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    day=${stamp%%T*}
    auth=$(s3__authorization "$method" "$host" "$path" "$query" "$payload_hash" "$stamp" "$day")

    local -a args=(
        --silent --show-error "$S3_FAIL_OPT"
        -X "$method"
        -H "Host: $host"
        -H "x-amz-content-sha256: $payload_hash"
        -H "x-amz-date: $stamp"
        -H "Authorization: $auth"
        -H "Expect:"
        -o "$out_file"
        -w '%{http_code}'
    )
    [ -n "$body_file" ] && args+=(--upload-file "$body_file")
    [ -n "$query" ] && url="$url?$query"

    if ! code=$(curl "${args[@]}" "$url"); then
        echo "ops/backup: $method $key failed (HTTP ${code:-none})" >&2
        [ "$out_file" != /dev/null ] && head -c 600 "$out_file" >&2 && echo >&2
        return 1
    fi
}

# Upload a file. The payload hash is the file's own sha256, so a truncated or
# altered upload is rejected by the bucket rather than silently stored.
s3_put() {
    local file=$1 key=$2
    s3__request PUT "$key" "" "$(s3__sha256 < "$file")" "$file"
}

s3_get() { s3__request GET "$1" "" "$S3_EMPTY_SHA256" "" "$2"; }

s3_delete() { s3__request DELETE "$1" "" "$S3_EMPTY_SHA256" ""; }

# Every key under a prefix, newest-last, following continuation tokens so a
# bucket with more than a thousand objects still prunes correctly. Query
# parameters must be sorted for signing; continuation-token, list-type and
# prefix already are.
s3_list() {
    local prefix=$1 token="" query xml
    xml=$(mktemp) || return 1
    while :; do
        query="list-type=2&prefix=$(s3__uri_encode "$prefix")"
        [ -n "$token" ] && query="continuation-token=$(s3__uri_encode "$token")&$query"
        s3__request GET "" "$query" "$S3_EMPTY_SHA256" "" "$xml" || { rm -f "$xml"; return 1; }
        tr '<' '\n' < "$xml" | sed -n 's|^Key>||p'
        token=$(tr '<' '\n' < "$xml" | sed -n 's|^NextContinuationToken>||p' | head -1)
        [ -n "$token" ] || break
    done
    rm -f "$xml"
}
