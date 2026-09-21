/**
 * Hours worked against hours charged (R4). Pure, so the numbers an owner
 * uses to judge a mechanic are tested rather than trusted.
 *
 * "Worked" is what the clock says. "Charged" is the labour on the invoice
 * the job became. Their ratio is the benchmark's efficiency figure: above
 * 100% the workshop billed more time than the job took, below it the job ran
 * over or the time was given away.
 */

/** Longer than this without a clock-off is almost certainly a forgotten tap, not a job. */
export const SUSPECT_MINUTES = 10 * 60;

export function entryMinutes(startedAt: Date, endedAt: Date): number {
    return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

export function isSuspect(minutes: number): boolean {
    return minutes > SUSPECT_MINUTES;
}

/**
 * Whether a clock-off may close the entry that is open.
 *
 * Live this is always true: the stop is now and the entry began earlier. It
 * matters when a phone replays a queue of taps made with no signal — an old
 * Stop can arrive to find a newer job running, and closing that one would
 * record work that ended before it began.
 */
export function stopApplies(at: Date, startedAt: Date): boolean {
    return at > startedAt;
}

/**
 * When two mechanics worked one job, the hours it was charged at are shared
 * by how long each actually spent on it — the fair split, and the one that
 * makes per-mechanic efficiency add back up to the job's.
 */
export function splitCharged(chargedMinutes: number, workedByMechanic: Record<string, number>): Record<string, number> {
    const total = Object.values(workedByMechanic).reduce((s, m) => s + m, 0);
    const ids = Object.keys(workedByMechanic);
    if (ids.length === 0) return {};
    if (total === 0) return Object.fromEntries(ids.map((id) => [id, Math.round(chargedMinutes / ids.length)]));
    const out: Record<string, number> = {};
    let given = 0;
    ids.forEach((id, i) => {
        // The last share takes the remainder, so rounding never loses or invents a minute.
        const share = i === ids.length - 1 ? chargedMinutes - given : Math.round((chargedMinutes * workedByMechanic[id]) / total);
        out[id] = share;
        given += share;
    });
    return out;
}

/** Null when nothing was worked: 0% would say "gave it all away", which is not what an empty week means. */
export function efficiency(chargedMinutes: number, workedMinutes: number): number | null {
    return workedMinutes > 0 ? Math.round((chargedMinutes / workedMinutes) * 100) : null;
}

export function hoursLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
}
