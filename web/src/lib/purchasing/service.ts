import "server-only";
import { Prisma, type Tenant } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { costTotals, orderStateAfterReceipt, outstanding, processInvoiceError, unitCostExTax } from "@/lib/purchasing/rules";
import { applyMatrixToProduct } from "@/lib/products/matrix-service";

/**
 * Buying, inside transactions. The shape follows what the benchmark's payables
 * side does well and avoids what it does badly: the order is a commitment that
 * moves nothing, the supplier invoice is what receives goods, receipt is
 * matched line by line, and no balance is denormalised onto a header where it
 * can go stale.
 */

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const day = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

export type OrderLineInput = {
    id?: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitCost: number;
    documentId: string | null;
    dueDate?: string | null;
    note?: string | null;
};

export type OrderInput = {
    supplierId: string;
    orderDate: string;
    dueDate?: string | null;
    reference?: string | null;
    note?: string | null;
    lines: OrderLineInput[];
};

/** The order number is allocated when it is first saved, so the supplier can be told it before anything arrives. */
export async function saveOrder(tx: TenantTx, tenant: Tenant, membershipId: string, id: string | null, input: OrderInput): Promise<string> {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } });
    if (!supplier) throw new Error("Choose a supplier.");
    const products = await productSnapshot(tx, input.lines);

    let orderId = id;
    if (orderId) {
        const existing = await tx.purchaseOrder.findUnique({ where: { id: orderId }, select: { state: true } });
        if (!existing) throw new Error("That order is no longer there.");
        if (existing.state === "CANCELLED" || existing.state === "RECEIVED") throw new Error("This order is closed, so its lines cannot change.");
        await tx.purchaseOrder.update({
            where: { id: orderId },
            data: { supplierId: input.supplierId, orderDate: day(input.orderDate) ?? new Date(), dueDate: day(input.dueDate), reference: input.reference ?? null, note: input.note ?? null },
        });
    } else {
        const number = await allocateNumber(tx, tenant.id, "PURCHASE_ORDER");
        const created = await tx.purchaseOrder.create({
            data: {
                tenantId: tenant.id, number, supplierId: input.supplierId, orderDate: day(input.orderDate) ?? new Date(), dueDate: day(input.dueDate),
                reference: input.reference ?? null, note: input.note ?? null, createdById: membershipId,
                taxName: tenant.taxName, taxRate: tenant.purchaseTaxRate, pricesIncludeTax: false,
            },
            select: { id: true },
        });
        orderId = created.id;
    }

    // Lines that goods have already arrived against cannot be dropped: the receipt points at them.
    const received = await receivedByOrderLine(tx, orderId);
    const keep = new Set(input.lines.map((l) => l.id).filter((x): x is string => !!x));
    const existingLines = await tx.purchaseOrderLine.findMany({ where: { orderId }, select: { id: true } });
    for (const line of existingLines) {
        if (keep.has(line.id)) continue;
        if ((received.get(line.id) ?? 0) !== 0) throw new Error("A line that has already been received cannot be removed.");
        await tx.purchaseOrderLine.delete({ where: { id: line.id } });
    }

    let sortOrder = 0;
    for (const line of input.lines) {
        const product = line.productId ? products.get(line.productId) : null;
        const data = {
            sortOrder: sortOrder++, productId: product?.id ?? null, itemCode: product?.itemCode ?? null,
            description: line.description.trim() || product?.description || "Item",
            quantity: line.quantity, unitCost: line.unitCost, documentId: line.documentId, dueDate: day(line.dueDate), note: line.note ?? null,
        };
        if (line.id && keep.has(line.id)) await tx.purchaseOrderLine.update({ where: { id: line.id }, data });
        else await tx.purchaseOrderLine.create({ data: { ...data, tenantId: tenant.id, orderId } });
    }
    return orderId;
}

async function productSnapshot(tx: TenantTx, lines: { productId: string | null }[]) {
    const ids = [...new Set(lines.map((l) => l.productId).filter((x): x is string => !!x))];
    const rows = ids.length ? await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, itemCode: true, description: true } }) : [];
    if (rows.length !== ids.length) throw new Error("One of those products is no longer there.");
    return new Map(rows.map((r) => [r.id, r]));
}

