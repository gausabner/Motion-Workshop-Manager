import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Every customer, for export.
 *
 * Separate from `listCustomers` because that one is a paginated screen query
 * capped at a hundred rows, and a listing that silently stopped at a hundred
 * would be worse than no listing at all — the file looks complete.
 *
 * This is the data-portability answer: the thing a workshop is handed when it
 * asks whether it can get its customers back out. It is also, for exactly that
 * reason, the file most worth taking, which is why the export is audited and
 * why `redactContact` runs over these rows before they are written. Somebody
 * whose role does not let them read an address on screen must not be able to
 * download six hundred of them.
 */

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type CustomerExportRow = {
    id: string;
    name: string;
    kind: string;
    mobile: string | null;
    phone: string | null;
    email: string | null;
    streetAddress1: string | null;
    streetSuburb: string | null;
    streetCity: string | null;
    streetPostcode: string | null;
    vatNumber: string | null;
    terms: string;
    vehicles: number;
    /** What they have been invoiced, ever — the number that says who matters. */
    invoiced: number;
    lastInvoice: string;
    since: string;
    archived: string;
    [key: string]: unknown;
};

export async function customerListing(db: TenantDb, includeArchived: boolean): Promise<CustomerExportRow[]> {
    const customers = await db.customer.findMany({
        where: includeArchived ? {} : { archivedAt: null },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
            id: true, firstName: true, lastName: true, isBusiness: true, vatNumber: true,
            mobile: true, phone: true, email: true,
            streetAddress1: true, streetSuburb: true, streetCity: true, streetPostcode: true,
            paymentTermsDays: true, createdAt: true, archivedAt: true,
            _count: { select: { vehicles: true } },
            documents: {
                where: { type: { in: ["INVOICE", "CASH_SALE", "CREDIT"] }, state: { in: ["PROCESSED", "CLOSED"] } },
                select: { total: true, postDate: true },
            },
        },
    });

    return customers.map((c) => {
        const invoiced = c.documents.reduce((t, d) => t + d.total.toNumber(), 0);
        const last = c.documents.reduce<Date | null>((m, d) => (m === null || d.postDate > m ? d.postDate : m), null);
        return {
            id: c.id,
            name: `${c.firstName} ${c.lastName}`.trim(),
            kind: c.isBusiness ? "Business" : "Private",
            mobile: c.mobile, phone: c.phone, email: c.email,
            streetAddress1: c.streetAddress1, streetSuburb: c.streetSuburb,
            streetCity: c.streetCity, streetPostcode: c.streetPostcode,
            vatNumber: c.vatNumber,
            terms: c.paymentTermsDays === null ? "" : `${c.paymentTermsDays} days`,
            vehicles: c._count.vehicles,
            invoiced: Math.round(invoiced * 100) / 100,
            lastInvoice: iso(last),
            since: iso(c.createdAt),
            archived: iso(c.archivedAt),
        };
    });
}
