import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { diaryMechanics, getDiary } from "@/lib/diary/queries";
import { overlapMinutes } from "@/lib/diary/capacity";
import { toZoned } from "@/lib/diary/time";
import { findMatches, type Matches } from "@/lib/bookings/approval";

export async function pendingRequestCount(db: TenantDb): Promise<number> {
    return db.bookingRequest.count({ where: { status: "PENDING" } });
}

export type QueueItem = {
    id: string;
    day: string;
    minute: number;
    minutes: number;
    service: string;
    name: string;
    mobile: string;
    email: string | null;
    plate: string | null;
    vehicle: string | null;
    notes: string | null;
    createdAt: Date;
    matches: Matches;
    /** A mechanic who is working and free for the whole job — a suggestion, not a decision. */
    suggestedMechanicId: string | null;
    /** Nobody is free: approving it will make a clash. */
    clashes: boolean;
};

export async function bookingQueue(db: TenantDb, tenant: Tenant) {
    const pending = await db.bookingRequest.findMany({ where: { status: "PENDING" }, orderBy: { requestedAt: "asc" } });
    const days = [...new Set(pending.map((r) => toZoned(r.requestedAt, tenant.timezone).day))].sort();
    const diaries = new Map<string, Awaited<ReturnType<typeof getDiary>>>();
    for (const day of days) diaries.set(day, await getDiary(db, tenant, day, day));

    const items: QueueItem[] = [];
    for (const r of pending) {
        const z = toZoned(r.requestedAt, tenant.timezone);
        const job = { start: z.minute, end: z.minute + r.minutes };
        const diary = diaries.get(z.day)!;
        const today = diary.days[0];
        const free = today.lanes.find(
            (lane) =>
                lane.working && lane.working.start <= job.start && lane.working.end >= job.end &&
                !lane.off.some((o) => overlapMinutes(o, job) > 0) &&
                !today.bookings.some((b) => b.mechanicId === lane.mechanicId && overlapMinutes({ start: b.start, end: b.start + b.minutes }, job) > 0),
        );
        items.push({
            id: r.id,
            day: z.day,
            minute: z.minute,
            minutes: r.minutes,
            service: r.service,
            name: `${r.firstName} ${r.lastName}`.trim(),
            mobile: r.mobile,
            email: r.email,
            plate: r.plate,
            vehicle: r.vehicleDescription,
            notes: r.notes,
            createdAt: r.createdAt,
            matches: await findMatches(db, tenant, r),
            suggestedMechanicId: free?.mechanicId ?? null,
            clashes: !free,
        });
    }

    const decided = await db.bookingRequest.findMany({
        where: { status: { not: "PENDING" } },
        orderBy: { decidedAt: "desc" },
        take: 15,
        select: { id: true, status: true, service: true, firstName: true, lastName: true, requestedAt: true, decidedAt: true, declineReason: true, documentId: true },
    });

    return { items, decided, mechanics: await diaryMechanics(db) };
}
