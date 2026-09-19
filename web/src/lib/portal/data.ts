import "server-only";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant, type TenantDb } from "@/lib/tenant-db";
import { resolveShareToken } from "@/lib/sharing/links";
import { portalSettings, onlineBookingSettings, type PortalSettings } from "@/lib/settings/schema";
import { getCustomerAccount } from "@/lib/payments/queries";
import { businessToday } from "@/lib/tenant/today";
import { JOB_STATUS_LABELS } from "@/lib/documents/types";

/**
 * The customer portal, found by the customer's own link.
 *
 * The token resolves to one tenant and one customer, and every read after it
 * goes through the tenant-scoped client and names that customer — so a portal
 * link reaches that customer's things and nothing else. The workshop's portal
 * settings are checked on every request, so switching the portal off (or a
 * section of it) takes effect for links already sent.
 */

export type PortalFailure = "unknown" | "expired" | "revoked" | "off";

export async function portalAccess(token: string) {
    const share = await resolveShareToken(token);
    if (!share.ok) return { ok: false as const, reason: share.reason as PortalFailure };
    if (share.kind !== "PORTAL") return { ok: false as const, reason: "unknown" as const };
    const tenant = await prisma.tenant.findUnique({ where: { id: share.tenantId } });
    if (!tenant?.isActive) return { ok: false as const, reason: "unknown" as const };
    const settings = portalSettings(tenant.settings);
    if (!settings.enabled) return { ok: false as const, reason: "off" as const };
    const db = forTenant(tenant.id);
    const customer = await db.customer.findUnique({ where: { id: share.targetId }, select: { id: true, firstName: true, lastName: true, archivedAt: true } });
    if (!customer || customer.archivedAt) return { ok: false as const, reason: "unknown" as const };
    return { ok: true as const, share, tenant, db, customer, settings };
}

const INVOICE_TYPES = ["INVOICE", "CASH_SALE", "CREDIT"] as const;
const QUOTE_DAYS = 90;
const vehicleText = (v: { year: number | null; make: string; model: string; plate: string } | null) =>
    v ? `${[v.year, v.make, v.model].filter(Boolean).join(" ")} (${v.plate})` : null;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Whether this customer may open this document through the portal. Invoices
 * once processed; quotes only once they were sent — a draft the workshop is
 * still pricing is not the customer's yet.
 */
export async function portalDocument(db: TenantDb, customerId: string, settings: PortalSettings, id: string) {
    const doc = await db.document.findUnique({ where: { id }, select: { id: true, customerId: true, type: true, state: true, contactedAt: true } });
    if (!doc || doc.customerId !== customerId) return null;
    if ((INVOICE_TYPES as readonly string[]).includes(doc.type)) {
        return settings.sections.invoices && (doc.state === "PROCESSED" || doc.state === "CLOSED" || doc.state === "VOID") ? doc : null;
    }
    if (doc.type === "QUOTE") return settings.sections.quotes && doc.state !== "VOID" && doc.contactedAt ? doc : null;
    return null;
}

export type PortalView = Awaited<ReturnType<typeof portalView>>;

