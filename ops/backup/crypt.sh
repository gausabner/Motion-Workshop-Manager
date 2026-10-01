# shellcheck shell=bash
#
# Envelope encryption for backups leaving the building.
#
# Why at all: an off-site backup is a complete copy of every workshop's
# customers, vehicles and money, sitting on a third party's disk in another
# country. Encrypting it before upload is what lets the security whitepaper say
# the bucket provider cannot read it, and is the difference between a leaked
# bucket being an incident and a catastrophe.
#
# How: a fresh random passphrase per backup encrypts the dump with AES-256; the
# passphrase is then wrapped with an RSA public key and uploaded beside it. The
# server holds only the public key, so a compromised server can write new
# backups but cannot read any backup, including its own. The private key lives
# wherever the owner keeps irreplaceable things, and never on the server.
#
# The envelope also carries the plaintext's sha256, so a restore proves it
# recovered the bytes that were dumped rather than something a bucket or a
# network corrupted on the way.
#
# No secret is ever passed on a command line. `openssl enc -K` would put the
# key in the process table for anyone running ps; the passphrase goes through a
# 0600 file in a private directory instead.
#
# Provides: crypt_seal crypt_open

# crypt_seal PLAINTEXT CIPHERTEXT ENVELOPE PUBLIC_KEY
crypt_seal() {
    local plain=$1 cipher=$2 envelope=$3 public_key=$4
    local work pass
    work=$(mktemp -d) || return 1
    chmod 700 "$work"
    pass="$work/pass"

    ( umask 077; openssl rand -hex 48 > "$pass" ) || { rm -rf "$work"; return 1; }
    {
        printf 'motion-backup-envelope-1\n'
        printf 'pass=%s\n' "$(cat "$pass")"
        printf 'sha256=%s\n' "$(openssl dgst -sha256 "$plain" | awk '{print $NF}')"
    } > "$work/envelope" || { rm -rf "$work"; return 1; }

    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$pass" \
        -in "$plain" -out "$cipher" || { rm -rf "$work"; return 1; }
    openssl pkeyutl -encrypt -pubin -inkey "$public_key" \
        -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
        -in "$work/envelope" -out "$envelope" || { rm -rf "$work"; return 1; }

    rm -rf "$work"
}

# crypt_open CIPHERTEXT ENVELOPE PRIVATE_KEY PLAINTEXT
# Fails, and leaves nothing behind, if the recovered bytes do not match the
# sha256 recorded when the backup was sealed.
crypt_open() {
    local cipher=$1 envelope=$2 private_key=$3 plain=$4
    local work pass want got
    work=$(mktemp -d) || return 1
    chmod 700 "$work"

    if ! openssl pkeyutl -decrypt -inkey "$private_key" \
            -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
            -in "$envelope" -out "$work/envelope" 2>"$work/err"; then
        echo "ops/backup: could not unwrap the envelope — wrong private key?" >&2
        sed 's/^/           /' "$work/err" >&2
        rm -rf "$work"; return 1
    fi
    if ! head -1 "$work/envelope" | grep -q '^motion-backup-envelope-1$'; then
        echo "ops/backup: unrecognised envelope format" >&2
        rm -rf "$work"; return 1
    fi

    pass="$work/pass"
    ( umask 077; sed -n 's/^pass=//p' "$work/envelope" > "$pass" )
    want=$(sed -n 's/^sha256=//p' "$work/envelope")

    if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$pass" \
            -in "$cipher" -out "$plain" 2>"$work/err"; then
        echo "ops/backup: decryption failed — the ciphertext is damaged" >&2
        sed 's/^/           /' "$work/err" >&2
        rm -f "$plain"; rm -rf "$work"; return 1
    fi

    got=$(openssl dgst -sha256 "$plain" | awk '{print $NF}')
    if [ "$got" != "$want" ]; then
        echo "ops/backup: the restored dump does not match its recorded hash" >&2
        echo "           sealed  $want" >&2
        echo "           opened  $got" >&2
        rm -f "$plain"; rm -rf "$work"; return 1
    fi

    rm -rf "$work"
}
