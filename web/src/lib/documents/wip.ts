import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";

/**
 * Work in progress: jobs opened and not yet invoiced.
 *
 * This is the owner's "what is standing in my workshop that I have not been
 * paid for" list, and it is also unbilled revenue at a period end, which is
 * why the plan has it doubling as auditor material. A council closing a year
 * wants a figure for work done and not yet billed; an owner wants to know
 * which car has been on a ramp for three weeks. Same query.
 *
 * The value shown is the job card's own total as it currently stands. That is
 * an estimate, not a receivable — lines get added the day it is finished — and
 * the note on the report says so rather than letting the total be mistaken for
 * money owed.
 *
 * Age is counted from the post date rather than from when the record was
 * created, because a job backdated to when the car actually arrived is telling
 * the truth about how long it has been there.
 */

const num = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type WipRow = {
    id: string;
    number: string;
    status: string;
    customer: string;
    vehicle: string;
    description: string;
    opened: string;
    /** Days since the job was opened, as at the date asked for. */
    age: number;
    mechanic: string;
    total: number;
    /** Nothing has been added to it yet, so the total is not an estimate of anything. */
    empty: boolean;
};

export const JOB_STATUS_LABELS: Record<string, string> = {
    BOOKED_IN: "Booked in",
    WORK_IN_PROGRESS: "In progress",
    WAITING_FOR_PARTS: "Waiting for parts",
    INSPECTION_IN_PROGRESS: "Inspection",
    WAITING_FOR_CUSTOMER_APPROVAL: "Waiting for approval",
    JOB_COMPLETE: "Complete",
    CUSTOMER_NOTIFIED: "Customer notified",
    AWAITING_FINALISE: "Awaiting finalise",
    FINALISED: "Finalised",
};

export async function workInProgress(db: TenantDb, asAt: Date): Promise<{
    rows: WipRow[];
    total: number;
    oldest: number;
    byStatus: { status: string; jobs: number; value: number }[];
}> {
    const jobs = await db.document.findMany({
        // A job card still in DRAFT is the open job. Once it is processed it
        // has become an invoice and belongs in the sales register instead.
        where: { type: "JOB_CARD", state: "DRAFT", postDate: { lte: asAt } },
        orderBy: [{ postDate: "asc" }],
        select: {
            id: true, number: true, jobNumber: true, jobStatus: true, postDate: true, total: true, description: true,
            _count: { select: { lines: true } },
            customer: { select: { firstName: true, lastName: true } },
            vehicle: { select: { plate: true, make: true, model: true } },
            mechanic: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
    });

    const days = (from: Date) => Math.max(0, Math.floor((asAt.getTime() - from.getTime()) / 86_400_000));

    const rows: WipRow[] = jobs.map((j) => ({
        id: j.id,
        number: j.jobNumber ?? j.number ?? "—",
        status: j.jobStatus ? (JOB_STATUS_LABELS[j.jobStatus] ?? j.jobStatus) : "No status",
        customer: j.customer ? `${j.customer.firstName} ${j.customer.lastName}`.trim() : "Cash sale",
        vehicle: [j.vehicle?.plate, [j.vehicle?.make, j.vehicle?.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
        description: j.description ?? "",
        opened: iso(j.postDate),
        age: days(j.postDate),
        mechanic: j.mechanic ? `${j.mechanic.user.firstName} ${j.mechanic.user.lastName}`.trim() : "",
        total: num(j.total),
        empty: j._count.lines === 0,
    }));

    const byStatus = new Map<string, { status: string; jobs: number; value: number }>();
    for (const r of rows) {
        const into = byStatus.get(r.status) ?? { status: r.status, jobs: 0, value: 0 };
        into.jobs += 1;
        into.value = round2(into.value + r.total);
        byStatus.set(r.status, into);
    }

    return {
        rows,
        total: round2(rows.reduce((t, r) => t + r.total, 0)),
        oldest: rows.reduce((m, r) => Math.max(m, r.age), 0),
        byStatus: [...byStatus.values()].sort((a, b) => b.value - a.value),
    };
}
