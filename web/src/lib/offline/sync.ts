import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { clockOff, clockOn } from "@/lib/time/clocking";
import { triage, type ClockEvent, type EventProblem } from "./queue";

/**
 * Applying a queue of taps made offline.
 *
 * Replayed in the order they happened, each carrying the moment it was made,
 * so the result matches what would have been recorded had the signal held.
 *
 * Sending twice must be safe, because a phone that uploads a queue and then
 * loses the reply will try again. A Start carries the phone's own reference
 * and the unique index on (tenantId, clientRef) is what makes the second
 * attempt a no-op — checked by reading first, since inside a transaction a
 * unique clash aborts everything after it and cannot be caught.
 */

export type SyncResult = {
    applied: number;
    alreadyIn: number;
    problems: EventProblem[];
};

export async function applyQueue(
    db: TenantDb,
    tenantId: string,
    membershipId: string,
    events: ClockEvent[],
    now = new Date(),
): Promise<SyncResult> {
    const { ready, problems } = triage(events, now);
    let applied = 0;
    let alreadyIn = 0;

    for (const event of ready) {
        const at = new Date(event.at);
        try {
            if (event.kind === "on") {
                const seen = await db.timeEntry.findFirst({ where: { clientRef: event.ref }, select: { id: true } });
                if (seen) { alreadyIn += 1; continue; }
                await db.$transaction(async (tx) => {
                    const result = await clockOn(tx, tenantId, membershipId, event.documentId, at);
                    // `clientRef: null` in the filter matters: tapping Start twice on the job already
                    // running returns the *existing* entry, and that entry keeps the reference of the
                    // tap that actually started it.
                    await tx.timeEntry.updateMany({ where: { id: result.entryId, clientRef: null }, data: { clientRef: event.ref } });
                });
                applied += 1;
            } else {
                // A Stop with nothing running is not an error: the queue arrived after
                // somebody at the counter had already closed the mechanic's clock.
                const stopped = await db.$transaction((tx) => clockOff(tx, membershipId, at));
                if (stopped) applied += 1; else alreadyIn += 1;
            }
        } catch (error) {
            problems.push({ ref: event.ref, reason: error instanceof Error ? error.message : "That tap could not be applied." });
        }
    }

    return { applied, alreadyIn, problems };
}
