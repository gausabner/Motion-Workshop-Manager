import "server-only";
import type { Prisma, Tenant } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { businessToday } from "@/lib/tenant/today";
import { round2 } from "@/lib/documents/totals";
import type { AudienceFilters } from "@/lib/campaigns/audience";

const ACCOUNT_TYPES = ["INVOICE", "CASH_SALE", "CREDIT"] as const;
const VISIT_TYPES = ["INVOICE", "CASH_SALE", "JOB_CARD"] as const;
const day = (s: string) => new Date(`${s}T00:00:00Z`);

export type AudienceMember = {
    id: string; firstName: string; lastName: string; mobile: string | null; email: string | null;
    preferredContact: Prisma.CustomerGetPayload<{ select: { preferredContact: true } }>["preferredContact"];
    vehicle: string | null; owing: number;
};

/**
 * Everyone a campaign would go to. Money is derived the way it always is —
 * from the allocations, never read off a document — so "owes us something"
 * here means the same as it does on the account screen.
 */
export async function findAudience(db: TenantDb, tenant: Tenant, filters: AudienceFilters, now: Date = new Date()): Promise<AudienceMember[]> {
    const today = businessToday(tenant.timezone, now);
    const where: Prisma.CustomerWhereInput = { archivedAt: null };
    const and: Prisma.CustomerWhereInput[] = [];

    if (filters.sourceIds.length) where.customerSourceId = { in: filters.sourceIds };
    if (filters.customerSince) where.createdAt = { gte: day(filters.customerSince) };
    if (filters.area) {
        const area = { contains: filters.area, mode: "insensitive" as const };
        and.push({ OR: [
            { streetSuburb: area }, { streetCity: area }, { streetPostcode: area },
            { postalSuburb: area }, { postalCity: area }, { postalPostcode: area },
        ] });
    }
    if (filters.vehicle) {
        const text = { contains: filters.vehicle, mode: "insensitive" as const };
        and.push({ vehicles: { some: { archivedAt: null, OR: [{ make: text }, { model: text }, { plate: text }] } } });
    }
    if (filters.serviceDueWithinDays) {
        and.push({ vehicles: { some: { archivedAt: null, nextServiceDate: { lte: new Date(today.getTime() + filters.serviceDueWithinDays * 86_400_000) } } } });
    }
    if (filters.licenceWithinDays) {
        and.push({ vehicles: { some: { archivedAt: null, licenceExpiry: { lte: new Date(today.getTime() + filters.licenceWithinDays * 86_400_000) } } } });
    }
    if (filters.lastInBefore) {
        // "Not in since" takes in the customers who have never been in at all.
        and.push({ NOT: { documents: { some: { type: { in: [...VISIT_TYPES] }, state: { in: ["PROCESSED", "CLOSED"] }, postDate: { gte: day(filters.lastInBefore) } } } } });
    }
    if (and.length) where.AND = and;

    const customers = await db.customer.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 2000,
        select: {
            id: true, firstName: true, lastName: true, mobile: true, email: true, preferredContact: true,
            vehicles: { where: { archivedAt: null }, take: 1, orderBy: { createdAt: "asc" }, select: { year: true, make: true, model: true, plate: true } },
        },
    });
    if (customers.length === 0) return [];

    const owing = await balances(db, customers.map((c) => c.id), filters.owing === "overdue" ? today : null);
    return customers
        .map((c) => ({
            id: c.id, firstName: c.firstName, lastName: c.lastName, mobile: c.mobile, email: c.email, preferredContact: c.preferredContact,
            vehicle: c.vehicles[0] ? `${[c.vehicles[0].year, c.vehicles[0].make, c.vehicles[0].model].filter(Boolean).join(" ")} (${c.vehicles[0].plate})` : null,
            owing: owing.get(c.id) ?? 0,
        }))
        .filter((c) => (filters.owing === "any" ? true : c.owing > 0));
}

/** What each of these customers owes: open documents less what has been allocated to them. `asAt` limits it to what is 30 days overdue. */
async function balances(db: TenantDb, customerIds: string[], asAt: Date | null): Promise<Map<string, number>> {
    const rows = await db.document.findMany({
        where: {
            customerId: { in: customerIds }, state: "PROCESSED", type: { in: [...ACCOUNT_TYPES] },
            ...(asAt ? { OR: [{ dueDate: { lt: new Date(asAt.getTime() - 30 * 86_400_000) } }, { dueDate: null, postDate: { lt: new Date(asAt.getTime() - 30 * 86_400_000) } }] } : {}),
        },
        select: { customerId: true, total: true, allocations: { where: { payment: { state: "PROCESSED" } }, select: { amount: true } } },
    });
    const out = new Map<string, number>();
    for (const row of rows) {
        if (!row.customerId) continue;
        const due = row.total.toNumber() - row.allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0);
        out.set(row.customerId, round2((out.get(row.customerId) ?? 0) + due));
    }
    return out;
}

export async function listCampaigns(db: TenantDb, take = 30) {
    const rows = await db.campaign.findMany({
        orderBy: { createdAt: "desc" },
        take,
        select: {
            id: true, name: true, channel: true, usePreferred: true, state: true, createdAt: true,
            createdBy: { select: { user: { select: { firstName: true } } } },
            recipients: { select: { state: true } },
        },
    });
    return rows.map((c) => ({
        id: c.id, name: c.name, channel: c.channel, usePreferred: c.usePreferred, state: c.state, createdAt: c.createdAt,
        by: c.createdBy?.user.firstName ?? null,
        counts: tally(c.recipients),
    }));
}

export function tally(recipients: { state: string }[]) {
    const counts = { total: recipients.length, pending: 0, sent: 0, skipped: 0, failed: 0 };
    for (const r of recipients) {
        if (r.state === "PENDING") counts.pending++;
        else if (r.state === "SENT") counts.sent++;
        else if (r.state === "SKIPPED") counts.skipped++;
        else counts.failed++;
    }
    return counts;
}

export async function getCampaign(db: TenantTx, id: string) {
    const campaign = await db.campaign.findUnique({
        where: { id },
        select: {
            id: true, name: true, channel: true, usePreferred: true, subject: true, body: true, filters: true, state: true, createdAt: true,
            createdBy: { select: { user: { select: { firstName: true } } } },
            recipients: {
                orderBy: [{ state: "asc" }, { customer: { lastName: "asc" } }],
                select: {
                    id: true, state: true, note: true, actedAt: true,
                    message: { select: { channel: true, status: true, recipient: true } },
                    customer: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true, preferredContact: true } },
                },
            },
        },
    });
    if (!campaign) return null;
    return { ...campaign, counts: tally(campaign.recipients) };
}

export type CampaignRecord = NonNullable<Awaited<ReturnType<typeof getCampaign>>>;
