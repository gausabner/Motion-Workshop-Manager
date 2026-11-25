import "server-only";
import type { Tenant, VisitPurpose } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { addDays, fromZoned, toZoned } from "@/lib/diary/time";
import { efficiency, entryMinutes, isSuspect, splitCharged } from "@/lib/time/clock";
import { diarySettings } from "@/lib/settings/schema";
import { workingInterval } from "@/lib/diary/capacity";

const JOB_TYPES = ["BOOKING", "JOB_CARD"] as const;

const labourMinutes = (lines: { lineType: string; quantity: { toNumber(): number } }[]) =>
    Math.round(lines.filter((l) => l.lineType === "LABOUR").reduce((s, l) => s + l.quantity.toNumber(), 0) * 60);

/**
 * What each job was charged at, in labour minutes, taken from the invoice it
 * became — the job card's own lines are only an intention until then.
 * Follows booking → job card → invoice, two steps down.
 */
export async function chargedLabour(db: TenantDb, jobIds: string[]): Promise<Map<string, { minutes: number; invoiced: boolean }>> {
    const out = new Map<string, { minutes: number; invoiced: boolean }>();
    if (!jobIds.length) return out;

    const own = await db.document.findMany({ where: { id: { in: jobIds } }, select: { id: true, lines: { select: { lineType: true, quantity: true } } } });
    const level1 = await db.document.findMany({ where: { sourceDocumentId: { in: jobIds } }, select: { id: true, sourceDocumentId: true, type: true, state: true, processedAt: true, lines: { select: { lineType: true, quantity: true } } } });
    const level2 = level1.length
        ? await db.document.findMany({ where: { sourceDocumentId: { in: level1.map((d) => d.id) } }, select: { id: true, sourceDocumentId: true, type: true, state: true, processedAt: true, lines: { select: { lineType: true, quantity: true } } } })
        : [];
    const parentOf = new Map(level1.map((d) => [d.id, d.sourceDocumentId!]));

    const invoices = new Map<string, (typeof level1)[number][]>();
    for (const d of [...level1, ...level2]) {
        if (!(d.type === "INVOICE" || d.type === "CASH_SALE") || !(d.state === "PROCESSED" || d.state === "CLOSED")) continue;
        const root = level1.includes(d) ? d.sourceDocumentId! : parentOf.get(d.sourceDocumentId!)!;
        invoices.set(root, [...(invoices.get(root) ?? []), d]);
    }

    for (const job of own) {
        const billed = (invoices.get(job.id) ?? []).sort((a, b) => (b.processedAt?.getTime() ?? 0) - (a.processedAt?.getTime() ?? 0))[0];
        out.set(job.id, billed ? { minutes: labourMinutes(billed.lines), invoiced: true } : { minutes: labourMinutes(job.lines), invoiced: false });
    }
    return out;
}

