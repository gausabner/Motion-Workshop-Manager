import type { DocumentType, Tenant } from "@prisma/client";
import { parseSettings } from "@/lib/settings/schema";
import { round2 } from "@/lib/documents/totals";
import { dateShort, money } from "@/lib/format";
import type { MergeValues } from "@/lib/templates/merge";

/**
 * The values merge fields resolve to, built in one place so a footer on a
 * printed invoice and the WhatsApp message that sends it can never disagree
 * about what `{{total}}` says.
 */

export function workshopValues(tenant: Tenant): MergeValues {
    const settings = parseSettings(tenant.settings);
    return {
        workshop_name: tenant.name,
        workshop_phone: tenant.phone ?? tenant.mobile ?? "",
        workshop_email: tenant.email ?? "",
        workshop_address: [tenant.address1, tenant.suburb, tenant.city].filter(Boolean).join(", "),
        vat_number: tenant.vatNumber ?? "",
        bank_details: settings.bankDetails ?? "",
    };
}

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
    QUOTE: "Quote",
    BOOKING: "Booking",
    JOB_CARD: "Job card",
    INVOICE: "Tax invoice",
    CASH_SALE: "Cash sale",
    CREDIT: "Credit note",
};

/** An invoice is only a *tax* invoice when there is a VAT number to put on it. */
export function documentTitle(type: DocumentType, vatNumber: string | null): string {
    return type === "INVOICE" && !vatNumber ? "Invoice" : DOCUMENT_TITLES[type];
}

export type DocumentForValues = {
    type: DocumentType;
    number: string | null;
    jobNumber: string | null;
    postDate: Date;
    dueDate: Date | null;
    scheduledAt: Date | null;
    odometer: number | null;
    nextServiceKm: number | null;
    nextServiceDate: Date | null;
    total: number;
    customer: { firstName: string; lastName: string; mobile: string | null } | null;
    vehicle: { plate: string; make: string; model: string; year: number | null } | null;
};

export function documentValues(tenant: Tenant, doc: DocumentForValues, amountPaid: number): MergeValues {
    const due = round2(doc.total - amountPaid);
    return {
        ...workshopValues(tenant),
        customer_name: doc.customer ? `${doc.customer.firstName} ${doc.customer.lastName}`.trim() : "",
        customer_first_name: doc.customer?.firstName ?? "",
        customer_mobile: doc.customer?.mobile ?? "",
        vehicle: doc.vehicle ? [doc.vehicle.year, doc.vehicle.make, doc.vehicle.model].filter(Boolean).join(" ") : "",
        plate: doc.vehicle?.plate ?? "",
        odometer: doc.odometer ? doc.odometer.toLocaleString("en-NA") : "",
        next_service_km: doc.nextServiceKm ? doc.nextServiceKm.toLocaleString("en-NA") : "",
        next_service_date: doc.nextServiceDate ? dateShort(doc.nextServiceDate) : "",
        document_title: documentTitle(doc.type, tenant.vatNumber),
        document_number: doc.number ?? doc.jobNumber ?? "",
        document_date: dateShort(doc.postDate),
        due_date: doc.dueDate ? dateShort(doc.dueDate) : "",
        scheduled_at: doc.scheduledAt ? dateShort(doc.scheduledAt) : "",
        total: money(Math.abs(doc.total), tenant.currency),
        // Blank once settled, so a line that says "Amount due: …" drops out instead of reading N$ 0.00.
        amount_due: due > 0 ? money(due, tenant.currency) : "",
    };
}
