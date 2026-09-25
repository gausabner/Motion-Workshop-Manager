import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Every vehicle with a date coming up: a service due, a licence disc expiring,
 * a roadworthy running out.
 *
 * The reminders screen already shows these for the next few weeks, because
 * that is what it is for — a list somebody works through this morning. This is
 * the other half of the same question: the whole book, as a file, so an owner
 * can see that four hundred discs expire in March and plan for it, or hand the
 * list to whoever does the phoning.
 *
 * It deliberately does not respect the reminder settings. A workshop that has
 * switched off disc reminders has decided not to be nagged; it has not decided
 * that the dates should be unobtainable. Opting out of a reminder and opting
 * out of the report are different things, and conflating them is how a feature
 * quietly hides data somebody is entitled to.
 *
 * Contact details are on it, because the point of the file is to ring people,
 * which means it is subject to the same redaction as the customer screen.
 */

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type RenewalKind = "Service" | "Licence disc" | "Roadworthy";

export type RenewalRow = {
    kind: RenewalKind;
    due: string;
    /** Negative when it has already passed. */
    daysAway: number;
    plate: string;
    vehicle: string;
    customer: string;
    mobile: string | null;
    phone: string | null;
    email: string | null;
    lastSeen: string;
    [key: string]: unknown;
};

export async function renewalsDue(db: TenantDb, from: Date, to: Date): Promise<{
    rows: RenewalRow[];
    counts: Record<RenewalKind, number>;
    overdue: number;
}> {
    const vehicles = await db.vehicle.findMany({
        where: {
            archivedAt: null,
            OR: [
                { nextServiceDate: { gte: from, lte: to } },
                { licenceExpiry: { gte: from, lte: to } },
                { roadworthyExpiry: { gte: from, lte: to } },
            ],
        },
        select: {
            plate: true, make: true, model: true, year: true, lastInDate: true,
            nextServiceDate: true, licenceExpiry: true, roadworthyExpiry: true,
            customer: { select: { firstName: true, lastName: true, mobile: true, phone: true, email: true } },
        },
    });

    const today = Date.now();
    const rows: RenewalRow[] = [];

    for (const v of vehicles) {
        const base = {
            plate: v.plate,
            vehicle: [v.year, v.make, v.model].filter(Boolean).join(" "),
            customer: v.customer ? `${v.customer.firstName} ${v.customer.lastName}`.trim() : "No customer on file",
            mobile: v.customer?.mobile ?? null,
            phone: v.customer?.phone ?? null,
            email: v.customer?.email ?? null,
            lastSeen: iso(v.lastInDate),
        };
        const add = (kind: RenewalKind, date: Date | null) => {
            if (!date || date < from || date > to) return;
            rows.push({ ...base, kind, due: iso(date), daysAway: Math.round((date.getTime() - today) / 86_400_000) });
        };
        add("Service", v.nextServiceDate);
        add("Licence disc", v.licenceExpiry);
        add("Roadworthy", v.roadworthyExpiry);
    }

    // Soonest first: the file is worked through from the top.
    rows.sort((a, b) => a.due.localeCompare(b.due) || a.plate.localeCompare(b.plate));

    const counts: Record<RenewalKind, number> = { Service: 0, "Licence disc": 0, Roadworthy: 0 };
    for (const r of rows) counts[r.kind] += 1;

    return { rows, counts, overdue: rows.filter((r) => r.daysAway < 0).length };
}
