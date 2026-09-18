import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * The communication log. One list, filtered by whatever the screen is about —
 * a customer sees everything sent to them, a document only what was sent
 * about it.
 */
export async function listMessages(db: TenantDb, filter: { customerId?: string; documentId?: string; paymentId?: string }, take = 50) {
    const where: Prisma.MessageWhereInput = {
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(filter.documentId ? { documentId: filter.documentId } : {}),
        ...(filter.paymentId ? { paymentId: filter.paymentId } : {}),
    };
    const rows = await db.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        select: {
            id: true, channel: true, driver: true, status: true, recipient: true, subject: true, body: true, error: true, createdAt: true,
            sentBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            document: { select: { id: true, type: true, number: true, jobNumber: true } },
            payment: { select: { id: true, number: true, direction: true } },
            shareLink: { select: { id: true, openCount: true, firstOpenedAt: true, lastOpenedAt: true, revokedAt: true, expiresAt: true } },
        },
    });
    return rows.map((row) => ({
        ...row,
        sentBy: row.sentBy ? `${row.sentBy.user.firstName} ${row.sentBy.user.lastName}` : null,
    }));
}

export type MessageRow = Awaited<ReturnType<typeof listMessages>>[number];

/** The latest word on a document: what went out, and whether it was opened. */
export function deliverySummary(rows: MessageRow[]) {
    const delivered = rows.filter((row) => row.status !== "FAILED");
    const latest = delivered[0] ?? null;
    const opened = delivered.map((row) => row.shareLink?.firstOpenedAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return { latest, opened, count: delivered.length };
}