/** How much has arrived against each line of an order, counted from processed supplier invoices. */
export async function receivedByOrderLine(tx: TenantTx | TenantDb, orderId: string): Promise<Map<string, number>> {
    const rows = await tx.supplierInvoiceLine.findMany({
        where: { orderLine: { orderId }, invoice: { state: { in: ["PROCESSED", "CLOSED"] } } },
        select: { orderLineId: true, quantity: true },
    });
    const out = new Map<string, number>();
    for (const row of rows) {
        if (!row.orderLineId) continue;
        out.set(row.orderLineId, (out.get(row.orderLineId) ?? 0) + num(row.quantity));
    }
    return out;
}

export async function setOrderState(tx: TenantTx, id: string, state: "ORDERED" | "CANCELLED" | "SUGGESTED"): Promise<void> {
    const order = await tx.purchaseOrder.findUnique({ where: { id }, select: { state: true, _count: { select: { lines: true } } } });
    if (!order) throw new Error("That order is no longer there.");
    if (order.state === "RECEIVED") throw new Error("Everything on this order has arrived.");
    if (state === "ORDERED" && order._count.lines === 0) throw new Error("Add a line before sending the order.");
    await tx.purchaseOrder.update({
        where: { id },
        data: { state, orderedAt: state === "ORDERED" ? new Date() : undefined, cancelledAt: state === "CANCELLED" ? new Date() : null },
    });
}

/** Start the receipt: a draft supplier invoice carrying what is still outstanding on the order. */
export async function receiptFromOrder(tx: TenantTx, tenant: Tenant, membershipId: string, orderId: string, postDate: Date): Promise<string> {
    const order = await tx.purchaseOrder.findUnique({
        where: { id: orderId },
        select: { id: true, supplierId: true, number: true, state: true, lines: { orderBy: { sortOrder: "asc" }, select: { id: true, productId: true, itemCode: true, description: true, quantity: true, unitCost: true, documentId: true } } },
    });
    if (!order) throw new Error("That order is no longer there.");
    if (order.state === "CANCELLED") throw new Error("That order was cancelled.");
    const received = await receivedByOrderLine(tx, orderId);

    const invoice = await tx.supplierInvoice.create({
        data: {
            tenantId: tenant.id, supplierId: order.supplierId, supplierNumber: "", postDate, orderId: order.id,
            taxName: tenant.taxName, taxRate: tenant.purchaseTaxRate, pricesIncludeTax: false, createdById: membershipId,
            note: order.number ? `Against order ${order.number}` : null,
        },
        select: { id: true },
    });

    let sortOrder = 0;
    for (const line of order.lines) {
        const left = outstanding({ id: line.id, quantity: num(line.quantity), received: received.get(line.id) ?? 0 });
        if (left <= 0) continue;
        await tx.supplierInvoiceLine.create({
            data: {
                tenantId: tenant.id, invoiceId: invoice.id, sortOrder: sortOrder++, productId: line.productId, itemCode: line.itemCode,
                description: line.description, quantity: left, unitCost: line.unitCost, orderLineId: line.id, documentId: line.documentId,
            },
        });
    }
    await recalculateInvoice(tx, invoice.id);
    return invoice.id;
}

export type InvoiceLineInput = {
    id?: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitCost: number;
    taxExempt: boolean;
    orderLineId: string | null;
    documentId: string | null;
    newSellPrice: number | null;
    note?: string | null;
};

export type InvoiceInput = {
    supplierId: string;
    supplierNumber: string;
    otherReference?: string | null;
    postDate: string;
    dueDate?: string | null;
    taxRate: number;
    pricesIncludeTax: boolean;
    freight: number;
    note?: string | null;
    lines: InvoiceLineInput[];
};

