#!/usr/bin/env bash
#
# The retention policy, exercised against generated histories. Pruning is the
# one part of a backup system whose bugs are silent: it deletes the thing you
# were going to need, and says nothing until the day you need it.
#
# Run: bash ops/backup/rotate.test.sh
set -uo pipefail
cd "$(dirname "$0")"
# shellcheck source=./rotate.sh
. ./rotate.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

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

# One stamp per day, newest first, counting back from 2026-10-01.
history() {
    python3 - "$1" <<'PY'
import sys, datetime
start = datetime.date(2026, 10, 1)
for i in range(int(sys.argv[1])):
    print((start - datetime.timedelta(days=i)).strftime("%Y%m%dT020000Z"))
PY
}

echo "stamp extraction"
check "stamps are pulled out of keys and sorted newest first" \
    "$(printf 'motion/db/20260801T020000Z.dump\nmotion/db/20261001T020000Z.dump\nmotion/db/20260901T020000Z.dump\n' | rotate_stamps | tr '\n' ' ')" \
    "20261001T020000Z 20260901T020000Z 20260801T020000Z "
check "several objects for one backup collapse to one stamp" \
    "$(printf 'db/20261001T020000Z.dump.enc\ndb/20261001T020000Z.key\nfiles/20261001T020000Z.tar.gz\n' | rotate_stamps | wc -l | tr -d ' ')" \
    "1"

echo "a short history is never pruned"
check "ten dailies with a fortnight's window: nothing deleted" \
    "$(history 10 | KEEP_DAILY=14 rotate_plan | wc -l | tr -d ' ')" "0"
check "exactly fourteen: nothing deleted" \
    "$(history 14 | KEEP_DAILY=14 rotate_plan | wc -l | tr -d ' ')" "0"

echo "the daily window holds, and does not eat the monthly allowance"
# 20 dailies back from 1 Oct reach 12 Sep. The newest 14 are kept outright;
# of the remaining 6 (17 Sep back to 12 Sep) all are in September, which the
# daily window already covers — so all 6 go.
check "a twenty-day history keeps fourteen" \
    "$(history 20 | KEEP_DAILY=14 KEEP_MONTHLY=12 rotate_plan | wc -l | tr -d ' ')" "6"
check "the fifteenth-oldest is the first to go" \
    "$(history 20 | KEEP_DAILY=14 KEEP_MONTHLY=12 rotate_plan | head -1)" "20260917T020000Z"
check "the newest is never in the delete list" \
    "$(history 400 | KEEP_DAILY=14 rotate_plan | grep -c '20261001T020000Z')" "0"

echo "monthly and yearly tiers"
# Two years of nightly backups, pruned, come to twenty-five objects:
#
#   14  dailies            1 Oct 2026 back to 18 Sep 2026
#   10  monthlies          the last day of Aug 2026 back to Nov 2025
#    1  yearly             31 Dec 2024
#
# Only ten monthlies, not twelve, because September and October 2026 are
# already covered by the daily window and count against the allowance. 2025
# needs no separate yearly either — 31 Dec 2025 is kept as a monthly and
# serves as both. That overlap is the policy working, not a gap in it.
history 730 | KEEP_DAILY=14 KEEP_MONTHLY=12 KEEP_YEARLY=7 rotate_plan | sort > "$tmp/deleted"
comm -23 <(history 730 | sort) "$tmp/deleted" | sort -r > "$tmp/kept"

check "two years of nightly backups reduce to twenty-five" \
    "$(grep -c . "$tmp/kept")" "25"
check "the first fourteen kept are the daily window, unbroken" \
    "$(sed -n '1,14p' "$tmp/kept" | sed -n '1p;14p' | tr '\n' ' ')" \
    "20261001T020000Z 20260918T020000Z "
check "the monthly keeps are each month's last day" \
    "$(sed -n '15,17p' "$tmp/kept" | tr '\n' ' ')" \
    "20260831T020000Z 20260731T020000Z 20260630T020000Z "
check "February is kept on the 28th, so no calendar arithmetic is assumed" \
    "$(grep -c '^20260228' "$tmp/kept")" "1"
check "the monthly chain reaches back to November 2025 and stops" \
    "$(sed -n '24p' "$tmp/kept")" "20251130T020000Z"
check "2025 needs no separate yearly: its December monthly serves as one" \
    "$(grep -c '^2025' "$tmp/kept")" "2"
check "2024 survives only as its yearly" \
    "$(grep '^2024' "$tmp/kept" | tr '\n' ' ')" "20241231T020000Z "
check "nothing kept is also deleted" \
    "$(comm -12 "$tmp/kept" <(sort "$tmp/deleted") | grep -c .)" "0"
check "every stamp is either kept or deleted, none lost" \
    "$(( $(grep -c . "$tmp/kept") + $(grep -c . "$tmp/deleted") ))" "730"

echo "gaps do not confuse it"
check "a history with a three-week hole still keeps the newest fourteen" \
    "$(printf '20261001T020000Z\n20260901T020000Z\n20260801T020000Z\n' | KEEP_DAILY=14 rotate_plan | wc -l | tr -d ' ')" "0"
check "two backups on the same day are two stamps, both inside the window" \
    "$(printf '20261001T020000Z\n20261001T140000Z\n' | KEEP_DAILY=14 rotate_plan | wc -l | tr -d ' ')" "0"

echo
if [ "$fails" -eq 0 ]; then echo "rotate.sh: all checks passed"; else echo "rotate.sh: $fails check(s) failed"; fi
exit "$fails"
