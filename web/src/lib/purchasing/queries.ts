import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { costTotals, outstanding, receiptState } from "@/lib/purchasing/rules";
import { receivedByOrderLine } from "@/lib/purchasing/service";

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listOrders(db: TenantDb, opts: { open?: boolean } = {}) {
    const rows = await db.purchaseOrder.findMany({
        where: opts.open ? { state: { in: ["SUGGESTED", "ORDERED"] } } : {},
        orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
            id: true, number: true, state: true, orderDate: true, dueDate: true, taxRate: true, pricesIncludeTax: true,
            supplier: { select: { id: true, companyName: true } },
            lines: { select: { id: true, quantity: true, unitCost: true } },
        },
    });
    const received = await receivedForOrders(db, rows.map((r) => r.id));
    return rows.map((r) => ({
        id: r.id, number: r.number, state: r.state, orderDate: iso(r.orderDate)!, dueDate: iso(r.dueDate), supplier: r.supplier,
        lineCount: r.lines.length,
        total: costTotals(r.lines.map((l) => ({ quantity: num(l.quantity), unitCost: num(l.unitCost) })), { taxRate: num(r.taxRate), pricesIncludeTax: r.pricesIncludeTax }).total,
        receipt: receiptState(r.lines.map((l) => ({ id: l.id, quantity: num(l.quantity), received: received.get(l.id) ?? 0 }))),
    }));
}

async function receivedForOrders(db: TenantDb, orderIds: string[]): Promise<Map<string, number>> {
    if (orderIds.length === 0) return new Map();
    const rows = await db.supplierInvoiceLine.findMany({
        where: { orderLine: { orderId: { in: orderIds } }, invoice: { state: { in: ["PROCESSED", "CLOSED"] } } },
        select: { orderLineId: true, quantity: true },
    });
    const out = new Map<string, number>();
    for (const row of rows) {
        if (!row.orderLineId) continue;
        out.set(row.orderLineId, (out.get(row.orderLineId) ?? 0) + num(row.quantity));
    }
    return out;
}

export async function getOrder(db: TenantDb, id: string) {
    const order = await db.purchaseOrder.findUnique({
        where: { id },
        select: {
            id: true, number: true, state: true, orderDate: true, dueDate: true, reference: true, note: true,
            taxName: true, taxRate: true, pricesIncludeTax: true, orderedAt: true, cancelledAt: true,
            supplier: { select: { id: true, companyName: true } },
            createdBy: { select: { user: { select: { firstName: true } } } },
            lines: {
                orderBy: { sortOrder: "asc" },
                select: {
                    id: true, productId: true, itemCode: true, description: true, quantity: true, unitCost: true, dueDate: true, note: true,
                    document: { select: { id: true, jobNumber: true, number: true } },
                },
            },
            supplierInvoices: { select: { id: true, supplierNumber: true, state: true, postDate: true, total: true } },
        },
    });
    if (!order) return null;
    const received = await receivedByOrderLine(db, id);
    const lines = order.lines.map((l) => ({
        id: l.id, productId: l.productId, itemCode: l.itemCode, description: l.description,
        quantity: num(l.quantity), unitCost: num(l.unitCost), dueDate: iso(l.dueDate), note: l.note,
        documentId: l.document?.id ?? null, jobNumber: l.document?.jobNumber ?? l.document?.number ?? null,
        received: received.get(l.id) ?? 0,
        outstanding: outstanding({ id: l.id, quantity: num(l.quantity), received: received.get(l.id) ?? 0 }),
    }));
    return {
        ...order,
        orderDate: iso(order.orderDate)!, dueDate: iso(order.dueDate), taxRate: num(order.taxRate),
        lines,
        totals: costTotals(lines.map((l) => ({ quantity: l.quantity, unitCost: l.unitCost })), { taxRate: num(order.taxRate), pricesIncludeTax: order.pricesIncludeTax }),
        receipt: receiptState(lines.map((l) => ({ id: l.id, quantity: l.quantity, received: l.received }))),
        anyReceived: lines.some((l) => l.received > 0),
        invoices: order.supplierInvoices.map((i) => ({ ...i, postDate: iso(i.postDate)!, total: num(i.total) })),
    };
}