export async function saveInvoice(tx: TenantTx, tenant: Tenant, membershipId: string, id: string | null, input: InvoiceInput): Promise<string> {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } });
    if (!supplier) throw new Error("Choose a supplier.");
    const products = await productSnapshot(tx, input.lines);

    const header = {
        supplierId: input.supplierId, supplierNumber: input.supplierNumber.trim(), otherReference: input.otherReference ?? null,
        postDate: day(input.postDate) ?? new Date(), dueDate: day(input.dueDate), taxRate: input.taxRate,
        pricesIncludeTax: input.pricesIncludeTax, freight: input.freight, note: input.note ?? null,
    };

    let invoiceId = id;
    try {
        if (invoiceId) {
            const existing = await tx.supplierInvoice.findUnique({ where: { id: invoiceId }, select: { state: true } });
            if (!existing) throw new Error("That supplier invoice is no longer there.");
            if (existing.state !== "DRAFT") throw new Error("A processed supplier invoice cannot be changed. Void it and enter it again.");
            await tx.supplierInvoice.update({ where: { id: invoiceId }, data: header });
        } else {
            const created = await tx.supplierInvoice.create({
                data: { ...header, tenantId: tenant.id, taxName: tenant.taxName, createdById: membershipId },
                select: { id: true },
            });
            invoiceId = created.id;
        }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error(`That supplier's invoice ${input.supplierNumber.trim()} is already entered.`);
        }
        throw error;
    }

    const keep = new Set(input.lines.map((l) => l.id).filter((x): x is string => !!x));
    await tx.supplierInvoiceLine.deleteMany({ where: { invoiceId, id: { notIn: [...keep] } } });
    let sortOrder = 0;
    for (const line of input.lines) {
        const product = line.productId ? products.get(line.productId) : null;
        const data = {
            sortOrder: sortOrder++, productId: product?.id ?? null, itemCode: product?.itemCode ?? null,
            description: line.description.trim() || product?.description || "Item",
            quantity: line.quantity, unitCost: line.unitCost, taxExempt: line.taxExempt,
            orderLineId: line.orderLineId, documentId: line.documentId, newSellPrice: line.newSellPrice, note: line.note ?? null,
        };
        if (line.id && keep.has(line.id)) await tx.supplierInvoiceLine.update({ where: { id: line.id }, data });
        else await tx.supplierInvoiceLine.create({ data: { ...data, tenantId: tenant.id, invoiceId } });
    }
    await recalculateInvoice(tx, invoiceId);
    return invoiceId;
}

/** Totals are stored because a supplier document does not change after processing; they are still recomputed from the lines on every save. */
export async function recalculateInvoice(tx: TenantTx, invoiceId: string): Promise<{ subtotal: number; taxTotal: number; total: number }> {
    const invoice = await tx.supplierInvoice.findUnique({
        where: { id: invoiceId },
        select: { taxRate: true, pricesIncludeTax: true, freight: true, lines: { select: { quantity: true, unitCost: true, taxExempt: true } } },
    });
    if (!invoice) throw new Error("That supplier invoice is no longer there.");
    const totals = costTotals(
        invoice.lines.map((l) => ({ quantity: num(l.quantity), unitCost: num(l.unitCost), taxExempt: l.taxExempt })),
        { taxRate: num(invoice.taxRate), pricesIncludeTax: invoice.pricesIncludeTax, freight: num(invoice.freight) },
    );
    await tx.supplierInvoice.update({ where: { id: invoiceId }, data: totals });
    return totals;
}

export type ReceiptResult = { total: number; received: number; repriced: number };

/**
 * Process a supplier invoice: the goods go on the shelf at what they cost,
 * the product's cost price is brought up to date, and any new sell price
 * decided on receipt is applied.
 */
