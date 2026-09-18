import "server-only";
import type { TenantTx } from "@/lib/tenant-db";
import { entryMinutes } from "@/lib/time/clock";

/**
 * Clocking on and off a job (R4). A mechanic is on one job at a time:
 * starting another stops the one that was running, because that is what
 * walking to the next car means.
 *
 * Every operation first locks the mechanic's membership row, so a double tap
 * on a phone — two requests a few milliseconds apart — cannot leave two
 * clocks running. Kept out of the "use server" module so it can be exercised
 * against a real database.
 */

async function lockMechanic(tx: TenantTx, membershipId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE id = ${membershipId} FOR UPDATE`;
}

/** Stop whatever this mechanic has running. Returns the entry stopped, if any. */
export async function stopRunning(tx: TenantTx, membershipId: string, at: Date): Promise<{ id: string; documentId: string; minutes: number } | null> {
    const open = await tx.timeEntry.findFirst({ where: { mechanicId: membershipId, endedAt: null }, select: { id: true, documentId: true, startedAt: true } });
    if (!open) return null;
    const minutes = entryMinutes(open.startedAt, at);
    await tx.timeEntry.update({ where: { id: open.id }, data: { endedAt: at, minutes } });
    return { id: open.id, documentId: open.documentId, minutes };
}

export async function clockOn(tx: TenantTx, tenantId: string, membershipId: string, documentId: string, at = new Date()) {
    await lockMechanic(tx, membershipId);

    const mechanic = await tx.membership.findUnique({ where: { id: membershipId }, select: { status: true, isMechanic: true, showOnDiary: true } });
    if (!mechanic || mechanic.status !== "ACTIVE" || !(mechanic.isMechanic || mechanic.showOnDiary)) throw new Error("Only mechanics clock on to jobs");

    const doc = await tx.document.findUnique({ where: { id: documentId }, select: { id: true, type: true, state: true, jobStatus: true, mechanicId: true } });
    if (!doc) throw new Error("That job is no longer there");
    if (doc.type !== "BOOKING" && doc.type !== "JOB_CARD") throw new Error("Time goes on a booking or job card");
    if (doc.state !== "DRAFT") throw new Error("That job has been closed off");

    // Tapping Start on the job already running changes nothing — one session stays one entry.
    const running = await tx.timeEntry.findFirst({ where: { mechanicId: membershipId, endedAt: null }, select: { id: true, documentId: true } });
    if (running?.documentId === documentId) return { entryId: running.id, stopped: null };

    const stopped = await stopRunning(tx, membershipId, at);

    const entry = await tx.timeEntry.create({ data: { tenantId, documentId, mechanicId: membershipId, source: "CLOCK", startedAt: at }, select: { id: true } });

    // Starting work moves the job along the board, and an unassigned job becomes this mechanic's.
    const moves = doc.jobStatus === "BOOKED_IN";
    if (moves || !doc.mechanicId) {
        await tx.document.update({ where: { id: documentId }, data: { ...(moves ? { jobStatus: "WORK_IN_PROGRESS" } : {}), ...(!doc.mechanicId ? { mechanicId: membershipId } : {}) } });
    }
    if (moves) {
        await tx.documentStatusEvent.create({ data: { tenantId, documentId, fromStatus: "BOOKED_IN", toStatus: "WORK_IN_PROGRESS", comment: "Clocked on", byId: membershipId } });
    }
    return { entryId: entry.id, stopped };
}

export async function clockOff(tx: TenantTx, membershipId: string, at = new Date()) {
    await lockMechanic(tx, membershipId);
    return stopRunning(tx, membershipId, at);
}
