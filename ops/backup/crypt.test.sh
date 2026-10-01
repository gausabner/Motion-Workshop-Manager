#!/usr/bin/env bash
#
# The envelope, round-tripped — and more importantly, the ways it must refuse.
# A backup that silently restores corrupt bytes is the worst outcome available,
# so every failure path gets a check of its own.
#
# Run: bash ops/backup/crypt.test.sh
set -uo pipefail
cd "$(dirname "$0")"
# shellcheck source=./crypt.sh
. ./crypt.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Is NEEDLE anywhere in FILE, treating both as bytes? Prints yes or no.
contains() {
    python3 -c 'import sys; sys.stdout.write("yes" if sys.argv[2].encode() in open(sys.argv[1],"rb").read() else "no")' "$1" "$2"
}

# Does any 32-byte stretch of A appear in B? Prints the first offset found, or
# "none". Thirty-two bytes of incompressible input recurring by chance is not
# a thing that happens.
leaks() {
    python3 - "$1" "$2" <<'PYEOF'
import sys
a = open(sys.argv[1], "rb").read()
b = open(sys.argv[2], "rb").read()
for i in range(0, max(0, len(a) - 32), 997):
    if a[i:i + 32] in b:
        print(i); break
else:
    print("none")
PYEOF
}

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

openssl genrsa -out "$tmp/priv.pem" 3072 2>/dev/null
openssl rsa -in "$tmp/priv.pem" -pubout -out "$tmp/pub.pem" 2>/dev/null
openssl genrsa -out "$tmp/other.pem" 3072 2>/dev/null

# Incompressible bytes, so a cipher that quietly did nothing would show up.
head -c 300000 /dev/urandom > "$tmp/plain"

echo "sealing and opening"
crypt_seal "$tmp/plain" "$tmp/cipher" "$tmp/env" "$tmp/pub.pem" && sealed=ok || sealed=failed
check "a dump seals without error" "$sealed" "ok"
check "the ciphertext is not the plaintext" \
    "$(cmp -s "$tmp/plain" "$tmp/cipher" && echo same || echo different)" "different"
# Binary-safe: grep on these files is unreliable and, asked the wrong way,
# cheerfully reports a match for an empty pattern.
check "no run of the plaintext survives into the ciphertext" \
    "$(leaks "$tmp/plain" "$tmp/cipher")" "none"

crypt_open "$tmp/cipher" "$tmp/env" "$tmp/priv.pem" "$tmp/back" && opened=ok || opened=failed
check "it opens again with the private key" "$opened" "ok"
check "the recovered bytes are identical" \
    "$(cmp -s "$tmp/plain" "$tmp/back" && echo same || echo different)" "same"

echo "the envelope holds a passphrase and a hash, and nothing in the clear"
check "the wrapped envelope is one RSA block" "$(wc -c < "$tmp/env" | tr -d ' ')" "384"
check "the wrapped envelope shows no trace of its own markers" \
    "$(contains "$tmp/env" 'pass=')$(contains "$tmp/env" 'motion-backup-envelope-1')" "nono"

echo "two backups of the same bytes never share a key"
crypt_seal "$tmp/plain" "$tmp/cipher2" "$tmp/env2" "$tmp/pub.pem"
check "the same input seals to different ciphertext each time" \
    "$(cmp -s "$tmp/cipher" "$tmp/cipher2" && echo same || echo different)" "different"

echo "refusals"
crypt_open "$tmp/cipher" "$tmp/env" "$tmp/other.pem" "$tmp/no1" 2>/dev/null && r=opened || r=refused
check "the wrong private key is refused" "$r" "refused"
check "and leaves no half-written dump behind" "$([ -e "$tmp/no1" ] && echo present || echo absent)" "absent"

# Flip a byte in the middle of the ciphertext. AES-CBC will still decrypt
# something; the recorded hash is what catches it.
cp "$tmp/cipher" "$tmp/tampered"
printf '\xff' | dd of="$tmp/tampered" bs=1 seek=150000 count=1 conv=notrunc status=none
crypt_open "$tmp/tampered" "$tmp/env" "$tmp/priv.pem" "$tmp/no2" 2>/dev/null && r=opened || r=refused
check "a single flipped byte is caught by the recorded hash" "$r" "refused"
check "and that dump is removed rather than left to be trusted" \
    "$([ -e "$tmp/no2" ] && echo present || echo absent)" "absent"

printf 'not an envelope at all, just some bytes padded out to length ........' > "$tmp/junk"
crypt_open "$tmp/cipher" "$tmp/junk" "$tmp/priv.pem" "$tmp/no3" 2>/dev/null && r=opened || r=refused
check "a junk envelope is refused" "$r" "refused"

echo "an empty dump is still a valid backup"
: > "$tmp/empty"
crypt_seal "$tmp/empty" "$tmp/ec" "$tmp/ee" "$tmp/pub.pem" \
    && crypt_open "$tmp/ec" "$tmp/ee" "$tmp/priv.pem" "$tmp/eb" && r=ok || r=failed
check "zero bytes round-trip" "$r" "ok"
check "and come back as zero bytes" "$(wc -c < "$tmp/eb" | tr -d ' ')" "0"

echo
if [ "$fails" -eq 0 ]; then echo "crypt.sh: all checks passed"; else echo "crypt.sh: $fails check(s) failed"; fi
exit "$fails"
