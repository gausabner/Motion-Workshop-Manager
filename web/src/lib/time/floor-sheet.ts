import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { addDays, fromZoned, toZoned } from "@/lib/diary/time";
import { fullName } from "@/lib/format";
import { entryMinutes } from "@/lib/time/clock";
import { leadOf } from "@/lib/fleet/crew-rules";
import { jobRequisitions } from "@/lib/requisitions/view";

const JOB_TYPES = ["BOOKING", "JOB_CARD"] as const;

/**
 * Everything a mechanic opens a job to read, from the floor app: the work
 * without prices, what the check bay found, the parts and whether they are
 * issued, who else is on it, the note it was sent with, and the time against
 * the estimate. Plain values only, so it crosses to the client as it is.
 */
export async function jobSheet(db: TenantDb, documentId: string, membershipId: string, now = new Date()) {
    const doc = await db.document.findFirst({
        where: { id: documentId, type: { in: [...JOB_TYPES] } },
        select: {
            id: true, jobNumber: true, description: true, odometer: true, estimatedHours: true, jobStatus: true,
            customer: { select: { firstName: true, lastName: true } },
            vehicle: { select: { plate: true, make: true, model: true } },
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, lineType: true } },
            inspections: { select: { items: { where: { OR: [{ urgent: true }, { soon: true }] }, select: { description: true, comment: true, urgent: true } } } },
            visits: {
                where: { leftAt: null }, take: 1,
                select: {
                    id: true, note: true, purpose: true, receivedAt: true, workshop: { select: { name: true } },
                    sentBy: { select: { user: { select: { firstName: true, lastName: true } } } },
                    assignments: { select: { membershipId: true, assignedAt: true, removedAt: true, membership: { select: { user: { select: { firstName: true, lastName: true } } } } } },
                },
            },
        },
    });
    if (!doc) return null;
    const [entries, parts] = await Promise.all([
        db.timeEntry.findMany({ where: { documentId }, select: { mechanicId: true, startedAt: true, endedAt: true, minutes: true } }),
        jobRequisitions(db, documentId),
    ]);
    const minutesOf = (e: (typeof entries)[number]) => (e.endedAt ? (e.minutes ?? 0) : entryMinutes(e.startedAt, now));
    const stay = doc.visits[0] ?? null;
    const lead = stay ? leadOf(stay.assignments) : null;
    const findings = doc.inspections.flatMap((i) => i.items).sort((a, b) => Number(b.urgent) - Number(a.urgent));
    return {
        id: doc.id,
        jobNumber: doc.jobNumber,
        jobStatus: doc.jobStatus,
        description: doc.description,
        odometer: doc.odometer,
        department: doc.customer ? `${doc.customer.firstName} ${doc.customer.lastName}`.trim() : null,
        vehicle: doc.vehicle,
        lines: doc.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity.toNumber(), labour: l.lineType === "LABOUR" })),
        findings: findings.map((f) => ({ description: f.description, comment: f.comment, urgent: f.urgent })),
        parts: parts.map((p) => ({ id: p.id, number: p.number, state: p.stateLabel, items: p.items, waitingFor: p.waitingFor })),
        place: stay ? { name: stay.workshop.name, purpose: stay.purpose, arrived: !!stay.receivedAt } : null,
        note: stay?.note ? { text: stay.note, from: stay.sentBy ? fullName(stay.sentBy.user) : null } : null,
        crew: (stay?.assignments ?? []).filter((a) => !a.removedAt).map((a) => ({ name: fullName(a.membership.user), lead: a.membershipId === lead, me: a.membershipId === membershipId })),
        time: {
            mine: entries.filter((e) => e.mechanicId === membershipId).reduce((s, e) => s + minutesOf(e), 0),
            team: entries.reduce((s, e) => s + minutesOf(e), 0),
            estimate: doc.estimatedHours ? Math.round(doc.estimatedHours.toNumber() * 60) : null,
        },
    };
}

export type JobSheetData = NonNullable<Awaited<ReturnType<typeof jobSheet>>>;

export type ScheduleItem = { id: string; jobNumber: string | null; title: string; plate: string | null; minute: number | null; estimatedMinutes: number | null; status: string | null };

/**
 * A mechanic's month: their booked jobs by day, for the calendar's marks and
 * the day list, from the Monday before the month to the Sunday after it so
 * the weeks at either edge are whole. Today also carries the fleet jobs they
 * are on now, which have no booked time.
 */
export async function scheduleMonth(db: TenantDb, tenant: Tenant, membershipId: string, month: string, now = new Date()) {
    const first = `${month}-01`;
    const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
    const from = addDays(first, -((weekday + 6) % 7));
    const next = new Date(`${first}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const to = addDays(next.toISOString().slice(0, 10), 7);
    const today = toZoned(now, tenant.timezone).day;
    const select = {
        id: true, jobNumber: true, description: true, scheduledAt: true, estimatedHours: true, jobStatus: true,
        vehicle: { select: { plate: true, make: true, model: true } },
    } as const;
    const [booked, onNow] = await Promise.all([
        db.document.findMany({
            where: { type: { in: [...JOB_TYPES] }, state: { not: "VOID" }, mechanicId: membershipId, scheduledAt: { gte: fromZoned(from, 0, tenant.timezone), lt: fromZoned(to, 0, tenant.timezone) } },
            orderBy: { scheduledAt: "asc" },
            select,
        }),
        today >= from && today < to
            ? db.document.findMany({
                  where: { type: { in: [...JOB_TYPES] }, state: "DRAFT", scheduledAt: null, visits: { some: { leftAt: null, assignments: { some: { membershipId, removedAt: null } } } } },
                  select,
              })
            : Promise.resolve([]),
    ]);
    const days: Record<string, ScheduleItem[]> = {};
    const add = (day: string, d: (typeof booked)[number], minute: number | null) =>
        (days[day] ??= []).push({
            id: d.id,
            jobNumber: d.jobNumber,
            title: d.description ?? (d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}`.trim() : "Job"),
            plate: d.vehicle?.plate ?? null,
            minute,
            estimatedMinutes: d.estimatedHours ? Math.round(d.estimatedHours.toNumber() * 60) : null,
            status: d.jobStatus,
        });
    for (const d of booked) {
        const at = toZoned(d.scheduledAt!, tenant.timezone);
        add(at.day, d, at.minute);
    }
    for (const d of onNow) add(today, d, null);
    return { month, today, days };
}

export type ScheduleMonth = Awaited<ReturnType<typeof scheduleMonth>>;
