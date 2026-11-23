import "server-only";
import type { TenantTx } from "@/lib/tenant-db";
import { unitCostExTax } from "@/lib/purchasing/rules";

/**
 * How much of each requisition line has happened, read from the records that
 * say so rather than kept beside them: what has been handed over, moved to a
 * purchase requisition, ordered, and received. A number stored next to the
 * movements is a number that can disagree with them.
 */

const round = (n: number) => Math.round(n * 100) / 100;

type Db = Pick<TenantTx, "requisitionIssueLine" | "requisitionLine" | "purchaseOrderLine" | "supplierInvoiceLine">;

/** What has been handed over against each line, from stores or as it arrived. */
export async function issuedByLine(db: Pick<Db, "requisitionIssueLine">, lineIds: string[]): Promise<Map<string, number>> {
    if (!lineIds.length) return new Map();
    const sums = await db.requisitionIssueLine.groupBy({ by: ["requisitionLineId"], where: { requisitionLineId: { in: lineIds } }, _sum: { quantity: true } });
    return new Map(sums.map((s) => [s.requisitionLineId, s._sum.quantity?.toNumber() ?? 0]));
}

/** What has been moved from each stores line to a purchase requisition. */
export async function movedByLine(db: Pick<Db, "requisitionLine">, lineIds: string[]): Promise<Map<string, number>> {
    if (!lineIds.length) return new Map();
    const rows = await db.requisitionLine.groupBy({ by: ["sourceLineId"], where: { sourceLineId: { in: lineIds } }, _sum: { quantity: true } });
    return new Map(rows.map((r) => [r.sourceLineId!, r._sum.quantity?.toNumber() ?? 0]));
}

/** What is on order against each line: purchase order lines of orders not cancelled. */
export async function orderedByLine(db: Pick<Db, "purchaseOrderLine">, lineIds: string[]): Promise<Map<string, number>> {
    if (!lineIds.length) return new Map();
    const rows = await db.purchaseOrderLine.groupBy({ by: ["requisitionLineId"], where: { requisitionLineId: { in: lineIds }, order: { state: { not: "CANCELLED" } } }, _sum: { quantity: true } });
    return new Map(rows.map((r) => [r.requisitionLineId!, r._sum.quantity?.toNumber() ?? 0]));
}

/**
 * What has arrived against each line, and at what cost excluding VAT, read
 * from processed supplier invoices that receive the orders made for it.
 */
export async function receivedByLine(db: Pick<Db, "supplierInvoiceLine">, lineIds: string[]): Promise<Map<string, { quantity: number; unitCost: number }>> {
    if (!lineIds.length) return new Map();
    const rows = await db.supplierInvoiceLine.findMany({
        where: { orderLine: { requisitionLineId: { in: lineIds } }, invoice: { state: { in: ["PROCESSED", "CLOSED"] } } },
        select: { quantity: true, unitCost: true, taxExempt: true, orderLine: { select: { requisitionLineId: true } }, invoice: { select: { taxRate: true, pricesIncludeTax: true } } },
    });
    const sums = new Map<string, { quantity: number; value: number }>();
    for (const r of rows) {
        const id = r.orderLine!.requisitionLineId!;
        const q = r.quantity.toNumber();
        const cost = unitCostExTax(r.unitCost.toNumber(), r.invoice.taxRate.toNumber(), r.invoice.pricesIncludeTax, r.taxExempt);
        const s = sums.get(id) ?? { quantity: 0, value: 0 };
        sums.set(id, { quantity: s.quantity + q, value: s.value + q * cost });
    }
    return new Map([...sums].map(([id, s]) => [id, { quantity: round(s.quantity), unitCost: s.quantity ? round(s.value / s.quantity) : 0 }]));
}

