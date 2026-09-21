import "server-only";
import type { Prisma, Tenant } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { round2 } from "@/lib/documents/totals";
import { ageItems } from "@/lib/payments/allocation";
import { clampSupplierAllocation, stateAfterSupplierAllocation, supplierOutstanding, supplierPaymentError } from "@/lib/purchasing/settlement";

/**
 * Paying suppliers. One payment can settle invoices from several suppliers —
 * one transfer, several accounts — which is the shape the benchmark found and
 * a customer receipt deliberately does not have.
 */

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const PROCESSED_ALLOCATIONS = { where: { payment: { state: "PROCESSED" as const } }, select: { amount: true } };
const sum = (rows: { amount: Prisma.Decimal }[]) => round2(rows.reduce((total, r) => total + num(r.amount), 0));

/** Every supplier invoice with money still on it, oldest first. */
export async function openSupplierInvoices(db: TenantDb | TenantTx, supplierId?: string) {
    const rows = await db.supplierInvoice.findMany({
        where: { state: "PROCESSED", ...(supplierId ? { supplierId } : {}) },
        orderBy: [{ postDate: "asc" }, { createdAt: "asc" }],
        select: {
            id: true, supplierNumber: true, postDate: true, dueDate: true, total: true,
            supplier: { select: { id: true, companyName: true } },
            allocations: PROCESSED_ALLOCATIONS,
        },
    });
    return rows
        .map((r) => ({
            id: r.id, supplierNumber: r.supplierNumber, supplier: r.supplier,
            postDate: iso(r.postDate)!, dueDate: iso(r.dueDate),
            total: num(r.total), outstanding: supplierOutstanding(num(r.total), sum(r.allocations)),
        }))
        .filter((r) => r.outstanding > 0);
}

/** What the workshop owes, by supplier, aged the same way its debtors are. */
export async function payablesReport(db: TenantDb, asAt: Date) {
    const open = await openSupplierInvoices(db);
    const bySupplier = new Map<string, { id: string; name: string; invoices: typeof open; total: number }>();
    for (const invoice of open) {
        const row = bySupplier.get(invoice.supplier.id) ?? { id: invoice.supplier.id, name: invoice.supplier.companyName, invoices: [], total: 0 };
        row.invoices.push(invoice);
        row.total = round2(row.total + invoice.outstanding);
        bySupplier.set(invoice.supplier.id, row);
    }
    const suppliers = [...bySupplier.values()]
        .map((s) => ({ ...s, ageing: ageItems(s.invoices.map((i) => ({ dueDate: i.dueDate, postDate: i.postDate, outstanding: i.outstanding })), asAt) }))
        .sort((a, b) => b.total - a.total);
    return { suppliers, total: round2(suppliers.reduce((t, s) => t + s.total, 0)), ageing: ageItems(open.map((i) => ({ dueDate: i.dueDate, postDate: i.postDate, outstanding: i.outstanding })), asAt) };
}

export type PaymentInput = {
    postDate: string;
    reference?: string | null;
    methodId?: string | null;
    note?: string | null;
    amount: number;
    allocations: { supplierInvoiceId: string; amount: number }[];
};

export async function savePayment(tx: TenantTx, tenant: Tenant, membershipId: string, id: string | null, input: PaymentInput): Promise<string> {
    const header = {
        postDate: new Date(`${input.postDate}T00:00:00Z`), reference: input.reference ?? null,
        methodId: input.methodId ?? null, note: input.note ?? null, amount: input.amount,
    };
    let paymentId = id;
    if (paymentId) {
        const existing = await tx.supplierPayment.findUnique({ where: { id: paymentId }, select: { state: true } });
        if (!existing) throw new Error("That payment is no longer there.");
        if (existing.state !== "DRAFT") throw new Error("A posted payment cannot be changed. Reverse it instead.");
        await tx.supplierPayment.update({ where: { id: paymentId }, data: header });
    } else {
        const created = await tx.supplierPayment.create({ data: { ...header, tenantId: tenant.id, createdById: membershipId }, select: { id: true } });
        paymentId = created.id;
    }

    await tx.supplierPaymentAllocation.deleteMany({ where: { paymentId } });
    for (const allocation of input.allocations) {
        if (round2(allocation.amount) === 0) continue;
        const invoice = await tx.supplierInvoice.findUnique({ where: { id: allocation.supplierInvoiceId }, select: { id: true } });
        if (!invoice) throw new Error("One of those invoices is no longer there.");
        await tx.supplierPaymentAllocation.create({
            data: { tenantId: tenant.id, paymentId, supplierInvoiceId: allocation.supplierInvoiceId, amount: allocation.amount },
        });
    }
    return paymentId;
}

