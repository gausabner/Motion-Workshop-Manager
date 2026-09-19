import "server-only";
import type { ContactMethod, ReminderKind, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { reminderSettings } from "@/lib/settings/schema";
import { businessToday } from "@/lib/tenant/today";
import { toZoned } from "@/lib/diary/time";
import { KIND_ORDER, followUpDay, inWindow, reminderKey, windowFor, type Window } from "@/lib/reminders/rules";

export type DueReminder = {
    kind: ReminderKind;
    targetId: string;
    /** The key date: service date, expiry, booking day, or the day the quote was sent. */
    dueOn: string;
    /** The day it falls due, as shown. Differs from `dueOn` only for quote follow-ups. */
    showOn: string;
    customer: { id: string; name: string; mobile: string | null; email: string | null; preferredContact: ContactMethod };
    vehicle: { id: string; plate: string; description: string } | null;
    document: { id: string; number: string | null } | null;
};

const day = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);
const CUSTOMER = { id: true, firstName: true, lastName: true, mobile: true, email: true, preferredContact: true, archivedAt: true } as const;
type CustomerRow = { id: string; firstName: string; lastName: string; mobile: string | null; email: string | null; preferredContact: ContactMethod; archivedAt: Date | null };
type VehicleRow = { id: string; plate: string; make: string; model: string; year: number | null };

const customerOf = (c: CustomerRow) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), mobile: c.mobile, email: c.email, preferredContact: c.preferredContact });
const vehicleOf = (v: VehicleRow) => ({ id: v.id, plate: v.plate, description: [v.year, v.make, v.model].filter(Boolean).join(" ") });

/**
 * Today's reminders, worked out from the data. Nothing runs on a timer: the
 * list is whatever is due right now, less what someone already sent or
 * skipped for that date. Customers who opted out are counted, not listed.
 */
export async function dueReminders(db: TenantDb, tenant: Tenant, at: Date = new Date()): Promise<{ today: string; items: DueReminder[]; optedOut: number }> {
    const today = day(businessToday(tenant.timezone, at));
    const settings = reminderSettings(tenant.settings);
    const windows = Object.fromEntries(KIND_ORDER.map((k) => [k, windowFor(k, today, settings)])) as Record<ReminderKind, Window | null>;
    const candidates: DueReminder[] = [];
    const add = (kind: ReminderKind, targetId: string, dueOn: string, customer: CustomerRow | null, vehicle: VehicleRow | null, document: DueReminder["document"]) => {
        if (!customer || customer.archivedAt) return;
        candidates.push({ kind, targetId, dueOn, showOn: followUpDay(kind, dueOn, settings), customer: customerOf(customer), vehicle: vehicle ? vehicleOf(vehicle) : null, document });
    };

    const vehicleKinds = [
        ["SERVICE_DUE", "nextServiceDate"],
        ["LICENCE_DISC", "licenceExpiry"],
        ["ROADWORTHY", "roadworthyExpiry"],
    ] as const;
    for (const [kind, field] of vehicleKinds) {
        const w = windows[kind];
        if (!w) continue;
        const vehicles = await db.vehicle.findMany({
            where: { archivedAt: null, customerId: { not: null }, [field]: { gte: asDate(w.from), lte: asDate(w.to) } },
            select: { id: true, plate: true, make: true, model: true, year: true, nextServiceDate: true, licenceExpiry: true, roadworthyExpiry: true, customer: { select: CUSTOMER } },
        });
        for (const v of vehicles) add(kind, v.id, day(v[field]!), v.customer, v, null);
    }

    if (windows.BOOKING) {
        const w = windows.BOOKING;
        // A day either side in UTC, then filtered to the workshop's own calendar day.
        const bookings = await db.document.findMany({
            where: { type: { in: ["BOOKING", "JOB_CARD"] }, state: "DRAFT", scheduledAt: { gte: asDate(w.from), lt: new Date(asDate(w.to).getTime() + 2 * 86_400_000) } },
            select: { id: true, number: true, jobNumber: true, scheduledAt: true, customer: { select: CUSTOMER }, vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } } },
        });
        for (const b of bookings) {
            const bookedDay = toZoned(b.scheduledAt!, tenant.timezone).day;
            if (inWindow(bookedDay, w)) add("BOOKING", b.id, bookedDay, b.customer, b.vehicle, { id: b.id, number: b.number ?? b.jobNumber });
        }
    }

    if (windows.QUOTE_FOLLOW_UP) {
        const w = windows.QUOTE_FOLLOW_UP;
        const quotes = await db.document.findMany({
            where: {
                type: "QUOTE", state: { not: "VOID" },
                contactedAt: { gte: new Date(asDate(w.from).getTime() - 86_400_000), lt: new Date(asDate(w.to).getTime() + 2 * 86_400_000) },
            },
            select: { id: true, number: true, contactedAt: true, customer: { select: CUSTOMER }, vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } } },
        });
        // A quote that became a booking, job or invoice has had its answer.
        const converted = new Set(
            (await db.document.findMany({ where: { sourceDocumentId: { in: quotes.map((q) => q.id) }, state: { not: "VOID" } }, select: { sourceDocumentId: true } })).map((d) => d.sourceDocumentId),
        );
        for (const q of quotes) {
            const sentDay = toZoned(q.contactedAt!, tenant.timezone).day;
            if (!converted.has(q.id) && inWindow(sentDay, w)) add("QUOTE_FOLLOW_UP", q.id, sentDay, q.customer, q.vehicle, { id: q.id, number: q.number });
        }
    }

    const done = await db.reminder.findMany({
        where: { OR: candidates.map((c) => ({ kind: c.kind, targetId: c.targetId, dueOn: asDate(c.dueOn) })) },
        select: { kind: true, targetId: true, dueOn: true },
    });
    const acted = new Set(done.map((r) => reminderKey(r.kind, r.targetId, day(r.dueOn))));
    const open = candidates.filter((c) => !acted.has(reminderKey(c.kind, c.targetId, c.dueOn)));
    const items = open
        .filter((c) => c.customer.preferredContact !== "OPT_OUT")
        .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.showOn.localeCompare(b.showOn) || a.customer.name.localeCompare(b.customer.name));
    return { today, items, optedOut: open.length - items.length };
}

/** What was sent or skipped lately, newest first. */
export async function recentReminders(db: TenantDb, take = 30) {
    return db.reminder.findMany({
        orderBy: { actedAt: "desc" },
        take,
        select: {
            id: true, kind: true, outcome: true, dueOn: true, actedAt: true,
            customer: { select: { id: true, firstName: true, lastName: true } },
            vehicle: { select: { plate: true } },
            document: { select: { number: true } },
            message: { select: { channel: true, status: true } },
            actedBy: { select: { user: { select: { firstName: true } } } },
        },
    });
}