export type OrderRecord = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function listSupplierInvoices(db: TenantDb, opts: { unpaidOnly?: boolean } = {}) {
    const rows = await db.supplierInvoice.findMany({
        where: opts.unpaidOnly ? { state: "PROCESSED" } : {},
        orderBy: [{ postDate: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
            id: true, supplierNumber: true, otherReference: true, state: true, postDate: true, dueDate: true, total: true,
            supplier: { select: { id: true, companyName: true } },
            order: { select: { id: true, number: true } },
            _count: { select: { lines: true } },
        },
    });
    return rows.map((r) => ({ ...r, postDate: iso(r.postDate)!, dueDate: iso(r.dueDate), total: num(r.total), lineCount: r._count.lines }));
}

export async function getSupplierInvoice(db: TenantDb, id: string) {
    const invoice = await db.supplierInvoice.findUnique({
        where: { id },
        select: {
            id: true, supplierNumber: true, otherReference: true, state: true, postDate: true, dueDate: true,
            taxName: true, taxRate: true, pricesIncludeTax: true, freight: true, subtotal: true, taxTotal: true, total: true,
            note: true, processedAt: true, voidedAt: true, voidReason: true,
            supplier: { select: { id: true, companyName: true } },
            order: { select: { id: true, number: true } },
            createdBy: { select: { user: { select: { firstName: true } } } },
            lines: {
                orderBy: { sortOrder: "asc" },
                select: {
                    id: true, productId: true, itemCode: true, description: true, quantity: true, unitCost: true, taxExempt: true,
                    orderLineId: true, newSellPrice: true, note: true,
                    product: { select: { id: true, itemCode: true, description: true, costExTax: true, retailPrice: true } },
                    document: { select: { id: true, jobNumber: true, number: true } },
                },
            },
        },
    });
    if (!invoice) return null;
    return {
        ...invoice,
        postDate: iso(invoice.postDate)!, dueDate: iso(invoice.dueDate),
        taxRate: num(invoice.taxRate), freight: num(invoice.freight),
        subtotal: num(invoice.subtotal), taxTotal: num(invoice.taxTotal), total: num(invoice.total),
        lines: invoice.lines.map((l) => ({
            id: l.id, productId: l.productId, itemCode: l.itemCode, description: l.description,
            quantity: num(l.quantity), unitCost: num(l.unitCost), taxExempt: l.taxExempt, orderLineId: l.orderLineId,
            newSellPrice: l.newSellPrice ? num(l.newSellPrice) : null, note: l.note,
            documentId: l.document?.id ?? null, jobNumber: l.document?.jobNumber ?? l.document?.number ?? null,
            currentCost: l.product ? num(l.product.costExTax) : null,
            currentPrice: l.product ? num(l.product.retailPrice) : null,
        })),
    };
}

export type SupplierInvoiceRecord = NonNullable<Awaited<ReturnType<typeof getSupplierInvoice>>>;

/** What the order and receipt screens pick from. */
export async function purchasingOptions(db: TenantDb) {
    const [suppliers, products, jobs] = await Promise.all([
        db.supplier.findMany({ where: { archivedAt: null }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
        db.product.findMany({ where: { archivedAt: null }, orderBy: { itemCode: "asc" }, take: 500, select: { id: true, itemCode: true, description: true, costExTax: true, retailPrice: true } }),
        db.document.findMany({
            where: { type: { in: ["JOB_CARD", "BOOKING"] }, state: "DRAFT" },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: { id: true, jobNumber: true, number: true, customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { plate: true } } },
        }),
    ]);
    return {
        suppliers,
        products: products.map((p) => ({ id: p.id, itemCode: p.itemCode, description: p.description, cost: num(p.costExTax), price: num(p.retailPrice) })),
        jobs: jobs.map((j) => ({
            id: j.id,
            label: [j.jobNumber ?? j.number, j.customer ? `${j.customer.firstName} ${j.customer.lastName}`.trim() : null, j.vehicle?.plate].filter(Boolean).join(" · "),
        })),
    };
}