export async function processInvoice(tx: TenantTx, tenant: Tenant, who: { membershipId: string; userId: string }, invoiceId: string): Promise<ReceiptResult> {
    const invoice = await tx.supplierInvoice.findUnique({
        where: { id: invoiceId },
        select: {
            id: true, state: true, supplierNumber: true, postDate: true, taxRate: true, pricesIncludeTax: true, orderId: true,
            lines: {
                orderBy: { sortOrder: "asc" },
                select: {
                    id: true, quantity: true, unitCost: true, taxExempt: true, newSellPrice: true, orderLineId: true,
                    product: { select: { id: true, itemCode: true, type: true, isService: true, dontUpdateQty: true, costExTax: true, retailPrice: true, priceMatrixId: true } },
                },
            },
        },
    });
    if (!invoice) throw new Error("That supplier invoice is no longer there.");
    const problem = processInvoiceError(invoice.state, invoice.lines.length, invoice.supplierNumber);
    if (problem) throw new Error(problem);

    const totals = await recalculateInvoice(tx, invoiceId);
    const already = new Set(
        (await tx.stockMovement.findMany({ where: { supplierInvoiceLineId: { in: invoice.lines.map((l) => l.id) } }, select: { supplierInvoiceLineId: true } }))
            .map((m) => m.supplierInvoiceLineId),
    );

    let received = 0;
    let repriced = 0;
    for (const line of invoice.lines) {
        const product = line.product;
        if (!product) continue;
        const cost = unitCostExTax(num(line.unitCost), num(invoice.taxRate), invoice.pricesIncludeTax, line.taxExempt);
        const tracked = !product.isService && !product.dontUpdateQty && product.type !== "LABOUR" && product.type !== "SUBLET";
        if (tracked && !already.has(line.id) && num(line.quantity) !== 0) {
            await tx.stockMovement.create({
                data: {
                    tenantId: tenant.id, productId: product.id, kind: "PURCHASE", quantity: line.quantity, unitCost: cost,
                    supplierInvoiceLineId: line.id, at: invoice.postDate, byId: who.membershipId,
                    note: `Supplier invoice ${invoice.supplierNumber}`,
                },
            });
            await tx.product.update({ where: { id: product.id }, data: { qtyOnHand: { increment: line.quantity } } });
            received++;
        }
        // What it costs now is what it just cost, and a sell price decided on receipt applies with it.
        const sell = line.newSellPrice ? num(line.newSellPrice) : null;
        if (cost !== num(product.costExTax) || sell !== null) {
            await tx.product.update({ where: { id: product.id }, data: { costExTax: cost, ...(sell !== null ? { retailPrice: sell } : {}) } });
            if (sell !== null) repriced++;
        }
        // A product on a price matrix follows the new cost by itself, unless somebody
        // decided a price on the receipt — a person's decision outranks the bands.
        if (sell === null && product.priceMatrixId) {
            const moved = await applyMatrixToProduct(tx, product.id, cost);
            if (moved) repriced++;
        }
    }

    await tx.supplierInvoice.update({ where: { id: invoiceId }, data: { state: "PROCESSED", processedAt: new Date() } });

    if (invoice.orderId) {
        const order = await tx.purchaseOrder.findUnique({ where: { id: invoice.orderId }, select: { state: true, lines: { select: { id: true, quantity: true } } } });
        if (order) {
            const receivedNow = await receivedByOrderLine(tx, invoice.orderId);
            const next = orderStateAfterReceipt(order.state, order.lines.map((l) => ({ id: l.id, quantity: num(l.quantity), received: receivedNow.get(l.id) ?? 0 })));
            if (next !== order.state) await tx.purchaseOrder.update({ where: { id: invoice.orderId }, data: { state: next } });
        }
    }

    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: who.userId, entityType: "SupplierInvoice", entityId: invoiceId, action: "PROCESSED", diff: { total: totals.total, received, repriced } },
    });
    return { total: totals.total, received, repriced };
}

/** Voiding takes the goods back off the shelf; the invoice stays as a record. */
export async function voidInvoice(tx: TenantTx, tenant: Tenant, who: { membershipId: string; userId: string }, invoiceId: string, reason: string): Promise<void> {
    const invoice = await tx.supplierInvoice.findUnique({ where: { id: invoiceId }, select: { state: true, lines: { select: { id: true } } } });
    if (!invoice) throw new Error("That supplier invoice is no longer there.");
    if (invoice.state === "VOID") throw new Error("Already voided.");
    if (invoice.state === "CLOSED") throw new Error("This invoice has been paid. Reverse the payment first.");

    const movements = await tx.stockMovement.findMany({
        where: { supplierInvoiceLineId: { in: invoice.lines.map((l) => l.id) }, kind: "PURCHASE" },
        select: { productId: true, quantity: true, unitCost: true },
    });
    for (const movement of movements) {
        const quantity = new Prisma.Decimal(movement.quantity).negated();
        await tx.stockMovement.create({
            data: { tenantId: tenant.id, productId: movement.productId, kind: "VOID_REVERSAL", quantity, unitCost: movement.unitCost, note: "Supplier invoice voided", byId: who.membershipId },
        });
        await tx.product.update({ where: { id: movement.productId }, data: { qtyOnHand: { increment: quantity } } });
    }
    await tx.supplierInvoice.update({ where: { id: invoiceId }, data: { state: "VOID", voidedAt: new Date(), voidReason: reason.trim().slice(0, 200) } });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: who.userId, entityType: "SupplierInvoice", entityId: invoiceId, action: "VOIDED", diff: { reason, stockReversed: movements.length } } });
}