/** Everything a mechanic's phone shows: what is running, and what they could start. */
export async function floorView(db: TenantDb, tenant: Tenant, membershipId: string, now = new Date()) {
    const today = toZoned(now, tenant.timezone).day;
    const dayStart = fromZoned(today, 0, tenant.timezone);
    const dayEnd = fromZoned(addDays(today, 1), 0, tenant.timezone);

    const jobSelect = {
        id: true, type: true, jobNumber: true, jobStatus: true, description: true, scheduledAt: true, estimatedHours: true, mechanicId: true,
        customer: { select: { firstName: true, lastName: true } },
        vehicle: { select: { plate: true, make: true, model: true } },
        // Where the vehicle is on a fleet route, so the card can say "At Light and medium vehicles".
        visits: { where: { leftAt: null }, take: 1, select: { purpose: true, receivedAt: true, workshop: { select: { name: true } } } },
    } as const;

    const weekday = toZoned(now, tenant.timezone).weekday;
    const weekStart = fromZoned(addDays(today, 1 - weekday), 0, tenant.timezone);
    const [running, mine, others, workedWeek, override, next] = await Promise.all([
        db.timeEntry.findFirst({ where: { mechanicId: membershipId, endedAt: null }, select: { id: true, startedAt: true, document: { select: jobSelect } } }),
        db.document.findMany({
            where: {
                type: { in: [...JOB_TYPES] }, state: "DRAFT",
                OR: [
                    { mechanicId: membershipId, OR: [{ scheduledAt: { gte: dayStart, lt: dayEnd } }, { jobStatus: { in: ["WORK_IN_PROGRESS", "WAITING_FOR_PARTS", "INSPECTION_IN_PROGRESS"] } }] },
                    // A job they are on at the workshop or bay the vehicle is in now, whoever is the lead.
                    { visits: { some: { leftAt: null, assignments: { some: { membershipId, removedAt: null } } } } },
                ],
            },
            orderBy: { scheduledAt: "asc" },
            select: jobSelect,
        }),
        db.document.findMany({
            where: { type: { in: [...JOB_TYPES] }, state: "DRAFT", scheduledAt: { gte: dayStart, lt: dayEnd }, NOT: { mechanicId: membershipId } },
            orderBy: { scheduledAt: "asc" },
            take: 30,
            select: { ...jobSelect, mechanic: { select: { user: { select: { firstName: true } } } } },
        }),
        // The week so far, Monday first; today's share of it is the day's clocked time.
        db.timeEntry.findMany({ where: { mechanicId: membershipId, startedAt: { gte: weekStart, lt: dayEnd } }, select: { startedAt: true, endedAt: true, minutes: true, documentId: true } }),
        db.workingHours.findFirst({ where: { membershipId, weekday }, select: { weekday: true, startMinute: true, endMinute: true } }),
        db.document.findFirst({
            where: { type: { in: [...JOB_TYPES] }, state: "DRAFT", mechanicId: membershipId, scheduledAt: { gt: now } },
            orderBy: { scheduledAt: "asc" },
            select: { jobNumber: true, scheduledAt: true },
        }),
    ]);

    const minutesOf = (e: { startedAt: Date; endedAt: Date | null; minutes: number | null }) => (e.endedAt ? (e.minutes ?? 0) : entryMinutes(e.startedAt, now));
    const workedToday = workedWeek.filter((e) => e.startedAt >= dayStart);
    const minutesToday = workedToday.reduce((s, e) => s + minutesOf(e), 0);
    const shift = workingInterval(weekday, diarySettings(tenant.settings), override ?? undefined);
    // What the mechanic has already put into the running job, so the clock bar can measure it against the estimate.
    const prior = running
        ? await db.timeEntry.aggregate({ where: { mechanicId: membershipId, documentId: running.document.id, endedAt: { not: null } }, _sum: { minutes: true } })
        : null;
    // The Decimal is dropped here, not later: this goes straight to a client
    // component, and a Decimal cannot cross that boundary.
    const shape = <T extends { scheduledAt: Date | null; estimatedHours: { toNumber(): number } | null; visits: { purpose: VisitPurpose; receivedAt: Date | null; workshop: { name: string } }[] }>({ estimatedHours, visits, ...d }: T) => ({
        ...d,
        place: visits[0] ? { name: visits[0].workshop.name, purpose: visits[0].purpose, arrived: !!visits[0].receivedAt } : null,
        time: d.scheduledAt ? toZoned(d.scheduledAt, tenant.timezone) : null,
        estimatedMinutes: estimatedHours ? Math.round(estimatedHours.toNumber() * 60) : null,
    });

    return {
        today,
        minutesToday,
        running: running ? { id: running.id, startedAt: running.startedAt, job: shape(running.document), priorMinutes: prior?._sum.minutes ?? 0 } : null,
        day: {
            shiftMinutes: shift ? shift.end - shift.start : null,
            jobsWorked: new Set(workedToday.map((e) => e.documentId)).size,
            waitingForParts: mine.filter((d) => d.jobStatus === "WAITING_FOR_PARTS").length,
            weekMinutes: workedWeek.reduce((s, e) => s + minutesOf(e), 0),
            next: next?.scheduledAt ? { jobNumber: next.jobNumber, ...toZoned(next.scheduledAt, tenant.timezone) } : null,
        },
        mine: mine.map(shape),
        others: others.map((d) => ({ ...shape(d), mechanicName: d.mechanic?.user.firstName ?? null })),
    };
}