/** Post the payment: settle what it is pointed at, then give it its number. */
export async function postPayment(tx: TenantTx, tenantId: string, paymentId: string): Promise<{ number: string; amount: number }> {
    const payment = await tx.supplierPayment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { id: true, state: true, amount: true, allocations: { select: { supplierInvoiceId: true, amount: true } } },
    });
    if (payment.state !== "DRAFT") throw new Error("Only a draft payment can be posted.");
    const problem = supplierPaymentError(num(payment.amount), payment.allocations.map((a) => num(a.amount)));
    if (problem) throw new Error(problem);

    for (const allocation of payment.allocations) {
        // Re-read inside the transaction: two people paying the same invoice cannot both succeed.
        const invoice = await tx.supplierInvoice.findUniqueOrThrow({
            where: { id: allocation.supplierInvoiceId },
            select: { id: true, state: true, supplierNumber: true, total: true, allocations: PROCESSED_ALLOCATIONS },
        });
        const name = invoice.supplierNumber || "That invoice";
        if (invoice.state !== "PROCESSED") throw new Error(`${name} is not open for payment.`);
        const already = sum(invoice.allocations);
        const left = supplierOutstanding(num(invoice.total), already);
        const amount = num(allocation.amount);
        if (clampSupplierAllocation(left, amount) !== amount) {
            throw new Error(`${name} has ${left.toFixed(2)} outstanding — ${amount.toFixed(2)} cannot be applied to it.`);
        }
        await tx.supplierInvoice.update({
            where: { id: invoice.id },
            data: { state: stateAfterSupplierAllocation(invoice.state, num(invoice.total), round2(already + amount)) },
        });
    }

    const number = await allocateNumber(tx, tenantId, "SUPPLIER_PAYMENT");
    await tx.supplierPayment.update({ where: { id: paymentId }, data: { state: "PROCESSED", number, processedAt: new Date() } });
    return { number, amount: num(payment.amount) };
}

/** Reverse a posted payment: the allocations stay for the trail but stop counting, so the invoices re-open. */
export async function reversePayment(tx: TenantTx, paymentId: string, reason: string): Promise<void> {
    const payment = await tx.supplierPayment.findUniqueOrThrow({ where: { id: paymentId }, select: { state: true, allocations: { select: { supplierInvoiceId: true } } } });
    if (payment.state === "VOID") throw new Error("Already reversed.");
    if (payment.state === "DRAFT") throw new Error("This payment was never posted.");
    await tx.supplierPayment.update({ where: { id: paymentId }, data: { state: "VOID", voidedAt: new Date(), voidReason: reason.trim().slice(0, 200) } });
    for (const { supplierInvoiceId } of payment.allocations) {
        const invoice = await tx.supplierInvoice.findUniqueOrThrow({
            where: { id: supplierInvoiceId },
            select: { id: true, state: true, total: true, allocations: PROCESSED_ALLOCATIONS },
        });
        await tx.supplierInvoice.update({
            where: { id: invoice.id },
            data: { state: stateAfterSupplierAllocation(invoice.state, num(invoice.total), sum(invoice.allocations)) },
        });
    }
}

export async function listPayments(db: TenantDb, take = 50) {
    const rows = await db.supplierPayment.findMany({
        orderBy: [{ postDate: "desc" }, { createdAt: "desc" }],
        take,
        select: {
            id: true, number: true, state: true, postDate: true, reference: true, amount: true,
            method: { select: { name: true } },
            createdBy: { select: { user: { select: { firstName: true } } } },
            allocations: { select: { amount: true, invoice: { select: { supplierNumber: true, supplier: { select: { id: true, companyName: true } } } } } },
        },
    });
    return rows.map((p) => ({
        id: p.id, number: p.number, state: p.state, postDate: iso(p.postDate)!, reference: p.reference,
        amount: num(p.amount), method: p.method?.name ?? null, by: p.createdBy?.user.firstName ?? null,
        suppliers: [...new Set(p.allocations.map((a) => a.invoice.supplier.companyName))],
        invoiceCount: p.allocations.length,
    }));
}

export async function getPayment(db: TenantDb, id: string) {
    const payment = await db.supplierPayment.findUnique({
        where: { id },
        select: {
            id: true, number: true, state: true, postDate: true, reference: true, note: true, amount: true, methodId: true,
            processedAt: true, voidedAt: true, voidReason: true,
            createdBy: { select: { user: { select: { firstName: true } } } },
            allocations: {
                select: {
                    id: true, amount: true, supplierInvoiceId: true,
                    invoice: { select: { id: true, supplierNumber: true, postDate: true, dueDate: true, total: true, state: true, supplier: { select: { id: true, companyName: true } }, allocations: PROCESSED_ALLOCATIONS } },
                },
            },
        },
    });
    if (!payment) return null;
    return {
        ...payment,
        postDate: iso(payment.postDate)!,
        amount: num(payment.amount),
        allocations: payment.allocations.map((a) => ({
            id: a.id, supplierInvoiceId: a.supplierInvoiceId, amount: num(a.amount),
            supplierNumber: a.invoice.supplierNumber, supplier: a.invoice.supplier,
            postDate: iso(a.invoice.postDate)!, dueDate: iso(a.invoice.dueDate), total: num(a.invoice.total),
            outstanding: supplierOutstanding(num(a.invoice.total), sum(a.invoice.allocations)),
        })),
    };
}

export type SupplierPaymentRecord = NonNullable<Awaited<ReturnType<typeof getPayment>>>;