export async function portalView(db: TenantDb, tenant: Tenant, customerId: string, settings: PortalSettings, now: Date = new Date()) {
    const s = settings.sections;
    const today = businessToday(tenant.timezone, now);
    const vehicleSelect = { select: { year: true, make: true, model: true, plate: true } } as const;

    const [account, inspections, jobs, bookings, vehicles, invoices, quotes] = await Promise.all([
        s.account || s.invoices ? getCustomerAccount(db, customerId, today) : null,
        s.inspections
            ? db.inspection.findMany({
                where: { customerId, state: { in: ["REQUESTED", "APPROVED", "REFUSED"] }, requestedAt: { gte: new Date(now.getTime() - 60 * 86_400_000) } },
                orderBy: { requestedAt: "desc" },
                select: { id: true, number: true, state: true, requestedAt: true, vehicle: vehicleSelect, items: { select: { urgent: true, soon: true, approvedAt: true, declinedAt: true } } },
            })
            : [],
        s.jobs
            ? db.document.findMany({
                where: { customerId, type: "JOB_CARD", state: "DRAFT", jobStatus: { notIn: ["FINALISED"] } },
                orderBy: { createdAt: "desc" },
                select: { id: true, jobNumber: true, number: true, jobStatus: true, vehicle: vehicleSelect },
            })
            : [],
        s.bookings
            ? db.document.findMany({
                where: { customerId, type: "BOOKING", state: "DRAFT", scheduledAt: { gte: now } },
                orderBy: { scheduledAt: "asc" },
                take: 10,
                select: { id: true, scheduledAt: true, description: true, vehicle: vehicleSelect },
            })
            : [],
        s.vehicles
            ? db.vehicle.findMany({
                where: { customerId, archivedAt: null },
                orderBy: { plate: "asc" },
                select: { id: true, plate: true, make: true, model: true, year: true, odometer: true, nextServiceDate: true, nextServiceKm: true, licenceExpiry: true, roadworthyExpiry: true },
            })
            : [],
        s.invoices
            ? db.document.findMany({
                where: { customerId, type: { in: [...INVOICE_TYPES] }, state: { in: ["PROCESSED", "CLOSED", "VOID"] }, postDate: { gte: new Date(now.getTime() - 730 * 86_400_000) } },
                orderBy: [{ postDate: "desc" }, { createdAt: "desc" }],
                take: 50,
                select: { id: true, type: true, state: true, number: true, postDate: true, total: true, vehicle: vehicleSelect },
            })
            : [],
        s.quotes
            ? db.document.findMany({
                where: { customerId, type: "QUOTE", state: { not: "VOID" }, contactedAt: { gte: new Date(now.getTime() - QUOTE_DAYS * 86_400_000) } },
                orderBy: { contactedAt: "desc" },
                select: { id: true, number: true, postDate: true, total: true, vehicle: vehicleSelect },
            })
            : [],
    ]);

    // A quote that became a job has had its answer; it moves to the job.
    const converted = quotes.length
        ? new Set((await db.document.findMany({ where: { sourceDocumentId: { in: quotes.map((q) => q.id) }, state: { not: "VOID" } }, select: { sourceDocumentId: true } })).map((d) => d.sourceDocumentId))
        : new Set<string | null>();
    const outstanding = new Map((account?.openItems ?? []).map((i) => [i.id, i.outstanding]));
    const booking = onlineBookingSettings(tenant.settings);

    return {
        today: iso(today)!,
        canBookOnline: booking.enabled,
        account: s.account && account ? { owing: account.netOwing, overdue: Math.max(0, account.ageing.total - account.ageing.current), openCount: account.openItems.length } : null,
        inspections: inspections.map((i) => {
            const flagged = i.items.filter((x) => x.urgent || x.soon);
            return {
                id: i.id, number: i.number, state: i.state, requestedAt: iso(i.requestedAt), vehicle: vehicleText(i.vehicle),
                flagged: flagged.length, waiting: i.state === "REQUESTED" ? flagged.filter((x) => !x.approvedAt && !x.declinedAt).length : 0,
                approved: flagged.filter((x) => x.approvedAt).length,
            };
        }),
        // One line per vehicle: the customer wants to know where their car is, not how the workshop split the work.
        jobs: jobs.filter((j, n) => !j.vehicle || jobs.findIndex((k) => k.vehicle?.plate === j.vehicle?.plate) === n).map((j) => ({ id: j.id, number: j.jobNumber ?? j.number, status: j.jobStatus ? JOB_STATUS_LABELS[j.jobStatus] : "In the workshop", vehicle: vehicleText(j.vehicle) })),
        bookings: bookings.map((b) => ({
            id: b.id, vehicle: vehicleText(b.vehicle), description: b.description,
            when: new Intl.DateTimeFormat("en-GB", { timeZone: tenant.timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(b.scheduledAt!),
        })),
        vehicles: vehicles.map((v) => ({
            id: v.id, name: vehicleText(v)!, odometer: v.odometer, nextServiceDate: iso(v.nextServiceDate), nextServiceKm: v.nextServiceKm,
            licenceExpiry: iso(v.licenceExpiry), roadworthyExpiry: iso(v.roadworthyExpiry),
        })),
        invoices: invoices.map((d) => ({
            id: d.id, type: d.type, number: d.number, date: iso(d.postDate)!, total: d.total.toNumber(), void: d.state === "VOID",
            outstanding: outstanding.get(d.id) ?? 0, vehicle: vehicleText(d.vehicle),
        })),
        quotes: quotes.filter((q) => !converted.has(q.id)).map((q) => ({ id: q.id, number: q.number, date: iso(q.postDate)!, total: q.total.toNumber(), vehicle: vehicleText(q.vehicle) })),
    };
}
