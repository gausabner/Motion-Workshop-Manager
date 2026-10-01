# shellcheck shell=bash
#
# Which backups to keep, and which to delete.
#
# Grandfather-father-son, with one deliberate omission: there is no weekly
# tier. A weekly tier needs a calendar — ISO week numbers — and the three
# `date` implementations this might run under (GNU, BusyBox, BSD) disagree
# about how to ask for one. Months and years are the first six and four
# characters of a UTC stamp, so those tiers are string slicing and cannot be
# wrong. The daily tier is widened to fourteen to cover the gap, which suits a
# workshop better anyway: the mistake an owner notices is usually days old, not
# weeks.
#
# Decisions are made per *stamp*, not per object, because one backup may be
# several objects — the dump, its wrapped key, the attachments tar. Keeping the
# dump and pruning its key would leave an unreadable backup, which is worse
# than having none, because it looks like having one.
#
# Reads: KEEP_DAILY KEEP_MONTHLY KEEP_YEARLY
# Provides: rotate_stamps rotate_plan

# Every distinct backup stamp among the keys on stdin, newest first.
# Stamps are fixed-width UTC, so lexical order is chronological order; keys
# are not, because prefixes and suffixes differ, which is why we sort on the
# extracted stamp rather than the key.
rotate_stamps() {
    grep -oE '[0-9]{8}T[0-9]{6}Z' | sort -ru
}

# The stamps to delete, given every stamp on stdin. Prints nothing when the
# policy keeps everything, so a caller can treat empty output as "no pruning".
rotate_plan() {
    local keep_daily=${KEEP_DAILY:-14}
    local keep_monthly=${KEEP_MONTHLY:-12}
    local keep_yearly=${KEEP_YEARLY:-7}
    local stamp index=0 months="" years="" month year
    local month_is_new year_is_new keep

    while read -r stamp; do
        [ -n "$stamp" ] || continue
        index=$((index + 1))
        month=${stamp:0:6}
        year=${stamp:0:4}

        # These lists hold each month and year once. An earlier version
        # appended on every pass, so fourteen dailies inside one month counted
        # as fourteen months and exhausted the monthly allowance immediately,
        # pruning everything older than a fortnight.
        month_is_new=false
        year_is_new=false
        case " $months " in *" $month "*) ;; *) months="$months $month"; month_is_new=true ;; esac
        case " $years " in *" $year "*) ;; *) years="$years $year"; year_is_new=true ;; esac

        keep=false
        if [ "$index" -le "$keep_daily" ]; then
            keep=true
        elif [ "$month_is_new" = true ] && [ "$(printf '%s' "$months" | wc -w)" -le "$keep_monthly" ]; then
            # Walking newest-first, the first sighting of a month is that
            # month's newest backup. A month already covered by a daily does
            # not need a second copy kept for it.
            keep=true
        elif [ "$year_is_new" = true ] && [ "$(printf '%s' "$years" | wc -w)" -le "$keep_yearly" ]; then
            keep=true
        fi

        [ "$keep" = true ] || printf '%s\n' "$stamp"
    done
}
