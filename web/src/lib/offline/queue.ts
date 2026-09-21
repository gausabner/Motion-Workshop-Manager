/**
 * Taps made with no signal.
 *
 * A mechanic under a car in a workshop with thick walls presses Start, and
 * nothing should depend on whether the phone had a bar at that moment. The tap
 * is kept on the phone with the time it happened, and sent when the signal
 * comes back.
 *
 * Which means the *time* is the payload. A queued Start replayed twenty
 * minutes later must record when the spanner was picked up, not when the wifi
 * returned — otherwise the mechanic loses the twenty minutes and the job's
 * charged hours are wrong. Every rule here exists to let the server trust a
 * timestamp it did not generate.
 */

export type ClockEvent =
    | { kind: "on"; ref: string; at: string; documentId: string }
    | { kind: "off"; ref: string; at: string };

/** Clocks differ. A phone a little ahead is normal; one a day ahead is broken or being played with. */
export const SKEW_TOLERANCE_MS = 2 * 60 * 1000;

/** Older than this and it is not a dropped signal any more — it is a phone left in a locker. Those go to the counter as a manual correction. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type EventProblem = { ref: string; reason: string };

/**
 * What the server will accept from a phone. Deliberately strict: this is the
 * one place where a client decides a time that lands in the workshop's books.
 */
export function eventProblem(event: ClockEvent, now: Date): string | null {
    const at = new Date(event.at);
    if (Number.isNaN(at.getTime())) return "That tap has no readable time on it.";
    if (at.getTime() > now.getTime() + SKEW_TOLERANCE_MS) return "That tap is dated in the future — check the phone's clock.";
    if (now.getTime() - at.getTime() > STALE_AFTER_MS) return "That tap is over a day old. Add the time at the counter instead.";
    if (event.kind === "on" && !event.documentId) return "That tap does not say which job.";
    if (!event.ref) return "That tap has no reference, so it cannot be sent safely.";
    return null;
}

/**
 * Sort by when things happened, not when they arrived.
 *
 * Two phones, or one phone and the counter, can send overlapping work. Replay
 * in the order the taps happened and the result is the same as if every tap
 * had gone through live, which is the whole point.
 */
export function inOrder(events: ClockEvent[]): ClockEvent[] {
    return [...events].sort((a, b) => {
        const diff = new Date(a.at).getTime() - new Date(b.at).getTime();
        // A Start and a Stop recorded in the same second must still apply in the order they were made.
        return diff !== 0 ? diff : events.indexOf(a) - events.indexOf(b);
    });
}

/** Split a queue into what will be applied and what has to be explained to the mechanic. */
export function triage(events: ClockEvent[], now: Date): { ready: ClockEvent[]; problems: EventProblem[] } {
    const ready: ClockEvent[] = [];
    const problems: EventProblem[] = [];
    const seen = new Set<string>();
    for (const event of inOrder(events)) {
        const reason = eventProblem(event, now);
        if (reason) {
            problems.push({ ref: event.ref || "unknown", reason });
        } else if (seen.has(event.ref)) {
            // The same tap sent twice in one batch: harmless, and not worth telling anybody about.
            continue;
        } else {
            seen.add(event.ref);
            ready.push(event);
        }
    }
    return { ready, problems };
}

/** How the floor app says what is waiting, without making a mechanic count. */
export function waitingLabel(count: number): string | null {
    if (count <= 0) return null;
    return count === 1 ? "1 change waiting to send" : `${count} changes waiting to send`;
}
