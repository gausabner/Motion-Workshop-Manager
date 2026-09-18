import "server-only";
import type { DocumentType, TemplateKind, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { readAttachment } from "@/lib/attachments/service";
import { calculateLine, round2 } from "@/lib/documents/totals";
import { getCustomerAccount, getStatement, getPayment } from "@/lib/payments/queries";
import { AGEING_BUCKETS, AGEING_LABELS } from "@/lib/payments/allocation";
import { parseSettings } from "@/lib/settings/schema";
import { renderTemplate, type MergeValues } from "@/lib/templates/merge";
import { documentValues, workshopValues } from "@/lib/templates/values";
import { defaultBodyFor } from "@/lib/templates/catalogue";
import type { DocumentPdfInput, PdfLine } from "@/lib/pdf/documents";
import type { ReceiptPdfInput } from "@/lib/pdf/receipt";
import type { StatementPdfInput } from "@/lib/pdf/statement";
import type { Letterhead } from "@/lib/pdf/letterhead";
import { dateShort } from "@/lib/format";

/**
 * Turning rows into something a renderer can lay out.
 *
 * Kept apart from the renderers so the layout code has no idea Prisma exists,
 * and apart from the routes so the customer portal can print the same document
 * the workshop does, from the same function.
 */

const FOOTER_KIND: Record<DocumentType, TemplateKind> = {
    QUOTE: "QUOTE_FOOTER",
    BOOKING: "JOB_CARD_FOOTER",
    JOB_CARD: "JOB_CARD_FOOTER",
    INVOICE: "INVOICE_FOOTER",
    CASH_SALE: "INVOICE_FOOTER",
    CREDIT: "INVOICE_FOOTER",
};

const moneyIn = (currency: string) => (value: number) =>
    `${currency === "ZAR" ? "R" : "N$"} ${value.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function letterheadFor(db: TenantDb, tenant: Tenant): Promise<Letterhead> {
    const settings = parseSettings(tenant.settings);
    let logo: Buffer | null = null;
    if (settings.logoAttachmentId) {
        // A missing or unreadable logo must never stop an invoice printing.
        logo = await readAttachment(db, settings.logoAttachmentId).then((a) => a?.body ?? null).catch(() => null);
    }
    return {
        name: tenant.name,
        registrationNumber: tenant.registrationNumber,
        vatNumber: tenant.vatNumber,
        addressLines: [
            [tenant.address1, tenant.address2].filter(Boolean).join(", "),
            [tenant.suburb, tenant.city].filter(Boolean).join(", "),
            [tenant.region, tenant.postcode].filter(Boolean).join(" "),
        ].filter((line) => line.trim().length > 0),
        phone: tenant.phone ?? tenant.mobile,
        email: tenant.email,
        web: tenant.web,
        logo,
        taxName: tenant.taxName,
    };
}

/** The workshop's own footer for this kind of document — or ours, if they have never written one — with its fields filled in. */
async function footerFor(db: TenantDb, kind: TemplateKind, values: MergeValues): Promise<string> {
    const template = await db.template.findFirst({ where: { kind, active: true }, orderBy: { sortOrder: "asc" }, select: { body: true } });
    return renderTemplate(template ? template.body : defaultBodyFor(kind), values);
}

export async function documentPdfInput(db: TenantDb, tenant: Tenant, id: string): Promise<DocumentPdfInput | null> {
    const doc = await db.document.findUnique({
        where: { id },
        include: {
            customer: { select: { firstName: true, lastName: true, postalAddress1: true, postalSuburb: true, postalCity: true, postalPostcode: true, mobile: true, email: true, vatNumber: true } },
            vehicle: { select: { plate: true, make: true, model: true, year: true, odometer: true, vin: true } },
            lines: { orderBy: { sortOrder: "asc" }, include: { product: { select: { itemCode: true } } } },
            serviceAdvisor: { select: { user: { select: { firstName: true, lastName: true } } } },
            mechanic: { select: { user: { select: { firstName: true, lastName: true } } } },
            allocations: { where: { payment: { state: "PROCESSED" } }, select: { amount: true } },
        },
    });
    if (!doc) return null;

    const pricesIncludeTax = doc.pricesIncludeTax;
    // Derived at render, never read off the row: a printed invoice cannot be allowed to show a stale figure.
    const lines: PdfLine[] = doc.lines.map((line) => {
        const computed = calculateLine(
            { quantity: line.quantity.toNumber(), unitPrice: line.unitPrice.toNumber(), vatRate: line.vatRate.toNumber(), discountPercent: line.discountPercent.toNumber() },
            pricesIncludeTax,
        );
        return {
            itemCode: line.product?.itemCode ?? null,
            description: line.description,
            quantity: line.quantity.toNumber(),
            unitPrice: line.unitPrice.toNumber(),
            discountPercent: line.discountPercent.toNumber(),
            lineTotal: pricesIncludeTax ? computed.lineTotal : computed.lineSubtotal,
            serialNumbers: line.serialNumbers,
        };
    });

    const total = doc.total.toNumber();
    const amountPaid = round2(doc.allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0));
    const values = documentValues(tenant, { ...doc, total }, amountPaid);

    const notes = [doc.type === "QUOTE" ? doc.eventNotes : null, doc.type === "BOOKING" || doc.type === "JOB_CARD" ? doc.jobCardNotes : null, doc.invoiceNotes]
        .filter((note): note is string => !!note?.trim())
        .map((note) => renderTemplate(note, values));

    return {
        workshop: await letterheadFor(db, tenant),
        currency: tenant.currency,
        type: doc.type,
        number: doc.number,
        jobNumber: doc.jobNumber,
        state: doc.state,
        postDate: dateShort(doc.postDate),
        dueDate: doc.dueDate ? dateShort(doc.dueDate) : null,
        scheduledAt: doc.scheduledAt ? dateShort(doc.scheduledAt) : null,
        reference: doc.reference,
        customerOrderNumber: doc.customerOrderNumber,
        customer: doc.customer
            ? {
                  name: `${doc.customer.firstName} ${doc.customer.lastName}`.trim(),
                  lines: [
                      doc.customer.postalAddress1 ?? "",
                      [doc.customer.postalSuburb, doc.customer.postalCity].filter(Boolean).join(", "),
                      doc.customer.postalPostcode ?? "",
                      doc.customer.mobile ?? doc.customer.email ?? "",
                      doc.customer.vatNumber ? `${tenant.taxName} ${doc.customer.vatNumber}` : "",
                  ].filter((line) => line.trim().length > 0),
              }
            : null,
        vehicle: doc.vehicle
            ? {
                  plate: doc.vehicle.plate,
                  description: [doc.vehicle.year, doc.vehicle.make, doc.vehicle.model].filter(Boolean).join(" "),
                  odometer: doc.odometer ?? doc.vehicle.odometer,
                  vin: doc.vehicle.vin,
              }
            : null,
        advisor: doc.serviceAdvisor ? `${doc.serviceAdvisor.user.firstName} ${doc.serviceAdvisor.user.lastName}` : null,
        mechanic: doc.mechanic ? `${doc.mechanic.user.firstName} ${doc.mechanic.user.lastName}` : null,
        lines,
        taxName: doc.taxName,
        taxRate: doc.taxRate.toNumber(),
        pricesIncludeTax,
        subtotal: doc.subtotal.toNumber(),
        discountApplied: doc.discountApplied.toNumber(),
        freight: doc.freight.toNumber(),
        vatTotal: doc.vatTotal.toNumber(),
        total,
        amountPaid,
        amountDue: round2(total - amountPaid),
        notes,
        footer: await footerFor(db, FOOTER_KIND[doc.type], values),
    };
}

export async function receiptPdfInput(db: TenantDb, tenant: Tenant, id: string): Promise<ReceiptPdfInput | null> {
    const payment = await getPayment(db, id);
    if (!payment) return null;
    const account = payment.customer ? await getCustomerAccount(db, payment.customer.id) : null;
    const values = workshopValues(tenant);

    return {
        workshop: await letterheadFor(db, tenant),
        currency: tenant.currency,
        direction: payment.direction,
        number: payment.number,
        state: payment.state,
        postDate: dateShort(payment.postDate),
        note: payment.note,
        takenBy: payment.takenBy ? `${payment.takenBy.user.firstName} ${payment.takenBy.user.lastName}` : null,
        customer: payment.customer
            ? { name: `${payment.customer.firstName} ${payment.customer.lastName}`.trim(), lines: [payment.customer.mobile ?? payment.customer.email ?? ""].filter(Boolean) }
            : null,
        tenders: payment.tenders.map((tender) => ({ method: tender.method.name, reference: tender.reference, amount: tender.amount, tendered: tender.tendered })),
        allocations: payment.allocations.map((allocation) => ({
            label: allocation.document.type === "CREDIT" ? "Credit note" : allocation.document.type === "CASH_SALE" ? "Cash sale" : "Invoice",
            number: allocation.document.number,
            date: dateShort(allocation.document.postDate),
            amount: allocation.amount,
        })),
        total: payment.amount,
        allocated: round2(payment.allocations.reduce((sum, a) => sum + a.amount, 0)),
        unapplied: round2(payment.amount - payment.allocations.reduce((sum, a) => sum + a.amount, 0)),
        accountBalance: account?.netOwing ?? 0,
        footer: await footerFor(db, "INVOICE_FOOTER", values),
    };
}

export async function statementPdfInput(db: TenantDb, tenant: Tenant, customerId: string, from: Date, to: Date): Promise<StatementPdfInput | null> {
    const statement = await getStatement(db, customerId, from, to);
    if (!statement) return null;
    const money = moneyIn(tenant.currency);
    const values: MergeValues = {
        ...workshopValues(tenant),
        customer_name: `${statement.customer.firstName} ${statement.customer.lastName}`,
        customer_first_name: statement.customer.firstName,
        account_balance: money(statement.closing),
    };

    return {
        workshop: await letterheadFor(db, tenant),
        currency: tenant.currency,
        customer: {
            name: `${statement.customer.firstName} ${statement.customer.lastName}`.trim(),
            lines: [statement.customer.postalAddress1 ?? "", statement.customer.postalCity ?? "", statement.customer.email ?? statement.customer.mobile ?? ""].filter((line) => line.trim().length > 0),
        },
        from: dateShort(statement.from),
        to: dateShort(statement.to),
        opening: statement.opening,
        rows: statement.rows.map((row) => ({ date: dateShort(row.postDate), detail: row.label, number: row.number, amount: row.amount, balance: row.balance })),
        closing: statement.closing,
        ageing: AGEING_BUCKETS.map((bucket) => ({ label: AGEING_LABELS[bucket], value: statement.ageing[bucket] })),
        unapplied: statement.unapplied,
        footer: await footerFor(db, "STATEMENT_FOOTER", values),
    };
}