/** A job's time, set against what it was estimated at and what it was charged. */
export async function jobTime(db: TenantDb, documentId: string, now = new Date()) {
    const [entries, doc, charged] = await Promise.all([
        db.timeEntry.findMany({
            where: { documentId },
            orderBy: { startedAt: "asc" },
            select: { id: true, source: true, startedAt: true, endedAt: true, minutes: true, note: true, mechanic: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
        }),
        db.document.findUnique({ where: { id: documentId }, select: { estimatedHours: true } }),
        chargedLabour(db, [documentId]),
    ]);
    const rows = entries.map((e) => {
        const minutes = e.endedAt ? (e.minutes ?? 0) : entryMinutes(e.startedAt, now);
        return { id: e.id, source: e.source, startedAt: e.startedAt, endedAt: e.endedAt, minutes, running: !e.endedAt, suspect: isSuspect(minutes), note: e.note, mechanicId: e.mechanic.id, mechanic: `${e.mechanic.user.firstName} ${e.mechanic.user.lastName}` };
    });
    const worked = rows.reduce((s, r) => s + r.minutes, 0);
    const c = charged.get(documentId) ?? { minutes: 0, invoiced: false };
    return {
        rows,
        worked,
        estimated: doc?.estimatedHours ? Math.round(doc.estimatedHours.toNumber() * 60) : null,
        charged: c.minutes,
        invoiced: c.invoiced,
        efficiency: c.invoiced ? efficiency(c.minutes, worked) : null,
    };
}

export type LabourRow = {
    mechanicId: string;
    name: string;
    worked: number;
    jobs: number;
    /** Worked on jobs that have been invoiced — the only time efficiency can be judged on. */
    workedInvoiced: number;
    charged: number;
    efficiency: number | null;
    /** Worked on jobs not invoiced yet. */
    workedPending: number;
    suspect: number;
};

/**
 * Mechanic time for a period: what the clock says each person worked, and
 * what the invoices say it was worth. Efficiency compares like with like —
 * only time on jobs that have been invoiced — so a week of unfinished jobs
 * does not read as a week of giving time away.
 */
export async function labourReport(db: TenantDb, tenant: Tenant, from: string, to: string, now = new Date()): Promise<{ rows: LabourRow[]; totals: Omit<LabourRow, "mechanicId" | "name"> }> {
    const start = fromZoned(from, 0, tenant.timezone);
    const end = fromZoned(addDays(to, 1), 0, tenant.timezone);
    const entries = await db.timeEntry.findMany({
        where: { startedAt: { gte: start, lt: end } },
        select: { documentId: true, mechanicId: true, startedAt: true, endedAt: true, minutes: true, mechanic: { select: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const jobIds = [...new Set(entries.map((e) => e.documentId))];
    const [charged, allTime] = await Promise.all([
        chargedLabour(db, jobIds),
        // A job's charged hours are shared by all the time spent on it, not just this period's.
        db.timeEntry.findMany({ where: { documentId: { in: jobIds } }, select: { documentId: true, mechanicId: true, startedAt: true, endedAt: true, minutes: true } }),
    ]);

    const mins = (e: { startedAt: Date; endedAt: Date | null; minutes: number | null }) => (e.endedAt ? (e.minutes ?? 0) : entryMinutes(e.startedAt, now));
    const shareByJob = new Map<string, Record<string, number>>();
    for (const job of jobIds) {
        const worked: Record<string, number> = {};
        for (const e of allTime.filter((x) => x.documentId === job)) worked[e.mechanicId] = (worked[e.mechanicId] ?? 0) + mins(e);
        const c = charged.get(job);
        shareByJob.set(job, c?.invoiced ? splitCharged(c.minutes, worked) : {});
    }

    const byMechanic = new Map<string, LabourRow & { jobSet: Set<string>; chargedJobs: Set<string> }>();
    for (const e of entries) {
        const row = byMechanic.get(e.mechanicId) ?? {
            mechanicId: e.mechanicId, name: `${e.mechanic.user.firstName} ${e.mechanic.user.lastName}`,
            worked: 0, jobs: 0, workedInvoiced: 0, charged: 0, efficiency: null, workedPending: 0, suspect: 0, jobSet: new Set<string>(), chargedJobs: new Set<string>(),
        };
        const m = mins(e);
        row.worked += m;
        row.jobSet.add(e.documentId);
        if (isSuspect(m)) row.suspect += 1;
        if (charged.get(e.documentId)?.invoiced) {
            row.workedInvoiced += m;
            // The share is counted once per job per mechanic, however many entries they have on it.
            if (!row.chargedJobs.has(e.documentId)) {
                row.chargedJobs.add(e.documentId);
                row.charged += shareByJob.get(e.documentId)?.[e.mechanicId] ?? 0;
            }
        } else row.workedPending += m;
        byMechanic.set(e.mechanicId, row);
    }

    const rows: LabourRow[] = [...byMechanic.values()]
        .map((r) => ({
            mechanicId: r.mechanicId, name: r.name, worked: r.worked, jobs: r.jobSet.size, workedInvoiced: r.workedInvoiced,
            charged: r.charged, efficiency: efficiency(r.charged, r.workedInvoiced), workedPending: r.workedPending, suspect: r.suspect,
        }))
        .sort((a, b) => b.worked - a.worked);
    const sum = (k: "worked" | "workedInvoiced" | "charged" | "workedPending" | "suspect" | "jobs") => rows.reduce((s, r) => s + r[k], 0);
    return {
        rows,
        totals: { worked: sum("worked"), jobs: jobIds.length, workedInvoiced: sum("workedInvoiced"), charged: sum("charged"), efficiency: efficiency(sum("charged"), sum("workedInvoiced")), workedPending: sum("workedPending"), suspect: sum("suspect") },
    };
}
