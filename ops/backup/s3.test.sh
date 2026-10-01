#!/usr/bin/env bash
#
# Checks the signer in s3.sh against the worked example AWS publishes for
# GET Object on `examplebucket`, the same vectors web/src/lib/storage/sigv4.test.ts
# uses. Two independent implementations agreeing with AWS is the only reason to
# trust either before a real bucket is pointed at them.
#
#   https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
#
# Run: bash ops/backup/s3.test.sh
set -uo pipefail
cd "$(dirname "$0")"
# shellcheck source=./s3.sh
. ./s3.sh

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

SECRET="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
EMPTY="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

echo "sha256"
check "an empty body hashes to the well-known value" "$(printf '' | s3__sha256)" "$EMPTY"
check "abc hashes as published" "$(printf 'abc' | s3__sha256)" \
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

echo "uri encoding"
check "a space becomes %20 and a slash is kept" "$(s3__uri_encode 'a/b c.txt' false)" 'a/b%20c.txt'
check "a slash is escaped when asked" "$(s3__uri_encode 'a/b' true)" 'a%2Fb'
check "the unreserved set is left alone" "$(s3__uri_encode '~-._')" '~-._'
check "utf-8 is escaped byte by byte" "$(s3__uri_encode 'é')" '%C3%A9'

echo "signing key derivation"
key=$(s3__hmac "$(s3__hex "AWS4$SECRET")" "20130524")
key=$(s3__hmac "$key" "us-east-1")
key=$(s3__hmac "$key" "s3")
key=$(s3__hmac "$key" "aws4_request")
check "the four-step chain matches AWS's example" "$key" \
    "dbb893acc010964918f1fd433add87c70e8b0db6be30c1fbeafefa5ec6ba8378"

echo "canonical request and string to sign"
canonical=$(printf 'GET\n/test.txt\n\nhost:examplebucket.s3.amazonaws.com\nrange:bytes=0-9\nx-amz-content-sha256:%s\nx-amz-date:20130524T000000Z\n\nhost;range;x-amz-content-sha256;x-amz-date\n%s' "$EMPTY" "$EMPTY")
check "the canonical request hashes as published" "$(printf '%s' "$canonical" | s3__sha256)" \
    "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972"

string_to_sign=$(printf 'AWS4-HMAC-SHA256\n20130524T000000Z\n20130524/us-east-1/s3/aws4_request\n%s' \
    "$(printf '%s' "$canonical" | s3__sha256)")
check "the signature matches AWS's example end to end" "$(s3__hmac "$key" "$string_to_sign")" \
    "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"

echo "our own canonical form, which signs three headers rather than four"
S3_ENDPOINT="https://s3.example.com" S3_BUCKET="motion" S3_REGION="us-east-1" \
S3_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE" S3_SECRET_ACCESS_KEY="$SECRET" \
    header=$(s3__authorization GET "motion.s3.example.com" "/a.dump" "" "$EMPTY" "20130524T000000Z" "20130524")
check "the credential scope and signed headers are what we send" \
    "${header%, Signature=*}" \
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date"
check "the signature is 64 hex characters" \
    "$(printf '%s' "${header##*Signature=}" | grep -cE '^[0-9a-f]{64}$')" "1"

echo "url and host selection"
# Set these in the shell rather than as a command prefix: $(...) is expanded
# before the prefixed command runs, so a prefix would never reach s3__target.
S3_ENDPOINT="https://s3.example.com"; S3_BUCKET="motion"
S3_FORCE_PATH_STYLE=false
check "virtual-hosted style puts the bucket in the host" "$(s3__target 'daily/a b.dump' | tr '\n' '|')" \
    "https://motion.s3.example.com/daily/a%20b.dump|motion.s3.example.com|/daily/a%20b.dump|"
S3_FORCE_PATH_STYLE=true
check "path style puts the bucket in the path" "$(s3__target 'daily/a.dump' | tr '\n' '|')" \
    "https://s3.example.com/motion/daily/a.dump|s3.example.com|/motion/daily/a.dump|"
# A listing addresses the bucket itself. AWS normalises a trailing slash away;
# not every S3-compatible store does, and the signature covers what we send.
check "path style addresses the bucket root without a trailing slash" \
    "$(s3__target '' | tr '\n' '|')" \
    "https://s3.example.com/motion|s3.example.com|/motion|"
S3_FORCE_PATH_STYLE=false
check "virtual-hosted style addresses the bucket root as /" \
    "$(s3__target '' | tr '\n' '|')" \
    "https://motion.s3.example.com/|motion.s3.example.com|/|"

echo
if [ "$fails" -eq 0 ]; then echo "s3.sh: all checks passed"; else echo "s3.sh: $fails check(s) failed"; fi
exit "$fails"
