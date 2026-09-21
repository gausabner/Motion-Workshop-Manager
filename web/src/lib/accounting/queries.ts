import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";
import type { MoneyRow, SaleRow } from "@/lib/accounting/export";

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const nameOf = (c: { firstName: string; lastName: string } | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "Cash sale");

/** Everything invoiced in the period. A credit note is the same row with the signs turned round. */
export async function salesFor(db: TenantDb, from: Date, to: Date): Promise<SaleRow[]> {
    const docs = await db.document.findMany({
        where: { type: { in: ["INVOICE", "CASH_SALE", "CREDIT"] }, state: { in: ["PROCESSED", "CLOSED"] }, postDate: { gte: from, lte: to } },
        orderBy: [{ postDate: "asc" }, { number: "asc" }],
        select: {
            type: true, number: true, postDate: true, dueDate: true, reference: true, description: true,
            subtotal: true, vatTotal: true, total: true, isInternal: true,
            customer: { select: { firstName: true, lastName: true } },
        },
    });
    return docs.map((d) => {
        const sign = d.type === "CREDIT" ? -1 : 1;
        // Credits are stored negative already; this keeps both cases the right way round.
        const net = round2(Math.abs(num(d.subtotal)) * sign);
        const tax = round2(Math.abs(num(d.vatTotal)) * sign);
        return {
            date: iso(d.postDate)!, number: d.number ?? "", customer: nameOf(d.customer), reference: d.reference,
            description: d.description ?? (d.type === "CREDIT" ? "Credit note" : "Workshop services"),
            net, tax, total: round2(net + tax), dueDate: iso(d.dueDate),
            ...(d.isInternal ? { internal: true } : {}),
        };
    });
}

export async function receiptsFor(db: TenantDb, from: Date, to: Date): Promise<MoneyRow[]> {
    const payments = await db.payment.findMany({
        where: { state: "PROCESSED", postDate: { gte: from, lte: to } },
        orderBy: [{ postDate: "asc" }, { number: "asc" }],
        select: {
            number: true, postDate: true, amount: true, direction: true,
            customer: { select: { firstName: true, lastName: true } },
            tenders: { select: { reference: true, method: { select: { name: true } } } },
        },
    });
    return payments.map((p) => ({
        date: iso(p.postDate)!, number: p.number ?? "", party: nameOf(p.customer),
        reference: p.tenders.map((t) => t.reference).filter(Boolean).join(", ") || null,
        method: [...new Set(p.tenders.map((t) => t.method?.name).filter(Boolean))].join(", ") || null,
        amount: round2(num(p.amount)),
    }));
}

export async function purchasesFor(db: TenantDb, from: Date, to: Date): Promise<SaleRow[]> {
    const invoices = await db.supplierInvoice.findMany({
        where: { state: { in: ["PROCESSED", "CLOSED"] }, postDate: { gte: from, lte: to } },
        orderBy: [{ postDate: "asc" }],
        select: {
            supplierNumber: true, otherReference: true, postDate: true, dueDate: true, subtotal: true, taxTotal: true, total: true,
            supplier: { select: { companyName: true } },
        },
    });
    return invoices.map((i) => ({
        date: iso(i.postDate)!, number: i.supplierNumber, customer: i.supplier.companyName, reference: i.otherReference,
        description: "Parts and sublets", net: round2(num(i.subtotal)), tax: round2(num(i.taxTotal)), total: round2(num(i.total)),
        dueDate: iso(i.dueDate),
    }));
}

export async function supplierPaymentsFor(db: TenantDb, from: Date, to: Date): Promise<MoneyRow[]> {
    const payments = await db.supplierPayment.findMany({
        where: { state: "PROCESSED", postDate: { gte: from, lte: to } },
        orderBy: [{ postDate: "asc" }],
        select: {
            number: true, postDate: true, amount: true, reference: true,
            method: { select: { name: true } },
            allocations: { select: { invoice: { select: { supplier: { select: { companyName: true } } } } } },
        },
    });
    return payments.map((p) => ({
        date: iso(p.postDate)!, number: p.number ?? "",
        party: [...new Set(p.allocations.map((a) => a.invoice.supplier.companyName))].join(", ") || "Several suppliers",
        reference: p.reference, method: p.method?.name ?? null, amount: round2(num(p.amount)),
    }));
}

/** How much is in the period, before anyone downloads it. */
export async function exportCounts(db: TenantDb, from: Date, to: Date) {
    const [sales, receipts, purchases, supplierPayments] = await Promise.all([
        salesFor(db, from, to), receiptsFor(db, from, to), purchasesFor(db, from, to), supplierPaymentsFor(db, from, to),
    ]);
    const sum = (rows: { total?: number; amount?: number }[]) => round2(rows.reduce((t, r) => t + (r.total ?? r.amount ?? 0), 0));
    return {
        sales: { count: sales.length, total: sum(sales) },
        receipts: { count: receipts.length, total: sum(receipts) },
        purchases: { count: purchases.length, total: sum(purchases) },
        supplierPayments: { count: supplierPayments.length, total: sum(supplierPayments) },
    };
}
