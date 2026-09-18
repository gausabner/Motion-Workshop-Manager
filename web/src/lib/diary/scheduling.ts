import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { fromZoned, formatLocalDateTime } from "@/lib/diary/time";

/**
 * Moving a booking in the diary: to another time, another day, another
 * mechanic, or another length. Kept out of the "use server" module so the
 * rules can be exercised against a real database.
 *
 * Deliberately permissive about clashes and hours. Workshops double-book on
 * purpose — two quick jobs in one slot, a mechanic staying late — so the diary
 * shows a clash in red and lets the person who knows the floor decide.
 */

export type Move = { documentId: string; day: string; minute: number; mechanicId: string | null; minutes?: number };

export async function moveBooking(tx: TenantTx, tenant: Tenant, move: Move): Promise<{ from: string; to: string }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(move.day)) throw new Error("That is not a day");
    if (!Number.isInteger(move.minute) || move.minute < 0 || move.minute >= 1440) throw new Error("That is not a time of day");
    if (move.minutes !== undefined && (!Number.isFinite(move.minutes) || move.minutes < 15 || move.minutes > 24 * 60)) {
        throw new Error("A booking has to be between 15 minutes and a day long");
    }

    const doc = await tx.document.findUnique({ where: { id: move.documentId }, select: { id: true, type: true, state: true, scheduledAt: true, mechanicId: true } });
    if (!doc) throw new Error("That booking is no longer there");
    if (doc.type !== "BOOKING" && doc.type !== "JOB_CARD") throw new Error("Only bookings and job cards sit in the diary");
    if (doc.state === "VOID") throw new Error("A voided job cannot be rescheduled");

    if (move.mechanicId) {
        const mechanic = await tx.membership.findUnique({ where: { id: move.mechanicId }, select: { status: true, isMechanic: true, showOnDiary: true } });
        if (!mechanic || mechanic.status !== "ACTIVE" || !(mechanic.isMechanic || mechanic.showOnDiary)) throw new Error("That person is not on the diary");
    }

    const scheduledAt = fromZoned(move.day, move.minute, tenant.timezone);
    await tx.document.update({
        where: { id: doc.id },
        data: {
            scheduledAt,
            mechanicId: move.mechanicId,
            ...(move.minutes !== undefined ? { estimatedHours: Math.round((move.minutes / 60) * 100) / 100 } : {}),
        },
    });
    return { from: formatLocalDateTime(doc.scheduledAt, tenant.timezone), to: formatLocalDateTime(scheduledAt, tenant.timezone) };
}
